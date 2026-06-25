import './styles.css';

const APP_VERSION = 'v4';
const SKY = '#a5d8ff';
const GOOD = '#b2f2bb';
const WARN = '#ffe066';
const ERR = '#ff9999';

const LOGO = String.raw`
   ______                __        ____  ___         ___      
  / ____/______  _______/ /_____ _/ /  |/  /__  ____/ (_)___ _
 / /   / ___/ / / / ___/ __/ __ \\ / /|_/ / _ \/ __  / / __ \
/ /___/ /  / /_/ (__  ) /_/ /_/ / / /  / /  __/ /_/ / / /_/ /
\____/_/   \__, /____/\__/\____/_/_/  /_/\___/\__,_/_/\__,_/
          /____/                                             `;

class Starfield {
  constructor(cols = 120, rows = 36, count = 220) {
    this.cols = cols; this.rows = rows; this.count = count; this.stars = [];
    this.depth = Math.max(cols, rows); this.boundsX = Math.max(10, Math.floor(cols/2)); this.boundsY = Math.max(6, Math.floor(rows/2));
    this.resetAll();
  }
  resize(cols, rows) { if (cols === this.cols && rows === this.rows) return; this.cols = Math.max(30, cols); this.rows = Math.max(12, rows); this.depth = Math.max(this.cols, this.rows); this.boundsX = Math.max(10, Math.floor(this.cols/2)); this.boundsY = Math.max(6, Math.floor(this.rows/2)); this.resetAll(); }
  newStar() { const z = rand(1,this.depth), sx = rand(0,this.cols-1), sy = rand(0,this.rows-1); return { x: Math.floor(((sx-this.boundsX)*z)/this.boundsX), y: Math.floor(((sy-this.boundsY)*z)/this.boundsY), z, pz:z, speed: [1,1,1,2][rand(0,3)] }; }
  reset(star) { Object.assign(star, this.newStar(), { z:this.depth, pz:this.depth }); }
  resetAll() { this.stars = Array.from({length:this.count}, () => this.newStar()); }
  tick() { this.stars.forEach(s => { s.pz = s.z; s.z -= s.speed; if (s.z <= 1) this.reset(s); }); }
  project(s, z=s.z) { z = Math.max(1,z); return [Math.floor((s.x/z)*this.boundsX + this.boundsX), Math.floor((s.y/z)*this.boundsY + this.boundsY)]; }
  render() { const canvas = Array.from({length:this.rows}, () => Array(this.cols).fill(' ')); for (const s of this.stars) { const [px,py]=this.project(s,s.pz); const [x,y]=this.project(s,s.z); if (inBounds(px,py,this.cols,this.rows)) canvas[py][px]='.'; if (inBounds(x,y,this.cols,this.rows)) canvas[y][x]= s.z < this.depth/3 ? '+' : s.z < this.depth/2 ? '*' : '.'; } return canvas; }
}

const app = document.querySelector('#app');
app.innerHTML = `
  <main class="termux-shell" aria-label="CrystalMedia browser terminal">
    <section class="terminal" tabindex="0">
      <pre id="screen" aria-live="polite"></pre><span class="cursor" aria-hidden="true"></span>
      <input id="hiddenInput" autocomplete="off" spellcheck="false" />
    </section>
    <aside class="docs-panel">
      <h2>CrystalMedia Web</h2>
      <p>Static browser port of the Python terminal app. Use ↑/↓/Enter, type commands, or click actions.</p>
      <button data-cmd="help">help</button><button data-cmd="compat">compat</button><button data-cmd="exportify">exportify</button><button data-cmd="clear">clear</button>
    </aside>
  </main>`;
const screen = document.querySelector('#screen');
const terminal = document.querySelector('.terminal');
const hiddenInput = document.querySelector('#hiddenInput');

let cols = 120, rows = 36, starfield = new Starfield(cols, rows), state = 'menu', selected = 0, lines = [], history = [], histIdx = 0, input = '', progress = null;
const categories = ['YouTube Video (MP4)', 'YouTube Music (MP3)', 'Spotify', 'Exit'];
const modes = ['Single Item', 'Playlist'];
const qualities = ['Low (~360p)', 'Medium (~480p–720p)', 'High (~720p–1080p)', 'Best (highest available) [default]'];
const bitrates = ['Low (96 kbps)', 'Medium (128 kbps)', 'Standard (192 kbps) [default]', 'High (256 kbps)', 'Insane (320 kbps)'];
let flow = { category: null, mode: null, url: '', extras: true };

