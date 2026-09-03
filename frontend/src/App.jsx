import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import DashboardPage from './pages/dashboard/DashboardPage';
import ClientsPage from './pages/dashboard/ClientsPage';
import BookingsPage from './pages/dashboard/BookingsPage';
import RevenuePage from './pages/dashboard/RevenuePage';
import TransactionsPage from './pages/dashboard/TransactionsPage';
import TeamPage from './pages/dashboard/TeamPage';
import VenuesPage from './pages/dashboard/VenuesPage';

/**
 * ProtectedRoute: checks session by calling /api/auth/me.
 * Redirects to "/" if unauthenticated.
 */
function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => {
        setAuthed(r.ok);
        setChecking(false);
      })
      .catch(() => {
        setAuthed(false);
        setChecking(false);
      });
  }, []);

  if (checking) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>Authenticating...</span>
      </div>
    );
  }

  return authed ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
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
          <Route path="clients" element={<ClientsPage />} />
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
  );
}
