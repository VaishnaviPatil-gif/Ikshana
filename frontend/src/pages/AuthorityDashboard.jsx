import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { dashboardAPI, reportsAPI, spillsAPI } from '../api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import MapView from '../components/map/MapView';

const SEVERITY_COLORS = {
  critical: '#dc3545', high: '#fd7e14', medium: '#f0ad4e', low: '#28a745', unknown: '#9ca3af'
};

const REGION_LABELS = {
  gujarat: 'Gujarat (Gulf of Kutch / Jamnagar / Kandla)',
  west_coast: 'West Coast (Mumbai High / JNPT / Maharashtra)',
  tamil_nadu: 'Tamil Nadu (Gulf of Mannar / Chennai)',
  andhra_pradesh: 'Andhra Pradesh (KG Basin / Visakhapatnam)',
  kerala: 'Kerala (Kochi / Lakshadweep Sea)',
  bengal_odisha: 'Bengal & Odisha (Sundarbans / Paradip)',
  southeast_coast: 'Southeast Coast (Tamil Nadu / Palk Strait)',
  southwest_coast: 'Southwest Coast (Karnataka / Kerala)',
  east_coast: 'East Coast (Odisha / West Bengal)',
  andaman: 'Andaman & Nicobar Islands',
};

export default function AuthorityDashboard() {
  const [activeSection, setActiveSection] = useState('overview');
  const [period, setPeriod] = useState('all'); // 'day', 'week', 'month', 'year', 'all'
  const [national, setNational] = useState(null);
  const [states, setStates] = useState([]);
  const [spills, setSpills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [natRes, statesRes, spillsRes] = await Promise.all([
        dashboardAPI.getNationalStats().catch(() => ({ data: null })),
        dashboardAPI.getStatesBreakdown().catch(() => ({ data: [] })),
        spillsAPI.list().catch(() => ({ data: { spills: [] } })),
      ]);
      setNational(natRes.data);
      setStates(statesRes.data || []);
      setSpills(spillsRes.data?.spills || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (spillId, spillName) => {
    setDownloadingId(spillId);
    setDownloadError(null);
    try {
      const res = await reportsAPI.downloadPDF(spillId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanName = (spillName || `Spill-${spillId}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `NTRO-Executive-Report-${cleanName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report download error:', err);
      let msg = 'Failed to generate PDF report.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.detail) msg = parsed.detail;
        } catch (_) {}
      } else if (err.response?.data?.detail) {
        msg = err.response.data.detail;
      } else if (err.message === 'Network Error' || err.response?.status === 502 || err.response?.status === 503) {
        msg = 'Cloud server is waking up (Render spin-up). Please wait 10 seconds and try again.';
      }
      setDownloadError(msg);
    } finally {
      setDownloadingId(null);
    }
  };


  const severityData = national?.severity_breakdown
    ? Object.entries(national.severity_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  const regionData = national?.region_breakdown
    ? Object.entries(national.region_breakdown).map(([name, value]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        count: value
      }))
    : [];

  const validationData = national?.validation_breakdown
    ? Object.entries(national.validation_breakdown).map(([name, value]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        value
      }))
    : [];

  const filteredSpills = spills.filter(s => {
    if (period === 'all') return true;
    if (!s.detected_at) return true;
    const dt = new Date(s.detected_at);
    const now = new Date();
    const diffDays = (now - dt) / (1000 * 60 * 60 * 24);
    if (period === 'day') return diffDays <= 1;
    if (period === 'week') return diffDays <= 7;
    if (period === 'month') return diffDays <= 30;
    if (period === 'year') return diffDays <= 365;
    return true;
  });

  const navItems = [
    { id: 'overview', icon: '', label: 'National Overview', active: activeSection === 'overview', onClick: () => setActiveSection('overview') },
    { id: 'map', icon: '', label: 'National Maritime Map', active: activeSection === 'map', onClick: () => setActiveSection('map') },
    { id: 'reports', icon: '', label: 'Spill Reports & PDF', active: activeSection === 'reports', onClick: () => setActiveSection('reports') },
    { id: 'states', icon: '', label: 'State/Coast Breakdown', active: activeSection === 'states', onClick: () => setActiveSection('states') },
    { id: 'trends', icon: '', label: 'Trends & Charts', active: activeSection === 'trends', onClick: () => setActiveSection('trends') },
  ];

  if (loading) {
    return (
      <DashboardLayout title="National Strategic Overview" navItems={navItems}>
        <div className="loading-spinner"><div className="spinner" /><p>Loading national data...</p></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="National Strategic Overview" navItems={navItems}>
      {activeSection === 'overview' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Spills (National)</div>
              <div className="stat-value">{national?.total_spills || 0}</div>
            </div>
            <div className="stat-card stat-high">
              <div className="stat-label">Total Affected Area</div>
              <div className="stat-value">{national?.total_area_sq_km?.toFixed(1) || '0'} <span className="stat-unit">km²</span></div>
            </div>
            <div className="stat-card stat-critical">
              <div className="stat-label">Critical Incidents</div>
              <div className="stat-value">{national?.severity_breakdown?.critical || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Regions Affected</div>
              <div className="stat-value">{Object.keys(national?.region_breakdown || {}).length}</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header"><h3>Severity Distribution (National)</h3></div>
              <div className="card-body">
                {severityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={severityData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={50} outerRadius={95} paddingAngle={2}
                        label={({ name, value }) => `${name}: ${value}`}>
                        {severityData.map((e) => (
                          <Cell key={e.name} fill={SEVERITY_COLORS[e.name] || '#9ca3af'} />
                        ))}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>No data</p>}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>Spills by Region</h3></div>
              <div className="card-body">
                {regionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={regionData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0a1628" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>No data</p>}
              </div>
            </div>
          </div>

          {/* Validation Status Breakdown */}
          <div className="card" style={{ marginTop: '16px' }}>
            <div className="card-header"><h3>Validation Status Breakdown</h3></div>
            <div className="card-body">
              <div className="stats-grid">
                {validationData.map((v) => (
                  <div key={v.name} className="stat-card">
                    <div className="stat-label">{v.name}</div>
                    <div className="stat-value">{v.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* National Maritime Map Section */}
      {activeSection === 'map' && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3>National Maritime Strategic Map — All India EEZ</h3>
              <p style={{ fontSize: '0.75rem', color: '#6b9fd4', margin: '2px 0 0 0' }}>
                Displaying {filteredSpills.length} spill incident{filteredSpills.length === 1 ? '' : 's'} across all Indian maritime zones
              </p>
            </div>
            {/* Period Selector */}
            <div style={{ display: 'inline-flex', background: '#0a1628', padding: '3px', borderRadius: '8px', border: '1px solid #1e3a5f', gap: '3px' }}>
              {[
                { id: 'day', label: 'Last 24h' },
                { id: 'week', label: 'Last 7 Days' },
                { id: 'month', label: 'Last 30 Days' },
                { id: 'year', label: 'Year-to-Date' },
                { id: 'all', label: 'All Time' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: period === p.id ? 700 : 500,
                    backgroundColor: period === p.id ? '#2563eb' : 'transparent',
                    color: period === p.id ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <MapView
              spills={filteredSpills}
              regionPreset="national"
              viewMode="national"
              allowNational={true}
              height="620px"
            />
          </div>
        </div>
      )}

      {/* Executive Spill Reports & PDF Download Section */}
      {activeSection === 'reports' && (
        <>
          {downloadError && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #ef4444',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '14px',
              fontSize: '0.8125rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span><b>Download Alert:</b> {downloadError}</span>
              <button
                onClick={() => setDownloadError(null)}
                style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}
              >
                ×
              </button>
            </div>
          )}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Official Incident Evidence & Attribution Dossiers</h3>
                <p style={{ fontSize: '0.75rem', color: '#6b9fd4', margin: '2px 0 0 0' }}>
                  Generate and download comprehensive legal/operational PDF evidence briefs for NTRO and Ministry briefings
                </p>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Spill Name & ID</th>
                    <th>Maritime Region</th>
                    <th>Surface Area</th>
                    <th>Calculated Severity</th>
                    <th>Detection Timestamp</th>
                    <th>Validation</th>
                    <th>Official Action</th>
                  </tr>
                </thead>
                <tbody>
                  {spills.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '36px' }}>
                        No incident records loaded.
                      </td>
                    </tr>
                  ) : (
                    spills.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#f8fafc' }}>{s.name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Centroid: {s.centroid_lat?.toFixed(2)}°N, {s.centroid_lon?.toFixed(2)}°E</div>
                        </td>
                        <td>{(s.region || '—').replace(/_/g, ' ').toUpperCase()}</td>
                        <td style={{ fontWeight: 600, color: '#38bdf8' }}>{s.area_sq_km?.toFixed(1) || '—'} km²</td>
                        <td><span className={`badge badge-${s.severity}`}>{(s.severity || '—').toUpperCase()}</span></td>
                        <td style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          {s.detected_at ? new Date(s.detected_at).toLocaleString() : '—'}
                        </td>
                        <td><span className={`badge badge-${s.validation_status}`}>{s.validation_status?.replace(/_/g, ' ')}</span></td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={downloadingId === s.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                            onClick={() => handleDownloadReport(s.id, s.name)}
                          >
                            {downloadingId === s.id ? 'Preparing Dossier...' : 'Download PDF'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSection === 'states' && (

        <>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>State / Coastal Region Breakdown</h3>
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Region</th>
                    <th>States</th>
                    <th>Incidents</th>
                    <th>Confirmed</th>
                    <th>Area (km²)</th>
                    <th>Critical</th>
                    <th>High</th>
                    <th>Avg Eco Risk</th>
                    <th>Commercial Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {states.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', color: '#9ca3af', padding: '30px' }}>
                      No state-level data available
                    </td></tr>
                  ) : (
                    states.map((s) => (
                      <tr key={s.region}>
                        <td style={{ fontWeight: 600 }}>
                          {(s.region || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </td>
                        <td style={{ fontSize: '0.6875rem', color: '#6b7280' }}>
                          {REGION_LABELS[s.region] || s.region}
                        </td>
                        <td style={{ fontWeight: 700, fontSize: '1rem' }}>{s.incident_count}</td>
                        <td>{s.confirmed_count}</td>
                        <td>{s.total_area_sq_km?.toFixed(1)}</td>
                        <td>
                          {s.critical_count > 0 && (
                            <span className="badge badge-critical">{s.critical_count}</span>
                          )}
                          {s.critical_count === 0 && '—'}
                        </td>
                        <td>
                          {s.high_count > 0 && (
                            <span className="badge badge-high">{s.high_count}</span>
                          )}
                          {s.high_count === 0 && '—'}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: s.avg_ecological_sensitivity > 50 ? '#f87171' : '#38bdf8' }}>
                            {s.avg_ecological_sensitivity ? `${s.avg_ecological_sensitivity}/100` : '—'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: '#f59e0b' }}>
                          {s.commercial_loss_usd ? `$${Math.round(s.commercial_loss_usd).toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSection === 'trends' && (
        <>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>National Trends</h3>
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><h3>Severity Distribution</h3></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={severityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#4a7ab5" radius={[4, 4, 0, 0]}>
                      {severityData.map((e) => (
                        <Cell key={e.name} fill={SEVERITY_COLORS[e.name] || '#9ca3af'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>Regional Comparison</h3></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={regionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0a1628" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
