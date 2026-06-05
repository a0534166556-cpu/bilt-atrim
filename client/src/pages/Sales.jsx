import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { fetchProducts } from '../api';
import ProductCard from '../components/ProductCard';

export default function Sales() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts({ onSale: 'true', sort: 'discount' })
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Helmet>
        <title>מבצעים והנחות | NovaShop</title>
        <meta name="description" content="כל המוצרים במבצע עם הנחות מיוחדות" />
      </Helmet>
      <div className="container page sales-page">
        <div className="page-hero sales-hero">
          <h1>🔥 מבצעים והנחות</h1>
          <p>מוצרים נבחרים במחירים מוזלים – מוגבל בכמות המלאי</p>
        </div>

        {loading && <p className="loading">טוען מבצעים...</p>}
        {error && (
          <div className="api-error-box">
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && products.length === 0 && (
          <p className="empty">אין מבצעים פעילים כרגע – חזרו בקרוב!</p>
        )}
        {!loading && products.length > 0 && (
          <>
            <p className="results-count">{products.length} מוצרים במבצע</p>
            <div className="products-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
