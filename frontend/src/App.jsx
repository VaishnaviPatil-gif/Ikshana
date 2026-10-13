import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import PublicLanding from './pages/PublicLanding';
import Login from './pages/Login';
import CoastGuardDashboard from './pages/CoastGuardDashboard';
import RegionalDashboard from './pages/RegionalDashboard';
import AuthorityDashboard from './pages/AuthorityDashboard';
import './index.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public — no login */}
          <Route path="/" element={<PublicLanding />} />
          <Route path="/login" element={<Login />} />

          {/* Coast Guard */}
          <Route
            path="/dashboard/coastguard"
            element={
              <ProtectedRoute allowedRoles={['coast_guard']}>
                <CoastGuardDashboard />
              </ProtectedRoute>
            }
          />

          {/* Regional Manager */}
          <Route
            path="/dashboard/regional"
            element={
              <ProtectedRoute allowedRoles={['regional_manager']}>
                <RegionalDashboard />
              </ProtectedRoute>
            }
          />

          {/* Higher Authority */}
          <Route
            path="/dashboard/authority"
            element={
              <ProtectedRoute allowedRoles={['higher_authority']}>
                <AuthorityDashboard />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
