import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import DashboardPage from './pages/dashboard/DashboardPage';
import ClientsPage from './pages/dashboard/ClientsPage';
import ManagersPage from './pages/dashboard/ManagersPage';
import LogsPage from './pages/dashboard/LogsPage';
import BookingsPage from './pages/dashboard/BookingsPage';
import RevenuePage from './pages/dashboard/RevenuePage';
import TransactionsPage from './pages/dashboard/TransactionsPage';
import TeamPage from './pages/dashboard/TeamPage';
import VenuesPage from './pages/dashboard/VenuesPage';

/**
 * ProtectedRoute: checks session via AuthContext.
 * Redirects to "/" if unauthenticated.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>Authenticating...</span>
      </div>
    );
  }

  return user ? children : <Navigate to="/" replace />;
}

/**
 * AdminOnlyRoute: redirects non-superadmin users back to dashboard.
 */
function AdminOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user || user.role !== 'superadmin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route
              path="clients"
              element={
                <AdminOnlyRoute>
                  <ClientsPage />
                </AdminOnlyRoute>
              }
            />
            <Route
              path="managers"
              element={
                <AdminOnlyRoute>
                  <ManagersPage />
                </AdminOnlyRoute>
              }
            />
            <Route
              path="logs"
              element={
                <AdminOnlyRoute>
                  <LogsPage />
                </AdminOnlyRoute>
              }
            />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="revenue" element={<RevenuePage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="venues" element={<VenuesPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
