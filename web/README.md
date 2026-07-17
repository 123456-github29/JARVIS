# JARVIS Web

The JARVIS onboarding site: an Apple-flavored black-and-white landing page plus
Google sign-in (via Supabase Auth) where users connect their Google account so
JARVIS can act on their Gmail, Drive, Calendar, and Docs.

- **Next.js** (App Router) + **Tailwind** + **Framer Motion**
- **Supabase Auth** for Google OAuth; tokens stored in the `Navinta-final`
  Supabase project in `"jarvis-*"` tables (RLS on; token columns server-only)
- Deploys to **Vercel**

## Routes

| Route | What it does |
|---|---|
| `/` | Landing page (hero, features, connect CTA) |
| `/login` | "Continue with Google" — requests Gmail/Drive/Calendar/Docs scopes |
| `/auth/callback` | Exchanges the OAuth code, stores profile + encrypted Google tokens |
| `/dashboard` | Shows connected services; reconnect / sign out |
| `/auth/signout` | POST — clears the session |

## Local setup

```bash
cd web
npm install
cp .env.local.example .env.local   # fill in the two secrets below
npm run dev                         # http://localhost:3000
```

`.env.local` needs (URL + anon key are pre-filled):

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API → `service_role`
- `APP_ENCRYPTION_KEY` — `openssl rand -base64 32` (encrypts Google tokens at rest)

## One-time configuration (outside this repo)

These are dashboard clicks I can't do for you:

### 1. Google Cloud Console
- Create/verify the OAuth consent screen with scopes: `gmail.modify`, `drive`,
  `calendar`, `documents`, plus `openid email profile`.
- OAuth client → **Authorized redirect URIs** → add Supabase's callback:
  `https://iqfrjomoggddxwteuigk.supabase.co/auth/v1/callback`

### 2. Supabase dashboard
- **Authentication → Providers → Google** → enable, paste the Google client ID
  and secret.
- **Authentication → URL Configuration** → set **Site URL** and add
  **Redirect URLs**: `http://localhost:3000/**` and your Vercel domain
  (`https://<app>.vercel.app/**`).

### 3. Vercel
- Import the repo, set **Root Directory** to `web`.
- Add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENCRYPTION_KEY`.

## Data model (`Navinta-final`, `public` schema)

- `"jarvis-profiles"` — one row per user (id → `auth.users`).
- `"jarvis-google-connections"` — connected Google account + encrypted
  `access_token` / `refresh_token`. RLS on; token columns are **not** granted to
  browser roles, so only the server's service-role key can read them.

The JARVIS phone/text backend (repo root) reads `refresh_token` from
`"jarvis-google-connections"` to build a per-user `TokenProvider` — the
multi-user path that replaces the single shared Google credential.
