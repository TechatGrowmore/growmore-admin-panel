import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HRAuthProvider, useHRAuth } from './context/HRAuthContext';
import { DriverAuthProvider, useDriverAuth } from './context/DriverAuthContext';

// Existing Admin Pages
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

// HR Pages
import HRLoginPage from './pages/hr/HRLoginPage';
import HRLayout from './pages/hr/HRLayout';
import HROverviewPage from './pages/hr/HROverviewPage';
import HREmployeesPage from './pages/hr/HREmployeesPage';
import HRPartTimePage from './pages/hr/HRPartTimePage';
import HRCalendarPage from './pages/hr/HRCalendarPage';

// Accountant Pages
import AccountantLoginPage from './pages/accountant/AccountantLoginPage';
import AccountantOverviewPage from './pages/accountant/AccountantOverviewPage';
import AccountantVerificationPage from './pages/accountant/AccountantVerificationPage';
import AccountantEmployeesPage from './pages/accountant/AccountantEmployeesPage';
import AccountantAttendancePage from './pages/accountant/AccountantAttendancePage';
import AccountantLeavesPage from './pages/accountant/AccountantLeavesPage';

// Driver Pages
import DriverLoginPage from './pages/driver/DriverLoginPage';
import DriverDashboard from './pages/driver/DriverDashboard';

// Public Registration & Punch Pages
import RegisterFullTimePage from './pages/RegisterFullTimePage';
import RegisterPartTimePage from './pages/RegisterPartTimePage';
import PunchInPage from './pages/PunchInPage';

/**
 * Super Admin / Operations Manager Protected Route
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

/**
 * HR Protected Route
 */
function HRProtectedRoute({ children }) {
  const { user, loading } = useHRAuth();
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>Authenticating HR...</span>
      </div>
    );
  }
  if (!user || user.role !== 'hr') {
    return <Navigate to="/hr/login" replace />;
  }
  return children;
}

/**
 * Accountant Protected Route
 */
function AccountantProtectedRoute({ children }) {
  const { user, loading } = useHRAuth();
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>Authenticating Accountant...</span>
      </div>
    );
  }
  if (!user || user.role !== 'accountant') {
    return <Navigate to="/accountant/login" replace />;
  }
  return children;
}

/**
 * Driver Protected Route
 */
function DriverProtectedRoute({ children }) {
  const { user, loading } = useDriverAuth();
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <span>Authenticating Driver...</span>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/driver/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <HRAuthProvider>
        <DriverAuthProvider>
          <BrowserRouter>
            <Routes>
              {/* ─── EXISTING ADMIN / MANAGER ROUTES ─── */}
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

              {/* ─── PUBLIC REGISTRATION & PUNCH ROUTES ─── */}
              <Route path="/register/fulltime" element={<RegisterFullTimePage />} />
              <Route path="/register/fulltime/:token" element={<RegisterFullTimePage />} />
              <Route path="/register/parttime" element={<RegisterPartTimePage />} />
              <Route path="/register/parttime/:token" element={<RegisterPartTimePage />} />
              <Route path="/punchin/:token" element={<PunchInPage />} />

              {/* ─── HR PORTAL ROUTES ─── */}
              <Route path="/hr/login" element={<HRLoginPage />} />
              <Route
                path="/hr/dashboard"
                element={
                  <HRProtectedRoute>
                    <HRLayout isAccountant={false} />
                  </HRProtectedRoute>
                }
              >
                <Route index element={<HROverviewPage />} />
                <Route path="employees" element={<HREmployeesPage />} />
                <Route path="parttime" element={<HRPartTimePage />} />
                <Route path="calendar" element={<HRCalendarPage />} />
              </Route>

              {/* ─── ACCOUNTANT PORTAL ROUTES ─── */}
              <Route path="/accountant/login" element={<AccountantLoginPage />} />
              <Route
                path="/accountant/dashboard"
                element={
                  <AccountantProtectedRoute>
                    <HRLayout isAccountant={true} />
                  </AccountantProtectedRoute>
                }
              >
                <Route index element={<AccountantOverviewPage />} />
                <Route path="verification" element={<AccountantVerificationPage />} />
                <Route path="employees" element={<AccountantEmployeesPage />} />
                <Route path="calendar" element={<HRCalendarPage />} />
                <Route path="attendance" element={<AccountantAttendancePage />} />
                <Route path="leaves" element={<AccountantLeavesPage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="revenue" element={<RevenuePage />} />
                <Route path="transactions" element={<TransactionsPage />} />
              </Route>

              {/* ─── DRIVER PORTAL ROUTES ─── */}
              <Route path="/driver/login" element={<DriverLoginPage />} />
              <Route
                path="/driver/dashboard"
                element={
                  <DriverProtectedRoute>
                    <DriverDashboard />
                  </DriverProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </DriverAuthProvider>
      </HRAuthProvider>
    </AuthProvider>
  );
}
