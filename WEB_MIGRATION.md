# CrystalMedia Browser Web Application Migration

## Full project structure

```text
CrystalMedia_Web/
├── index.html                  # Browser entry point for GitHub/Cloudflare/Vercel static hosting
├── package.json                # Vite scripts for local dev/build/preview
├── package-lock.json           # Locked JavaScript dependency graph
├── src/
│   ├── main.js                 # Terminal emulator, starfield, menus, command shell, compatibility flows
│   └── styles.css              # Termux/Command Prompt-style dark terminal recreation
├── CrystalMedia.py             # Original Python CLI retained for reference/native use
├── crystalmedia/               # Original Python package modules retained
├── vendor/exportify/           # Original Exportify vendor files retained
└── WEB_MIGRATION.md            # Migration, compatibility, and deployment documentation
```

## Dependency migration table

| Original dependency / feature | Browser replacement | Status | Notes |
|---|---|---:|---|
| `rich`, `Live`, `Panel`, `Progress` | HTML `<pre>`, CSS terminal chrome, JavaScript progress renderer | Ported | Preserves fixed panels, log area, progress bar, prompt styling, and dark theme. |
| `pyfiglet` | Embedded CrystalMedia ASCII art string | Ported | Avoids browser runtime font dependency while preserving CLI splash style. |
| `StarfieldBackground` Python thread | `Starfield` JavaScript animation loop | Ported | Uses projection math, `.`/`*`/`+` depth tokens, resize tracking, and 30 FPS render loop. |
| `msvcrt`, `tty`, `termios`, `select` keyboard handling | Browser `keydown` events | Ported with limits | Supports arrows, Enter, Ctrl+C, backspace, command history. Global hooks are intentionally unavailable. |
| `yt-dlp` | Browser-safe simulated workflow plus optional backend recommendation | Limited | Browsers cannot run yt-dlp, ffmpeg, cookies-from-browser, or arbitrary process execution safely. |
| `ffmpeg` | Optional `ffmpeg.wasm` or separate backend | Limited | Not bundled because large media transcoding is unreliable and expensive in static hosting. |
| `spotdl` | Spotify oEmbed/Exportify CSV workflow concepts | Partial | Playlist metadata path is represented through integrated Exportify guidance and CSV-compatible flow. |
| `mutagen` ID3 writing | Optional backend or client-side metadata libraries | Limited | Direct metadata mutation of remote downloads is constrained by File API/user file selection. |
| `urllib`, `json`, `csv` | `fetch`, browser File API, custom command flow | Ported where possible | Network operations that require CORS-friendly endpoints can run in browser; protected media extraction needs backend. |
| Filesystem output tree | Browser Downloads/user-selected files | Replaced | Static hosts cannot write arbitrary folders such as `CrystalMedia_output/`. |
| Exportify helper | In-app `exportify` command and retained vendor files | Integrated | Users can export CSV from Exportify and use the browser app workflow. |

## Feature compatibility report

| Feature | Browser web app status | Compatibility details |
|---|---:|---|
| Main menu, mode selection, quality/bitrate selection | Supported | Keyboard navigation mirrors the CLI: `↑`, `↓`, `Enter`, `Ctrl+C`. |
| ASCII CrystalMedia splash | Supported | Rendered inside the browser terminal. |
| Animated starfield / particles | Supported | JavaScript implementation preserves the original terminal particle effect. |
| Terminal prompt, scrollback, command history | Supported | `help`, `menu`, `youtube`, `music`, `spotify`, `exportify`, `compat`, `deps`, and `clear` commands are available. |
| ANSI-like color/dark terminal style | Supported visually | CSS recreates the pastel blue-on-black terminal aesthetic; the current renderer is plain text plus themed panels. |
| YouTube MP4/MP3 real downloads | Requires backend | `yt-dlp`, ffmpeg, browser cookies, signature solving, and filesystem writes are process-level tasks that static web pages cannot perform. |
| Spotify playlist Exportify flow | Browser-compatible | The web app documents and integrates the Exportify-first workflow. A future enhancement can add drag-and-drop CSV ingestion. |
| Spotify single track metadata | Requires CORS-friendly API/backend for reliability | Spotify oEmbed can be proxied; direct calls may be blocked by CORS or rate limits. |
| Lyrics/subtitle/album art embedding | Requires backend for full parity | Browser can collect metadata but cannot safely rewrite downloaded MP3s without explicit user file access and extra libraries. |
| Browser cookie extraction / age-restricted fallback | Unsupported in static browser | Browser security correctly prevents reading other browser profiles/cookies. |
| Global keyboard/mouse hooks and process injection | Unsupported | Replaced with focused terminal keyboard controls. |

## Why a backend may be required

A static browser app can recreate CrystalMedia's terminal UI and user flow, but real media extraction needs capabilities unavailable to GitHub Pages, Cloudflare Pages static assets, or Vercel static hosting:

1. Spawning `yt-dlp`, ffmpeg, Deno, or Node subprocesses.
2. Writing arbitrary files and output directory trees.
3. Reading browser profile cookies for age-restricted media.
4. Bypassing CORS restrictions for protected media and metadata endpoints.
5. Running long-lived downloads without tab lifecycle interruptions.

Recommended full-parity architecture: keep this frontend static and add a separate Node/Python backend endpoint that queues `yt-dlp` jobs, streams progress as Server-Sent Events or WebSockets, and returns completed files through authenticated download URLs.

## Deployment instructions

### Local development

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
```

The static output is written to `dist/`.

### GitHub Pages

1. Run `npm run build`.
2. Publish the `dist/` directory with GitHub Actions or Pages.
3. If deploying under a repository subpath, configure Vite `base` as needed in a future `vite.config.js`.

### Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`

### Vercel

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

## Visual recreation notes

The browser app recreates the reference terminal by combining:

- A dark Command Prompt/Termux-style browser shell.
- Monospace text and fixed-line terminal rendering.
- Pastel blue CrystalMedia ASCII art.
- Projection-style particle starfield using `.`, `*`, and `+` tokens.
- Blinking cursor, command prompt, history, and scrollback.
- Responsive layout that hides documentation controls on smaller screens.
