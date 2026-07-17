# JARVIS — Claude Code Context

This file is for Claude Code. Read this before touching anything.

---

## What this project is

JARVIS is a personal AI assistant — think Tony Stark's JARVIS. It listens to your voice (via phone call or app), reasons about what you said, calls real tools (Gmail, Drive, Calendar, Docs), and speaks back.

Built by combining:
- **Automaton** (https://github.com/Conway-Research/automaton, MIT) — the agent brain/ReAct loop
- **Toury** — voice layer using OpenAI Realtime API (private repo, owned by this project's author)

The vision: you're driving, you say "draft an email to my client saying the meeting is moved to Thursday", and JARVIS does it — no touching your phone.

---

## Who is building this

Solo founder, self-taught engineer. Moving fast. Wants working code, not perfect code. This will eventually be a public SaaS product.

---

## Project status

**This is a starting scaffold.** Most of the new files were just written. The project has NOT been run yet. Expect type errors and missing imports to fix.

Known issues to resolve:
- The automaton files copied into `src/agent/` (loop.ts, context.ts, etc.) and `src/memory/`, `src/inference/` still import from modules that were deleted (Conway, survival, replication, etc.). These need to be cleaned up or those imports need to be stubbed out.
- The `src/types.ts` file is the full Automaton types file and references things like `ConwayClient`, `SurvivalTier`, etc. that don't exist anymore. Either trim it down or add type stubs.
- `src/agent/jarvis.ts` is the NEW clean agent — this is the one to use, not `src/agent/loop.ts` (which is the full Automaton loop and has Conway dependencies).
- `src/voice/index.ts` has the OpenAI Realtime API skeleton but is missing the actual Toury WebRTC/audio code. The author needs to paste their Toury voice session code in here.

---

## Architecture

```
Voice input (phone/app)
       ↓
src/voice/index.ts          ← OpenAI Realtime API (Toury's voice layer)
       ↓
src/agent/jarvis.ts         ← Core ReAct loop (Think → Act → Observe)
       ↓
src/agent/tools.ts          ← 16 JARVIS tools
       ↓ ↓ ↓ ↓
Gmail  Drive  Calendar  Docs   Memory
       ↓
Voice response back to user
```

### The agent loop (src/agent/jarvis.ts)

This is the BRAIN. It:
1. Takes user input (text from voice transcript)
2. Sends to Claude (claude-sonnet-4-6) with tools
3. Claude picks tools to call
4. Tools execute against real Google APIs
5. Results feed back to Claude
6. Claude formulates final response
7. Response gets spoken back

This is a stripped version of Automaton's ReAct loop — all Conway Cloud / blockchain / survival / replication stuff removed.

### Tools (src/agent/tools.ts)

16 tools the agent can call:

| Tool | Category | Risk |
|---|---|---|
| create_email_draft | email | safe |
| read_emails | email | safe |
| send_email | email | dangerous |
| reply_to_email | email | dangerous |
| save_to_drive | drive | safe |
| save_transcript | drive | safe |
| list_drive_files | drive | safe |
| read_drive_file | drive | safe |
| create_calendar_event | calendar | caution |
| get_calendar_events | calendar | safe |
| fill_document_template | docs | caution |
| create_doc | docs | safe |
| remember | memory | safe |
| recall | memory | safe |
| forget | memory | safe |
| get_current_time | system | safe |
| summarize_session | system | safe |

To add a new tool: add it to `JARVIS_TOOLS` array in tools.ts, then add a case in the `executeTool` switch statement.

### Integrations (src/integrations/)

Thin wrappers around Google APIs using raw fetch (no SDK needed):
- `gmail.ts` — Gmail API v1
- `drive.ts` — Drive API v3
- `calendar.ts` — Calendar API v3
- `docs.ts` — Docs API v1 + Drive v3 for template copying

All use `GOOGLE_ACCESS_TOKEN` from env. For production, this needs to be replaced with OAuth2 refresh token flow.

### Memory (src/memory/store.ts)

Simple SQLite key-value store at `~/.jarvis/memory.db`.
- `remember(key, value)` — store a fact
- `recall(key)` — get it back
- `search(query)` — fuzzy search across all memories
- Persists across sessions

The full Automaton memory system (episodic, semantic, procedural, etc.) is in `src/memory/` but not yet wired into the JARVIS agent. Can be plugged in later for richer context.

### Voice (src/voice/index.ts)

OpenAI Realtime API skeleton. The structure is:
1. Open WebSocket to `wss://api.openai.com/v1/realtime`
2. Configure with system prompt + VAD (voice activity detection)
3. Stream PCM audio in
4. On transcript complete → `agent.think(transcript)`
5. Agent responds → speak back

**TODO**: Paste Toury's actual WebRTC/audio code here.

---

## Tech stack

| Layer | Tech |
|---|---|
| AI reasoning | Claude (claude-sonnet-4-6 via @anthropic-ai/sdk) |
| Voice | OpenAI Realtime API (gpt-4o-realtime) |
| Email | Gmail API v1 |
| Files | Google Drive API v3 |
| Calendar | Google Calendar API v3 |
| Documents | Google Docs API v1 |
| Memory | SQLite via better-sqlite3 |
| Language | TypeScript (ESM, strict mode) |
| Runtime | Node.js 20+ |

---

## Environment variables

All in `.env` (copy from `.env.example`):

```
ANTHROPIC_API_KEY     # Claude API key — console.anthropic.com
GOOGLE_ACCESS_TOKEN   # Google OAuth access token (Gmail, Drive, Calendar, Docs)
OPENAI_API_KEY        # Only for voice mode
```

**IMPORTANT**: Never hardcode secrets. Never commit `.env`. It's in `.gitignore`.

---

## Running it

```bash
npm install
cp .env.example .env   # then fill in your keys
npm run dev            # interactive REPL mode
npm run dev -- --text "Draft an email to mom"  # one-shot
npm run dev -- --voice # voice mode (needs Toury code)
```

---

## What needs to be done next (priority order)

1. **Fix type errors** — the copied Automaton files have imports that point to deleted modules. Either delete those files or add stub types to make them compile.
2. **Wire in Toury voice code** — paste existing WebRTC/audio code into `src/voice/index.ts`
3. **Google OAuth** — replace the static `GOOGLE_ACCESS_TOKEN` with a proper refresh token flow so the token doesn't expire
4. **Test end to end** — run in REPL mode first, test each tool
5. **Web dashboard** — Next.js app so users can see transcripts, docs, email history
6. **Stripe** — subscription payments for public launch
7. **Supabase** — replace SQLite memory with Supabase so it syncs across devices

---

## What NOT to do

- Don't touch `.env` — it's gitignored for a reason
- Don't re-add any Conway Cloud / blockchain / Ethereum wallet stuff — that was intentionally removed
- Don't over-engineer — this is moving fast, working code > perfect code
- Don't add authentication to the local REPL — it's a local tool for now

---

## File map — what's from where

| Path | Source |
|---|---|
| src/agent/jarvis.ts | NEW — written for JARVIS |
| src/agent/tools.ts | NEW — JARVIS tools |
| src/integrations/* | NEW — Google API clients |
| src/memory/store.ts | NEW — SQLite memory |
| src/voice/index.ts | NEW — Toury skeleton |
| src/observability/logger.ts | NEW — simplified from Automaton |
| src/index.ts | NEW — JARVIS entry point |
| src/agent/loop.ts | FROM AUTOMATON (has Conway deps, don't use directly) |
| src/agent/context.ts | FROM AUTOMATON |
| src/agent/injection-defense.ts | FROM AUTOMATON (good to keep) |
| src/agent/policy-engine.ts | FROM AUTOMATON (good to keep) |
| src/agent/policy-rules/* | FROM AUTOMATON |
| src/memory/* (except store.ts) | FROM AUTOMATON (advanced, not yet wired in) |
| src/inference/* | FROM AUTOMATON (advanced inference routing) |
| src/state/* | FROM AUTOMATON (SQLite schema, not yet used) |
| src/types.ts | FROM AUTOMATON (needs trimming) |
