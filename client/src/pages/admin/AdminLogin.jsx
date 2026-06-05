import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../../api';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken');
    if (token) navigate('/admin');
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await adminLogin(email.trim(), password);
      localStorage.setItem('authToken', token);
      localStorage.removeItem('adminToken');
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <h1>כניסת מנהל</h1>
        <p>התחבר עם האימייל והסיסמה שלך</p>
        <label>
          אימייל
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          סיסמה
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'מתחבר...' : 'התחבר'}
        </button>
        <a href="/">← חזרה לחנות</a>
      </form>
    </div>
  );
}
