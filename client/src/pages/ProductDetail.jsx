import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  fetchProduct,
  fetchRelated,
  fetchReviews,
  addReview,
  formatPrice,
  translateProductContent,
} from '../api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import ProductCard from '../components/ProductCard';
import StarRating from '../components/StarRating';
import Breadcrumbs from '../components/Breadcrumbs';
import RecentlyViewed from '../components/RecentlyViewed';
import ProductDescription from '../components/ProductDescription';
import ProductMediaGallery from '../components/ProductMediaGallery';
import { addRecentlyViewed } from '../hooks/useRecentlyViewed';

function looksEnglish(text) {
  if (!text?.trim()) return false;
  const hebrew = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return latin > 8 && latin > hebrew * 1.5;
}

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [displayName, setDisplayName] = useState(null);
  const [displayDesc, setDisplayDesc] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 5, comment: '' });
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();
  const { showToast } = useToast();

  useEffect(() => {
    setNotFound(false);
    setProduct(null);
    setDisplayName(null);
    setDisplayDesc(null);
    fetchProduct(id)
      .then((p) => {
        setProduct(p);
        addRecentlyViewed(p);
      })
      .catch(() => setNotFound(true));
    fetchRelated(id).then(setRelated).catch(() => {});
    fetchReviews(id).then(setReviews).catch(() => {});
  }, [id]);

  if (notFound) {
    return (
      <div className="container page">
        <p>מוצר לא נמצא</p>
        <Link to="/products" className="btn btn-primary">חזרה למוצרים</Link>
      </div>
    );
  }
  if (!product) return <div className="container page"><p className="loading">טוען...</p></div>;

  const productTitle = displayName ?? product.name;
  const productDescription = displayDesc ?? product.description;
  const galleryImages = (product.images?.length ? product.images : [product.image]).filter(Boolean);
  const galleryVideos =
    product.videos?.length > 0
      ? product.videos
      : product.videoUrl
        ? [{ url: product.videoUrl, poster: galleryImages[0] || '' }]
        : [];
  const mainImage = galleryImages[0] || product.image;
  const outOfStock = Number(product.stock) === 0;

  const showTranslate =
    (looksEnglish(product.description) || looksEnglish(product.name)) && !displayDesc;

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const translated = await translateProductContent({
        name: product.name,
        description: product.description,
      });
      setDisplayName(translated.name || product.name);
      setDisplayDesc(translated.description || product.description);
      showToast('תורגם לעברית');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTranslating(false);
    }
  };

  const handleAdd = () => {
    if (outOfStock) {
      showToast('המוצר אזל מהמלאי', 'error');
      return;
    }
    const ok = addItem(product, quantity);
    showToast(ok ? 'נוסף לסל!' : 'לא ניתן להוסיף לסל', ok ? 'success' : 'error');
  };

  const shareProduct = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, url });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      showToast('הקישור הועתק');
    }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    try {
      await addReview(id, reviewForm);
      const updated = await fetchReviews(id);
      setReviews(updated);
      const p = await fetchProduct(id);
      setProduct(p);
      setReviewForm({ name: '', rating: 5, comment: '' });
      showToast('תודה על הביקורת!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: mainImage,
    sku: product.sku,
    brand: { '@type': 'Brand', name: product.brand },
    aggregateRating: product.reviewCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: product.averageRating,
      reviewCount: product.reviewCount,
    } : undefined,
    offers: {
      '@type': 'Offer',
      price: product.effectivePrice,
      priceCurrency: 'ILS',
      availability: outOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    },
  };

  return (
    <>
      <Helmet>
        <title>{`${productTitle || 'מוצר'} | מרקט גוגל`}</title>
        <meta name="description" content={productDescription} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="container page product-detail">
        <Breadcrumbs items={[{ to: '/products', label: 'מוצרים' }, { label: productTitle }]} />
        <div className="product-detail-grid">
          <div className="product-detail-image">
            {product.onSale && <span className="badge-sale large">מבצע</span>}
            <ProductMediaGallery
              images={galleryImages}
              videos={galleryVideos}
              productName={productTitle}
            />
          </div>
          <div className="product-detail-info">
            <span className="product-brand">{product.brand}</span>
            <h1>{productTitle}</h1>
            {product.reviewCount > 0 && (
              <div className="product-rating-row">
                <StarRating value={Math.round(product.averageRating)} readonly />
                <span>{product.averageRating} ({product.reviewCount} ביקורות)</span>
              </div>
            )}
            <div className="product-prices-lg">
              <span className="product-price-lg">{formatPrice(product.effectivePrice)}</span>
              {product.onSale && (
                <>
                  <span className="product-price-old">{formatPrice(product.price)}</span>
                  {product.discountPercent > 0 && (
                    <span className="badge-sale large">חיסכון {product.discountPercent}%</span>
                  )}
                </>
              )}
            </div>
            {product.onSale && (
              <p className="savings-line">
                אתה חוסך {formatPrice(product.price - product.effectivePrice)}!
              </p>
            )}
            {(showTranslate || displayDesc) && (
              <div className="product-translate-row">
                {showTranslate && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm translate-btn"
                    disabled={translating}
                    onClick={handleTranslate}
                  >
                    {translating ? 'מתרגם...' : 'תרגם לעברית'}
                  </button>
                )}
                {displayDesc && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm translate-btn"
                    onClick={() => {
                      setDisplayDesc(null);
                      setDisplayName(null);
                    }}
                  >
                    הצג מקור (אנגלית)
                  </button>
                )}
                {showTranslate && (
                  <span className="translate-hint">תצוגה בלבד — לשמירה: ניהול → ייבוא CJ → סנכרן עם תרגום</span>
                )}
              </div>
            )}
            <div className="product-desc-block">
              <ProductDescription content={productDescription} plain={Boolean(displayDesc)} />
            </div>
            <p className={`stock-info ${outOfStock ? 'out' : product.stock < 5 ? 'low' : ''}`}>
              {outOfStock ? 'אזל מהמלאי' : `במלאי: ${product.stock} יחידות`}
            </p>

            {!outOfStock && (
              <div className="add-to-cart-row">
                <label>
                  כמות
                  <input
                    type="number"
                    min="1"
                    max={product.stock}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </label>
                <button type="button" className="btn btn-primary btn-lg" onClick={handleAdd}>
                  הוסף לסל
                </button>
                <button
                  className={`btn btn-outline ${has(product.id) ? 'active' : ''}`}
                  onClick={() => toggle(product.id)}
                >
                  {has(product.id) ? '♥ במועדפים' : '♡ הוסף למועדפים'}
                </button>
                <button type="button" className="btn btn-outline" onClick={shareProduct}>
                  שתף
                </button>
              </div>
            )}
          </div>
        </div>

        <section className="reviews-section">
          <h2>ביקורות ({reviews.length})</h2>
          <form className="review-form" onSubmit={handleReview}>
            <label>שמך
              <input
                value={reviewForm.name}
                onChange={(e) => setReviewForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label>דירוג
              <StarRating
                value={reviewForm.rating}
                onChange={(r) => setReviewForm((f) => ({ ...f, rating: r }))}
              />
            </label>
            <label>תגובה
              <textarea
                value={reviewForm.comment}
                onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                rows={3}
              />
            </label>
            <button type="submit" className="btn btn-primary btn-sm">שלח ביקורת</button>
          </form>
          <div className="reviews-list">
            {reviews.map((r) => (
              <div key={r.id} className="review-item">
                <strong>{r.name}</strong>
                <StarRating value={r.rating} readonly size="sm" />
                <p>{r.comment}</p>
                <small>{new Date(r.createdAt).toLocaleDateString('he-IL')}</small>
              </div>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <section className="related-section">
            <h2>מוצרים דומים</h2>
            <div className="products-grid">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
        <RecentlyViewed excludeId={product.id} />
      </div>
    </>
  );
}
