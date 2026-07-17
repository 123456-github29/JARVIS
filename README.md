# JARVIS

A personal AI assistant with voice, Gmail, Drive, Calendar, and document automation.

Built on:
- **Agent brain** — stripped from [Automaton](https://github.com/Conway-Research/automaton) (MIT)
- **Voice layer** — from Toury (OpenAI Realtime API)
- **Claude** — reasoning and tool use
- **Google APIs** — Gmail, Drive, Calendar, Docs

---

## What it can do

- 📧 Draft, read, and reply to emails
- 💾 Save files and transcripts to Google Drive
- 📅 Create and check calendar events
- 📄 Fill document templates
- 🧠 Remember things across sessions
- 🎤 Work hands-free via voice (Toury integration)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `GOOGLE_ACCESS_TOKEN` — see Google OAuth setup below
- `OPENAI_API_KEY` — only needed for voice mode

### 3. Google OAuth Setup

You need a Google Cloud project with the following APIs enabled:
- Gmail API
- Google Drive API
- Google Calendar API
- Google Docs API

Then create OAuth2 credentials and get an access token:

```
1. Go to https://console.cloud.google.com
2. Create a new project (or use an existing one)
3. Enable the 4 APIs above
4. Go to APIs & Services → Credentials → Create OAuth2 client
5. Download the client JSON
6. Run: npx google-auth-library-nodejs auth (or use the OAuth playground)
7. Paste the access token in your .env
```

> For production: set up proper OAuth2 refresh token flow in src/setup/oauth.ts

### 4. Run

```bash
# Text mode (REPL)
npm run dev

# One-shot command
npm run dev -- --text "Draft an email to mom saying I'll call tonight"

# Voice mode (Toury)
npm run dev -- --voice
```

---

## Project Structure

```
src/
  index.ts              Entry point + modes (text, voice)
  agent/
    jarvis.ts           Core ReAct loop (Think → Act → Observe)
    tools.ts            All JARVIS tool definitions + executor
  integrations/
    gmail.ts            Gmail API client
    drive.ts            Google Drive API client
    calendar.ts         Google Calendar API client
    docs.ts             Google Docs API client
  voice/
    index.ts            OpenAI Realtime API voice session (Toury)
  memory/
    store.ts            SQLite-backed memory store
  observability/
    logger.ts           Structured logging
```

---

## Adding Toury's Voice Code

The `src/voice/index.ts` file has the skeleton for the OpenAI Realtime API session.
Paste your existing Toury WebSocket/WebRTC code in there and wire it to the `JarvisAgent`.

The interface is simple:
```ts
const session = createVoiceSession(config, agent);
await session.start();
session.sendAudio(audioBuffer); // feed audio chunks
session.stop();
```

---

## Roadmap

- [ ] Proper Google OAuth2 refresh token flow
- [ ] Web dashboard (Next.js) — see transcripts, docs, email history
- [ ] Stripe subscription for public launch
- [ ] Supabase for cloud memory sync across devices
- [ ] Driving mode (Toury GPS integration)
- [ ] Document template library

---

## License

MIT
