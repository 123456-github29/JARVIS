# JARVIS — Full Setup Guide

Everything needed to take JARVIS from zero to fully working. There are two
deployables from this one repo:

| App | Folder | Host | Purpose |
|---|---|---|---|
| Website | `web/` | Vercel | Google sign-in, connect your Google account |
| Phone assistant | repo root | Railway | Answers calls, runs the tools |

Work top to bottom — later steps use values from earlier ones.

---

## Accounts you'll need

1. **OpenAI** — platform.openai.com (billing enabled; Realtime API access)
2. **Google Cloud** — console.cloud.google.com
3. **Supabase** — already set up (project `Navinta-final`)
4. **Twilio** — twilio.com (for the phone number)
5. **Vercel** — already set up (project `jarvis`)
6. **Railway** — railway.app

---

## Step 1 — OpenAI API key

1. platform.openai.com → **API keys** → **Create new secret key**.
2. Save it as `OPENAI_API_KEY` (used on Railway later).
3. Make sure billing is enabled and your account has **Realtime API** access
   (needed for the voice phone line).

---

## Step 2 — Google Cloud OAuth

This produces a **Client ID** and **Client Secret** used by BOTH the website
(via Supabase) and the phone backend.

1. console.cloud.google.com → **Create Project** (e.g. "JARVIS").
2. **APIs & Services → Library** → enable all four:
   - Gmail API
   - Google Drive API
   - Google Calendar API
   - Google Docs API
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - Fill app name / support email.
   - **Scopes** → add: `.../auth/gmail.modify`, `.../auth/drive`,
     `.../auth/calendar`, `.../auth/documents` (plus `openid`, `email`,
     `profile`).
   - **Test users** → add your own Google email.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs** → add BOTH:
     - `https://iqfrjomoggddxwteuigk.supabase.co/auth/v1/callback`  (Supabase)
     - `https://developers.google.com/oauthplayground`             (to mint the backend token, Step 5)
   - Create → copy **Client ID** and **Client Secret**.

> ⚠️ While the consent screen is in **Testing**, Google refresh tokens expire
> after 7 days. Publish the app ("In production") for permanent tokens.

---

## Step 3 — Supabase

### 3a. Get the service-role key
Supabase → **Project Settings → API** → copy the **`service_role`** secret.
Save as `SUPABASE_SERVICE_ROLE_KEY`.

### 3b. Enable Google sign-in
**Authentication → Providers → Google** → enable → paste the **Client ID** and
**Client Secret** from Step 2 → Save.

### 3c. Set the URLs
**Authentication → URL Configuration**:
- **Site URL**: your Vercel URL, e.g. `https://jarvis-xxxx.vercel.app`
- **Redirect URLs** — add:
  - `http://localhost:3000/**`
  - `https://jarvis-xxxx.vercel.app/**`

### 3d. Set the Edge Function secret
Token storage runs in the **`jarvis-store-connection`** Edge Function (already
deployed), which keeps the service-role key and encryption key inside Supabase
instead of the web app. It needs one secret:

- **Edge Functions → Secrets** (or CLI: `supabase secrets set ...`) → add
  `APP_ENCRYPTION_KEY` = output of `openssl rand -base64 32`.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — don't set
those. (Keep a copy of the encryption key; the phone backend will need the same
value later to decrypt tokens.)

---

## Step 4 — Website on Vercel

In the **`jarvis`** Vercel project:

1. **Settings → Build and Deployment → Root Directory** → set to `web` → Save.
   (This is why it was crashing — Vercel was building the backend, not the site.)
2. **Settings → Environment Variables** → add just these two public values.
   No secrets live in the web app anymore — they're in the Edge Function (3d).

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://iqfrjomoggddxwteuigk.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_1mhtWKPAexk6-ycdAuR4sg_hdil-hlj` |

3. **Deployments → latest → ⋯ → Redeploy.**

✅ The website is now live. Visit it, click **Continue with Google**, and you
should land on `/dashboard` with your Google services shown as connected. The
sign-in callback calls the Edge Function, which writes your encrypted Google
tokens into `jarvis-google-connections`.

---

## Step 5 — Google refresh token for the phone backend

The phone assistant currently uses **one shared** Google account for its tools
(per-user tokens from the website are a later code step). Mint a refresh token:

1. Go to developers.google.com/oauthplayground → **⚙ gear** (top right) →
   check **"Use your own OAuth credentials"** → paste your Client ID + Secret.
2. Left panel: enter these scopes and **Authorize APIs**:
   ```
   https://www.googleapis.com/auth/gmail.modify
   https://www.googleapis.com/auth/drive
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/documents
   ```
3. Sign in → Allow → **Exchange authorization code for tokens**.
4. Copy the **Refresh token**. Save as `GOOGLE_REFRESH_TOKEN`.

---

## Step 6 — Twilio phone number

1. twilio.com → get a phone number with **Voice** capability.
2. From the console dashboard copy **Account SID** and **Auth Token**.
3. (Webhook wiring happens in Step 8, after Railway is live.)

> Trial accounts work but can only call **verified** numbers and prepend a
> trial notice. Upgrade for real use.

---

## Step 7 — Phone backend on Railway

1. railway.app → **New Project → Deploy from GitHub repo** → pick this repo.
   Leave root directory as the repo root (Railway reads `railway.json`).
2. **Variables** → add:

   | Name | Value |
   |---|---|
   | `OPENAI_API_KEY` | *(Step 1)* |
   | `GOOGLE_CLIENT_ID` | *(Step 2)* |
   | `GOOGLE_CLIENT_SECRET` | *(Step 2)* |
   | `GOOGLE_REFRESH_TOKEN` | *(Step 5)* |
   | `TWILIO_ACCOUNT_SID` | *(Step 6)* |
   | `TWILIO_AUTH_TOKEN` | *(Step 6)* |
   | `TWILIO_PHONE_NUMBER` | `+1...` |
   | `PUBLIC_HOST` | *(your Railway domain, below)* |

   Optional overrides: `OPENAI_TEXT_MODEL`, `OPENAI_REALTIME_MODEL`,
   `OPENAI_REALTIME_VOICE`, `TIMEZONE`. (`PORT` is provided by Railway.)
3. **Settings → Networking → Generate Domain**. Copy it (e.g.
   `jarvis-production.up.railway.app`) into `PUBLIC_HOST` (no `https://`), then
   redeploy.
4. Check `https://<PUBLIC_HOST>/health` returns `{"status":"ok"}`.

---

## Step 8 — Wire Twilio to the backend

Twilio console → your number → **Voice Configuration** → **A call comes in**:
- Type: **Webhook**
- URL: `https://<PUBLIC_HOST>/incoming-call`
- Method: **HTTP POST**

Call the number. JARVIS answers.

---

## Env var reference

**Vercel (website):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
*(both public — no secrets)*

**Supabase Edge Function `jarvis-store-connection`:** `APP_ENCRYPTION_KEY`
*(secret; `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are auto-injected)*

**Railway (phone backend):** `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `PUBLIC_HOST`

Never commit real secrets — set them in the Vercel / Railway dashboards only.

---

## Known remaining work

- **Per-user Google on the phone.** Today the phone line uses one shared Google
  account (`GOOGLE_REFRESH_TOKEN`). The website already stores each user's tokens
  in `jarvis-google-connections`; wiring the backend to look up the caller and
  use *their* tokens is the next code task.
- **Caller → user mapping.** To do the above, JARVIS needs to know which user a
  phone number belongs to (add a phone field to `jarvis-profiles`).
- **Move JARVIS off the shared Supabase project** before real users — the
  `Navinta-final` DB has other tables with RLS disabled.
