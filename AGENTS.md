# AGENTS.md

## Cursor Cloud specific instructions

### Overview
Aura is an AI-first video conferencing platform built with Next.js 15 (App Router), React 18, TypeScript, LiveKit, MongoDB, and Clerk. It is a single Next.js application deployed on Vercel — no Docker, no local databases, no multi-service setup.

### Running the dev server
```bash
npm run dev        # starts Next.js dev server with Turbo on http://localhost:3000
```

### Lint, format, and build
See `CLAUDE.md` and `package.json` `scripts` for the full list. Key commands:
- `npm run lint` — ESLint (warnings only, exits 0)
- `npm run format:check` / `npm run format:write` — Prettier
- `npm run build` — production build (requires valid Clerk publishable key)

### Required secrets
All external services are cloud-hosted SaaS. **No page will render** without a valid Clerk publishable key because Clerk middleware validates it on every request. At minimum, set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env.local`.

Full list in `.env.example`. Copy to `.env.local` and fill in real values.

### Gotchas
- The `packageManager` field in `package.json` says `pnpm@9.15.9`, but the lockfile is `package-lock.json`. Always use **npm**.
- `npm run build` fails at static page generation if `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is not a validly-formatted Clerk key. The dev server (`npm run dev`) still starts and compiles, but all pages return 500.
- `npm run format:check` exits non-zero on the existing codebase (95 files with pre-existing formatting differences). This is the repo's current state and not a sign of a broken setup.
- Runtime env var checks (MongoDB, Pinecone, OpenAI, Resend) throw only when those services are actually accessed, not at startup.
