import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getEscalations, acknowledgeAlert } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

const SEVERITY_COLOR = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' };

function minutesSince(iso) {
    if (!iso) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function breachMinutes(alert) {
    if (!alert.createdAt || !alert.slaMinutes) return 0;
    return Math.max(0, Math.floor((Date.now() - (new Date(alert.createdAt).getTime() + alert.slaMinutes * 60000)) / 60000));
}

function escalationLevel(alert) {
    const mins = breachMinutes(alert);
    if ((alert.severity || '').toUpperCase() === 'CRITICAL' || mins >= 60) return 'L3';
    if ((alert.severity || '').toUpperCase() === 'HIGH' || mins >= 30) return 'L2';
    return 'L1';
}

export default function Escalations() {
    const [breached, setBreached] = useState([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());

    const load = useCallback(async () => {
        try { setBreached(await getEscalations()); }
        catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

    useWebSocket(['/topic/escalations'], useCallback((_, payload) => {
        setBreached(prev => {
            if (prev.find(a => a.id === payload.id)) return prev;
            return [payload, ...prev];
        });
    }, []));

    const handleAck = async (id) => {
        try {
            await acknowledgeAlert(id);
            setBreached(prev => prev.filter(a => a.id !== id));
        } catch { /* silent */ }
    };

    const stats = useMemo(() => ({
        breached: breached.filter(a => a.status !== 'RESOLVED').length,
        critical: breached.filter(a => (a.severity || '').toUpperCase() === 'CRITICAL').length,
        warning: breached.filter(a => ['HIGH', 'MEDIUM'].includes((a.severity || '').toUpperCase())).length,
        resolved: breached.filter(a => a.status === 'RESOLVED').length,
  }), [breached]);

    const remainingTimer = (alert) => {
        if (!alert.createdAt || !alert.slaMinutes) return '00:00';
        const remaining = Math.max(0, Math.ceil((new Date(alert.createdAt).getTime() + alert.slaMinutes * 60000 - now) / 60000));
        return `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    };

    return (
        <div className="page">
            <div className="page-header">
                <div className="eyebrow">SLA MONITOR · CRITICAL</div>
                <h1>Escalations</h1>
                <p>Active SLA breaches requiring acknowledgement, dispatch ownership, or resolution.</p>
            </div>

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)' }}>
                    <div className="spinner" /> Checking SLA status...
                </div>
            ) : breached.length === 0 ? (
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '20px 24px', color: '#22c55e', fontSize: 14 }}>
                    No active SLA escalations. All alerts are within their response windows.
                </div>
            ) : (
                <>
                    <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 18 }}>
                        <Metric label="CRITICAL" value={stats.critical} color="#ef4444" />
                        <Metric label="WARNING" value={stats.warning} color="#f59e0b" />
                        <Metric label="BREACHED" value={stats.breached} color="#ef4444" />
                        <Metric label="RESOLVED" value={stats.resolved} color="#22c55e" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
                        {breached.map(alert => {
                            const sev = (alert.severity || 'LOW').toUpperCase();
                            const color = SEVERITY_COLOR[sev] || '#6b7280';
                            const level = escalationLevel(alert);
                            const overdue = breachMinutes(alert);
                            return (
                                <div key={alert.id} style={{ background: 'var(--bg2)', border: `1px solid ${color}45`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '15px 16px', boxShadow: '0 4px 18px rgba(0,0,0,0.28)' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                                <Badge text="SLA BREACH" color={color} />
                                                <Badge text={level} color={level === 'L3' ? '#ef4444' : level === 'L2' ? '#f97316' : '#f59e0b'} />
                                                <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>SLA {alert.slaMinutes || '—'} min</span>
                                            </div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.title}</div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{alert.location} · {alert.type}</div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'var(--mono)', lineHeight: 1 }}>{remainingTimer(alert)}</div>
                                            <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 3 }}>HH:MM REMAINING</div>
                                            <div style={{ fontSize: 8, color: '#ef4444', fontFamily: 'var(--mono)', marginTop: 2 }}>{overdue} MIN OVER</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                                        <Info label="SEVERITY" value={sev} color={color} />
                                        <Info label="TYPE" value={alert.type || 'INCIDENT'} color="#9ca3af" />
                                        <Info label="TEAM" value={alert.assignedTeamName || 'UNASSIGNED'} color={alert.assignedTeamName ? '#9ca3af' : '#f59e0b'} />
                                        <Info label="STATUS" value={alert.status || 'ACTIVE'} color="#9ca3af" />
                                    </div>

                                    {alert.description && (
                                        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.45, marginBottom: 12 }}>
                                            {alert.description.length > 150 ? alert.description.slice(0, 148) + '...' : alert.description}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                                        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                                            ESC {minutesSince(alert.escalatedAt) ?? 0}m ago · CREATED {minutesSince(alert.createdAt) ?? 0}m ago
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                        <button className="action-btn monitor" onClick={() => window.alert('Escalation level noted for command review.')}>
                                            Escalate
                                        </button>
                                        <button className="action-btn" onClick={() => window.alert('Open Assignments to dispatch a response team.')}>
                                            Dispatch Team
                                        </button>
                                        <button className="action-btn ack" onClick={() => handleAck(alert.id)}>
                                            Acknowledge
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

function Metric({ label, value, color }) {
    return (
        <div className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
            <div className="stat-sub">ESCALATIONS</div>
        </div>
    );
}

function Badge({ text, color }) {
    return (
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color, fontFamily: 'var(--mono)', background: `${color}14`, border: `1px solid ${color}40`, padding: '2px 7px', borderRadius: 4 }}>
            {text}
        </span>
    );
}

function Info({ label, value, color }) {
    return (
        <div style={{ background: 'rgba(13,15,20,0.55)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 9px' }}>
            <div style={{ fontSize: 8, color: 'var(--muted)', fontFamily: 'var(--mono)', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 11, color, fontWeight: 700, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        </div>
    );
}
