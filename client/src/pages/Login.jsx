import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import PageHelmet from '../components/PageHelmet';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/account';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      showToast(`שלום ${user.name || user.email}!`);
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate(from);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page auth-page">
      <PageHelmet title="התחברות" />
      <div className="auth-card">
        <h1>התחברות</h1>
        <p>התחבר לחשבון שלך לצפייה בהזמנות וקנייה מהירה</p>
        <form onSubmit={handleSubmit}>
          <label>
            אימייל
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            סיסמה
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'מתחבר...' : 'התחבר'}
          </button>
        </form>
        <p className="auth-footer">
          אין לך חשבון? <Link to="/register">הרשמה</Link>
        </p>
        <p className="auth-footer">
          <Link to="/admin/login">כניסת מנהל</Link>
        </p>
      </div>
    </div>
  );
}