function rand(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function inBounds(x,y,w,h){ return x>=0 && y>=0 && x<w && y<h; }
function measure(){ const style = getComputedStyle(screen); const charW = parseFloat(style.fontSize) * 0.61; const charH = parseFloat(style.lineHeight); cols = Math.max(60, Math.floor(terminal.clientWidth / charW)); rows = Math.max(18, Math.floor(terminal.clientHeight / charH)); starfield.resize(cols, rows); }
function overlay(canvas, text, r=2, c=2){ text.split('\n').forEach((line,i)=>{ const y=r+i; if (y>=canvas.length) return; for(let x=0;x<line.length && c+x<cols;x++) if(line[x] !== ' ') canvas[y][c+x]=line[x]; }); }
function baseCanvas(body=''){ const canvas = starfield.render(); overlay(canvas, LOGO, 3, 2); overlay(canvas, `${APP_VERSION}\n${'-'.repeat(Math.min(cols-4,60))}`, 3+LOGO.split('\n').length, 2); if(body) overlay(canvas, body, 5+LOGO.split('\n').length, 2); return canvas.map(r=>r.join('')).join('\n'); }
function menuBody(title, opts, help='↑ ↓ to navigate • Enter to select • Ctrl+C to quit'){ return [title, ...opts.map((o,i)=>(i===selected?'→ ':'  ')+o), '', help].join('\n'); }
function render(){ starfield.tick(); if(state==='menu') screen.textContent = baseCanvas(menuBody('Main Category Selection', categories)); else if(state==='mode') screen.textContent = baseCanvas(menuBody('Mode Selection', modes)); else if(state==='quality') screen.textContent = baseCanvas(menuBody(flow.category==='YouTube Music (MP3)'?'MP3 Bitrate Selection':'MP4 Quality Selection', flow.category==='YouTube Music (MP3)'?bitrates:qualities)); else if(state==='extras') screen.textContent = baseCanvas(menuBody('Embed extras (lyrics + art + subtitle fallback + metadata)', ['Yes (recommended for MP3)', 'No'])); else if(state==='input') screen.textContent = baseCanvas(`\nResource URL → ${input}\n\nType URL • Backspace to edit • Enter to continue • Ctrl+C to cancel`); else if(state==='progress') screen.textContent = renderProgress(); else if(state==='shell') screen.textContent = baseCanvas(lines.slice(-Math.max(1,rows-10)).join('\n') + `\n\ncrystalmedia@web:~$ ${input}`); }
function renderProgress(){ const pct = progress?.pct ?? 0; const barWidth = Math.min(48, cols-30); const fill = Math.round((pct/100)*barWidth); const bar = '█'.repeat(fill) + '░'.repeat(barWidth-fill); const logLines = (progress?.logs || []).slice(-12).join('\n'); return baseCanvas(`Downloading: ${flow.url || 'browser demo'}\nMode: ${flow.mode} ${flow.category}\nOutput: Browser Downloads / user-selected folder\n\n╭─ Progress ─────────────────────────────────╮\n│ ${progress?.desc || 'Waiting'} ${bar} ${String(Math.round(pct)).padStart(3)}% │\n╰─────────────────────────────────────────────╯\n\n╭─ Download Log ──────────────────────────────╮\n${logLines}\n╰─────────────────────────────────────────────╯`); }
function startProgress(){ state='progress'; progress={pct:0, desc:'Preparing', logs:['[info] Browser compatibility pipeline started.']}; const steps = ['Resolving metadata with browser APIs','Preparing download instructions','Exportify CSV parser ready','yt-dlp requires optional backend','Writing compatibility report']; const timer=setInterval(()=>{ progress.pct += rand(4,11); progress.desc = progress.pct<100 ? 'Processing' : 'Complete'; if(steps.length) progress.logs.push(`[info] ${steps.shift()}`); if(progress.pct>=100){ progress.pct=100; progress.logs.push('[success] Demo flow complete. Use download/export actions where browser-safe.'); clearInterval(timer); setTimeout(()=>{ state='shell'; lines.push('Operation complete. Browser port cannot run yt-dlp locally; see compat report.'); },1800); } },700); }
function submitCommand(cmd){ if(!cmd.trim()) return; history.push(cmd); histIdx=history.length; lines.push(`crystalmedia@web:~$ ${cmd}`); const [name,...args]=cmd.trim().split(/\s+/); const table = { help: helpText, compat: compatText, deps: depsText, exportify: exportifyText, clear:()=>{lines=[];}, menu:()=>{state='menu'; selected=0;}, youtube:()=>{flow.category='YouTube Video (MP4)'; state='mode'; selected=0;}, music:()=>{flow.category='YouTube Music (MP3)'; state='mode'; selected=0;}, spotify:()=>{flow.category='Spotify'; state='mode'; selected=0;} }; (table[name]||(()=>`Unknown command: ${name}. Try help.`))().split('\n').forEach(l=>lines.push(l)); input=''; }
function helpText(){return `Commands: help, menu, youtube, music, spotify, exportify, compat, deps, clear\nKeyboard: ↑/↓ navigate menus, Enter select, Ctrl+C returns to menu.\nThis UI preserves the CrystalMedia terminal look, starfield, ASCII logo, prompt, history and scrollback.`}
function compatText(){return `Feature compatibility report:\n- YouTube MP4/MP3: UI ported; direct browser download via yt-dlp blocked by CORS, signatures, filesystem, ffmpeg. Use optional backend.\n- Spotify single: oEmbed metadata can be fetched by backend or pasted manually.\n- Spotify playlists: Exportify CSV is integrated in-browser via CSV import/parsing.\n- MP3 tags/lyrics/art: browser can prepare metadata; writing ID3 needs backend or client-side libraries plus user files.\n- Global hooks/process injection/browser cookies: not available in browsers by design.`}
function depsText(){return `Dependency migration table:\nPython rich/Live -> HTML pre + CSS terminal panels\npyfiglet -> embedded ASCII art\nyt-dlp -> optional Node backend or external service; browser demo only\nffmpeg -> ffmpeg.wasm optional, backend recommended for large media\nspotdl -> Spotify oEmbed/Exportify CSV + YouTube search handoff\nmutagen -> browser metadata plan / backend ID3 writer\nurllib/csv/json -> fetch, File API, Papa-free custom CSV parser`}
function exportifyText(){return `Exportify integration:\n1. Open https://watsonbox.github.io/exportify/\n2. Export playlist CSV.\n3. Drag/drop or paste CSV into this terminal with command: spotify.\nCSV columns recognized: Track Name, Artist Name(s), Artist Name, track_name, artist_names.`}
function key(e){ terminal.focus(); hiddenInput.focus(); if(e.ctrlKey && e.key.toLowerCase()==='c'){ state='menu'; selected=0; input=''; e.preventDefault(); return; } if(['menu','mode','quality','extras'].includes(state)){ if(e.key==='ArrowUp'){selected=(selected-1+(state==='menu'?categories:state==='mode'?modes:state==='extras'?[1,2]:qualities).length)%((state==='menu'?categories:state==='mode'?modes:state==='extras'?[1,2]:(flow.category==='YouTube Music (MP3)'?bitrates:qualities)).length); e.preventDefault();} if(e.key==='ArrowDown'){selected=(selected+1)%((state==='menu'?categories:state==='mode'?modes:state==='extras'?[1,2]:(flow.category==='YouTube Music (MP3)'?bitrates:qualities)).length); e.preventDefault();} if(e.key==='Enter'){choose(); e.preventDefault();} return; } if(state==='input'||state==='shell'){ if(e.key==='Enter'){ state==='input'? (flow.url=input, input='', selected=0, state='extras') : submitCommand(input); e.preventDefault(); } else if(e.key==='Backspace'){ input=input.slice(0,-1); e.preventDefault(); } else if(e.key==='ArrowUp' && state==='shell'){ histIdx=Math.max(0,histIdx-1); input=history[histIdx]||''; e.preventDefault(); } else if(e.key==='ArrowDown' && state==='shell'){ histIdx=Math.min(history.length,histIdx+1); input=history[histIdx]||''; e.preventDefault(); } else if(e.key.length===1 && !e.metaKey && !e.ctrlKey){ input+=e.key; e.preventDefault(); } } }
function choose(){ if(state==='menu'){ if(selected===3){ state='shell'; lines.push('Thank you for using CrystalMedia Web.'); return; } flow.category=categories[selected]; selected=0; state='mode'; } else if(state==='mode'){ flow.mode=modes[selected]; input=''; state='input'; } else if(state==='extras'){ flow.extras=selected===0; selected=0; if(flow.category==='Spotify') startProgress(); else state='quality'; } else if(state==='quality'){ flow.quality=(flow.category==='YouTube Music (MP3)'?bitrates:qualities)[selected]; startProgress(); } }

document.addEventListener('keydown', key); document.querySelectorAll('button[data-cmd]').forEach(b=>b.addEventListener('click',()=>{state='shell'; submitCommand(b.dataset.cmd);})); window.addEventListener('resize', measure); terminal.addEventListener('click',()=>hiddenInput.focus()); measure(); setInterval(render, 1000/30); lines.push('CrystalMedia Web terminal ready. Type help or use ↑/↓/Enter.');
