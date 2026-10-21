// Channel adapters. "live" adapters call the platform API; the rest hand off a copy-ready pack
// to outbox/ for a person to post (Google Business Profile and LinkedIn need API access that
// Google and LinkedIn grant only after review).
import * as meta from './meta.mjs';
import * as whatsapp from './whatsapp.mjs';
import * as youtube from './youtube.mjs';
import * as handoff from './handoff.mjs';

export const adapters = {
  facebook: meta.facebook,
  instagram: meta.instagram,
  whatsapp: whatsapp.adapter,
  youtube: youtube.adapter,
  gbp: handoff.adapter,
  linkedin: handoff.adapter,
};

// Falls back to handoff when a live adapter's credentials are missing.
export function pick(channel, env = process.env) {
  const adapter = adapters[channel];
  if (!adapter) throw new Error(`no adapter for ${channel}`);
  if (adapter.mode === 'live' && adapter.missing(env).length) return { ...handoff.adapter, fallbackFrom: channel };
  return adapter;
}
