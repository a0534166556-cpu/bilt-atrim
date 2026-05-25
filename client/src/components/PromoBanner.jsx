import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function PromoBanner() {
  const { store } = useStore();
  if (!store?.promoActive || !store.promoTitle) return null;

  const link = store.promoLink?.startsWith('http')
    ? store.promoLink
    : store.promoLink || '/sales';
  const isExternal = link.startsWith('http');

  const content = (
    <>
      <strong>{store.promoTitle}</strong>
      {store.promoText && <span className="promo-banner-text">{store.promoText}</span>}
      <span className="promo-banner-cta">למבצעים ←</span>
    </>
  );

  return (
    <div className="promo-banner">
      <div className="container promo-banner-inner">
        {isExternal ? (
          <a href={link} target="_blank" rel="noreferrer" className="promo-banner-link">
            {content}
          </a>
        ) : (
          <Link to={link} className="promo-banner-link">
            {content}
          </Link>
        )}
      </div>
    </div>
  );
}
