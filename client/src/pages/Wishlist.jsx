import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useWishlist } from '../context/WishlistContext';
import { fetchProducts } from '../api';
import ProductCard from '../components/ProductCard';

export default function Wishlist() {
  const { ids } = useWishlist();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (ids.length === 0) {
      setProducts([]);
      return;
    }
    fetchProducts().then((all) => {
      setProducts(all.filter((p) => ids.includes(p.id)));
    });
  }, [ids]);

  return (
    <div className="container page">
      <Helmet><title>מועדפים | מרקט גוגל</title></Helmet>
      <h1>המועדפים שלי</h1>
      {products.length === 0 ? (
        <p className="empty">אין מוצרים במועדפים עדיין</p>
      ) : (
        <div className="products-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
