import React, { useState, useEffect } from 'react';
import { getTeams, createTeam, updateTeam, deleteTeam, getAssignments } from '../services/api';
import { useAuth } from '../context/AuthContext';

const TYPE_OPTIONS = ['Fire', 'Flood', 'Earthquake', 'Storm', 'Chemical/Hazmat', 'Medical', 'Security/Terror'];
const AVAIL_OPTIONS = ['AVAILABLE', 'STANDBY', 'DEPLOYED'];
const AVAIL_LABEL = { AVAILABLE:'AVAILABLE', STANDBY:'STANDBY', DEPLOYED:'DEPLOYED', EN_ROUTE:'DEPLOYED', ON_SITE:'DEPLOYED', RETURNING:'STANDBY' };
const AVAIL_COLOR = { AVAILABLE:'#22c55e', STANDBY:'#60a5fa', DEPLOYED:'#f59e0b', EN_ROUTE:'#f59e0b', ON_SITE:'#ef4444', RETURNING:'#3b82f6' };

const EMPTY_FORM = {
    name: '', specialty: '', baseLocation: '',
    baseLat: '', baseLng: '',
    availability: 'AVAILABLE',
    handlesTypes: [],
    handlesSeverities: ['CRITICAL', 'HIGH'],
    members: 10, avgSpeedKmh: 70, icon: 'UNIT',
};

function activeAssignments(assignments, teamId) {
    return assignments.filter(a => a.teamId === teamId && !['RESOLVED', 'CANCELLED'].includes(a.status));
}

function readinessFor(team, activeCount) {
    const members = Number(team.members) || 1;
    const availability = (team.availability || 'AVAILABLE').toUpperCase();
    const base = availability === 'AVAILABLE' ? 92 : availability === 'STANDBY' || availability === 'RETURNING' ? 76 : 48;
    const loadPenalty = Math.min(42, activeCount * 18);
    const staffingBonus = Math.min(8, Math.floor(members / 5));
    return Math.max(12, Math.min(100, base + staffingBonus - loadPenalty));
}

function equipmentStatus(team, readiness) {
    if ((team.availability || '').toUpperCase() === 'ON_SITE' || readiness < 45) return 'Maintenance';
    if (readiness < 70 || (Number(team.members) || 0) < 6) return 'Limited';
    return 'Ready';
}

