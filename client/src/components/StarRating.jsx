export default function StarRating({ value, onChange, readonly = false, size = 'md' }) {
  return (
    <div className={`stars stars-${size} ${readonly ? 'stars-readonly' : ''}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= value ? 'star filled' : 'star'}
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
          aria-label={`${star} כוכבים`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
