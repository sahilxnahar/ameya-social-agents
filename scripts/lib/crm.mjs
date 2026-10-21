// Ameya CRM client (ameyacrm /api/v1). Reading new leads needs a read-only API token; recording a
// conversation needs a write token and only happens from the publisher, after owner approval.
const base = (env) => (env.CRM_API_URL || '').replace(/\/+$/, '');

async function call(env, path, { token, method = 'GET', body } = {}, fetchImpl = fetch) {
  const res = await fetchImpl(`${base(env)}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(`CRM ${res.status}: ${data.error || 'request failed'}`);
  return data;
}

export const canRead = (env) => Boolean(env.CRM_API_URL && env.CRM_READ_TOKEN);
export const canWrite = (env) => Boolean(env.CRM_API_URL && env.CRM_WRITE_TOKEN);

export async function newLeads(env = process.env, fetchImpl = fetch, limit = 50) {
  if (!canRead(env)) throw new Error('set CRM_API_URL and CRM_READ_TOKEN in .env to read leads');
  const data = await call(env, `/api/v1/leads?status=NEW&limit=${limit}`, { token: env.CRM_READ_TOKEN }, fetchImpl);
  return data.data || [];
}

const SOURCE_BY_CHANNEL = { instagram: 'CAMPAIGN', facebook: 'CAMPAIGN', linkedin: 'CAMPAIGN', youtube: 'CAMPAIGN', whatsapp: 'OTHER', gbp: 'OTHER' };
const TEMPS = ['HOT', 'WARM', 'COLD'];

export function leadPayload(item) {
  const l = item.lead || {};
  const temperature = String(l.temperature || '').toUpperCase();
  return {
    name: l.name || 'Social lead',
    ...(l.phone ? { phone: String(l.phone) } : {}),
    ...(l.email ? { email: String(l.email).toLowerCase() } : {}),
    source: l.nri ? 'NRI_DESK' : SOURCE_BY_CHANNEL[item.channel] || 'OTHER',
    requirement: [l.project, l.requirement].filter(Boolean).join(' · ').slice(0, 300) || undefined,
    ...(TEMPS.includes(temperature) ? { temperature } : {}),
    customFields: { socialChannel: item.channel, socialQueueId: item.id },
  };
}

export async function recordLead(item, env = process.env, fetchImpl = fetch) {
  if (!canWrite(env)) throw new Error('set CRM_API_URL and CRM_WRITE_TOKEN in .env to record leads');
  const data = await call(env, '/api/v1/leads', { token: env.CRM_WRITE_TOKEN, method: 'POST', body: leadPayload(item) }, fetchImpl);
  return { id: data.id, reference: data.reference, action: data.action };
}
