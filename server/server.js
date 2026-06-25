import express from 'express';
import cors from 'cors';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outRoot = process.env.CRYSTALMEDIA_OUTPUT || path.join(root, 'CrystalMedia_output', 'downloads');
const app = express();
const jobs = new Map();
mkdirSync(outRoot, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(root, 'dist')));
app.use('/downloads', express.static(outRoot, { fallthrough: false }));

function hasBinary(name) {
  return spawnSync(name, ['--version'], { stdio: 'ignore' }).status === 0;
}


function buildArgs({ url, category, mode, quality, bitrate, extras }) {
  const isPlaylist = mode === 'Playlist';
  const isMusic = category === 'YouTube Music (MP3)' || category === 'Spotify';
  const base = path.join(outRoot, category === 'YouTube Video (MP4)' ? 'YT VIDEO' : category === 'YouTube Music (MP3)' ? 'YT MUSIC' : 'SPOTIFY', isPlaylist ? 'Playlist' : 'Single');
  mkdirSync(base, { recursive: true });
  const args = ['--newline', '--no-colors', '--no-warnings', '--ignore-errors', '--retries', '10', '--fragment-retries', '10'];
  args.push('-o', path.join(base, isPlaylist ? '%(playlist_title)s/%(title)s.%(ext)s' : '%(title)s.%(ext)s'));
  if (category === 'Spotify') args.push(`ytsearch1:${url}`);
  else args.push(url);
  if (isMusic) {
    args.unshift('--extract-audio', '--audio-format', 'mp3', '--audio-quality', String(bitrate || '192'));
    if (extras) args.unshift('--embed-metadata', '--embed-thumbnail', '--convert-thumbnails', 'jpg');
  } else {
    const format = quality === 'Low (~360p)' ? 'bestvideo[height<=?360][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]' : quality === 'Medium (~480p–720p)' ? 'bestvideo[height<=?720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]' : quality === 'High (~720p–1080p)' ? 'bestvideo[height<=?1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]' : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
    args.unshift('-f', format, '--merge-output-format', 'mp4');
  }
  return { args, base };
}

function newestFile(dir) {
  let best = null;
  const walk = (d) => {
    for (const entry of readdirSyncSafe(d)) {
      const p = path.join(d, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (!best || st.mtimeMs > best.mtimeMs) best = { path: p, mtimeMs: st.mtimeMs };
    }
  };
  walk(dir);
  return best?.path || null;
}
function readdirSyncSafe(d) { try { return readdirSync(d); } catch { return []; } }

app.get('/api/status', (_req, res) => {
  res.json({ ok: true, ytDlp: hasBinary('yt-dlp'), ffmpeg: hasBinary('ffmpeg'), output: outRoot });
});

app.post('/api/download', (req, res) => {
  const { url, category, mode, quality, bitrate, extras } = req.body || {};
  if (!url || !category || !mode) return res.status(400).json({ error: 'url, category, and mode are required' });
  if (!hasBinary('yt-dlp')) return res.status(503).json({ error: 'yt-dlp is not installed on this server' });
  const id = crypto.randomUUID();
  const job = { id, status: 'running', pct: 0, logs: [], files: [], createdAt: Date.now() };
  jobs.set(id, job);
  const { args, base } = buildArgs({ url, category, mode, quality, bitrate, extras });
  job.logs.push(`$ yt-dlp ${args.join(' ')}`);
  const child = spawn('yt-dlp', args, { cwd: root, env: process.env });
  job.child = child;
  const handle = (chunk) => {
    for (const raw of String(chunk).split(/\r?\n/).filter(Boolean)) {
      const line = raw.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').trim();
      const pct = line.match(/(\d+(?:\.\d+)?)%/);
      if (pct) job.pct = Math.max(job.pct, Math.min(99, Number(pct[1])));
      job.logs.push(line);
      job.logs = job.logs.slice(-200);
    }
  };
  child.stdout.on('data', handle);
  child.stderr.on('data', handle);
  child.on('close', (code) => {
    job.status = code === 0 ? 'complete' : 'failed';
    job.pct = code === 0 ? 100 : job.pct;
    const file = newestFile(base);
    if (file) job.files.push({ name: path.basename(file), url: `/downloads/${path.relative(outRoot, file).split(path.sep).map(encodeURIComponent).join('/')}` });
    job.logs.push(code === 0 ? 'Download complete!' : `yt-dlp exited with code ${code}`);
  });
  res.json({ id });
});

app.get('/api/events/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = () => res.write(`data: ${JSON.stringify({ id: job.id, status: job.status, pct: job.pct, logs: job.logs.slice(-30), files: job.files })}\n\n`);
  send();
  const timer = setInterval(() => { send(); if (job.status !== 'running') { clearInterval(timer); res.end(); } }, 800);
  req.on('close', () => clearInterval(timer));
});

app.post('/api/exportify/parse', (req, res) => {
  const csv = String(req.body?.csv || '');
  const rows = parseCsv(csv);
  const queries = rows.map(row => `${row['Track Name'] || row.track_name || ''} ${row['Artist Name(s)'] || row.artist_names || row['Artist Name'] || ''}`.trim()).filter(Boolean);
  res.json({ count: queries.length, queries });
});

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const parseLine = (line) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out;
  };
  const head = parseLine(lines.shift() || '');
  return lines.map(l => Object.fromEntries(parseLine(l).map((v, i) => [head[i], v])));
}

const port = Number(process.env.PORT || 4174);
app.listen(port, () => console.log(`CrystalMedia web backend on http://localhost:${port}`));
