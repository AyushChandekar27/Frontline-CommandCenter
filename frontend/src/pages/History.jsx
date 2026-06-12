import React, { useState, useMemo, useEffect } from 'react';
import { useAlerts } from '../hooks/useAlerts';
import { getAssignments } from '../services/api';
import {
    AlertTypeIcon, MapPinIcon, UsersIcon, SEV_COLOR,
    StatusMonitorIcon, StatusResolvedIcon,
} from '../components/icons';

const STATUS_CLASS = {
    ACTIVE: 'status-active',
    MONITORING: 'status-monitoring',
    RESOLVED: 'status-resolved',
};

const STAGES = ['Created', 'Assigned', 'En Route', 'Resolved'];

function fmt(iso) {
    if (!iso) return 'Pending';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Pending';
    return d.toLocaleString('en', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function duration(start, end) {
    if (!start) return 'Unknown';
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    if (!Number.isFinite(s) || !Number.isFinite(e)) return 'Unknown';
    const mins = Math.max(0, Math.round((e - s) / 60000));
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
}

function dateKey(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function slaState(alert, assignments) {
    const sla = Number(alert.slaMinutes);
    if (!Number.isFinite(sla) || !alert.createdAt) return { label: 'SLA Unknown', color: '#6b7280' };
    const resolvedAt = assignments.find(a => a.resolvedAt)?.resolvedAt || (alert.status === 'RESOLVED' ? alert.updatedAt : null);
    const elapsed = (new Date(resolvedAt || Date.now()).getTime() - new Date(alert.createdAt).getTime()) / 60000;
    return elapsed <= sla
        ? { label: 'SLA Met', color: '#22c55e' }
        : { label: 'SLA Breached', color: '#ef4444' };
}

function stageTime(stage, alert, assignments) {
    if (stage === 'Created') return alert.createdAt;
    if (stage === 'Assigned') return assignments[0]?.assignedAt;
    if (stage === 'En Route') return assignments.find(a => ['EN_ROUTE', 'ON_SITE', 'RESOLVED'].includes(a.status))?.assignedAt;
    return assignments.find(a => a.resolvedAt)?.resolvedAt || (alert.status === 'RESOLVED' ? alert.updatedAt : null);
}

export default function History() {
    const { alerts, loading, changeStatus } = useAlerts();
    const [assignments, setAssignments] = useState([]);
    const [search, setSearch] = useState('');
    const [typeF, setTypeF] = useState('');
    const [sevF, setSevF] = useState('');
    const [statusF, setStatusF] = useState('');
    const [dateF, setDateF] = useState('');
    const [teamF, setTeamF] = useState('');

    useEffect(() => {
        getAssignments().then(setAssignments).catch(() => setAssignments([]));
    }, []);

    const assignmentByAlert = useMemo(() => {
        const map = new Map();
        assignments.forEach(a => {
            if (!map.has(a.alertId)) map.set(a.alertId, []);
            map.get(a.alertId).push(a);
        });
        map.forEach(list => list.sort((a, b) => new Date(a.assignedAt || 0) - new Date(b.assignedAt || 0)));
        return map;
    }, [assignments]);

    const types = useMemo(() => [...new Set(alerts.map(a => a.type).filter(Boolean))], [alerts]);
    const teams = useMemo(() => [...new Set(assignments.map(a => a.teamName).filter(Boolean))].sort(), [assignments]);

    const filtered = useMemo(() => alerts.filter(a => {
        const q = search.toLowerCase();
        const linked = assignmentByAlert.get(a.id) || [];
        if (q && !a.title?.toLowerCase().includes(q) && !a.location?.toLowerCase().includes(q)) return false;
        if (typeF && a.type !== typeF) return false;
        if (sevF && a.severity !== sevF) return false;
        if (statusF && a.status !== statusF) return false;
        if (dateF && dateKey(a.createdAt) !== dateF) return false;
        if (teamF && !linked.some(asg => asg.teamName === teamF)) return false;
        return true;
    }), [alerts, assignmentByAlert, dateF, search, sevF, statusF, teamF, typeF]);

    const clear = () => {
        setSearch('');
        setTypeF('');
        setSevF('');
        setStatusF('');
        setDateF('');
        setTeamF('');
    };

    return (
        <div className="page">
            <div className="page-header">
                <div className="eyebrow">INCIDENT TIMELINE · IMMUTABLE</div>
                <h1>Incident History</h1>
                <p>Operational timeline of incidents, assignments, SLA outcome, and resolution progress.</p>
            </div>

            <div className="history-meta">
                <span className="meta-chip">TOTAL <strong>{filtered.length}</strong></span>
                <span className="meta-chip">ACTIVE <strong style={{ color:'var(--orange)' }}>{filtered.filter(a=>a.status==='ACTIVE').length}</strong></span>
                <span className="meta-chip">BREACHED <strong style={{ color:'#ef4444' }}>{filtered.filter(a=>slaState(a, assignmentByAlert.get(a.id) || []).label === 'SLA Breached').length}</strong></span>
                <span className="meta-chip">RESOLVED <strong style={{ color:'var(--green)' }}>{filtered.filter(a=>a.status==='RESOLVED').length}</strong></span>
            </div>

            <div className="history-controls" style={{ gridTemplateColumns:'1.6fr repeat(5, minmax(120px, 1fr)) auto' }}>
                <div className="search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input placeholder="Search title or location..." value={search} onChange={e=>setSearch(e.target.value)}/>
                </div>
                <select className="filter-select" value={typeF} onChange={e=>setTypeF(e.target.value)}>
                    <option value="">All types</option>
                    {types.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                <select className="filter-select" value={sevF} onChange={e=>setSevF(e.target.value)}>
                    <option value="">All severities</option>
                    {['CRITICAL','HIGH','MEDIUM','LOW'].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
                <select className="filter-select" value={statusF} onChange={e=>setStatusF(e.target.value)}>
                    <option value="">All statuses</option>
                    {['ACTIVE','MONITORING','RESOLVED'].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
                <input className="filter-select" type="date" value={dateF} onChange={e=>setDateF(e.target.value)} />
                <select className="filter-select" value={teamF} onChange={e=>setTeamF(e.target.value)}>
                    <option value="">All teams</option>
                    {teams.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                <button className="clear-btn" onClick={clear}>Clear</button>
            </div>

            {loading ? (
                <div style={{ display:'flex', alignItems:'center', gap:12, color:'var(--muted)' }}>
                    <div className="spinner"/> Loading history...
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ color:'var(--muted)', padding:28, textAlign:'center' }}>No alerts match filters.</div>
            ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {filtered.map(alert => {
                        const linked = assignmentByAlert.get(alert.id) || [];
                        const severityColor = SEV_COLOR[(alert.severity || 'LOW').toUpperCase()] || '#6b7280';
                        const sla = slaState(alert, linked);
                        const resolvedAt = linked.find(a => a.resolvedAt)?.resolvedAt || (alert.status === 'RESOLVED' ? alert.updatedAt : null);
                        const assignedTeams = linked.map(a => a.teamName).filter(Boolean);

                        return (
                            <div key={alert.id} style={{
                                background:'var(--bg2)',
                                border:'1px solid var(--border)',
                                borderLeft:`3px solid ${severityColor}`,
                                borderRadius:10,
                                padding:'14px 16px',
                            }}>
                                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14 }}>
                                    <div style={{ minWidth:0 }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                                            <AlertTypeIcon type={alert.type} size={15} color={severityColor}/>
                                            <span style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{alert.title}</span>
                                            <span className="sev-chip" style={{ color:severityColor, border:`1px solid ${severityColor}40`, background:`${severityColor}12` }}>{alert.severity}</span>
                                        </div>
                                        <div style={{ display:'flex', alignItems:'center', gap:6, color:'var(--muted)', fontSize:12 }}>
                                            <MapPinIcon size={11} color="var(--muted)"/>
                                            {alert.location}
                                        </div>
                                    </div>
                                    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end' }}>
                                        <span className={`status-pill ${STATUS_CLASS[alert.status]||''}`}>{alert.status}</span>
                                        <span style={{ color:sla.color, background:`${sla.color}12`, border:`1px solid ${sla.color}40`, borderRadius:5, padding:'4px 8px', fontSize:10, fontFamily:'var(--mono)', fontWeight:800 }}>
                                            {sla.label}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display:'grid', gridTemplateColumns:'repeat(5, minmax(120px, 1fr))', gap:10, marginTop:12 }}>
                                    <Info label="DURATION" value={duration(alert.createdAt, resolvedAt)} />
                                    <Info label="RESOLUTION" value={resolvedAt ? fmt(resolvedAt) : 'Pending'} />
                                    <Info label="ASSIGNED TEAMS" value={assignedTeams.length ? assignedTeams.join(', ') : 'Unassigned'} />
                                    <Info label="AFFECTED" value={(alert.affectedPopulation || 0).toLocaleString()} Icon={UsersIcon} />
                                    <Info label="SLA TARGET" value={alert.slaMinutes ? `${alert.slaMinutes} min` : 'Unknown'} />
                                </div>

                                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6, marginTop:12 }}>
                                    {STAGES.map(stage => {
                                        const stamp = stageTime(stage, alert, linked);
                                        const done = Boolean(stamp);
                                        const color = done ? (stage === 'Resolved' ? '#22c55e' : '#60a5fa') : '#4b5563';
                                        return (
                                            <div key={stage} style={{ border:`1px solid ${color}35`, background:`${color}10`, borderRadius:7, padding:'8px 9px' }}>
                                                <div style={{ fontSize:9, color, fontFamily:'var(--mono)', fontWeight:800, letterSpacing:'0.06em' }}>{stage.toUpperCase()}</div>
                                                <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>{fmt(stamp)}</div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                                    <span className="id-cell">{alert.id?.slice(0,8)}</span>
                                    <div style={{ display:'flex', gap:6 }}>
                                        {alert.status !== 'RESOLVED' && (
                                            <button className="action-btn resolve" style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, padding:'4px 8px' }} onClick={() => changeStatus(alert.id,'RESOLVED')}>
                                                <StatusResolvedIcon size={11}/> Resolve
                                            </button>
                                        )}
                                        {alert.status === 'ACTIVE' && (
                                            <button className="action-btn monitor" style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, padding:'4px 8px' }} onClick={() => changeStatus(alert.id,'MONITORING')}>
                                                <StatusMonitorIcon size={11}/> Monitor
                                            </button>
                                        )}
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

function Info({ label, value, Icon }) {
    return (
        <div style={{ minWidth:0 }}>
            <div style={{ fontSize:9, color:'var(--muted)', fontFamily:'var(--mono)', letterSpacing:'0.08em', marginBottom:3 }}>{label}</div>
            <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text)', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {Icon && <Icon size={11} color="var(--muted)" />}
                {value}
            </div>
        </div>
    );
}
