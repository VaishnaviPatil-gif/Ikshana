import axios from 'axios';

const getApiUrl = () => {
  // If explicitly configured at build time (e.g. via .env.production or Vercel env vars)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // If running in browser on a production domain (e.g. vercel.app or any external domain)
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0') {
      return 'https://sarvas-backend.onrender.com';
    }
  }
  // Local development default
  return 'http://localhost:8000';
};

const API_URL = getApiUrl();

const client = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 120s timeout to allow Render free tier containers to cold boot
  headers: { 'Content-Type': 'application/json' },
});

// JWT interceptor — attach token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 (expired/invalid token)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Don't redirect if we're on a public page
      if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;

// === Auth API ===
export const authAPI = {
  login: (username, password) =>
    client.post('/api/auth/login', { username, password }),
  register: (data) =>
    client.post('/api/auth/register', data),
  getMe: () =>
    client.get('/api/auth/me'),
};

// === Public API (no auth needed) ===
export const publicAPI = {
  getImpacts: (period) => client.get('/api/public/impacts', { params: { period } }),
  getImpact: (spillId) => client.get(`/api/public/impacts/${spillId}`),
  getStats: (period) => client.get('/api/public/stats', { params: { period } }),
};


// === Spills API ===
export const spillsAPI = {
  list: (params) => client.get('/api/spills', { params }),
  get: (id) => client.get(`/api/spills/${id}`),
  validate: (id, status) =>
    client.post(`/api/spills/${id}/validate`, { validation_status: status }),
  uploadSAR: (formData) =>
    client.post('/api/spills/upload-sar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// === Vessels API ===
export const vesselsAPI = {
  list: (params) => client.get('/api/vessels', { params }),
  get: (id) => client.get(`/api/vessels/${id}`),
  getTracks: (id) => client.get(`/api/vessels/${id}/tracks`),
  getClassification: () => client.get('/api/vessels/classification'),
  uploadAIS: (formData) =>
    client.post('/api/vessels/upload-ais', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};


// === Drift API ===
export const driftAPI = {
  getBackward: (spillId) => client.get(`/api/drift/${spillId}/backward`),
  getForward: (spillId) => client.get(`/api/drift/${spillId}/forward`),
  getAll: (spillId) => client.get(`/api/drift/${spillId}/all`),
};

// === Attribution API ===
export const attributionAPI = {
  getSuspects: (spillId, topN = 3) =>
    client.get(`/api/attribution/${spillId}/suspects`, { params: { top_n: topN } }),
  evaluateSuspects: (spillId, topN = 3) =>
    client.post(`/api/attribution/${spillId}/evaluate`, null, { params: { top_n: topN } }),
  getAnomalyFeed: (acknowledged = false) =>
    client.get('/api/attribution/anomalies/feed', { params: { acknowledged } }),
  acknowledgeAnomaly: (id) =>
    client.post(`/api/attribution/anomalies/${id}/acknowledge`),
  getTraffic: (spillId) =>
    client.get(`/api/attribution/${spillId}/traffic`),
};

// === Impact API ===
export const impactAPI = {
  getAssessment: (spillId) => client.get(`/api/impact/${spillId}/assessment`),
};

// === GIS API ===
export const gisAPI = {
  getEEZ: () => client.get('/api/gis/eez'),
  getCorals: (params) => client.get('/api/gis/corals', { params }),
  getDataStreams: () => client.get('/api/gis/data-streams'),
};

// === System API ===
export const systemAPI = {
  getLimitations: () => client.get('/api/limitations'),
};

// === Dashboard API ===
export const dashboardAPI = {
  getRegionStats: (region) => client.get(`/api/dashboard/region/${region}`),
  getNationalStats: () => client.get('/api/dashboard/national'),
  getStatesBreakdown: () => client.get('/api/dashboard/states'),
};

// === Reports API ===
export const reportsAPI = {
  downloadPDF: (spillId) =>
    client.get(`/api/reports/dossier/${spillId}`, { responseType: 'blob' }),
};

// === Audit API ===
export const auditAPI = {
  getLogs: (params) => client.get('/api/audit/logs', { params }),
  getLogsByResource: (resourceId) => client.get(`/api/audit/logs/${resourceId}`),
};

// === AIS Stream API ===
export const aisAPI = {
  getStatus: () => client.get('/api/ais/status'),
  start: () => client.post('/api/ais/start'),
  stop: () => client.post('/api/ais/stop'),
};

// === Qualcomm Cloud AI API ===
export const qualcommAPI = {
  getExplanation: (spillId) => client.get(`/api/qualcomm/explain/${spillId}`),
  getPublicAdvisories: (lang = 'en') => client.get(`/api/qualcomm/public-advisories`, { params: { lang } }),
  getPublicAdvisory: (spillId, lang = 'en') => client.get(`/api/qualcomm/public-advisory/${spillId}`, { params: { lang } }),
  getCleanupBrief: (spillId) => client.get(`/api/qualcomm/cleanup-brief/${spillId}`),
};


