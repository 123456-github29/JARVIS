# JARVIS

A personal AI assistant with voice, Gmail, Drive, Calendar, and document automation.

Runs entirely on **OpenAI** (text brain + Realtime voice), with a **Twilio**
phone line and **Google APIs** for the tools. Deploys to **Railway**.

Scaffold history: the agent loop was adapted from
[Automaton](https://github.com/Conway-Research/automaton) (MIT) and the voice
approach from Toury — these were reference sources, not runtime dependencies.

---

## What it can do

- 📧 Draft, read, send, and reply to emails (Gmail)
- 💾 Save files and transcripts to Google Drive
- 📅 Create and check calendar events
- 📄 Fill Google Doc templates / create docs
- 🧠 Remember things across sessions (local SQLite)
- 🎤 Answer a phone call and do all of the above by voice

---

## Architecture

```
Phone call ──▶ Twilio ──(Media Streams WS, μ-law)──▶ Railway server (src/server.ts)
                                                          │
                                                          ▼
                                          OpenAI Realtime API (src/voice/index.ts)
                                                          │  tool calls
                                                          ▼
                                          JARVIS tools (src/agent/tools.ts)
                                                          ▼
                                      Gmail · Drive · Calendar · Docs · Memory

Text / REPL ──▶ OpenAI Chat Completions (src/agent/jarvis.ts) ──▶ same tools
```

Both the voice path and the text path share one set of tool definitions and
one executor. Voice lets the Realtime model call tools directly (lowest
latency); text uses Chat Completions function-calling.

---

## Setup

### 1. Install

```bash
npm install
cp .env.example .env
```

### 2. OpenAI

Set `OPENAI_API_KEY` from [platform.openai.com](https://platform.openai.com).
That single key powers both the text brain and the Realtime voice.

### 3. Google OAuth (Gmail / Drive / Calendar / Docs)

You need an access token with these scopes:

```
https://www.googleapis.com/auth/gmail.modify
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/documents
```

**Option A — quick token for testing (expires in ~1 hour)**

1. Open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. In "Step 1", paste the four scopes above → **Authorize APIs** → sign in → **Allow**.
3. In "Step 2", click **Exchange authorization code for tokens**.
4. Copy the **Access token** (`ya29...`) into `GOOGLE_ACCESS_TOKEN` in `.env`.

**Option B — refresh token for production (long-lived; used by the phone server)**

1. [Google Cloud Console](https://console.cloud.google.com) → **New Project**.
2. **APIs & Services → Library** → enable *Gmail API, Google Drive API, Google
   Calendar API, Google Docs API*.
3. **OAuth consent screen** → External → add yourself as a **Test user** and add
   the four scopes.
4. **Credentials → Create Credentials → OAuth client ID** → *Web application* →
   add redirect URI `https://developers.google.com/oauthplayground` → save the
   **Client ID** and **Client secret**.
5. Back in the Playground, click the **⚙ gear** → check **"Use your own OAuth
   credentials"** → paste your client ID/secret → authorize the scopes →
   exchange. You now get a **refresh token** too.
6. Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`
   in `.env`. When all three are set, the app refreshes access tokens
   automatically and ignores `GOOGLE_ACCESS_TOKEN`.

> ⚠️ While the consent screen is in **"Testing"** status, refresh tokens expire
> after 7 days. Publish the app ("In production") for a permanent one.

### 4. Run (text)

```bash
npm run dev                                   # interactive REPL
npm run dev -- --text "Draft an email to mom" # one-shot
```

---

## Phone line (Twilio + Railway)

### 1. Deploy the server

Push this repo to Railway. It reads `railway.json` and starts
`node dist/index.js --serve`. Set these env vars in Railway:

- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (Option B —
  a 1-hour static token is no good for an always-on server)
- `PUBLIC_HOST` — your Railway domain, e.g. `jarvis-production.up.railway.app`
  (no protocol)

Verify: `https://<PUBLIC_HOST>/health` returns `{"status":"ok"}`.

### 2. Point Twilio at it

In the [Twilio console](https://console.twilio.com), open your phone number and
set **A call comes in** → **Webhook** → `https://<PUBLIC_HOST>/incoming-call`
(HTTP POST). Call the number and JARVIS picks up.

Locally you can expose the server with a tunnel (e.g. `ngrok http 8080`) and use
the tunnel host as `PUBLIC_HOST`.

---

## Project structure

```
src/
  index.ts                 Entry point + modes (--text, --serve, REPL)
  config.ts                Env config loader/validation
  server.ts                Fastify server: Twilio webhook + media-stream WS
  agent/
    jarvis.ts              Text brain (OpenAI Chat Completions + tools)
    tools.ts               Tool definitions + executor + schema formatters
    tool-context.ts        Builds the live API clients from config
  voice/
    index.ts               Twilio ⇄ OpenAI Realtime bridge (voice + tool calls)
  integrations/
    google-auth.ts         Static / refresh-token providers
    gmail.ts drive.ts calendar.ts docs.ts
  memory/store.ts          SQLite-backed memory
  observability/logger.ts  Structured logging
```

---

## Roadmap

- [ ] Web dashboard — transcripts, docs, email history
- [ ] Stripe subscriptions for public launch
- [ ] Supabase-backed memory (cloud sync across devices)
- [ ] Multi-user auth + per-user Google tokens
- [ ] Prompt-injection defense on email content

---

## License

MIT
