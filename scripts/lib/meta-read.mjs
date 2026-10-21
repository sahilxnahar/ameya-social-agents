// Read-only Meta Graph calls: comments to answer and post insights for the weekly report.
const graph = (env) => `https://graph.facebook.com/${env.META_GRAPH_VERSION || 'v23.0'}`;

async function get(env, path, params, fetchImpl) {
  const qs = new URLSearchParams({ ...params, access_token: env.META_PAGE_TOKEN });
  const res = await fetchImpl(`${graph(env)}/${path}?${qs}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(`Meta API ${res.status}: ${body.error?.message || 'unknown error'}`);
  return body;
}

export const canReadInstagram = (env) => Boolean(env.IG_USER_ID && env.META_PAGE_TOKEN);
export const canReadFacebook = (env) => Boolean(env.META_PAGE_ID && env.META_PAGE_TOKEN);

export async function instagramComments(env, fetchImpl = fetch, { posts = 10 } = {}) {
  const body = await get(env, `${env.IG_USER_ID}/media`, {
    fields: 'id,permalink,caption,timestamp,comments.limit(25){id,text,username,timestamp}',
    limit: String(posts),
  }, fetchImpl);
  const own = (env.IG_USERNAME || 'ameyaheights').toLowerCase();
  return (body.data || []).flatMap((m) => (m.comments?.data || [])
    .filter((c) => (c.username || '').toLowerCase() !== own)
    .map((c) => ({ type: 'comment', channel: 'instagram', id: c.id, post: m.permalink, author: c.username, text: c.text, at: c.timestamp })));
}

export async function facebookComments(env, fetchImpl = fetch, { posts = 10 } = {}) {
  const body = await get(env, `${env.META_PAGE_ID}/posts`, {
    fields: 'id,permalink_url,created_time,comments.limit(25){id,message,from,created_time}',
    limit: String(posts),
  }, fetchImpl);
  return (body.data || []).flatMap((p) => (p.comments?.data || [])
    .filter((c) => c.from?.id !== env.META_PAGE_ID)
    .map((c) => ({ type: 'comment', channel: 'facebook', id: c.id, post: p.permalink_url, author: c.from?.name || null, text: c.message, at: c.created_time })));
}

export async function instagramInsights(env, fetchImpl = fetch, { posts = 25 } = {}) {
  const body = await get(env, `${env.IG_USER_ID}/media`, {
    fields: 'id,permalink,timestamp,caption,media_product_type,like_count,comments_count',
    limit: String(posts),
  }, fetchImpl);
  const out = [];
  for (const m of body.data || []) {
    const row = { channel: 'instagram', id: m.id, url: m.permalink, at: m.timestamp, caption: (m.caption || '').slice(0, 80), likes: m.like_count, comments: m.comments_count };
    try {
      const ins = await get(env, `${m.id}/insights`, { metric: 'reach,saved,shares,total_interactions' }, fetchImpl);
      for (const metric of ins.data || []) row[metric.name] = metric.values?.[0]?.value ?? null;
    } catch (e) {
      row.insights_error = e.message;
    }
    out.push(row);
  }
  return out;
}

export async function facebookInsights(env, fetchImpl = fetch, { posts = 25 } = {}) {
  const body = await get(env, `${env.META_PAGE_ID}/posts`, {
    fields: 'id,permalink_url,created_time,message,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)',
    limit: String(posts),
  }, fetchImpl);
  return (body.data || []).map((p) => ({
    channel: 'facebook',
    id: p.id,
    url: p.permalink_url,
    at: p.created_time,
    caption: (p.message || '').slice(0, 80),
    reactions: p.reactions?.summary?.total_count ?? null,
    comments: p.comments?.summary?.total_count ?? null,
    shares: p.shares?.count ?? 0,
  }));
}
