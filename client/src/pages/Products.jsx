import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { fetchProducts, fetchCategories } from '../api';
import ProductCard from '../components/ProductCard';
import ProductFilters from '../components/ProductFilters';

const PAGE_SIZE = 12;

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const q = searchParams.get('q') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = Object.fromEntries(searchParams.entries());
    delete params.page;
    setApiError('');
    fetchProducts(params)
      .then(setProducts)
      .catch((err) => {
        setProducts([]);
        setApiError(err.message || 'שגיאה בטעינת מוצרים');
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = products.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const goToPage = (p) => {
    const next = new URLSearchParams(searchParams);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Helmet>
        <title>{`${q ? `חיפוש: ${q}` : 'כל המוצרים'} | מרקט גוגל`}</title>
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
            ) : apiError ? (
              <div className="empty api-error-box">
                <p><strong>החנות עדיין לא מחוברת לשרת</strong></p>
                <p>{apiError}</p>
                <p className="hint">ב-Netlify הוסף <code>RAILWAY_BACKEND_URL</code> וב-Railway ודא ש-MySQL מחובר.</p>
              </div>
            ) : products.length === 0 ? (
              <p className="empty">לא נמצאו מוצרים</p>
            ) : (
              <>
                <p className="results-count">
                  {products.length} מוצרים
                  {totalPages > 1 && ` · עמוד ${safePage} מתוך ${totalPages}`}
                </p>
                <div className="products-grid">
                  {pageItems.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <nav className="pagination" aria-label="עימוד">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={safePage <= 1}
                      onClick={() => goToPage(safePage - 1)}
                    >
                      → הקודם
                    </button>
                    <span className="pagination-info">{safePage} / {totalPages}</span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={safePage >= totalPages}
                      onClick={() => goToPage(safePage + 1)}
                    >
                      הבא ←
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
