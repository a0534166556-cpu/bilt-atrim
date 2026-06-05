import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHelmet from '../components/PageHelmet';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      showToast('סיסמה – לפחות 6 תווים', 'error');
      return;
    }
    if (form.password !== form.confirm) {
      showToast('הסיסמאות לא תואמות', 'error');
      return;
    }
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      showToast('נרשמת בהצלחה!');
      navigate('/account');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page auth-page">
      <PageHelmet title="הרשמה" />
      <div className="auth-card">
        <h1>יצירת חשבון</h1>
        <p>הירשם לצפייה בהזמנות שלך ומילוי מהיר בקופה</p>
        <form onSubmit={handleSubmit}>
          <label>
            שם מלא
            <input name="name" required value={form.name} onChange={handleChange} />
          </label>
          <label>
            אימייל
            <input name="email" type="email" required value={form.email} onChange={handleChange} />
          </label>
          <label>
            טלפון
            <input name="phone" type="tel" value={form.phone} onChange={handleChange} />
          </label>
          <label>
            סיסמה (לפחות 6 תווים)
            <input name="password" type="password" required value={form.password} onChange={handleChange} />
          </label>
          <label>
            אימות סיסמה
            <input name="confirm" type="password" required value={form.confirm} onChange={handleChange} />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'נרשם...' : 'הרשמה'}
          </button>
        </form>
        <p className="auth-footer">
          כבר יש לך חשבון? <Link to="/login">התחבר</Link>
        </p>
      </div>
    </div>
  );
}
