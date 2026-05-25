import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useStore } from '../context/StoreContext';
import PromoBanner from './PromoBanner';

export default function Layout({ children }) {
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const { store } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = location.pathname.startsWith('/admin');

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/products?q=${encodeURIComponent(query.trim())}`);
      setMenuOpen(false);
    }
  };

  if (isAdmin) return <div className="app admin-app">{children}</div>;

  const storeName = store?.name || 'מרקט גוגל';

  return (
    <div className="app">
      <div className="top-bar">
        <div className="container top-bar-inner">
          <span>{store?.shippingInfo || 'משלוח מהיר לכל הארץ'}</span>
          {store?.phone && <a href={`tel:${store.phone}`}>📞 {store.phone}</a>}
        </div>
      </div>

      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">
            <span className="logo-icon">G</span>
            <span>{storeName}</span>
          </Link>

          <form className="search-form" onSubmit={handleSearch}>
            <input
              type="search"
              placeholder="חיפוש מוצרים..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" aria-label="חיפוש">🔍</button>
          </form>

          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="תפריט">
            ☰
          </button>

          <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
            <Link to="/products" onClick={() => setMenuOpen(false)}>מוצרים</Link>
            <Link to="/sales" onClick={() => setMenuOpen(false)} className="nav-sale">מבצעים</Link>
            <Link to="/wishlist" onClick={() => setMenuOpen(false)}>מועדפים ({wishCount})</Link>
            <Link to="/track-order" onClick={() => setMenuOpen(false)}>מעקב הזמנה</Link>
            <Link to="/contact" onClick={() => setMenuOpen(false)}>צור קשר</Link>
            <Link to="/cart" className="cart-link" onClick={() => setMenuOpen(false)}>
              🛒 סל ({count})
            </Link>
            <Link
              to={localStorage.getItem('adminToken') ? '/admin' : '/admin/login'}
              className="admin-link"
              onClick={() => setMenuOpen(false)}
            >
              ניהול
            </Link>
          </nav>
        </div>
      </header>

      <PromoBanner />

      <main className="main">{children}</main>

      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <strong>{storeName}</strong>
            <p>{store?.tagline}</p>
          </div>
          <div>
            <h4>קניות</h4>
            <Link to="/products">כל המוצרים</Link>
            <Link to="/sales">מבצעים</Link>
            <Link to="/wishlist">מועדפים</Link>
            <Link to="/cart">סל קניות</Link>
          </div>
          <div>
            <h4>שירות</h4>
            <Link to="/track-order">מעקב הזמנה</Link>
            <Link to="/shipping">משלוחים</Link>
            <Link to="/returns">החזרות</Link>
            <Link to="/contact">צור קשר</Link>
          </div>
          <div>
            <h4>יצירת קשר</h4>
            {store?.email && <p>✉️ {store.email}</p>}
            {store?.phone && <p>📞 {store.phone}</p>}
            {store?.whatsapp && (
              <a
                href={`https://wa.me/${store.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="whatsapp-link"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>
        <p className="copyright">© {new Date().getFullYear()} {storeName}</p>
      </footer>
    </div>
  );
}
