import axios from 'axios';
import { getToken, clearAuth } from './auth';

const BASE = 'http://localhost:8081';

const api = axios.create({
    baseURL: `${BASE}/api`,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use(config => {
    const token = getToken();
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    return config;
});

// Handle 401 — redirect to login
api.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            clearAuth();
            window.location.href = '/login';
        }
        console.error(`[API] ${err.config?.method?.toUpperCase()} ${err.config?.url} →`, err.response?.data || err.message);
        return Promise.reject(err);
    }
);

// ── Auth (uses BASE directly, not /api prefix) ────────────────
export const login = (username, password) =>
    axios.post(`${BASE}/auth/login`, { username, password }).then(r => r.data);

// ── Alerts ────────────────────────────────────────────────────
export const getAlerts = (params = {}) => api.get('/alerts', { params }).then(r => r.data);
export const getRecentAlerts = () => api.get('/alerts/recent').then(r => r.data);
export const getDashboardStats = () => api.get('/alerts/stats').then(r => r.data);
export const createAlert = (data) => api.post('/alerts', data).then(r => r.data);
export const updateAlert = (id, data) => api.put(`/alerts/${id}`, data).then(r => r.data);
export const updateAlertStatus = (id, status) => api.patch(`/alerts/${id}/status`, { status }).then(r => r.data);
export const acknowledgeAlert = (id) => api.post(`/alerts/${id}/acknowledge`).then(r => r.data);
export const deleteAlert = (id) => api.delete(`/alerts/${id}`).then(r => r.data);
export const searchAlerts = (q) => api.get('/alerts/search', { params: { q } }).then(r => r.data);

// ── Teams ─────────────────────────────────────────────────────
export const getTeams = () => api.get('/teams').then(r => r.data);
export const createTeam = (data) => api.post('/teams', data).then(r => r.data);
export const updateTeam = (id, data) => api.put(`/teams/${id}`, data).then(r => r.data);
export const deleteTeam = (id) => api.delete(`/teams/${id}`).then(r => r.data);
export const getTeamRecommendations = (type, severity, lat, lng, top = 3) =>
    api.get('/teams/recommend', { params: { type, severity, lat, lng, top } }).then(r => r.data);

// ── Assignments ───────────────────────────────────────────────
export const getAssignments = (params = {}) => api.get('/assignments', { params }).then(r => r.data);
export const autoAssign = (alertId) => api.post(`/assignments/auto/${alertId}`).then(r => r.data);
export const manualAssign = (data) => api.post('/assignments/manual', data).then(r => r.data);
export const updateAssignmentStatus = (id, status) => api.patch(`/assignments/${id}/status`, { status }).then(r => r.data);

// ── Audit ─────────────────────────────────────────────────────
export const getAuditLogs = (params = {}) => api.get('/audit', { params }).then(r => r.data);

// ── Escalations ───────────────────────────────────────────────
export const getEscalations = () => api.get('/escalations').then(r => r.data);

// ── Tracking ──────────────────────────────────────────────────
export const getLatestLocations = () => api.get('/tracking/latest').then(r => r.data);
export const updateTeamLocation = (data) => api.post('/tracking/update', data).then(r => r.data);

// ── Users (SUPER_ADMIN only) ──────────────────────────────────
export const getUsers = () => api.get('/users').then(r => r.data);
export const createUser = (data) => api.post('/users', data).then(r => r.data);
export const deleteUser = (id) => api.delete(`/users/${id}`).then(r => r.data);

export default api;