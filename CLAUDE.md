# Contract Tool — CLAUDE.md

## What This Is
A fully client-side Next.js 16 tool for generating API contracts from JIRA stories + Figma screen uploads. No backend — all state in localStorage via Zustand persist.

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript strict
- Tailwind v4 + shadcn/ui (new-york style)
- Zustand 5 with `persist` middleware
- Monaco Editor for types/schemas editing
- Fuse.js for fuzzy spec matching
- AI: direct browser calls to Claude/OpenAI APIs

## Directory Structure
- `types/` — all TypeScript interfaces (barrel: `types/index.ts`)
- `stores/` — Zustand stores (contract, contracts-list, specs, settings, ui)
- `lib/` — pure logic: specs/, parsers/, generators/, ai/
- `hooks/` — client hooks
- `components/` — organized by feature: jira/, screens/, endpoints/, types-editor/, schemas/, export/, ai/, settings/, specs/, layout/
- `app/` — routes: `/` (dashboard), `/contract/[id]` (workspace), `/settings`

## Import Conventions
- `@/types` — never import individual type files
- `@/*` — everything else from root

## Key Rules
- Never call `localStorage` directly — use Zustand stores
- Images stored as compressed base64 (canvas resize max 1920px, JPEG 0.8)
- Annotation positions stored as percentages (0-100%) for zoom independence
- `isEdited` flag on GeneratedType/GeneratedSchema prevents regeneration from overwriting manual changes
- CORS for specs solved via Next.js rewrite: `/api/proxy-spec/:project`

## Spec Proxy
`next.config.ts` rewrites `/api/proxy-spec/:project` → `https://staging-api2.leadliaison.com/api/specs.json?project=:project`

## 7 Configured Spec Projects
digitalcard-core, digitalcard-front-end, meetingplatform-dashboard, submission-log, digitalcard-portal, freemium-webapp-frontend, freemium-activation-flow

## Running
```
npm run dev    # development
npm run build  # production build
npm run lint   # eslint
```
