import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../auth/AuthContext';
import { spillsAPI, dashboardAPI, vesselsAPI, reportsAPI, qualcommAPI } from '../api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import MapView from '../components/map/MapView';

const SEVERITY_COLORS = {
  critical: '#dc3545', high: '#fd7e14', medium: '#f0ad4e', low: '#28a745', unknown: '#9ca3af'
};

const REGIONS = [
  { id: 'gujarat', label: 'Gujarat (Gulf of Kutch / Jamnagar / Kandla)' },
  { id: 'west_coast', label: 'West Coast (Mumbai High / JNPT / Maharashtra)' },
  { id: 'tamil_nadu', label: 'Tamil Nadu (Gulf of Mannar / Chennai)' },
  { id: 'andhra_pradesh', label: 'Andhra Pradesh (KG Basin / Visakhapatnam)' },
  { id: 'kerala', label: 'Kerala (Kochi / Lakshadweep Sea)' },
  { id: 'bengal_odisha', label: 'Bengal & Odisha (Sundarbans / Paradip)' },
];

export default function RegionalDashboard() {
  const { user } = useAuth();
  const [region, setRegion] = useState(user?.assigned_region || 'west_coast');
  const [activeSection, setActiveSection] = useState('overview');
  const [period, setPeriod] = useState('all'); // 'day', 'week', 'month', 'all'
  const [stats, setStats] = useState(null);
  const [spills, setSpills] = useState([]);
  const [classification, setClassification] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  // Qualcomm Cloud AI Strategic Cleanup Brief
  const [cleanupBrief, setCleanupBrief] = useState(null);
  const [loadingCleanup, setLoadingCleanup] = useState(false);
  const [selectedSpillForBrief, setSelectedSpillForBrief] = useState(null);

  useEffect(() => {
    loadData(region);
  }, [region]);

  const fetchCleanupBrief = async (spillId) => {
    if (!spillId) return;
    setLoadingCleanup(true);
    setSelectedSpillForBrief(spillId);
    try {
      const res = await qualcommAPI.getCleanupBrief(spillId);
      setCleanupBrief(res.data);
    } catch (err) {
      console.error('Error fetching Qualcomm cleanup brief:', err);
    } finally {
      setLoadingCleanup(false);
    }
  };

  const loadData = async (targetRegion = region) => {
    setLoading(true);
    try {
      const [statsRes, spillsRes, classRes] = await Promise.all([
        dashboardAPI.getRegionStats(targetRegion).catch(() => ({ data: null })),
        spillsAPI.list({ region: targetRegion }).catch(() => ({ data: { spills: [] } })),
        vesselsAPI.getClassification().catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      const spillList = spillsRes.data?.spills || spillsRes.data || [];
      setSpills(spillList);
      setClassification(classRes.data || []);
      if (spillList.length > 0) {
        fetchCleanupBrief(spillList[0].id);
      }
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
      a.download = `SARVAS-Regional-Report-${cleanName}.pdf`;
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

  const severityData = stats?.severity_breakdown
    ? Object.entries(stats.severity_breakdown).map(([name, value]) => ({ name, value }))
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
    return true;
  });

  const navItems = [
    { id: 'overview', icon: '', label: 'Region Overview', active: activeSection === 'overview', onClick: () => setActiveSection('overview') },
    { id: 'map', icon: '', label: 'Regional Map', active: activeSection === 'map', onClick: () => setActiveSection('map') },
    { id: 'spills', icon: '', label: 'Spills', active: activeSection === 'spills', onClick: () => setActiveSection('spills') },
    { id: 'vessels', icon: '', label: 'Vessel Classification', active: activeSection === 'vessels', onClick: () => setActiveSection('vessels') },
    { id: 'reports', icon: '', label: 'Reports', active: activeSection === 'reports', onClick: () => setActiveSection('reports') },
  ];

  if (loading) {
    return (
      <DashboardLayout title={`Regional Manager — ${region.replace(/_/g, ' ')}`} navItems={navItems}>
        <div className="loading-spinner"><div className="spinner" /><p>Loading region data...</p></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Regional Manager — ${region.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`} navItems={navItems}>
      {/* Sector Switcher Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        padding: '10px 16px',
        marginBottom: '18px',
        flexWrap: 'wrap',
        gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Operational Maritime Sector:
          </span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #38bdf8',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {REGIONS.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          Sector Incidents: <strong style={{ color: '#38bdf8' }}>{stats?.total_spills || spills.length}</strong>
        </div>
      </div>

      {activeSection === 'overview' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Spills (Region)</div>
              <div className="stat-value">{stats?.total_spills || 0}</div>
            </div>
            <div className="stat-card stat-low">
              <div className="stat-label">Confirmed</div>
              <div className="stat-value">{stats?.confirmed_spills || 0}</div>
            </div>
            <div className="stat-card stat-high">
              <div className="stat-label">Total Affected Area</div>
              <div className="stat-value">{stats?.total_area_sq_km?.toFixed(1) || '0'} <span className="stat-unit">km²</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Ecological Sensitivity</div>
              <div className="stat-value">{stats?.avg_ecological_sensitivity?.toFixed(0) || '0'}<span className="stat-unit">/100</span></div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header"><h3>Severity Distribution</h3></div>
              <div className="card-body">
                {severityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={severityData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2}
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
              <div className="card-header"><h3>Vessel Types in Region</h3></div>
              <div className="card-body">
                {classification.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={classification.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
                      <XAxis dataKey="vessel_type" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0a1628" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>No classification data</p>}
              </div>
            </div>
          </div>

          {/* Qualcomm Cloud AI Strategic Cleanup & Containment Brief */}
          <div className="card" style={{
            marginTop: '20px',
            border: '1.5px solid #0284c7',
            background: 'linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)',
            boxShadow: '0 4px 20px rgba(2, 132, 199, 0.08)'
          }}>
            <div className="card-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              borderBottom: '1px solid #e0f2fe',
              background: '#ffffff'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    background: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '20px',
                    border: '1px solid #bae6fd'
                  }}>
                    QUALCOMM CLOUD AI (Llama-3.3-70B)
                  </span>
                  <span style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '20px',
                    border: '1px solid #fde68a'
                  }}>
                    NOS-DCP TIER-1 PROTOCOL
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f2e59' }}>
                  Strategic 48-Hour Containment & Resource Staging Brief
                </h3>
              </div>

              {/* Spill Selector for Brief */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {spills.length > 0 && (
                  <select
                    value={selectedSpillForBrief || spills[0]?.id}
                    onChange={(e) => fetchCleanupBrief(Number(e.target.value))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      background: '#ffffff',
                      color: '#1e293b'
                    }}
                  >
                    {spills.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.severity || 'Medium'})</option>
                    ))}
                  </select>
                )}
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => fetchCleanupBrief(selectedSpillForBrief || spills[0]?.id)}
                  disabled={loadingCleanup}
                  style={{ fontSize: '0.75rem', borderColor: '#0284c7', color: '#0284c7' }}
                >
                  {loadingCleanup ? 'Querying Qualcomm AI...' : 'Refresh Brief'}
                </button>
              </div>
            </div>

            <div className="card-body" style={{ padding: '20px' }}>
              {loadingCleanup ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '0.9rem', marginBottom: 4 }}>Synthesizing 48-hour response plan with Qualcomm Cloud AI...</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Evaluating hydrodynamic drift velocity, shoreline proximity, and containment resource staging</div>
                </div>
              ) : cleanupBrief ? (
                <div>
                  {/* Top Key Metrics Banner */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                    marginBottom: 16
                  }}>
                    <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>ESTIMATED LANDFALL COUNTDOWN</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>
                        ~{cleanupBrief.landfall_countdown_hours} Hours
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Based on RK4 surface drift vector</div>
                    </div>
                    <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>RESPONSE PRIORITY TIER</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>
                        {cleanupBrief.response_priority || 'HIGH'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Immediate Tier-1 escalation</div>
                    </div>
                    <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>QUALCOMM AI LATENCY</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7' }}>
                        {cleanupBrief.latency_ms || 18} ms
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Qualcomm Cloud Playground</div>
                    </div>
                  </div>

                  {/* Summary Narrative */}
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px',
                    fontSize: '0.875rem',
                    lineHeight: 1.65,
                    color: '#1e293b',
                    whiteSpace: 'pre-line',
                    marginBottom: 16
                  }}>
                    {cleanupBrief.summary}
                  </div>

                  {/* Priority Action Checklist */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f2e59', marginBottom: 10 }}>
                      TACTICAL RESOURCE DEPLOYMENT DIRECTIVES (NOS-DCP ANNEX-C):
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {(cleanupBrief.key_actions || []).map((action, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          fontSize: '0.82rem',
                          color: '#334155'
                        }}>
                          <span style={{
                            background: '#0284c7',
                            color: '#ffffff',
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            flexShrink: 0,
                            marginTop: 1
                          }}>
                            {idx + 1}
                          </span>
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                  Select an incident to generate an operational deployment brief via Qualcomm Cloud AI.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Regional Spill Map Section */}
      {activeSection === 'map' && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3>Regional Map — {region.replace(/_/g, ' ').toUpperCase()}</h3>
              <p style={{ fontSize: '0.75rem', color: '#6b9fd4', margin: '2px 0 0 0' }}>
                Showing {filteredSpills.length} spill incident{filteredSpills.length === 1 ? '' : 's'} detected in your jurisdiction
              </p>
            </div>
            {/* Period Selector */}
            <div style={{ display: 'inline-flex', background: '#0a1628', padding: '3px', borderRadius: '8px', border: '1px solid #1e3a5f', gap: '3px' }}>
              {[
                { id: 'day', label: 'Last 24h' },
                { id: 'week', label: 'Last 7 Days' },
                { id: 'month', label: 'Last 30 Days' },
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
              regionPreset={region}
              viewMode="regional"
              allowNational={false}
              height="600px"
            />
          </div>
        </div>
      )}


      {activeSection === 'spills' && (
        <div className="card">
          <div className="card-header"><h3>Spills in {region.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr><th>Spill</th><th>Detected</th><th>Severity</th><th>Area</th><th>Status</th><th>Age</th></tr>
              </thead>
              <tbody>
                {spills.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ fontSize: '0.75rem' }}>{s.detected_at ? new Date(s.detected_at).toLocaleDateString() : '—'}</td>
                    <td><span className={`badge badge-${s.severity}`}>{(s.severity || '—').toUpperCase()}</span></td>
                    <td>{s.area_sq_km?.toFixed(1)} km²</td>
                    <td><span className={`badge badge-${s.validation_status}`}>{s.validation_status.replace(/_/g, ' ')}</span></td>
                    <td>{s.age_estimate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'vessels' && (
        <div className="card">
          <div className="card-header"><h3>Vessel Classification Lookup</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr><th>Vessel Type</th><th>Count</th><th>Vessels</th></tr>
              </thead>
              <tbody>
                {classification.map((c) => (
                  <tr key={c.vessel_type}>
                    <td><span className="badge badge-detected" style={{ fontWeight: 600 }}>{c.vessel_type}</span></td>
                    <td style={{ fontWeight: 600 }}>{c.count}</td>
                    <td style={{ fontSize: '0.75rem', color: '#4b5563' }}>
                      {c.vessel_names?.slice(0, 5).join(', ')}
                      {c.vessel_names?.length > 5 && ` +${c.vessel_names.length - 5} more`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'reports' && (
        <>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Report Generation</h3>
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
          <div className="card">
            <div className="card-header"><h3>Generate PDF Evidence Report</h3></div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Spill</th><th>Severity</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {spills.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span className={`badge badge-${s.severity}`}>{(s.severity || '—').toUpperCase()}</span></td>
                      <td><span className={`badge badge-${s.validation_status}`}>{s.validation_status.replace(/_/g, ' ')}</span></td>
                      <td>
                        <button className="btn btn-primary btn-sm" disabled={downloadingId === s.id}
                          onClick={() => handleDownloadReport(s.id, s.name)}>
                          {downloadingId === s.id ? 'Generating Dossier...' : 'Download PDF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
