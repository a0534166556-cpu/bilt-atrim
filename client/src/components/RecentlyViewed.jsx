import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRecentlyViewed } from '../hooks/useRecentlyViewed';
import { formatPrice } from '../api';

export default function RecentlyViewed({ excludeId }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(getRecentlyViewed().filter((p) => p.id !== excludeId));
  }, [excludeId]);

  if (items.length === 0) return null;

  return (
    <section className="recently-viewed">
      <h2>נצפו לאחרונה</h2>
      <div className="recently-grid">
        {items.map((p) => (
          <Link key={p.id} to={`/product/${p.id}`} className="recent-item">
            <img src={p.image} alt={p.name} />
            <span>{p.name}</span>
            <strong>{formatPrice(p.effectivePrice)}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}
