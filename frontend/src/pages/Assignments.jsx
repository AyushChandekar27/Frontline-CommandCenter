import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getAssignments, manualAssign, updateAssignmentStatus, getAlerts, getTeams } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

const STATUS_COLOR = { ASSIGNED: '#3b82f6', EN_ROUTE: '#f59e0b', ON_SITE: '#ef4444', RESOLVED: '#22c55e', CANCELLED: '#6b7280' };
const STATUS_NEXT = { ASSIGNED: 'EN_ROUTE', EN_ROUTE: 'ON_SITE', ON_SITE: 'RESOLVED' };
const SEVERITY_COLOR = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' };
const STEPS = ['ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'RESOLVED'];

const isAssignableTeam = (team) => (team?.availability || '').toUpperCase() === 'AVAILABLE';
const isUnavailableTeam = (team) => {
    const status = (team?.availability || '').toUpperCase();
    return status === 'DEPLOYED' || status !== 'AVAILABLE';
};

function formatEta(minutes) {
    const total = Number(minutes);
    if (!Number.isFinite(total) || total < 0) return 'Unknown';
    if (total < 60) return `${Math.round(total)}m`;
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const mins = Math.round(total % 60);
    if (days > 0) return `${days}d ${hours}h${mins ? ` ${mins}m` : ''}`;
    return `${hours}h ${mins}m`;
}

function formatDateTime(iso) {
    if (!iso) return 'Pending';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Pending';
    return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function distanceKm(team, alert) {
    const lat1 = Number(team?.baseLat);
    const lon1 = Number(team?.baseLng);
    const lat2 = Number(alert?.latitude);
    const lon2 = Number(alert?.longitude);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOverdue(a) {
    const eta = Number(a.etaMinutes);
    if (!Number.isFinite(eta) || !a.assignedAt || ['RESOLVED', 'CANCELLED'].includes(a.status)) return false;
    return Date.now() - new Date(a.assignedAt).getTime() > eta * 60000;
}

function Counter({ label, value, color }) {
    return (
        <div className="stat-card" style={{ padding: '11px 13px', borderColor: `${color}35`, background: 'rgba(15,23,42,0.78)' }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>{label}</div>
            <div style={{ fontSize: 23, fontWeight: 800, color, lineHeight: 1.15 }}>{value}</div>
        </div>
    );
}

function Capacity({ label, value, color }) {
    return (
        <div style={{ border: `1px solid ${color}35`, background: `${color}12`, color, borderRadius: 6, padding: '5px 9px', fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: '0.05em' }}>
            {label.toUpperCase()} {value}
        </div>
    );
}

function Badge({ label, color }) {
    return (
        <span style={{ color, background: `${color}18`, border: `1px solid ${color}45`, borderRadius: 4, padding: '3px 8px', fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 800, letterSpacing: '0.06em' }}>
            {label}
        </span>
    );
}

function Info({ label, value, color = 'var(--text)' }) {
    return (
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
            <div style={{ color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        </div>
    );
}

export default function Assignments() {
    const [assignments, setAssignments] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showManual, setShowManual] = useState(false);
    const [manual, setManual] = useState({ alertId: '', teamId: '', notes: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const [a, al, tm] = await Promise.all([getAssignments(), getAlerts(), getTeams()]);
            setAssignments(a);
            setAlerts(al);
            setTeams(tm);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    useWebSocket(['/topic/assignments'], useCallback((_, payload) => {
        setAssignments(prev => {
            const idx = prev.findIndex(a => a.id === payload.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = payload; return n; }
            return [payload, ...prev];
        });
    }, []));

    const handleManual = async () => {
        if (!manual.alertId || !manual.teamId) return alert('Select both an alert and a team.');
        const selectedTeam = teams.find(t => t.id === manual.teamId);
        if (!isAssignableTeam(selectedTeam)) return alert('Selected team is not available for assignment.');
        setSaving(true);
        try {
            const a = await manualAssign({ ...manual, assignedBy: 'OPS_CONSOLE' });
            setAssignments(p => [a, ...p]);
            setShowManual(false);
            setManual({ alertId: '', teamId: '', notes: '' });
        } catch (e) { alert(e.response?.data?.error || 'Manual assign failed.'); }
        finally { setSaving(false); }
    };

    const advance = async (id, currentStatus) => {
        const next = STATUS_NEXT[currentStatus];
        if (!next) return;
        try {
            const updated = await updateAssignmentStatus(id, next);
            setAssignments(p => p.map(a => a.id === updated.id ? updated : a));
        } catch { /* silent */ }
    };

    const alertTitle = (id) => alerts.find(a => a.id === id)?.title || id?.slice(0, 8);
    const alertById = useMemo(() => new Map(alerts.map(a => [a.id, a])), [alerts]);
    const teamById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
    const capacity = useMemo(() => ({
        available: teams.filter(isAssignableTeam).length,
        deployed: teams.filter(t => (t.availability || '').toUpperCase() === 'DEPLOYED').length,
        busy: teams.filter(t => {
            const status = (t.availability || '').toUpperCase();
            return status && status !== 'AVAILABLE' && status !== 'DEPLOYED';
        }).length
    }), [teams]);
    const counters = useMemo(() => ({
        active: assignments.filter(a => !['RESOLVED', 'CANCELLED'].includes(a.status)).length,
        enRoute: assignments.filter(a => a.status === 'EN_ROUTE').length,
        delayed: assignments.filter(isOverdue).length,
        resolved: assignments.filter(a => a.status === 'RESOLVED').length
    }), [assignments]);
    const filtered = filter ? assignments.filter(a => a.status === filter) : assignments;

    return (
        <div className="page">
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <div className="eyebrow">DISPATCH · OPERATIONS</div>
                    <h1>Assignments</h1>
                    <p>Auto and manual team dispatch. Advance lifecycle: Assigned -&gt; En Route -&gt; On Site -&gt; Resolved.</p>
                </div>
                <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowManual(!showManual)}>
                    + Manual Assign
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                <Counter label="ACTIVE DISPATCHES" value={counters.active} color="#60a5fa" />
                <Counter label="EN ROUTE" value={counters.enRoute} color="#f59e0b" />
                <Counter label="DELAYED" value={counters.delayed} color="#ef4444" />
                <Counter label="RESOLVED" value={counters.resolved} color="#22c55e" />
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                <Capacity label="Available" value={capacity.available} color="#22c55e" />
                <Capacity label="Busy" value={capacity.busy} color="#f59e0b" />
                <Capacity label="Deployed" value={capacity.deployed} color="#ef4444" />
            </div>

            {showManual && (
                <div className="step-panel" style={{ marginBottom: 20 }}>
                    <div className="step-title"><h2>Manual Assignment</h2></div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>ALERT *</label>
                            <select value={manual.alertId} onChange={e => setManual(m => ({ ...m, alertId: e.target.value }))}>
                                <option value="">-- Select alert --</option>
                                {alerts.filter(a => a.status !== 'RESOLVED').map(a => (
                                    <option key={a.id} value={a.id}>{a.title} ({a.severity})</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>TEAM *</label>
                            <select value={manual.teamId} onChange={e => setManual(m => ({ ...m, teamId: e.target.value }))}>
                                <option value="">-- Select team --</option>
                                {teams.map(t => (
                                    <option key={t.id} value={t.id} disabled={isUnavailableTeam(t)}>
                                        {t.name} - {t.availability}{isUnavailableTeam(t) ? ' - unavailable' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {manual.teamId && !isAssignableTeam(teams.find(t => t.id === manual.teamId)) && (
                            <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
                                WARNING: UNAVAILABLE / DEPLOYED TEAM
                            </div>
                        )}
                        {manual.teamId && !isAssignableTeam(teams.find(t => t.id === manual.teamId)) && (
                            <div style={{ color: '#fca5a5', fontSize: 11, marginTop: -2 }}>
                                Selected team is unavailable and cannot be assigned.
                            </div>
                        )}
                        <div className="form-group">
                            <label>NOTES</label>
                            <input value={manual.notes} onChange={e => setManual(m => ({ ...m, notes: e.target.value }))} placeholder="Optional dispatch notes" />
                        </div>
                    </div>
                    <div className="step-actions">
                        <button className="btn btn-ghost" onClick={() => setShowManual(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleManual} disabled={saving}>
                            {saving ? 'Assigning...' : 'Confirm Assignment'}
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {['', 'ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'RESOLVED'].map(s => (
                    <button key={s} onClick={() => setFilter(s)}
                        style={{
                            padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${filter === s ? (STATUS_COLOR[s] || 'var(--blue)') : 'var(--border)'}`,
                            background: filter === s ? `${STATUS_COLOR[s] || '#3b82f6'}18` : 'var(--bg2)',
                            color: filter === s ? (STATUS_COLOR[s] || '#60a5fa') : 'var(--muted)',
                            fontFamily: 'var(--font)', letterSpacing: '0.05em'
                        }}>
                        {s || 'ALL'} ({s ? assignments.filter(a => a.status === s).length : assignments.length})
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)' }}>
                    <div className="spinner" /> Loading assignments...
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>
                    No assignments yet. Use "Auto Assign" on an alert to dispatch a team.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filtered.map(a => {
                        const alert = alertById.get(a.alertId);
                        const team = teamById.get(a.teamId);
                        const severity = (alert?.severity || 'UNKNOWN').toUpperCase();
                        const color = STATUS_COLOR[a.status] || '#6b7280';
                        const next = STATUS_NEXT[a.status];
                        const dist = distanceKm(team, alert);
                        const overdue = isOverdue(a);
                        const teamStatus = (team?.availability || a.status || 'UNKNOWN').toUpperCase();
                        return (
                            <div key={a.id} style={{
                                background: overdue ? 'rgba(239,68,68,0.08)' : 'var(--bg2)',
                                border: `1px solid ${overdue ? 'rgba(239,68,68,0.45)' : 'var(--border)'}`,
                                borderLeft: `3px solid ${overdue ? '#ef4444' : color}`, borderRadius: 10, padding: '14px 16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                                            {a.teamName}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                            -&gt; {alertTitle(a.alertId)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        {overdue && <Badge color="#ef4444" label="OVERDUE" />}
                                        <Badge color={SEVERITY_COLOR[severity] || '#9ca3af'} label={severity} />
                                        <Badge color={color} label={a.status} />
                                        <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                                            {a.assignmentType}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 8, fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
                                    <Info label="LOCATION" value={alert?.location || 'Unknown'} />
                                    <Info label="INCIDENT TYPE" value={alert?.type || 'Unknown'} />
                                    <Info label="DISTANCE" value={dist == null ? 'Unknown' : `${dist.toFixed(1)} km`} />
                                    <Info label="ASSIGNED" value={formatDateTime(a.assignedAt)} />
                                    <Info label="TEAM STATUS" value={teamStatus} color={isAssignableTeam(team) ? '#22c55e' : '#f59e0b'} />
                                </div>

                                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: 10, flexWrap: 'wrap' }}>
                                    <span>ETA {formatEta(a.etaMinutes)}</span>
                                    {a.assignedBy && <span>BY {a.assignedBy}</span>}
                                    {a.arrivedAt && <span>ARRIVED {formatDateTime(a.arrivedAt)}</span>}
                                    {a.notes && <span>NOTE {a.notes}</span>}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, alignItems: 'stretch', marginBottom: next ? 10 : 0 }}>
                                    {STEPS.map((s, i) => {
                                        const cur = STEPS.indexOf(a.status);
                                        const done = i <= cur;
                                        const stamp = s === 'ASSIGNED' ? a.assignedAt : s === 'ON_SITE' ? a.arrivedAt : s === 'RESOLVED' ? a.resolvedAt : null;
                                        return (
                                            <div key={s} style={{
                                                border: `1px solid ${done ? `${STATUS_COLOR[s]}55` : 'var(--border)'}`,
                                                background: done ? `${STATUS_COLOR[s]}12` : 'rgba(255,255,255,0.02)',
                                                borderRadius: 6,
                                                padding: '7px 8px'
                                            }}>
                                                <div style={{ fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: '0.05em', color: done ? STATUS_COLOR[s] : 'var(--muted)', fontWeight: i === cur ? 700 : 500 }}>
                                                    {s.replace('_', ' ')}
                                                </div>
                                                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                                                    {s === 'EN_ROUTE' && a.status === 'EN_ROUTE' ? formatDateTime(a.assignedAt) : formatDateTime(stamp)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {next && (
                                    <button className="action-btn" style={{ width: '100%', marginTop: 4, color: STATUS_COLOR[next], borderColor: `${STATUS_COLOR[next]}40` }}
                                        onClick={() => advance(a.id, a.status)}>
                                        Mark as {next.replace('_', ' ')}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
