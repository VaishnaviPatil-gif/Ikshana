import { useState } from 'react';
import { spillsAPI, vesselsAPI } from '../../api/client';

export default function DataUploadSection({ onUploadSuccess }) {
  const [activeTab, setActiveTab] = useState('sar');
  
  // SAR state
  const [sarFile, setSarFile] = useState(null);
  const [sarLat, setSarLat] = useState(18.85);
  const [sarLon, setSarLon] = useState(71.90);
  const [sarRegion, setSarRegion] = useState('west_coast');
  const [sarName, setSarName] = useState('');
  const [sarUploading, setSarUploading] = useState(false);
  const [sarResult, setSarResult] = useState(null);
  const [sarError, setSarError] = useState(null);

  // AIS state
  const [aisFile, setAisFile] = useState(null);
  const [aisUploading, setAisUploading] = useState(false);
  const [aisResult, setAisResult] = useState(null);
  const [aisError, setAisError] = useState(null);

  const handleSarSubmit = async (e) => {
    e.preventDefault();
    if (!sarFile) {
      setSarError('Please select a SAR image file (PNG, JPG, TIFF).');
      return;
    }
    setSarUploading(true);
    setSarError(null);
    setSarResult(null);

    try {
      const formData = new FormData();
      formData.append('file', sarFile);
      formData.append('lat', sarLat);
      formData.append('lon', sarLon);
      formData.append('region', sarRegion);
      if (sarName.trim()) {
        formData.append('name', sarName.trim());
      }

      const res = await spillsAPI.uploadSAR(formData);
      setSarResult(res.data);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      let detail = err.response?.data?.detail || err.message || 'Failed to analyze SAR image.';
      if (Array.isArray(detail)) {
        detail = detail.map(d => `${d.loc ? d.loc.slice(1).join('.') + ': ' : ''}${d.msg}`).join(', ');
      } else if (typeof detail === 'object' && detail !== null) {
        detail = JSON.stringify(detail);
      }
      setSarError(detail);
    } finally {
      setSarUploading(false);
    }
  };

  const handleAisSubmit = async (e) => {
    e.preventDefault();
    if (!aisFile) {
      setAisError('Please select an AIS CSV dataset file.');
      return;
    }
    setAisUploading(true);
    setAisError(null);
    setAisResult(null);

    try {
      const formData = new FormData();
      formData.append('file', aisFile);

      const res = await vesselsAPI.uploadAIS(formData);
      setAisResult(res.data);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setAisError(err.response?.data?.detail || 'Failed to ingest AIS data.');
    } finally {
      setAisUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card bg-gradient-to-r from-navy-800 to-navy-900 border border-navy-700 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>️</span> Operational Data Ingestion Hub
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Upload real satellite SAR imagery for automatic segmentation or AIS CSV logs for trajectory & attribution analysis.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('sar')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'sar'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-navy-700 text-slate-300 hover:bg-navy-600'
              }`}
            >
              ️ SAR Satellite Imagery
            </button>
            <button
              onClick={() => setActiveTab('ais')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'ais'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-navy-700 text-slate-300 hover:bg-navy-600'
              }`}
            >
               Historic AIS Data
            </button>
            <button
              onClick={() => setActiveTab('instructions')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'instructions'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-navy-700 text-slate-300 hover:bg-navy-600'
              }`}
            >
               File Paths & CLI
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: SAR Upload */}
      {activeTab === 'sar' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 bg-navy-800/80 border border-navy-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span></span> Upload SAR Image for Segmentation
            </h3>

            <form onSubmit={handleSarSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  SAR Image File (PNG, JPG, TIFF)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/tiff"
                  onChange={(e) => setSarFile(e.target.files[0])}
                  className="w-full text-sm text-slate-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer bg-navy-900/60 p-2 rounded-lg border border-navy-600"
                />
                <span className="text-xs text-slate-400 mt-1 block">
                  Sample file ready in: <code className="text-blue-400">backend/data/sar/sample_sar_slick.png</code>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Center Latitude (°N)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={sarLat}
                    onChange={(e) => setSarLat(parseFloat(e.target.value))}
                    className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Center Longitude (°E)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={sarLon}
                    onChange={(e) => setSarLon(parseFloat(e.target.value))}
                    className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Maritime Region
                  </label>
                  <select
                    value={sarRegion}
                    onChange={(e) => setSarRegion(e.target.value)}
                    className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="west_coast">West Coast (Arabian Sea / Mumbai)</option>
                    <option value="southeast_coast">Southeast Coast (Chennai / TN)</option>
                    <option value="east_coast">East Coast (Visakhapatnam / Odisha)</option>
                    <option value="andaman">Andaman & Nicobar Islands</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Spill Label / ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SENTINEL1-2026-WEST"
                    value={sarName}
                    onChange={(e) => setSarName(e.target.value)}
                    className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {sarError && (
                <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-xs text-red-200">
                  {sarError}
                </div>
              )}

              <button
                type="submit"
                disabled={sarUploading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 text-sm"
              >
                {sarUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing SAR Backscatter & Computing Contours...
                  </>
                ) : (
                  <> Analyze SAR & Detect Oil Slick</>
                )}
              </button>
            </form>
          </div>

          {/* Analysis Results preview */}
          <div className="card p-6 bg-navy-800/80 border border-navy-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span></span> Extraction & Detection Telemetry
            </h3>

            {sarResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-base mb-1">
                    Oil Slick Successfully Detected & Cataloged
                  </div>
                  <p className="text-xs text-slate-300">
                    Spill ID <strong className="text-white">#{sarResult.id}</strong> ({sarResult.name}) was registered and projected in hydrodynamic drift models.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-navy-900/70 p-3 rounded-lg border border-navy-700">
                    <span className="text-xs text-slate-400 block">Slick Surface Area</span>
                    <span className="text-xl font-bold text-amber-400">{sarResult.area_sq_km} km²</span>
                  </div>
                  <div className="bg-navy-900/70 p-3 rounded-lg border border-navy-700">
                    <span className="text-xs text-slate-400 block">Perimeter</span>
                    <span className="text-xl font-bold text-cyan-400">{sarResult.perimeter_km} km</span>
                  </div>
                  <div className="bg-navy-900/70 p-3 rounded-lg border border-navy-700">
                    <span className="text-xs text-slate-400 block">Calculated Severity</span>
                    <span className="text-sm font-bold uppercase text-red-400">{sarResult.severity}</span>
                  </div>
                  <div className="bg-navy-900/70 p-3 rounded-lg border border-navy-700">
                    <span className="text-xs text-slate-400 block">Estimated Slick Age</span>
                    <span className="text-sm font-bold uppercase text-emerald-400">{sarResult.age_estimate}</span>
                  </div>
                </div>

                <div className="p-3 bg-navy-900/60 rounded-lg text-xs text-slate-300 space-y-1">
                  <div><strong>Centroid:</strong> {sarResult.centroid_lat}°N, {sarResult.centroid_lon}°E</div>
                  <div><strong>Fragmentation Index:</strong> {sarResult.fragmentation_index}</div>
                  <div><strong>Elongation Ratio:</strong> {sarResult.elongation_ratio}</div>
                  <div><strong>Classification:</strong> {sarResult.validation_status === 'lookalike' ? 'Look-Alike (Natural Film / Low Wind)' : 'Confirmed Oil Slick'}</div>
                  <div><strong>AI Detection Confidence:</strong> {(((sarResult.validation_status === 'lookalike' ? (sarResult.model_confidence?.lookalike ?? sarResult.confidence_score) : (sarResult.model_confidence?.oil ?? sarResult.confidence_score)) ?? 0.88) * 100).toFixed(0)}%</div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-navy-600 rounded-xl">
                <span className="text-4xl mb-3">️</span>
                <p className="text-sm font-medium text-slate-300">Awaiting SAR Satellite Imagery</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Upload an image on the left to extract contour geometries, estimate age, and trigger backward drift tracing.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: AIS Upload */}
      {activeTab === 'ais' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 bg-navy-800/80 border border-navy-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span></span> Upload Real AIS CSV Log
            </h3>

            <form onSubmit={handleAisSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  AIS CSV File (.csv)
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setAisFile(e.target.files[0])}
                  className="w-full text-sm text-slate-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer bg-navy-900/60 p-2 rounded-lg border border-navy-600"
                />
                <span className="text-xs text-slate-400 mt-1 block">
                  Sample dataset available: <code className="text-cyan-400">backend/data/ais/sample_ais_track.csv</code>
                </span>
              </div>

              <div className="p-3 bg-navy-900/60 rounded-lg border border-navy-700">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                  Supported CSV Headers
                </span>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  MMSI, BaseDateTime (or Timestamp), LAT, LON, SOG, COG, Heading, VesselName, VesselType
                </p>
              </div>

              {aisError && (
                <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-xs text-red-200">
                  {aisError}
                </div>
              )}

              <button
                type="submit"
                disabled={aisUploading}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 text-sm"
              >
                {aisUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Parsing AIS Records & Correlating Trajectories...
                  </>
                ) : (
                  <> Ingest AIS Dataset</>
                )}
              </button>
            </form>
          </div>

          {/* AIS Result preview */}
          <div className="card p-6 bg-navy-800/80 border border-navy-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span></span> Ingested Vessel Fleet Status
            </h3>

            {aisResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-cyan-950/40 border border-cyan-500/40 rounded-xl">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-base mb-1">
                    AIS Data Stream Ingested
                  </div>
                  <p className="text-xs text-slate-300">
                    File <strong className="text-white">{aisResult.filename}</strong> has been parsed and integrated into the suspect attribution engine.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-navy-900/70 p-3 rounded-lg border border-navy-700 text-center">
                    <span className="text-xs text-slate-400 block">Total Vessels</span>
                    <span className="text-2xl font-bold text-white">{aisResult.unique_vessels}</span>
                  </div>
                  <div className="bg-navy-900/70 p-3 rounded-lg border border-navy-700 text-center">
                    <span className="text-xs text-slate-400 block">New Vessels</span>
                    <span className="text-2xl font-bold text-cyan-400">+{aisResult.new_vessels}</span>
                  </div>
                  <div className="bg-navy-900/70 p-3 rounded-lg border border-navy-700 text-center">
                    <span className="text-xs text-slate-400 block">AIS Waypoints</span>
                    <span className="text-2xl font-bold text-emerald-400">{aisResult.track_points}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  Switch to the <strong>Tactical Map</strong> or <strong>Ship & Drift Replay</strong> tab to view these vessels maneuvering in real time against the oil slicks.
                </p>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-navy-600 rounded-xl">
                <span className="text-4xl mb-3"></span>
                <p className="text-sm font-medium text-slate-300">No New AIS File Processed Yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Upload an AIS CSV file to populate vessel trajectories, evaluate speed drops, course deviations, and AIS transmission gaps.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Instructions & CLI */}
      {activeTab === 'instructions' && (
        <div className="card p-6 bg-navy-800/80 border border-navy-700 space-y-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span></span> Where to Place Files & Command Line Processing
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-navy-900/80 rounded-xl border border-navy-700 space-y-3">
              <h4 className="font-bold text-blue-400 text-sm flex items-center gap-2">
                <span></span> Option 1: File System Folders
              </h4>
              <p className="text-xs text-slate-300">
                You can place your raw files directly into the backend directories:
              </p>
              <ul className="text-xs space-y-2 text-slate-300 font-mono">
                <li className="p-2 bg-navy-950 rounded border border-navy-800">
                  <span className="text-amber-400">SAR Images:</span> backend/data/sar/
                  <span className="text-slate-500 block font-sans text-[11px] mt-0.5">Formats: .png, .jpg, .tif, .tiff</span>
                </li>
                <li className="p-2 bg-navy-950 rounded border border-navy-800">
                  <span className="text-cyan-400">AIS CSVs:</span> backend/data/ais/
                  <span className="text-slate-500 block font-sans text-[11px] mt-0.5">Format: .csv with MMSI, Timestamp, LAT, LON</span>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-navy-900/80 rounded-xl border border-navy-700 space-y-3">
              <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                Option 2: CLI Ingestion Command
              </h4>
              <p className="text-xs text-slate-300">
                From your terminal inside the <code className="text-emerald-400">backend/</code> directory, run:
              </p>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2 bg-navy-950 rounded border border-navy-800 text-slate-300 overflow-x-auto">
                  <span className="text-slate-500"># Ingest all files in data/sar and data/ais:</span><br />
                  <span className="text-emerald-400">python -m scripts.ingest_real_data --all</span>
                </div>
                <div className="p-2 bg-navy-950 rounded border border-navy-800 text-slate-300 overflow-x-auto">
                  <span className="text-slate-500"># Or ingest a specific AIS CSV file:</span><br />
                  <span className="text-cyan-400">python -m scripts.ingest_real_data --ais "data/ais/my_fleet.csv"</span>
                </div>
                <div className="p-2 bg-navy-950 rounded border border-navy-800 text-slate-300 overflow-x-auto">
                  <span className="text-slate-500"># Or ingest a specific SAR image at coordinates:</span><br />
                  <span className="text-blue-400">python -m scripts.ingest_real_data --sar "data/sar/image.png" --lat 18.85 --lon 71.90 --region "west_coast"</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
