#!/usr/bin/env bash
#
# JARVIS — push every secret/env to Supabase, Vercel, and Railway in one run.
#
# Prereqs (install + login once):
#   Supabase CLI : brew install supabase/tap/supabase   (or: npm i -g supabase)
#                  supabase login
#   Vercel CLI   : npm i -g vercel
#                  vercel login && vercel link        # pick the "jarvis" project
#   Railway CLI  : npm i -g @railway/cli
#                  railway login && railway link       # pick your JARVIS project
#
# Usage:
#   cp scripts/secrets.env.example scripts/secrets.env
#   # fill in scripts/secrets.env
#   bash scripts/push-secrets.sh
#
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$HERE/secrets.env"
SUPABASE_PROJECT_REF="iqfrjomoggddxwteuigk"

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ Missing $ENV_FILE"
  echo "  Run: cp scripts/secrets.env.example scripts/secrets.env  then fill it in."
  exit 1
fi

# Load values (every KEY=VALUE becomes an env var here).
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

have() { command -v "$1" >/dev/null 2>&1; }

# ── Supabase: Edge Function secret ───────────────────────────────
echo "▶ Supabase Edge Function secrets"
if ! have supabase; then
  echo "  ⚠ supabase CLI not found — skipping. Install: npm i -g supabase"
elif [ -z "${APP_ENCRYPTION_KEY:-}" ]; then
  echo "  ⚠ APP_ENCRYPTION_KEY is empty — skipping."
else
  supabase secrets set "APP_ENCRYPTION_KEY=$APP_ENCRYPTION_KEY" \
    --project-ref "$SUPABASE_PROJECT_REF"
  echo "  ✓ APP_ENCRYPTION_KEY set"
fi

# ── Vercel: web app env (public) across all environments ─────────
echo "▶ Vercel (web app) environment variables"
if ! have vercel; then
  echo "  ⚠ vercel CLI not found — skipping. Install: npm i -g vercel"
else
  vercel_set() {
    local name="$1" val="$2"
    [ -z "$val" ] && { echo "  ⚠ $name empty — skipping"; return; }
    for target in production preview development; do
      vercel env rm "$name" "$target" -y >/dev/null 2>&1 || true
      printf '%s' "$val" | vercel env add "$name" "$target" >/dev/null 2>&1
    done
    echo "  ✓ $name"
  }
  vercel_set NEXT_PUBLIC_SUPABASE_URL      "${NEXT_PUBLIC_SUPABASE_URL:-}"
  vercel_set NEXT_PUBLIC_SUPABASE_ANON_KEY "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
fi

# ── Railway: phone backend variables ─────────────────────────────
echo "▶ Railway (phone backend) variables"
if ! have railway; then
  echo "  ⚠ railway CLI not found — skipping. Install: npm i -g @railway/cli"
else
  railway_args=()
  add_rw() { [ -n "${2:-}" ] && railway_args+=(--set "$1=$2") || echo "  ⚠ $1 empty — skipping"; }
  add_rw OPENAI_API_KEY       "${OPENAI_API_KEY:-}"
  add_rw GOOGLE_CLIENT_ID     "${GOOGLE_CLIENT_ID:-}"
  add_rw GOOGLE_CLIENT_SECRET "${GOOGLE_CLIENT_SECRET:-}"
  add_rw GOOGLE_REFRESH_TOKEN "${GOOGLE_REFRESH_TOKEN:-}"
  add_rw TWILIO_ACCOUNT_SID   "${TWILIO_ACCOUNT_SID:-}"
  add_rw TWILIO_AUTH_TOKEN    "${TWILIO_AUTH_TOKEN:-}"
  add_rw TWILIO_PHONE_NUMBER  "${TWILIO_PHONE_NUMBER:-}"
  add_rw PUBLIC_HOST          "${PUBLIC_HOST:-}"
  if [ ${#railway_args[@]} -gt 0 ]; then
    railway variables "${railway_args[@]}"
    echo "  ✓ Railway variables set"
  else
    echo "  ⚠ no Railway values provided — skipping"
  fi
fi

echo
echo "✅ Done. Not settable via this script (one-time dashboard steps):"
echo "   • Vercel → Settings → Root Directory = web"
echo "   • Supabase → Authentication → Providers → Google (client id/secret)"
echo "   • Supabase → Authentication → URL Configuration (site + redirect URLs)"
echo "   • Twilio → your number → 'A call comes in' webhook"
