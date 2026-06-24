# src/ — quick guide

Three layers. Full map with clickable links: [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)

| Layer | Meaning | Folders |
|-------|---------|---------|
| **ENTRY** | where a user/request starts | [pages/](./pages/) · `../server.js` · `../supabase/functions/` |
| **INTERFACE** | what the user sees | [components/](./components/) · [contexts/](./contexts/) |
| **DATA** | fetch / save / validate / DB | [lib/](./lib/) · [lib/api/](./lib/api/) · [services/](./services/) · [hooks/](./hooks/) |

**Rules of thumb**
- A screen at a URL → `pages/`
- A reusable visual piece → `components/`
- "Talks to the database" → anything in `lib/api/` or a file ending in `Api.js`
- A pure helper (format, parse, calculate) → the rest of `lib/`
- The one Supabase client → `lib/supabase.js`
- The one import hub for all data APIs → `lib/storage.js`
- Database shape lives in `../supabase/migrations/`
