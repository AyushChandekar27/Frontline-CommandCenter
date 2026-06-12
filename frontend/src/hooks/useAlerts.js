import { useState, useEffect, useCallback, useRef } from 'react';
import { getAlerts, getDashboardStats, updateAlertStatus, acknowledgeAlert } from '../services/api';
import { useWebSocket } from './useWebSocket';

export function useAlerts() {
    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState({ active: 0, monitoring: 0, resolved: 0, critical: 0, totalAffected: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastFetched, setLastFetched] = useState(null);
    const timer = useRef(null);

    const fetchAll = useCallback(async () => {
        try {
            const [alertData, statsData] = await Promise.all([getAlerts(), getDashboardStats()]);
            setAlerts(alertData);
            setStats(statsData);
            setError(null);
            setLastFetched(new Date());
        } catch {
            setError('Cannot reach backend.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        timer.current = setInterval(fetchAll, 12000);
        return () => clearInterval(timer.current);
    }, [fetchAll]);

    // WebSocket — instant push when any alert is created/updated
    useWebSocket(['/topic/alerts'], useCallback((_, payload) => {
        setAlerts(prev => {
            const idx = prev.findIndex(a => a.id === payload.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = payload; return n; }
            return [payload, ...prev];
        });
        getDashboardStats().then(setStats).catch(() => { });
    }, []));

    const refresh = useCallback(() => fetchAll(), [fetchAll]);

    const changeStatus = useCallback(async (id, status) => {
        const updated = await updateAlertStatus(id, status);
        setAlerts(prev => prev.map(a => a.id === updated.id ? { ...updated, updatedAt: updated.updatedAt || new Date().toISOString() } : a));
        getDashboardStats().then(setStats).catch(() => { });
    }, []);

    const ackAlert = useCallback(async (id) => {
        const updated = await acknowledgeAlert(id);
        setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));
    }, []);

    return { alerts, stats, loading, error, lastFetched, refresh, changeStatus, ackAlert };
}
