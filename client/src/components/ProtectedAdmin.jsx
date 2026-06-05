import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedAdmin({ children }) {
  const { user, loading } = useAuth();
  const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken');

  if (loading) {
    return <div className="container page"><p>טוען...</p></div>;
  }

  if (!token && !user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user && user.role !== 'admin') {
    return <Navigate to="/account" replace />;
  }

  return children;
}
