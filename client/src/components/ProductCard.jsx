import { Link } from 'react-router-dom';
import { formatPrice } from '../api';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import StarRating from './StarRating';

export default function ProductCard({ product }) {
  const { toggle, has } = useWishlist();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const outOfStock = Number(product.stock) === 0;

  const handleQuickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) {
      showToast('המוצר אזל מהמלאי', 'error');
      return;
    }
    const ok = addItem(product, 1);
    showToast(ok ? 'נוסף לסל!' : 'לא ניתן להוסיף לסל', ok ? 'success' : 'error');
  };

  return (
    <article className={`product-card ${outOfStock ? 'out-of-stock' : ''}`}>
      <div className="product-card-badges">
        {product.onSale && <span className="badge-sale">מבצע</span>}
        {product.featured && <span className="badge-featured">מומלץ</span>}
        {outOfStock && <span className="badge-out">אזל מהמלאי</span>}
        {product.stock > 0 && product.stock < 5 && (
          <span className="badge-low">מלאי מוגבל</span>
        )}
      </div>
      <button
        className={`wishlist-btn ${has(product.id) ? 'active' : ''}`}
        onClick={() => toggle(product.id)}
        aria-label="מועדפים"
      >
        {has(product.id) ? '♥' : '♡'}
      </button>
      <Link to={`/product/${product.id}`} className="product-card-image">
        <img src={product.image} alt={product.name} loading="lazy" />
      </Link>
      <div className="product-card-body">
        <span className="product-brand">{product.brand}</span>
        <Link to={`/product/${product.id}`}>
          <h3>{product.name}</h3>
        </Link>
        {product.reviewCount > 0 && (
          <div className="product-card-rating">
            <StarRating value={Math.round(product.averageRating)} readonly size="sm" />
            <span>({product.reviewCount})</span>
          </div>
        )}
        <div className="product-prices">
          <span className="product-price">{formatPrice(product.effectivePrice)}</span>
          {product.onSale && (
            <span className="product-price-old">{formatPrice(product.price)}</span>
          )}
        </div>
        <div className="product-card-actions">
          <Link to={`/product/${product.id}`} className="btn btn-outline btn-sm">
            פרטים
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleQuickAdd}
            disabled={outOfStock}
          >
            {outOfStock ? 'אזל' : '+ לסל'}
          </button>
        </div>
      </div>
    </article>
  );
}
