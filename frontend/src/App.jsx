import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { WishlistProvider } from "./context/WishlistContext";
import ToastViewport from "./components/ToastViewport";
import HomePage from "./pages/HomePage";
import CategoryPage from "./pages/CategoryPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CustomerDashboard from "./pages/CustomerDashboard";
import SellerDashboard from "./pages/SellerDashboard";
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
import CartPage from "./pages/CartPage";
import AuthPage from "./pages/AuthPage";
import FooterInfoPage from "./pages/FooterInfoPage";
import TrackOrderPage from "./pages/TrackOrderPage";
import PasswordRecoveryPage from "./pages/PasswordRecoveryPage";

function RoleRoute({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <ToastViewport />
          <BrowserRouter>
            <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/category" element={<CategoryPage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/track-order" element={<TrackOrderPage />} />
            <Route path="/info/:slug" element={<FooterInfoPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage register />} />
            <Route
              path="/forgot-password"
              element={<PasswordRecoveryPage />}
            />
            <Route
              path="/reset-password"
              element={<PasswordRecoveryPage reset />}
            />
            <Route
              path="/customer"
              element={
                <RoleRoute role="customer">
                  <CustomerDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/seller"
              element={
                <RoleRoute role="seller">
                  <SellerDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <Suspense
                  fallback={
                    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
                      Loading admin dashboard...
                    </div>
                  }
                >
                  <RoleRoute role="admin">
                    <AdminDashboard />
                  </RoleRoute>
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
