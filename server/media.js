import { Readable } from 'stream';

const CJ_REFERER = 'https://developers.cjdropshipping.com/';

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

export function proxyVideoUrl(url) {
  if (!url || !isCjVideoHost(url) || !isPlayableCjVideoUrl(url)) return url || '';
  return `/api/media/cj-video?url=${encodeURIComponent(url)}`;
}

export function mapProductMediaForClient(product) {
  if (!product) return product;

  const mapVideo = (v) => {
    const raw = typeof v === 'string' ? v : v?.url;
    if (!raw || !isPlayableCjVideoUrl(raw)) return null;
    return {
      url: proxyVideoUrl(raw),
      poster: typeof v === 'object' ? v.poster || '' : '',
    };
  };

  const videos = (product.videos || []).map(mapVideo).filter(Boolean);
  const videoUrl = product.videoUrl && isPlayableCjVideoUrl(product.videoUrl)
    ? proxyVideoUrl(product.videoUrl)
    : videos[0]?.url || '';

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

  if (!/^https:\/\/(download-only-api|video-cf)\.cjdropshipping\.com/i.test(url)) {
    return res.status(403).json({ error: 'URL לא מורשה' });
  }

  const headers = { Referer: CJ_REFERER };
  if (req.headers.range) headers.Range = req.headers.range;

  const upstream = await fetch(url, { headers });
  res.status(upstream.status);

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
