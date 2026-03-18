import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Audit from './pages/Audit';
import Resources from './pages/Resources';
import IAM from './pages/IAM';
import SecurityGroups from './pages/SecurityGroups';
import Scan from './pages/Scan';
import Users from './pages/Users';
import Report from './pages/Report';
import Compliance from './pages/Compliance';
import Docs from './pages/Docs';
import Threats from './pages/Threats';
import Pricing from './pages/Pricing';
import Support from './pages/Support';
import AdminPanel from './pages/AdminPanel';
import ClientDashboard from './pages/ClientDashboard';
import Loader from './components/Loader';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader text="Checking authentication..." />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const isClient = user.user_type === 'client';

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Owner/Admin Routes */}
        {!isClient && (
          <>
            <Route path="/" element={<Overview />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/iam" element={<IAM />} />
            <Route path="/security-groups" element={<SecurityGroups />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/users" element={<Users />} />
            <Route path="/report" element={<Report />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/threats" element={<Threats />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/support" element={<Support />} />
            <Route path="/admin" element={<AdminPanel />} />
          </>
        )}

        {/* Client Routes */}
        {isClient && (
          <>
            <Route path="/" element={<ClientDashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/threats" element={<Threats />} />
            <Route path="/report" element={<Report />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/support" element={<Support />} />
            <Route path="/my-account" element={<ClientDashboard />} />
          </>
        )}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader text="Checking authentication..." />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
