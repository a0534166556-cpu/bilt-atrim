import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { fetchProducts, fetchCategories } from '../api';
import { useStore } from '../context/StoreContext';
import ProductCard from '../components/ProductCard';
import NewsletterForm from '../components/NewsletterForm';

export default function Home() {
  const { store } = useStore();
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    Promise.all([
      fetchProducts({ featured: 'true' }),
      fetchCategories(),
    ]).then(([prods, cats]) => {
      setFeatured(prods.slice(0, 8));
      setCategories(cats);
    }).catch(console.error);
  }, []);

  const name = store?.name || 'מרקט גוגל';

  return (
    <>
      <Helmet>
        <title>{name} | חנות מקוונת</title>
        <meta name="description" content={store?.tagline || 'חנות מקוונת למכירת מוצרים'} />
      </Helmet>

      <section className="hero">
        <div className="container hero-content">
          <h1>{name}</h1>
          <p>{store?.tagline || 'החנות שלך – קנה בקלות, מכור בגוגל'}</p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary btn-lg">קנה עכשיו</Link>
            <Link to="/sales" className="btn btn-secondary btn-lg">מבצעים 🔥</Link>
          </div>
        </div>
      </section>

      <section className="trust-bar">
        <div className="container trust-items">
          <div>🚚 {store?.shippingInfo || 'משלוח מהיר'}</div>
          <div>🔒 קנייה מאובטחת</div>
          <div>⭐ ביקורות לקוחות</div>
          <div>📱 מעקב הזמנה</div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">קטגוריות</h2>
          <div className="categories-grid">
            {categories.map((cat) => (
              <Link key={cat.id} to={`/category/${cat.id}`} className="category-card">
                <img src={cat.image} alt={cat.name} />
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section deals-strip">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">🔥 מבצעים חמים</h2>
            <Link to="/sales">כל המבצעים →</Link>
          </div>
          <div className="products-grid">
            {featured.filter((p) => p.onSale).slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {featured.filter((p) => p.onSale).length === 0 && (
            <p className="empty-inline">אין מבצעים כרגע – <Link to="/products">לכל המוצרים</Link></p>
          )}
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">מוצרים מומלצים</h2>
            <Link to="/products">הצג הכל →</Link>
          </div>
          <div className="products-grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="section newsletter-section">
        <div className="container">
          <NewsletterForm />
        </div>
      </section>
    </>
  );
}