function formatTime(iso) {
    if (!iso) return 'No activity';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'No activity';
    return d.toLocaleString([], { month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function avgResponse(assignments) {
    const values = assignments.map(a => Number(a.etaMinutes)).filter(Number.isFinite);
    if (values.length === 0) return 'Unknown';
    return `${Math.round(values.reduce((sum, n) => sum + n, 0) / values.length)} min`;
}

export default function Teams() {
    const { user } = useAuth();
    const [teams, setTeams] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const load = async () => {
        try {
            setLoading(true);
            const [teamData, assignmentData] = await Promise.all([
                getTeams(),
                getAssignments().catch(() => []),
            ]);
            setTeams(teamData);
            setAssignments(assignmentData);
            setError(null);
        } catch {
            setError('Could not load teams. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const toggleType = (t) => {
        setForm(f => ({
            ...f,
            handlesTypes: f.handlesTypes.includes(t)
                ? f.handlesTypes.filter(x => x !== t)
                : [...f.handlesTypes, t],
        }));
    };

    const toggleSev = (s) => {
        setForm(f => ({
            ...f,
            handlesSeverities: f.handlesSeverities.includes(s)
                ? f.handlesSeverities.filter(x => x !== s)
                : [...f.handlesSeverities, s],
        }));
    };

    const handleSave = async () => {
        if (!form.name || !form.specialty) {
            alert('Name and specialty are required.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                baseLat: form.baseLat ? parseFloat(form.baseLat) : null,
                baseLng: form.baseLng ? parseFloat(form.baseLng) : null,
                members: parseInt(form.members) || 10,
                avgSpeedKmh: parseInt(form.avgSpeedKmh) || 70,
                handlesTypes: form.handlesTypes.join(','),
                handlesSeverities: form.handlesSeverities.join(','),
            };
            if (editingId) {
                const updated = await updateTeam(editingId, payload);
                setTeams(prev => prev.map(t => t.id === editingId ? updated : t));
            } else {
                const created = await createTeam(payload);
                setTeams(prev => [created, ...prev]);
            }
            setShowForm(false);
            setForm({ ...EMPTY_FORM });
            setEditingId(null);
        } catch {
            alert('Failed to save team.');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (team) => {
        setForm({
            name: team.name || '',
            specialty: team.specialty || '',
            baseLocation: team.baseLocation || '',
            baseLat: team.baseLat || '',
            baseLng: team.baseLng || '',
            availability: AVAIL_OPTIONS.includes(team.availability) ? team.availability : 'AVAILABLE',
            handlesTypes: (team.handlesTypes || '').split(',').filter(Boolean),
            handlesSeverities: (team.handlesSeverities || '').split(',').filter(Boolean),
            members: team.members || 10,
            avgSpeedKmh: team.avgSpeedKmh || 70,
            icon: team.icon || 'UNIT',
        });
        setEditingId(team.id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this team?')) return;
        try {
            await deleteTeam(id);
            setTeams(prev => prev.filter(t => t.id !== id));
        } catch {
            alert('Delete failed.');
        }
    };

    const canManageTeams = user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

    return (
        <div className="page">
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <div className="eyebrow">RESOURCE MANAGEMENT</div>
                    <h1>Response Teams</h1>
                    <p>Operational readiness, capacity, workload, and response performance for registered units.</p>
                </div>
                {canManageTeams && (
                    <button
                        className="btn btn-primary"
                        style={{ marginTop: 8 }}
                        onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
                    >
                        + New Team
                    </button>
                )}
            </div>

            {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 16px', marginBottom: 18, color: '#ef4444', fontSize: 13 }}>
                    {error}
                </div>
            )}

            {canManageTeams && showForm && (
                <div className="step-panel" style={{ marginBottom: 24 }}>
                    <div className="step-title"><h2>{editingId ? 'Edit Team' : 'Create New Team'}</h2></div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>TEAM NAME *</label>
                            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Fire Response Unit Alpha" />
                        </div>
                        <div className="form-group">
                            <label>SPECIALTY *</label>
                            <input value={form.specialty} onChange={e => set('specialty', e.target.value)} placeholder="e.g. Wildfire / Structure Fire" />
                        </div>
                        <div className="form-group">
                            <label>ICON / CODE</label>
                            <input value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="UNIT" maxLength={8} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>BASE LOCATION</label>
                            <input value={form.baseLocation} onChange={e => set('baseLocation', e.target.value)} placeholder="City, State" />
                        </div>
                        <div className="form-group">
                            <label>BASE LATITUDE</label>
                            <input type="number" value={form.baseLat} onChange={e => set('baseLat', e.target.value)} placeholder="34.05" />
                        </div>
                        <div className="form-group">
                            <label>BASE LONGITUDE</label>
                            <input type="number" value={form.baseLng} onChange={e => set('baseLng', e.target.value)} placeholder="-118.24" />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>AVAILABILITY</label>
                            <select value={form.availability} onChange={e => set('availability', e.target.value)}>
                                {AVAIL_OPTIONS.map(a => <option key={a} value={a}>{AVAIL_LABEL[a]}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>MEMBERS</label>
                            <input type="number" value={form.members} onChange={e => set('members', e.target.value)} min={1} />
                        </div>
                        <div className="form-group">
                            <label>AVG SPEED (km/h)</label>
                            <input type="number" value={form.avgSpeedKmh} onChange={e => set('avgSpeedKmh', e.target.value)} min={10} />
                        </div>
                    </div>

                    <div className="form-group form-full" style={{ marginBottom: 14 }}>
                        <label>HANDLES ALERT TYPES</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                            {TYPE_OPTIONS.map(t => (
                                <button key={t} onClick={() => toggleType(t)}
                                    style={{
                                        padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                                        border: form.handlesTypes.includes(t) ? '1px solid var(--blue)' : '1px solid var(--border)',
                                        background: form.handlesTypes.includes(t) ? 'rgba(59,130,246,0.12)' : 'var(--bg3)',
                                        color: form.handlesTypes.includes(t) ? '#60a5fa' : 'var(--muted)',
                                        fontFamily: 'var(--font)',
                                    }}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group form-full" style={{ marginBottom: 20 }}>
                        <label>CERTIFIED FOR SEVERITIES</label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => {
                                const colors = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' };
                                const active = form.handlesSeverities.includes(s);
                                return (
                                    <button key={s} onClick={() => toggleSev(s)}
                                        style={{
                                            padding: '5px 14px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                                            fontWeight: 700, letterSpacing: '0.06em',
                                            border: active ? `1px solid ${colors[s]}` : '1px solid var(--border)',
                                            background: active ? `${colors[s]}18` : 'var(--bg3)',
                                            color: active ? colors[s] : 'var(--muted)',
                                            fontFamily: 'var(--font)',
                                        }}>
                                        {s}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="step-actions">
                        <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editingId ? 'Update Team' : 'Create Team'}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)' }}>
                    <div className="spinner" /> Loading teams...
                </div>
            ) : teams.length === 0 ? (
                <div style={{ color: 'var(--muted)', padding: '24px 0', fontSize: 13 }}>
                    No teams registered yet. Create one above. Teams are required for auto-assignment.
                </div>
            ) : (
                <div className="teams-grid">
                    {teams.map(t => {
                        const teamAssignments = assignments.filter(a => a.teamId === t.id);
                        const activeCount = activeAssignments(assignments, t.id).length;
                        const capacity = Math.min(100, Math.round((activeCount / Math.max(1, Math.ceil((Number(t.members) || 1) / 6))) * 100));
                        const readiness = readinessFor(t, activeCount);
                        const equipment = equipmentStatus(t, readiness);
                        const overloaded = capacity >= 100 || readiness < 45;
                        const lastActive = teamAssignments[0]?.resolvedAt || teamAssignments[0]?.arrivedAt || teamAssignments[0]?.assignedAt;
                        const avail = AVAIL_LABEL[t.availability] || t.availability || 'AVAILABLE';
                        const availColor = AVAIL_COLOR[t.availability] || '#6b7280';
                        const equipmentColor = equipment === 'Ready' ? '#22c55e' : equipment === 'Limited' ? '#f59e0b' : '#ef4444';

                        return (
                            <div key={t.id} className="team-card" style={{
                                borderColor: overloaded ? 'rgba(239,68,68,0.45)' : 'var(--border)',
                                boxShadow: overloaded ? '0 0 0 1px rgba(239,68,68,0.12)' : undefined,
                            }}>
                                <div className="team-top">
                                    <div className="team-icon">{t.icon || 'UNIT'}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="team-name">{t.name}</div>
                                        <div className="team-specialty">{t.specialty}</div>
                                    </div>
                                    <div className="team-avail" style={{ color: availColor, borderColor: `${availColor}45`, background: `${availColor}14` }}>
                                        {avail}
                                    </div>
                                </div>

                                {overloaded && (
                                    <div style={{ marginTop: 10, color: '#ef4444', fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 800, letterSpacing: '0.07em' }}>
                                        OVERLOADED RESOURCE
                                    </div>
                                )}

                                <div className="team-meta">
                                    {t.baseLocation && <span>{t.baseLocation}</span>}
                                    <span>{t.members} members</span>
                                    <span>{t.avgSpeedKmh} km/h</span>
                                </div>

                                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginTop:12 }}>
                                    <Metric label="READINESS" value={`${readiness}%`} color={readiness >= 70 ? '#22c55e' : readiness >= 45 ? '#f59e0b' : '#ef4444'} />
                                    <Metric label="WORKLOAD" value={activeCount} color={activeCount ? '#f59e0b' : '#22c55e'} />
                                    <Metric label="ACTIVE" value={activeCount} color={activeCount ? '#60a5fa' : '#6b7280'} />
                                </div>

                                <Progress label="CAPACITY" value={capacity} color={capacity >= 100 ? '#ef4444' : capacity >= 70 ? '#f59e0b' : '#22c55e'} />
                                <Progress label="READINESS" value={readiness} color={readiness >= 70 ? '#22c55e' : readiness >= 45 ? '#f59e0b' : '#ef4444'} />

                                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8, marginTop:10 }}>
                                    <Info label="EQUIPMENT" value={equipment} color={equipmentColor} />
                                    <Info label="LAST ACTIVE" value={formatTime(lastActive)} />
                                    <Info label="AVG RESPONSE" value={avgResponse(teamAssignments)} />
                                    <Info label="INCIDENTS" value={teamAssignments.filter(a => a.status === 'RESOLVED').length || teamAssignments.length} />
                                </div>

                                {t.handlesTypes && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                                        {t.handlesTypes.split(',').filter(Boolean).map(tp => (
                                            <span key={tp} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--dim)', fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>
                                                {tp}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {canManageTeams && (
                                    <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                                        <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11, padding: '6px 10px' }} onClick={() => handleEdit(t)}>
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(t.id)}
                                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function Metric({ label, value, color }) {
    return (
        <div style={{ background:'rgba(15,23,42,0.55)', border:'1px solid var(--border)', borderRadius:7, padding:'7px 8px', minWidth:0 }}>
            <div style={{ fontSize:8, color:'var(--muted)', fontFamily:'var(--mono)', letterSpacing:'0.08em' }}>{label}</div>
            <div style={{ fontSize:16, fontWeight:800, color, lineHeight:1.2 }}>{value}</div>
        </div>
    );
}

function Progress({ label, value, color }) {
    return (
        <div style={{ marginTop:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:9, color:'var(--muted)', fontFamily:'var(--mono)', letterSpacing:'0.06em' }}>
                <span>{label}</span><span>{value}%</span>
            </div>
            <div style={{ height:6, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:999, overflow:'hidden' }}>
                <div style={{ width:`${Math.min(100, value)}%`, height:'100%', background:color }} />
            </div>
        </div>
    );
}

function Info({ label, value, color = 'var(--text)' }) {
    return (
        <div style={{ minWidth:0 }}>
            <div style={{ fontSize:8, color:'var(--muted)', fontFamily:'var(--mono)', letterSpacing:'0.08em', marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:11, color, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</div>
        </div>
    );
}
