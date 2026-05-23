import { Link } from 'react-router-dom';

export default function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="ניווט">
      <Link to="/">דף הבית</Link>
      {items.map((item, i) => (
        <span key={i}>
          <span className="sep"> / </span>
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
