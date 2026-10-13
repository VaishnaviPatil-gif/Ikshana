import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const TAB_ICONS = {
  overview: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  animation: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  map: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  suspects: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="22" y1="12" x2="18" y2="12" /><line x1="6" y1="12" x2="2" y2="12" /><line x1="12" y1="6" x2="12" y2="2" /><line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  ),
  anomalies: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  validation: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  drift: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-4 6-4 6 4 8 4 6-4 6-4" /><path d="M2 18s3-4 6-4 6 4 8 4 6-4 6-4" />
    </svg>
  ),
  upload: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
};

export default function DashboardLayout({ children, title, navItems = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'CG';

  const formattedRegion = user?.assigned_region
    ? user.assigned_region.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'West Coast';

  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  return (
    <div className="app-layout" style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside style={{
        width: '235px',
        flexShrink: 0,
        background: '#ffffff',
        borderRight: '1px solid #cbd5e1',
        position: 'sticky',
        top: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        zIndex: 100,
        boxShadow: '1px 0 3px rgba(15, 23, 42, 0.04)',
      }}>
        <div>
          {/* Sidebar Top: Logo & Branding */}
          <div style={{
            padding: '16px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <img
              src="/sarvas_logo.png"
              alt="SARVAS"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1.5px solid #0f2e59',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f2e59', letterSpacing: '0.5px' }}>
                  SARVAS
                </span>
                <span style={{
                  background: '#eff6ff',
                  color: '#1e40af',
                  border: '1px solid #bfdbfe',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '3px',
                }}>
                  NTRO
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '1px' }}>
                Coast Guard Operations
              </div>
            </div>
          </div>

          {/* Navigation Links (Vertical Left List) */}
          <nav style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {navItems.map((item) => {
              const icon = TAB_ICONS[item.id] || TAB_ICONS.overview;
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '5px',
                    border: 'none',
                    borderLeft: item.active ? '3.5px solid #0f2e59' : '3.5px solid transparent',
                    background: item.active ? '#eff6ff' : 'transparent',
                    color: item.active ? '#0f2e59' : '#475569',
                    fontWeight: item.active ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={(e) => {
                    if (!item.active) e.currentTarget.style.background = '#f1f5f9';
                  }}
                  onMouseOut={(e) => {
                    if (!item.active) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ color: item.active ? '#0f2e59' : '#64748b', display: 'flex', flexShrink: 0 }}>
                    {icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom: User Profile, Region & Sign Out */}
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: '#0f2e59',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.72rem',
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.username ? user.username.replace(/_/g, ' ') : 'Coast Guard'}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                Region: {formattedRegion}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <a
              href="/"
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: '0.72rem',
                color: '#0f2e59',
                padding: '5px 8px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                textDecoration: 'none',
                fontWeight: 600,
                textAlign: 'center',
              }}
              title="Public Portal"
            >
              Public
            </a>

            <button
              onClick={handleLogout}
              style={{
                flex: 1,
                fontSize: '0.72rem',
                padding: '5px 8px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#dc2626',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Simple Top Header Bar (Single Slim Line) */}
        <header style={{
          height: '48px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 90,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f2e59' }}>
              {title || 'Coast Guard Operations'}
            </span>
            <span style={{
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '1px 8px',
              borderRadius: '4px',
            }}>
              Active Sector: {formattedRegion}
            </span>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
            {todayStr}
          </div>
        </header>

        {/* Page Content Body */}
        <main className="main-content" style={{ flex: 1, padding: '20px 24px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
