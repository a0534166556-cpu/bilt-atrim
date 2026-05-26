import { useMemo, useState } from 'react';

function videoMimeType(url) {
  if (/\.webm(\?|$)/i.test(url)) return 'video/webm';
  return 'video/mp4';
}

export default function ProductMediaGallery({ images = [], videos = [], productName = '' }) {
  const media = useMemo(() => {
    const items = [];
    const seen = new Set();

    (videos || []).forEach((v) => {
      const url = typeof v === 'string' ? v : v?.url;
      if (!url || seen.has(url)) return;
      seen.add(url);
      items.push({
        type: 'video',
        url,
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
  const [videoError, setVideoError] = useState(false);

  if (!media.length) {
    return <div className="product-no-img large">📦</div>;
  }

  const current = media[active] || media[0];
  const poster = current.type === 'video' ? current.poster || images[0] : current.url;

  return (
    <div className="product-media-gallery">
      {media.length > 1 && (
        <div className="product-media-thumbs">
          {media.map((item, i) => (
            <button
              key={item.url + i}
              type="button"
              className={`product-media-thumb ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={item.type === 'video' ? 'סרטון' : 'תמונה'}
            >
              <img src={item.type === 'video' ? item.poster || images[0] : item.url} alt="" />
              {item.type === 'video' && <span className="thumb-play">▶</span>}
            </button>
          ))}
        </div>
      )}

      <div className="product-media-main">
        {current.type === 'video' ? (
          videoError ? (
            <div className="product-video-fallback">
              <p>לא ניתן לטעון את הסרטון בדפדפן.</p>
              <a href={current.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                פתח סרטון בחלון חדש
              </a>
            </div>
          ) : (
            <video
              key={current.url}
              src={current.url}
              poster={poster}
              controls
              playsInline
              preload="metadata"
              className="product-gallery-main"
              onError={() => setVideoError(true)}
            >
              <source src={current.url} type={videoMimeType(current.url)} />
            </video>
          )
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
