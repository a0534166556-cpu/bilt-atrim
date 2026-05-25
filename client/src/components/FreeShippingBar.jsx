import { formatPrice } from '../api';
import { useStore } from '../context/StoreContext';

export default function FreeShippingBar({ subtotal }) {
  const { store } = useStore();
  const min = Number(store?.freeShippingMin) || 0;
  if (min <= 0 || subtotal <= 0) return null;

  const remaining = Math.max(0, min - subtotal);
  const progress = Math.min(100, (subtotal / min) * 100);
  const free = remaining <= 0;

  return (
    <div className={`free-shipping-bar ${free ? 'free-shipping-bar--done' : ''}`}>
      <p>
        {free
          ? '🎉 מגיע לך משלוח חינם!'
          : `עוד ${formatPrice(remaining)} למשלוח חינם`}
      </p>
      <div className="free-shipping-track">
        <div className="free-shipping-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
