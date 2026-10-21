// Channel adapters. "live" adapters call the platform API; the rest hand off a copy-ready pack
// to outbox/ for a person to post (Google Business Profile, LinkedIn and YouTube need OAuth apps
// that are not wired up yet).
import * as meta from './meta.mjs';
import * as whatsapp from './whatsapp.mjs';
import * as handoff from './handoff.mjs';

export const adapters = {
  facebook: meta.facebook,
  instagram: meta.instagram,
  whatsapp: whatsapp.adapter,
  gbp: handoff.adapter,
  linkedin: handoff.adapter,
  youtube: handoff.adapter,
};

// Falls back to handoff when a live adapter's credentials are missing.
export function pick(channel, env = process.env) {
  const adapter = adapters[channel];
  if (!adapter) throw new Error(`no adapter for ${channel}`);
  if (adapter.mode === 'live' && adapter.missing(env).length) return { ...handoff.adapter, fallbackFrom: channel };
  return adapter;
}
