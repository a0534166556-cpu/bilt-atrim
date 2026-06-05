import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedAdmin from './components/ProtectedAdmin';
import Home from './pages/Home';
import Products from './pages/Products';
import Category from './pages/Category';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import Wishlist from './pages/Wishlist';
import TrackOrder from './pages/TrackOrder';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';
import Account from './pages/Account';
import Sales from './pages/Sales';
import ShippingInfo from './pages/ShippingInfo';
import ReturnsPolicy from './pages/ReturnsPolicy';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductForm from './pages/admin/AdminProductForm';
import AdminOrders from './pages/admin/AdminOrders';
import AdminSettings from './pages/admin/AdminSettings';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminCJImport from './pages/admin/AdminCJImport';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/category/:id" element={<Category />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success/:orderId" element={<OrderSuccess />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/track-order" element={<TrackOrder />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account" element={<Account />} />
        <Route path="/shipping" element={<ShippingInfo />} />
        <Route path="/returns" element={<ReturnsPolicy />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedAdmin><AdminDashboard /></ProtectedAdmin>} />
        <Route
          path="/admin/products"
          element={
            <ProtectedAdmin>
              <AdminProducts />
            </ProtectedAdmin>
          }
        />
        <Route
          path="/admin/products/new"
          element={
            <ProtectedAdmin>
              <AdminProductForm />
            </ProtectedAdmin>
          }
        />
        <Route
          path="/admin/products/:id/edit"
          element={
            <ProtectedAdmin>
              <AdminProductForm />
            </ProtectedAdmin>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <ProtectedAdmin>
              <AdminOrders />
            </ProtectedAdmin>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedAdmin>
              <AdminSettings />
            </ProtectedAdmin>
          }
        />
        <Route
          path="/admin/coupons"
          element={
            <ProtectedAdmin>
              <AdminCoupons />
            </ProtectedAdmin>
          }
        />
        <Route
          path="/admin/cj"
          element={
            <ProtectedAdmin>
              <AdminCJImport />
            </ProtectedAdmin>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
