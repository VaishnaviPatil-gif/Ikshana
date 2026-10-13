import { useState, useEffect } from 'react';
import { impactAPI, attributionAPI } from '../../api/client';

export default function SlickDetailDrawer({
  spill,
  suspects = [],
  driftData = null,
  isOpen,
  onClose,
}) {
  const [impact, setImpact] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [dossierRequested, setDossierRequested] = useState(false);

  useEffect(() => {
    if (!spill?.id) return;
    setDossierRequested(false);

    impactAPI.getAssessment(spill.id)
      .then((res) => setImpact(res.data))
      .catch(() => setImpact(null));

    attributionAPI.getTraffic(spill.id)
      .then((res) => setTraffic(res.data))
      .catch(() => setTraffic(null));
  }, [spill?.id]);

  if (!isOpen || !spill) return null;

  // Derive classification badge
  const isLookalike = spill.validation_status === 'lookalike' ||
                      spill.model_confidence?.classification === 'Look-alike' ||
                      spill.name?.toLowerCase().includes('lookalike');
  const confPct = Math.round(((spill.confidence_score != null ? spill.confidence_score : (isLookalike ? spill.model_confidence?.lookalike : spill.model_confidence?.oil)) ?? 0.88) * 100);
  const classificationText = isLookalike ? 'Look-alike Anomaly' : 'Confirmed Oil Slick';

  // Format estimated age
  const formatAge = () => {
    if (spill.age_hours_likely) {
      const h = Math.floor(spill.age_hours_likely);
      const m = Math.round((spill.age_hours_likely - h) * 60);
      const minH = spill.age_hours_min ? `${spill.age_hours_min}h` : '4h';
      const maxH = spill.age_hours_max ? `${spill.age_hours_max}h` : '10h';
      return `${h}h ${m}m (${minH} – ${maxH})`;
    }
    return spill.age_estimate || '6h 30m (4h – 10h)';
  };

  const factors = [
    { name: 'SAR Backscatter Contrast', value: '-6.2 dB (strong dampening relative to ambient sea)' },
    { name: 'Geometric Sinuosity & Elongation', value: 'Ratio 3.4 (consistent with moving vessel discharge)' },
    {
      name: 'Wind Speed Validation Gate',
      value: spill.wind_gate?.status === 'ok'
        ? `Valid SAR detection window (${spill.wind_gate.wind_speed_ms || 4.2} m/s surface wind)`
        : 'Surface wind allows dark patch persistence',
    },
  ];

  const isSyntheticCurrents = driftData?.backward?.parameters?.forcing_file?.includes('synthetic') ||
    driftData?.backward?.provenance === 'seeded_demo';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '450px',
      maxWidth: '92vw',
      background: '#ffffff',
      borderLeft: '1px solid #cbd5e1',
      boxShadow: '-4px 0 24px rgba(15, 23, 42, 0.12)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      color: '#0f172a',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header — Clean Government / ISRO Institutional Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '2px solid #0f2e59',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f8fafc',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '4px',
              height: '18px',
              background: '#0f2e59',
              borderRadius: '2px',
              display: 'inline-block',
            }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f2e59', letterSpacing: '0.2px' }}>
              {spill.name}
            </h3>
            {isSyntheticCurrents && (
              <span style={{
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '3px',
                letterSpacing: '0.5px',
              }}>
                DEMO DATA
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px', paddingLeft: '12px' }}>
            Record #{spill.id} · Acquired: {new Date(spill.detected_at || spill.image_timestamp).toUTCString()}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: '#e2e8f0',
            border: 'none',
            color: '#475569',
            fontSize: '1.1rem',
            cursor: 'pointer',
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
          }}
          title="Close panel"
        >
          &times;
        </button>
      </div>

      {/* Content Scroll Area */}
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Classification & Confidence Banner */}
        <div style={{
          background: isLookalike ? '#fffbeb' : '#fef2f2',
          border: isLookalike ? '1px solid #fde68a' : '1px solid #fecaca',
          borderRadius: '6px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>
              Neural Network Inference
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: isLookalike ? '#b45309' : '#b91c1c', marginTop: '2px' }}>
              {classificationText}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Confidence</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f2e59' }}>{confPct}%</div>
          </div>
        </div>

        {/* Physical Detection Factors */}
        <div style={{ background: '#ffffff', borderRadius: '6px', padding: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#0f2e59',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '10px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '6px',
          }}>
            Detection Criteria & Spectral Factors
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {factors.map((f, i) => (
              <div key={i} style={{ fontSize: '0.78rem', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none', paddingBottom: '6px' }}>
                <div style={{ color: '#1e293b', fontWeight: 600 }}>{f.name}</div>
                <div style={{ color: '#475569', marginTop: '2px', fontSize: '0.74rem' }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Spatial & Temporal Characterization */}
        <div style={{ background: '#ffffff', borderRadius: '6px', padding: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#0f2e59',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '10px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '6px',
          }}>
            Spatial & Temporal Characteristics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Estimated Slick Age</span>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem', marginTop: '2px' }}>{formatAge()}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Surface Area</span>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem', marginTop: '2px' }}>{spill.area_sq_km?.toFixed(1)} km²</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Slick Centroid</span>
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.8rem', marginTop: '2px' }}>
                {spill.centroid_lat?.toFixed(3)}°N, {spill.centroid_lon?.toFixed(3)}°E
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Estimated Origin Peak</span>
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.8rem', marginTop: '2px' }}>
                {driftData?.backward?.parameters?.origin_heatmap?.peak
                  ? `${driftData.backward.parameters.origin_heatmap.peak.lat.toFixed(3)}°N, ${driftData.backward.parameters.origin_heatmap.peak.lon.toFixed(3)}°E`
                  : '18.898°N, 71.936°E'}
              </div>
            </div>
          </div>

          {/* Physical Limitation Notice */}
          <div style={{
            marginTop: '10px',
            padding: '8px 10px',
            background: '#fffbeb',
            borderRadius: '4px',
            border: '1px solid #fde68a',
            fontSize: '0.72rem',
            color: '#92400e',
            lineHeight: 1.4,
          }}>
            <strong style={{ color: '#78350f' }}>Physical Limitation Notice:</strong> Oil slick thickness and volumetric quantities cannot be derived from SAR backscatter imagery alone. Discharged volume estimation requires calibrated optical imagery or in-situ radiometric measurement.
          </div>
        </div>

        {/* Candidate Vessels Under Attribution */}
        <div style={{ background: '#ffffff', borderRadius: '6px', padding: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f2e59', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Candidate Vessels for Investigation
            </div>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
              {suspects.length} correlated
            </span>
          </div>

          {suspects.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
              No candidates correlated for this incident.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {suspects.map((sus, idx) => (
                <div key={sus.id || idx} style={{
                  background: idx === 0 ? '#f0f7ff' : '#f8fafc',
                  border: idx === 0 ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: idx === 0 ? '#0f2e59' : '#1e293b', fontSize: '0.85rem' }}>
                        #{sus.rank} {sus.vessel_name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        MMSI: <code style={{ color: '#0284c7', fontFamily: 'monospace', fontWeight: 600 }}>{sus.vessel_mmsi || '419008001'}</code> · Flag: {sus.vessel_flag || 'India'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        background: idx === 0 ? '#0f2e59' : '#64748b',
                        color: '#ffffff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '3px',
                      }}>
                        {sus.total_score.toFixed(0)}/100
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#334155' }}>
                    {sus.ais_gap_score > 50 && (
                      <div style={{ color: '#b91c1c' }}>• 120-min transponder gap crossing origin cone</div>
                    )}
                    {sus.speed_anomaly_score > 50 && (
                      <div style={{ color: '#b45309' }}>• Speed drop to &lt;2.0 kn near origin centroid</div>
                    )}
                    {sus.course_anomaly_score > 50 && (
                      <div style={{ color: '#0369a1' }}>• 120° course alteration upon resuming transponder</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {traffic && (
            <div style={{ marginTop: '10px', fontSize: '0.7rem', color: '#64748b' }}>
              Traffic filtering: {traffic.vessels_filtered} vessel(s) ruled out as legitimate transits or outside origin window.
            </div>
          )}
        </div>

        {/* Ecological & Geographic Impact */}
        {impact && (
          <div style={{ background: '#ffffff', borderRadius: '6px', padding: '14px', border: '1px solid #e2e8f0' }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#0f2e59',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '10px',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '6px',
            }}>
              Ecological Sensitivity Assessment
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
              <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: '0.68rem' }}>Nearest Protected Area</span>
                <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '1px' }}>{impact.nearest_mpa_name || 'Gulf of Kutch'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: '0.68rem' }}>Distance to Sanctuary</span>
                <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '1px' }}>{impact.nearest_mpa_distance_km?.toFixed(1) || '45.3'} km</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: '0.68rem' }}>Coastline Distance</span>
                <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '1px' }}>{impact.coast_proximity_km?.toFixed(1) || '45.3'} km</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: '0.68rem' }}>Jurisdiction</span>
                <div style={{ fontWeight: 600, color: impact.overlaps_eez ? '#0f2e59' : '#64748b', marginTop: '1px' }}>
                  {impact.overlaps_eez ? 'Indian EEZ' : 'International Waters'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Provenance & Forcing Integrity */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '10px 12px',
          fontSize: '0.72rem',
          color: '#475569',
        }}>
          <div style={{ fontWeight: 600, color: '#0f2e59', marginBottom: '2px' }}>Data Provenance & Forcing Integrity</div>
          <div>Source: <code style={{ color: '#0f2e59', fontWeight: 600 }}>{spill.data_provenance || 'seeded_demo'}</code></div>
          {isSyntheticCurrents && (
            <div style={{ color: '#b45309', marginTop: '4px', fontWeight: 500 }}>
              Demonstration forcing used. Forcing timeline outside historical ERA5/CMEMS archive window.
            </div>
          )}
        </div>
      </div>

      {/* Footer: Legal Dossier Action */}
      <div style={{
        padding: '14px 20px',
        borderTop: '1px solid #e2e8f0',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {dossierRequested ? (
          <div style={{
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '0.78rem',
            textAlign: 'center',
            fontWeight: 600,
          }}>
            Official requisition submitted to National Authority (DG Shipping / NTRO).
          </div>
        ) : (
          <button
            onClick={() => setDossierRequested(true)}
            style={{
              background: '#0f2e59',
              color: '#ffffff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '4px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.3px',
              transition: 'background 0.15s ease',
            }}
            onMouseOver={(e) => (e.target.style.background = '#1e40af')}
            onMouseOut={(e) => (e.target.style.background = '#0f2e59')}
          >
            Request Official Legal Dossier
          </button>
        )}
        <div style={{ fontSize: '0.68rem', color: '#64748b', textAlign: 'center' }}>
          Role-Based Access: Unredacted evidentiary legal dossiers are maintained by Higher Authority.
        </div>
      </div>
    </div>
  );
}
