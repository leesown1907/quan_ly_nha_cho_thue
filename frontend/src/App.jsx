import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeedbackProvider } from './context/FeedbackContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Tenants from './pages/Tenants';
import Contracts from './pages/Contracts';
import Readings from './pages/Readings';
import Fees from './pages/Fees';
import Invoices from './pages/Invoices';
import Payments from './pages/Payments';
import Incidents from './pages/Incidents';
import UsersPage from './pages/UsersPage';
import Notifications from './pages/Notifications';
import MyRoom from './pages/MyRoom';
import Profile from './pages/Profile';

function RequireAuth({ children, admin = false }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Spinner className="min-h-screen" />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner className="min-h-screen" />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <FeedbackProvider>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="rooms" element={<RequireAuth admin><Rooms /></RequireAuth>} />
              <Route path="tenants" element={<RequireAuth admin><Tenants /></RequireAuth>} />
              <Route path="contracts" element={<RequireAuth admin><Contracts /></RequireAuth>} />
              <Route path="fees" element={<RequireAuth admin><Fees /></RequireAuth>} />
              <Route path="users" element={<RequireAuth admin><UsersPage /></RequireAuth>} />
              <Route path="my-room" element={<MyRoom />} />
              <Route path="readings" element={<Readings />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="payments" element={<Payments />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </FeedbackProvider>
      </AuthProvider>
    </HashRouter>
  );
}
