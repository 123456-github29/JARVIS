/**
 * Google OAuth token management.
 *
 * The Google integration clients (Gmail/Drive/Calendar/Docs) don't hold a
 * static token anymore — they hold a `TokenProvider`, an async function that
 * returns a currently-valid access token. This lets us support two modes:
 *
 *   1. Static token  — a `ya29...` access token pasted from the OAuth
 *      Playground. Expires after ~1 hour. Fine for local testing.
 *
 *   2. Refresh token — client id/secret + a long-lived refresh token. We
 *      exchange it for fresh access tokens on demand and cache them until
 *      just before they expire. This is what the Railway server uses.
 */

import { createLogger } from "../observability/logger.js";

const logger = createLogger("google-auth");

/** Returns a currently-valid Google OAuth access token. */
export type TokenProvider = () => Promise<string>;

/** Wrap a fixed access token (testing). It just returns the same string. */
export function staticToken(token: string): TokenProvider {
  return async () => token;
}

interface RefreshConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Build a provider that exchanges a refresh token for access tokens and
 * caches the result until ~1 minute before expiry.
 */
export function refreshingToken(cfg: RefreshConfig): TokenProvider {
  let cached: { token: string; expiresAt: number } | null = null;

  return async () => {
    const now = Date.now();
    if (cached && now < cached.expiresAt - 60_000) {
      return cached.token;
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: cfg.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google token refresh failed ${res.status}: ${err}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    cached = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };
    logger.info("Refreshed Google access token", { expiresInSec: data.expires_in });
    return data.access_token;
  };
}

/**
 * Pick the right provider from config: prefer the refresh flow when full
 * credentials are present, otherwise fall back to the static token.
 */
export function tokenProviderFromConfig(google: {
  accessToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): TokenProvider {
  if (google.clientId && google.clientSecret && google.refreshToken) {
    return refreshingToken({
      clientId: google.clientId,
      clientSecret: google.clientSecret,
      refreshToken: google.refreshToken,
    });
  }
  return staticToken(google.accessToken);
}
