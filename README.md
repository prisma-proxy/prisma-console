# Prisma Console

Real-time web management dashboard for the [Prisma](https://github.com/prisma-proxy/prisma) encrypted proxy system. Built with Next.js as a static site served directly by the Prisma management API.

## Features

- **Dashboard** — live metrics, connection map (Natural Earth 50m), traffic charts, health score
- **Client management** — add/remove/toggle clients, share via TOML/URI/QR, per-client bandwidth and quota
- **Subscriptions** — redemption codes (`PRISMA-XXXX`), invite links, plan management with expiry and permissions
- **Routing** — visual rules editor, GeoSite/GeoIP presets, rule providers
- **Connections** — real-time connection tracking with filtering and virtual scrolling
- **Analytics** — traffic by domain, daily trends, top connections, CSV export
- **Logs** — real-time log stream with level/keyword filtering
- **Server management** — config editor, TLS info, port forwards, listener status
- **Settings** — registration toggle, session expiry, auto-backup, alerts
- **Multi-language** — English and Chinese (Simplified)
- **Dark mode** — automatic and manual theme switching

## Quick Start

```bash
npm install
npm run build
```

Static files are output to `out/`. Configure the Prisma server to serve them:

```toml
[management_api]
enabled = true
listen_addr = "0.0.0.0:9090"
auth_token = "your-secure-token-here"
console_dir = "./out"
```

Access the console at `https://your-server:9090/`.

## Development

```bash
npm install
npm run dev
# → http://localhost:3000
```

During development, the console connects to the management API on the same origin. Start the Prisma server with the management API enabled.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, static export) |
| UI | shadcn/ui + Tailwind CSS 4 |
| Charts | Recharts + react-simple-maps |
| Data | TanStack React Query + WebSocket |
| State | Zustand |
| i18n | Custom context-based system (EN + ZH) |

## Related Repositories

| Repository | Description |
|------------|-------------|
| [prisma](https://github.com/prisma-proxy/prisma) | Core Rust workspace (server, client, CLI, FFI, management API) |
| [prisma-gui](https://github.com/prisma-proxy/prisma-gui) | Desktop + mobile client (Tauri 2 + React) |
| [prisma-docs](https://github.com/prisma-proxy/prisma-docs) | Documentation site (Docusaurus) |

## License

MIT
