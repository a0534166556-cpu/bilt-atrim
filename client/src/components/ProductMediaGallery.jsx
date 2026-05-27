import { useEffect, useMemo, useState } from 'react';

function videoMimeType(url) {
  if (/\.webm(\?|$)/i.test(url)) return 'video/webm';
  return 'video/mp4';
}

function GalleryVideo({ item, poster, productName }) {
  const [src, setSrc] = useState(item.url);
  const [failed, setFailed] = useState(false);
  const [fallbackStep, setFallbackStep] = useState(0);

  useEffect(() => {
    setSrc(item.url);
    setFailed(false);
    setFallbackStep(0);
  }, [item.url]);

  const handleError = () => {
    const original = item.originalUrl;
    if (fallbackStep === 0 && original && src !== original) {
      setFallbackStep(1);
      setSrc(original);
      return;
    }
    if (fallbackStep <= 1 && original && !src.includes('/api/media/cj-video')) {
      setFallbackStep(2);
      setSrc(`/api/media/cj-video?url=${encodeURIComponent(original)}`);
      return;
    }
    setFailed(true);
  };

  if (failed) {
    return (
      <div className="product-video-fallback">
        <p>לא ניתן לטעון את הסרטון בדפדפן.</p>
        {item.originalUrl && (
          <a
            href={item.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
          >
            פתח סרטון בחלון חדש
          </a>
        )}
      </div>
    );
  }

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

export default function ProductMediaGallery({ images = [], videos = [], productName = '' }) {
  const media = useMemo(() => {
    const items = [];
    const seen = new Set();

    (videos || []).forEach((v) => {
      const url = typeof v === 'string' ? v : v?.url;
      const originalUrl = typeof v === 'object' ? v.originalUrl || url : url;
      if (!url || seen.has(url)) return;
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
  }, [images, videos]);

  const [active, setActive] = useState(0);
  const videoCount = media.filter((m) => m.type === 'video').length;

  useEffect(() => {
    setActive(0);
  }, [media.length, videos.length]);

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
          <GalleryVideo item={current} poster={poster} productName={productName} />
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
