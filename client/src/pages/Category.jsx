import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { fetchProducts, fetchCategories } from '../api';
import ProductCard from '../components/ProductCard';

export default function Category() {
  const { id } = useParams();
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchProducts({ category: id }),
      fetchCategories().then((cats) => cats.find((c) => c.id === id)),
    ])
      .then(([prods, cat]) => {
        setProducts(prods);
        setCategory(cat);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <>
      <Helmet>
        <title>{category?.name || 'קטגוריה'} | מרקט גוגל</title>
      </Helmet>
      <div className="container page">
        <h1>{category?.name || 'קטגוריה'}</h1>
        {loading ? (
          <p className="loading">טוען...</p>
        ) : (
          <div className="products-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
