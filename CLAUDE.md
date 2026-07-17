# JARVIS — Claude Code Context

This file is for Claude Code. Read this before touching anything.

---

## What this project is

JARVIS is a personal AI assistant — think Tony Stark's JARVIS. You call a phone
number, talk to it, and it does real work: drafts/reads/sends email, saves files
to Drive, manages your calendar, fills document templates — then talks back.

The whole thing runs on **OpenAI** (text brain + Realtime voice), uses **Twilio**
for the phone line, **Google APIs** for the tools, and deploys to **Railway**.

> History note: the agent loop was adapted from
> [Automaton](https://github.com/Conway-Research/automaton) (MIT) and the voice
> approach was informed by "Toury". **Neither is a dependency** — they were just
> source repos files were copied from. There is no Toury package, private repo,
> or code to paste in. Don't reintroduce Automaton concepts (Conway, survival
> tiers, wallets, replication) — all of that was removed.

---

## Who is building this

Solo founder, self-taught engineer, moving fast. Wants working code, not perfect
code. This will eventually be a public SaaS product.

---

## Architecture

```
Phone call ──▶ Twilio ──(Media Streams WS, μ-law 8kHz)──▶ Railway server
                                                              │
                                                              ▼
                                              OpenAI Realtime API
                                        (VAD + tool calls, src/voice/index.ts)
                                                              │
                                                              ▼
                                          JARVIS tools (src/agent/tools.ts)
                                                              ▼
                                  Gmail · Drive · Calendar · Docs · Memory

Text / REPL ──▶ OpenAI Chat Completions (src/agent/jarvis.ts) ──▶ same tools
```

Two entry paths, one tool layer:

- **Voice** (`--serve`): Twilio Media Streams WebSocket bridged to an OpenAI
  Realtime session. Audio is G.711 µ-law on both sides, so it passes through
  untranscoded. The Realtime model does voice-activity detection AND tool
  calling itself; we execute the tool and hand the result back into the session.
- **Text** (REPL / `--text`): OpenAI Chat Completions with function-calling in a
  Think → Act → Observe loop.

Both share `JARVIS_TOOLS` + `executeTool` in `src/agent/tools.ts` and the
`JARVIS_SYSTEM_PROMPT` in `src/agent/jarvis.ts`.

---

## Files

| Path | Role |
|---|---|
| `src/index.ts` | Entry point. Flags: `--serve`, `--text "..."`, else REPL |
| `src/config.ts` | Loads/validates env → `JarvisConfig` |
| `src/server.ts` | Fastify: `POST /incoming-call` (TwiML) + `GET /media-stream` (WS) + `/health` |
| `src/agent/jarvis.ts` | Text brain (OpenAI Chat Completions) + shared system prompt |
| `src/agent/tools.ts` | 16 tool defs, `executeTool`, OpenAI + Realtime schema formatters |
| `src/agent/tool-context.ts` | Builds the live API clients from config (`createToolContext`) |
| `src/voice/index.ts` | Twilio ⇄ OpenAI Realtime bridge (`bridgeTwilioMediaStream`) |
| `src/integrations/google-auth.ts` | `TokenProvider`: static token or refresh-token flow |
| `src/integrations/{gmail,drive,calendar,docs}.ts` | Raw-`fetch` Google API clients |
| `src/memory/store.ts` | SQLite key-value memory at `~/.jarvis/memory.db` |
| `src/observability/logger.ts` | Structured JSON logger |

Everything else from the original Automaton scaffold (loop.ts, inference/,
state/, skills/, the advanced memory/*, types.ts, policy-engine, etc.) was
**deleted** — it had dependencies on removed modules and wasn't on the JARVIS
path. Recoverable from git history (commit `init: JARVIS scaffold`) if ever
needed.

---

## Tools

16 tools, defined in `JARVIS_TOOLS` and dispatched in the `executeTool` switch.

| Tool | Category | Risk |
|---|---|---|
| create_email_draft / read_emails | email | safe |
| send_email / reply_to_email | email | dangerous |
| save_to_drive / save_transcript / list_drive_files / read_drive_file | drive | safe |
| create_calendar_event | calendar | caution |
| get_calendar_events | calendar | safe |
| fill_document_template | docs | caution |
| create_doc | docs | safe |
| remember / recall / forget | memory | safe |
| get_current_time / summarize_session | system | safe |

To add a tool: add an entry to `JARVIS_TOOLS`, then a `case` in `executeTool`.
The schema formatters (`formatToolsForOpenAI`, `formatToolsForRealtime`) pick it
up automatically for both the text and voice paths.

---

## Google auth

Integration clients take a `TokenProvider` (`() => Promise<string>`), not a
static string. `tokenProviderFromConfig` chooses:

- **Refresh flow** when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` +
  `GOOGLE_REFRESH_TOKEN` are all set (caches access tokens until ~1 min before
  expiry). **Use this for the server.**
- **Static token** (`GOOGLE_ACCESS_TOKEN`) otherwise — expires in ~1h, testing
  only.

See README for how to obtain either from the Google OAuth Playground.

---

## Environment variables

See `.env.example`. Required: `OPENAI_API_KEY` + some Google auth. Twilio vars
and `PUBLIC_HOST` are only needed for `--serve`. Never commit `.env`.

---

## Running it

```bash
npm install
cp .env.example .env      # fill in keys
npm run dev               # REPL (text)
npm run dev -- --text "Draft an email to mom"
npm run serve             # phone server locally (needs a tunnel for Twilio)
npm run build && npm start -- --serve   # production-style
npm run typecheck         # must stay green
```

Deploy: push to Railway; `railway.json` builds and runs `--serve`. Point the
Twilio number's "A call comes in" webhook at `https://<PUBLIC_HOST>/incoming-call`.

---

## What NOT to do

- Don't touch `.env` — gitignored.
- Don't reintroduce Automaton concepts (Conway, blockchain, wallets, survival,
  replication) or a Toury dependency — none of that exists here.
- Don't add Anthropic/Claude back as the brain — this is OpenAI end to end.
- Don't over-engineer. Working code > perfect code.
- Keep `npm run typecheck` green before committing.

---

## What's next (priority order)

1. **End-to-end live test** — real OpenAI + Google keys in REPL, exercise each tool.
2. **First real phone call** — deploy to Railway, wire Twilio, call in.
3. **Multi-user** — per-user Google tokens instead of one shared credential.
4. **Prompt-injection defense** on email content the model reads.
5. Web dashboard · Stripe · Supabase-backed memory.
