import { useState } from 'react';
import { subscribeNewsletter } from '../api';
import { useToast } from '../context/ToastContext';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await subscribeNewsletter(email);
      showToast(data.message);
      setEmail('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="newsletter-form" onSubmit={handleSubmit}>
      <h3>הירשמו לעדכונים ומבצעים</h3>
      <div className="newsletter-row">
        <input
          type="email"
          placeholder="האימייל שלך"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? '...' : 'הרשמה'}
        </button>
      </div>
    </form>
  );
}
