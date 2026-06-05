import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function NotFound() {
  return (
    <div className="container page not-found">
      <Helmet><title>הדף לא נמצא | NovaShop</title></Helmet>
      <h1>404</h1>
      <p>הדף שחיפשת לא קיים</p>
      <Link to="/" className="btn btn-primary">חזרה לדף הבית</Link>
    </div>
  );
}
