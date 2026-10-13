import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Role-gated route wrapper.
 * Redirects to /login if not authenticated.
 * Redirects to the user's correct dashboard if they access a route for a different role.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading, getDashboardPath } = useAuth();

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardPath()} replace />;
  }

  return children;
}
