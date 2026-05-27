import { Readable } from 'stream';

const CJ_REFERER = 'https://developers.cjdropshipping.com/';
export const MIN_PRODUCT_VIDEOS = 3;

export function isCjVideoHost(url) {
  return /cjdropshipping\.com/i.test(String(url || ''));
}

export function isPlayableCjVideoUrl(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  if (u.includes('download-only-api.cjdropshipping.com')) return true;
  if (/\.(mp4|webm|m3u8)(\?|$)/i.test(u)) return true;
  if (u.includes('video-cf.cjdropshipping.com') && !/\.(mp4|webm)/i.test(u)) return false;
  return /\.(mp4|webm)/i.test(u);
}

/** מנסה לתקן כתובות CJ שבורות */
export function normalizeCjVideoUrl(url) {
  let u = String(url || '').trim();
  if (!u) return null;
  if (u.startsWith('//')) u = `https:${u}`;

  if (isPlayableCjVideoUrl(u)) return u;

  if (u.includes('video-cf.cjdropshipping.com') && !/\.(mp4|webm)/i.test(u)) {
    const withMp4 = `${u.replace(/\/$/, '')}.mp4`;
    if (isPlayableCjVideoUrl(withMp4)) return withMp4;
    return null;
  }

  if (/^[a-f0-9]{16,}$/i.test(u)) return null;

  return null;
}

export function proxyVideoUrl(url) {
  const raw = normalizeCjVideoUrl(url) || url;
  if (!raw || !isCjVideoHost(raw) || !isPlayableCjVideoUrl(raw)) return raw || '';
  return `/api/media/cj-video?url=${encodeURIComponent(raw)}`;
}

export function mapProductMediaForClient(product) {
  if (!product) return product;

  const mapVideo = (v) => {
    const raw = typeof v === 'string' ? v : v?.url;
    const normalized = normalizeCjVideoUrl(raw);
    if (!normalized || !isPlayableCjVideoUrl(normalized)) return null;
    return {
      url: proxyVideoUrl(normalized),
      originalUrl: normalized,
      poster: typeof v === 'object' ? v.poster || '' : '',
    };
  };

  const seen = new Set();
  const videos = (product.videos || [])
    .map(mapVideo)
    .filter((v) => {
      if (!v || seen.has(v.originalUrl)) return false;
      seen.add(v.originalUrl);
      return true;
    });

  const rawMain = normalizeCjVideoUrl(product.videoUrl);
  const videoUrl =
    rawMain && isPlayableCjVideoUrl(rawMain) ? proxyVideoUrl(rawMain) : videos[0]?.url || '';

  return { ...product, videoUrl, videos };
}

export async function streamCjVideo(req, res) {
  const raw = String(req.query.url || '');
  let url;
  try {
    url = decodeURIComponent(raw);
  } catch {
    return res.status(400).end();
  }

  url = normalizeCjVideoUrl(url) || url;
  if (!/^https:\/\/(download-only-api|video-cf)\.cjdropshipping\.com/i.test(url)) {
    return res.status(403).json({ error: 'URL לא מורשה' });
  }

  const headers = { Referer: CJ_REFERER, 'User-Agent': 'Mozilla/5.0' };
  if (req.headers.range) headers.Range = req.headers.range;

  let upstream = await fetch(url, { headers, redirect: 'follow' });

  if (!upstream.ok && req.headers.range) {
    delete headers.Range;
    upstream = await fetch(url, { headers, redirect: 'follow' });
  }

  res.status(upstream.status);
  res.setHeader('Access-Control-Allow-Origin', '*');

  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(name);
    if (v) res.setHeader(name, v);
  }
  if (!res.getHeader('content-type')) res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  if (!upstream.ok || !upstream.body) {
    return res.end();
  }

  Readable.fromWeb(upstream.body).pipe(res);
}
