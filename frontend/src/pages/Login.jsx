import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, getDashboardPath } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      // Navigate to role-appropriate dashboard
      switch (user.role) {
        case 'coast_guard': navigate('/dashboard/coastguard'); break;
        case 'regional_manager': navigate('/dashboard/regional'); break;
        case 'higher_authority': navigate('/dashboard/authority'); break;
        default: navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const demoUsers = [
    { username: 'coast_guard', label: 'Coast Guard', role: 'Operational' },
    { username: 'regional_mgr', label: 'Regional Manager', role: 'Regional Oversight' },
    { username: 'authority', label: 'Higher Authority', role: 'National Strategy' },
  ];

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <img
            src="/sarvas_logo.png"
            alt="SARVAS Logo"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3px solid #0284c7',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.25)',
              display: 'inline-block'
            }}
          />
          <div style={{ marginTop: '10px' }}>
            <span style={{
              display: 'inline-block', background: '#0b1e36', color: '#ffffff',
              fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px',
              borderRadius: '9999px', letterSpacing: '0.5px'
            }}>
              AUTHORIZED PERSONNEL ONLY
            </span>
          </div>
        </div>
        <h1 style={{ textAlign: 'center', color: '#0b1e36', margin: '0 0 6px 0' }}>SARVAS Command Sign In</h1>
        <p className="login-subtitle" style={{ textAlign: 'center', color: '#0284c7', fontWeight: 700, letterSpacing: '0.6px' }}>
          From Slick to Suspect
        </p>

        {error && (
          <div style={{
            background: '#fdf0f1', border: '1px solid #dc3545', borderRadius: '8px',
            padding: '10px 14px', marginBottom: '16px', fontSize: '0.8125rem', color: '#dc3545'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              id="login-username"
              className="form-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          <button
            id="login-submit"
            className="btn btn-primary login-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '24px', borderTop: '1px solid #e2e5ea', paddingTop: '16px' }}>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '8px', textAlign: 'center' }}>
            Demo accounts (password: <strong>demo123</strong>)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {demoUsers.map((u) => (
              <button
                key={u.username}
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'space-between' }}
                onClick={() => { setUsername(u.username); setPassword('demo123'); }}
              >
                <span>{u.label}</span>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{u.role}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <a href="/" style={{ fontSize: '0.8125rem', color: '#0b1e36', fontWeight: 600 }}>
            ← Back to Environmental Awareness Portal
          </a>
        </div>
      </div>
    </div>
  );
}
