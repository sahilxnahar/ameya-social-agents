// Facebook Page and Instagram professional account publishing through the Meta Graph API.
// Instagram needs a public image or video URL in content.media[0].
const graph = (env) => `https://graph.facebook.com/${env.META_GRAPH_VERSION || 'v23.0'}`;

async function call(url, params, fetchImpl) {
  const res = await fetchImpl(url, { method: 'POST', body: new URLSearchParams(params) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(`Meta API ${res.status}: ${body.error?.message || 'unknown error'}`);
  return body;
}

export const facebook = {
  mode: 'live',
  missing: (env) => ['META_PAGE_ID', 'META_PAGE_TOKEN'].filter((k) => !env[k]),
  async send(item, env = process.env, fetchImpl = fetch) {
    if (item.kind !== 'post') throw new Error(`facebook adapter only publishes posts, got ${item.kind}`);
    const { text, link, media = [] } = item.content;
    const token = env.META_PAGE_TOKEN;
    const body = media[0]
      ? await call(`${graph(env)}/${env.META_PAGE_ID}/photos`, { url: media[0], caption: text, access_token: token }, fetchImpl)
      : await call(`${graph(env)}/${env.META_PAGE_ID}/feed`, { message: text, ...(link ? { link } : {}), access_token: token }, fetchImpl);
    return { ref: body.post_id || body.id };
  },
};

export const instagram = {
  mode: 'live',
  missing: (env) => ['IG_USER_ID', 'META_PAGE_TOKEN'].filter((k) => !env[k]),
  async send(item, env = process.env, fetchImpl = fetch) {
    if (!['post', 'reel'].includes(item.kind)) throw new Error(`instagram adapter publishes posts and reels, got ${item.kind}`);
    const mediaUrl = item.content.media?.[0];
    if (!mediaUrl) throw new Error('instagram needs a public media URL in content.media[0]');
    const token = env.META_PAGE_TOKEN;
    const isVideo = item.kind === 'reel';
    const container = await call(
      `${graph(env)}/${env.IG_USER_ID}/media`,
      { caption: item.content.text, access_token: token, ...(isVideo ? { media_type: 'REELS', video_url: mediaUrl } : { image_url: mediaUrl }) },
      fetchImpl,
    );
    const done = await call(`${graph(env)}/${env.IG_USER_ID}/media_publish`, { creation_id: container.id, access_token: token }, fetchImpl);
    return { ref: done.id };
  },
};
