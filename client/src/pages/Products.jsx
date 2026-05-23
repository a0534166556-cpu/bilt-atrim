import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { fetchProducts, fetchCategories } from '../api';
import ProductCard from '../components/ProductCard';
import ProductFilters from '../components/ProductFilters';

export default function Products() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const q = searchParams.get('q') || '';

  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = Object.fromEntries(searchParams.entries());
    fetchProducts(params)
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [searchParams]);

  return (
    <>
      <Helmet>
        <title>{q ? `חיפוש: ${q}` : 'כל המוצרים'} | מרקט גוגל</title>
      </Helmet>
      <div className="container page products-page">
        <h1>{q ? `תוצאות: "${q}"` : 'כל המוצרים'}</h1>
        <div className="products-layout">
          <ProductFilters categories={categories} />
          <div className="products-main">
            {loading ? (
              <div className="loading-grid">
                {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton-card" />)}
              </div>
            ) : products.length === 0 ? (
              <p className="empty">לא נמצאו מוצרים</p>
            ) : (
              <>
                <p className="results-count">{products.length} מוצרים</p>
                <div className="products-grid">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
