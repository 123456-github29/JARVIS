/**
 * Public Supabase connection values. These are safe to expose in the browser
 * bundle (the publishable/anon key is designed for client use). Env vars win;
 * the fallbacks let preview deployments render before env is configured.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://iqfrjomoggddxwteuigk.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_1mhtWKPAexk6-ycdAuR4sg_hdil-hlj";
