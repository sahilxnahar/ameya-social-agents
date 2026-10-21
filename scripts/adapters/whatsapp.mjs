// WhatsApp Business Cloud API. Free-form text only works inside the 24-hour window after the
// customer's last message; outside it Meta requires an approved template, which this does not send.
export const adapter = {
  mode: 'live',
  missing: (env) => ['WA_PHONE_NUMBER_ID', 'WA_TOKEN'].filter((k) => !env[k]),
  async send(item, env = process.env, fetchImpl = fetch) {
    const to = String(item.target || '').replace(/[^\d]/g, '');
    if (to.length < 10) throw new Error('whatsapp target must be a phone number with country code');
    const version = env.META_GRAPH_VERSION || 'v23.0';
    const res = await fetchImpl(`https://graph.facebook.com/${version}/${env.WA_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: item.content.text } }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) throw new Error(`WhatsApp API ${res.status}: ${body.error?.message || 'unknown error'}`);
    return { ref: body.messages?.[0]?.id };
  },
};
