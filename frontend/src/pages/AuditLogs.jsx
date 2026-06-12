import React, { useState, useEffect, useCallback } from 'react';
import { getAuditLogs } from '../services/api';

const ACTION_COLOR = {
    ALERT_CREATED: '#22c55e', ALERT_UPDATED: '#3b82f6', ALERT_ACKNOWLEDGED: '#22c55e',
    ALERT_RESOLVED: '#22c55e', ALERT_DELETED: '#ef4444', TEAM_ASSIGNED: '#f59e0b',
    TEAM_UPDATED: '#3b82f6', SLA_BREACHED: '#ef4444', STATUS_CHANGED: '#f59e0b',
    ESCALATED: '#ef4444',
};
const ACTION_ICON = {
    ALERT_CREATED: '✚', ALERT_UPDATED: '✎', ALERT_ACKNOWLEDGED: '✓',
    ALERT_RESOLVED: '✔', ALERT_DELETED: '✗', TEAM_ASSIGNED: '⇒',
    TEAM_UPDATED: '✎', SLA_BREACHED: '⚠', STATUS_CHANGED: '↻', ESCALATED: '⚡',
};

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setType] = useState('');

    const load = useCallback(async () => {
        try { setLogs(await getAuditLogs()); }
        catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

    const filtered = logs.filter(l => {
        const q = search.toLowerCase();
        const matchesSearch = !q || l.entityTitle?.toLowerCase().includes(q) || l.action?.toLowerCase().includes(q) || l.details?.toLowerCase().includes(q);
        const matchesType = !typeFilter || l.action === typeFilter;
        return matchesSearch && matchesType;
    });

    const uniqueActions = [...new Set(logs.map(l => l.action))];

    const fmt = (iso) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="page">
            <div className="page-header">
                <div className="eyebrow">AUDIT · IMMUTABLE</div>
                <h1>Audit Logs</h1>
                <p>Complete activity history for all alerts, teams, and assignments.</p>
            </div>

            {/* Filters */}
            <div className="history-controls" style={{ marginBottom: 16 }}>
                <div className="search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input placeholder="Search action, entity, or details..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="filter-select" value={typeFilter} onChange={e => setType(e.target.value)}>
                    <option value="">All actions</option>
                    {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <button className="clear-btn" onClick={() => { setSearch(''); setType(''); }}>⊗ CLEAR</button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: 12 }}>
                Showing {filtered.length} of {logs.length} entries
            </div>

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)' }}>
                    <div className="spinner" /> Loading audit trail...
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>No matching audit entries.</div>
                    ) : filtered.map((log, i) => {
                        const color = ACTION_COLOR[log.action] || '#6b7280';
                        const icon = ACTION_ICON[log.action] || '·';
                        return (
                            <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                {/* Icon */}
                                <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color, flexShrink: 0 }}>
                                    {icon}
                                </div>
                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color, fontFamily: 'var(--mono)' }}>
                                            {log.action}
                                        </span>
                                        <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                                            {log.entityType}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>
                                        {log.entityTitle || log.entityId?.slice(0, 8)}
                                    </div>
                                    {log.details && (
                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{log.details}</div>
                                    )}
                                </div>
                                {/* Meta */}
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                                        {fmt(log.performedAt)}
                                    </div>
                                    <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                                        {log.performedBy}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}