# CrystalMedia Browser Web Application Migration

## Full project structure

```text
CrystalMedia_Web/
├── index.html                  # Browser entry point
├── package.json                # Vite frontend + Node backend scripts
├── package-lock.json           # Locked JavaScript dependency graph
├── server/
│   └── server.js               # Native yt-dlp/ffmpeg backend with SSE progress
├── src/
│   ├── main.js                 # Terminal emulator, FIGlet splash, menus, URL input, live progress
│   └── styles.css              # Full-width Termux/Command Prompt-style dark terminal
├── CrystalMedia.py             # Original Python CLI retained for native reference
├── crystalmedia/               # Original Python modules retained
├── vendor/exportify/           # Original Exportify vendor files retained
└── WEB_MIGRATION.md            # Migration, compatibility, and deployment documentation
```

## Dependency migration table

| Original dependency / feature | Browser/backend replacement | Status | Notes |
|---|---|---:|---|
| `rich`, `Live`, `Panel`, `Progress` | HTML `<pre>`, CSS terminal chrome, JavaScript progress renderer | Ported | Preserves fixed panels, log area, progress bar, prompt styling, and dark theme. |
| `pyfiglet` | `figlet` npm package using the Slant FIGlet font | Ported | The web app generates the CrystalMedia splash from a FIGlet implementation instead of a hard-coded-only logo. |
| `StarfieldBackground` Python thread | `Starfield` JavaScript animation loop | Ported | Uses projection math, `.`/`*`/`+` depth tokens, resize tracking, and 30 FPS render loop. |
| `msvcrt`, `tty`, `termios`, `select` keyboard handling | Browser `keydown` events | Ported with browser limits | Supports arrows, Enter, Ctrl+C, backspace, editable URL input, command history, and scrollback. |
| `yt-dlp` | Included Node backend spawning native `yt-dlp` | Functional with backend | Mirrors online yt-dlp sites that use a server process behind a browser UI; progress streams back via Server-Sent Events. |
| `ffmpeg` | Native `ffmpeg` installed beside `yt-dlp` on the backend | Functional with backend | Required for merge/remux/audio extraction just like the CLI. |
| `spotdl` | Spotify metadata/search flow through `yt-dlp` and Exportify CSV helper endpoint | Partial | Spotify mode submits metadata/search terms to `yt-dlp` as `ytsearch1:<query>`. |
| `mutagen` ID3 writing | `yt-dlp --embed-metadata --embed-thumbnail` | Partial | Covers common metadata/art embedding; advanced synced lyrics still needs a dedicated backend extension. |
| `urllib`, `json`, `csv` | `fetch`, Express JSON APIs, `/api/exportify/parse` CSV parsing | Ported | Browser-to-backend APIs replace Python blocking I/O. |
| Filesystem output tree | Backend `CrystalMedia_output/downloads` exposed as `/downloads` | Ported with backend | Static-only hosts cannot write arbitrary folders, so the backend owns the output tree. |
| Exportify helper | Retained vendor files plus `/api/exportify/parse` and terminal `exportify` command | Integrated | Users can export CSV and feed parsed track queries into Spotify mode. |

## Feature compatibility report

| Feature | Web app status | Compatibility details |
|---|---:|---|
| Main menu, mode selection, quality/bitrate selection | Supported | Keyboard navigation mirrors the CLI: `↑`, `↓`, `Enter`, `Ctrl+C`. |
| Editable URL prompt | Supported | The Resource URL area accepts normal typing, backspace, and Enter. |
| ASCII CrystalMedia splash | Supported | Rendered from the JS FIGlet package with the Slant font style. |
| Animated starfield / particles | Supported | JavaScript implementation preserves the original terminal particle effect. |
| Terminal prompt, scrollback, command history | Supported | Commands include `help`, `menu`, `youtube`, `music`, `spotify`, `exportify`, `compat`, `deps`, `backend`, `open`, and `clear`. |
| Real YouTube MP4/MP3 downloads | Functional with backend | Requires `npm run server` on a host with `yt-dlp` and `ffmpeg` installed. |
| Real-time download progress | Supported with backend | The backend streams native `yt-dlp` stdout/stderr and percentage updates over SSE. |
| Spotify playlist Exportify flow | Browser/backend-compatible | CSV parsing endpoint and terminal guidance are included; track queries can be submitted through Spotify mode. |
| Browser cookie extraction / age-restricted fallback | Not browser-native | Browser security prevents reading user browser profiles. Add server-side cookie-file support if needed. |
| Global keyboard/mouse hooks and process injection | Unsupported | Replaced with focused terminal controls because browsers intentionally forbid global OS hooks. |

## Backend behavior

The referenced online yt-dlp web pattern is a browser UI connected to server-side download capacity. This repository now includes the same kind of mechanism: `server/server.js` starts an Express backend, spawns native `yt-dlp`, parses real progress from stdout/stderr, exposes download artifacts from `CrystalMedia_output/downloads`, and streams job state to the terminal UI using Server-Sent Events.

## Deployment instructions

### Fully functional local/native deployment

```bash
npm install
npm run build
npm run server
```

Requirements on the server machine:

```bash
yt-dlp --version
ffmpeg -version
```

Open `http://localhost:4174` and use the terminal menus. Real download links appear in the progress panel when jobs finish.

### Frontend-only static deployment

```bash
npm run build
```

Publish `dist/` to GitHub Pages, Cloudflare Pages, or Vercel static hosting. Static-only deployment preserves the terminal UI but cannot spawn native `yt-dlp`; pair it with the Node backend for full functionality.

### Cloudflare Pages / Vercel with backend

- Frontend build command: `npm run build`
- Static output directory: `dist`
- Backend command on a Node server/container: `npm run server`
- Required system packages in the backend image/container: `yt-dlp`, `ffmpeg`

## Visual recreation notes

The browser app recreates the reference terminal by combining:

- Full-width dark Command Prompt/Termux-style browser shell with no right sidebar.
- Monospace text and fixed-line terminal rendering.
- FIGlet-generated CrystalMedia ASCII art.
- Projection-style particle starfield using `.`, `*`, and `+` tokens.
- Blinking cursor, command prompt, history, scrollback, and editable URL prompt.
- Real backend download progress when `npm run server` is active.
