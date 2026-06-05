import { useEffect, useMemo, useRef, useState } from 'react';
import { refreshProductVideos } from '../api';

function videoMimeType(url) {
  if (/\.webm(\?|$)/i.test(url)) return 'video/webm';
  return 'video/mp4';
}

function GalleryVideo({ item, poster, onDead }) {
  const [src, setSrc] = useState(item.url);
  const [triedOriginal, setTriedOriginal] = useState(false);

  useEffect(() => {
    setSrc(item.url);
    setTriedOriginal(false);
  }, [item.url]);

  const handleError = () => {
    const original = item.originalUrl;
    if (!triedOriginal && original && src !== original) {
      setTriedOriginal(true);
      setSrc(original);
      return;
    }
    onDead?.(item.url);
  };

  return (
    <video
      key={src}
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      className="product-gallery-main"
      onError={handleError}
    >
      <source src={src} type={videoMimeType(src)} />
    </video>
  );
}

export default function ProductMediaGallery({ images = [], videos = [], productName = '', productId }) {
  const [videoList, setVideoList] = useState(videos);
  const [deadVideos, setDeadVideos] = useState(() => new Set());
  const [refreshing, setRefreshing] = useState(false);
  const refreshedRef = useRef(false);

  useEffect(() => {
    setVideoList(videos);
    setDeadVideos(new Set());
    refreshedRef.current = false;
  }, [videos, productId]);

  const tryRefresh = async () => {
    if (refreshedRef.current || !productId) return;
    refreshedRef.current = true;
    setRefreshing(true);
    try {
      const data = await refreshProductVideos(productId);
      if (Array.isArray(data.videos) && data.videos.length) {
        setVideoList(data.videos);
        setDeadVideos(new Set());
      }
    } catch {
      /* נשאר עם התמונות */
    } finally {
      setRefreshing(false);
    }
  };

  const markDead = (url) => {
    setDeadVideos((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
    tryRefresh();
  };

  const media = useMemo(() => {
    const items = [];
    const seen = new Set();

    (videoList || []).forEach((v) => {
      const url = typeof v === 'string' ? v : v?.url;
      const originalUrl = typeof v === 'object' ? v.originalUrl || url : url;
      if (!url || seen.has(url) || deadVideos.has(url)) return;
      seen.add(url);
      items.push({
        type: 'video',
        url,
        originalUrl,
        poster: typeof v === 'object' ? v.poster || '' : '',
      });
    });

    (images || []).forEach((url) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      items.push({ type: 'image', url });
    });

    return items;
  }, [images, videoList, deadVideos]);

  const [active, setActive] = useState(0);
  const videoCount = media.filter((m) => m.type === 'video').length;

  useEffect(() => {
    setActive(0);
  }, [videoList.length]);

  useEffect(() => {
    if (active > media.length - 1) setActive(0);
  }, [media.length, active]);

  if (!media.length) {
    return <div className="product-no-img large">📦</div>;
  }

  const current = media[active] || media[0];
  const poster = current.type === 'video' ? current.poster || images[0] : current.url;

  return (
    <div className="product-media-gallery">
      {videoCount > 0 && (
        <p className="gallery-video-count">
          {videoCount} {videoCount === 1 ? 'סרטון' : 'סרטונים'}
        </p>
      )}
      {refreshing && <p className="gallery-video-count">מרענן סרטון...</p>}
      {media.length > 1 && (
        <div className="product-media-thumbs">
          {media.map((item, i) => (
            <button
              key={`${item.url}-${i}`}
              type="button"
              className={`product-media-thumb ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={item.type === 'video' ? `סרטון ${i + 1}` : `תמונה ${i + 1}`}
            >
              <img src={item.type === 'video' ? item.poster || images[0] : item.url} alt="" />
              {item.type === 'video' && <span className="thumb-play">▶</span>}
            </button>
          ))}
        </div>
      )}

      <div className="product-media-main">
        {current.type === 'video' ? (
          <GalleryVideo item={current} poster={poster} onDead={markDead} />
        ) : (
          <img
            src={current.url}
            alt={productName}
            className="product-gallery-main"
            loading="eager"
          />
        )}
      </div>
    </div>
  );
}
