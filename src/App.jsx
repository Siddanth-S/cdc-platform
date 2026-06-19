import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import { lazy, Suspense, useEffect } from 'react';
import { seedDatabase } from './seedFirebase';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

// Route-level code splitting: a phone on a slow connection only downloads
// Login + Dashboard up front instead of every page's JS in one bundle.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const DriveRoom = lazy(() => import('./pages/DriveRoom'));
const DirectMessage = lazy(() => import('./pages/DirectMessage'));

const RouteFallback = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
    Loading...
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
        Authenticating...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function AppRoutes() {
  const location = useLocation();
  const isAuthRoute = location.pathname !== '/login';
  const routeKey = isAuthRoute ? 'auth' : 'login';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -30 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, overflow: 'hidden' }}
      >
        <Suspense fallback={<RouteFallback />}>
          <Routes location={location}>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="drive/:id" element={<DriveRoom />} />
              <Route path="dm/:id" element={<DirectMessage />} />
            </Route>
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  useEffect(() => {
    seedDatabase();
  }, []);

  return (
    <AuthProvider>
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: 'rgba(30, 41, 59, 0.95)',
            color: '#fff',
            border: '1px solid var(--primary-color)',
            backdropFilter: 'blur(10px)',
          },
        }}
      />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
