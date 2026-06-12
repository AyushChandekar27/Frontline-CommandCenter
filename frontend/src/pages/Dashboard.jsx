import React, { useMemo, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAlerts } from '../hooks/useAlerts';
import { useTeamSimulation } from '../hooks/useTeamSimulation';
import { getTeams } from '../services/api';
import OperationalMap from '../components/OperationalMap';
import LayerControl from '../components/LayerControl';
import TeamDetailPanel from '../components/TeamDetailPanel';
import { useMapStore } from '../hooks/useMapStore';
import { SEV_COLOR, FilterIcon } from '../components/icons';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const G = 12;

const OV = {
    position: 'absolute',
    zIndex: 800,
    background: 'rgba(13,15,20,0.76)',
    border: '1px solid rgba(46,52,71,0.62)',
    borderRadius: 8,
    backdropFilter: 'blur(12px)',
    boxShadow: '0 3px 14px rgba(0,0,0,0.34)',
};

function timeAgo(iso) {
    if (!iso) return '—';
    const m = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

const EMPTY_FILTERS = { state:'', severity:'', type:'', team:'', status:'' };

export default function Dashboard() {
    const navigate = useNavigate();
    const { alerts, stats, loading, error, lastFetched, changeStatus, ackAlert } = useAlerts();
    const { user } = useAuth();
    const canReadAlerts = ['ADMIN','SUPER_ADMIN'].includes(user?.role);
    const { locations: teamLocations } = useTeamSimulation(canReadAlerts);
    const [teams, setTeams] = useState([]);
    const { layers, toggleLayer } = useMapStore();

    const [filters, setFilters]         = useState(EMPTY_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));
    const clearFilters = () => setFilters(EMPTY_FILTERS);
    const activeCount = Object.values(filters).filter(Boolean).length;

    const [selectedTeam, setSelectedTeam] = useState(null);
    const [flyToTeam, setFlyToTeam]       = useState(null);
    const [statsOpen, setStatsOpen]       = useState(false);
    const [chartsOpen, setChartsOpen]     = useState(false);
    const [feedOpen, setFeedOpen]         = useState(false);

    React.useEffect(() => {
        getTeams().then(setTeams).catch(() => {});
    }, []);

    const handleTeamClick = useCallback((loc, team) => {
        setSelectedTeam({ loc, team: team || teams.find(t => t.id === loc.teamId) });
        setFlyToTeam({ lat: loc.latitude, lng: loc.longitude, zoom: 10 });
    }, [teams]);

    const handleTeamClose = useCallback(() => {
        setSelectedTeam(null);
        setFlyToTeam(null);
    }, []);

    const typeOptions  = useMemo(() => [...new Set(alerts.map(a => a.type).filter(Boolean))].sort(), [alerts]);
    const stateOptions = useMemo(() => {
        const states = alerts.map(a => {
            const parts = (a.location || '').split(',');
            return parts[parts.length - 1]?.trim();
        }).filter(Boolean);
        return [...new Set(states)].sort();
    }, [alerts]);
    const teamOptions = useMemo(() => [...new Set(alerts.map(a => a.assignedTeamName).filter(Boolean))].sort(), [alerts]);

    const filtered = useMemo(() => alerts.filter(a => {
        if (filters.severity && a.severity !== filters.severity) return false;
        if (filters.type     && a.type     !== filters.type)     return false;
        if (filters.status   && a.status   !== filters.status)   return false;
        if (filters.team     && a.assignedTeamName !== filters.team) return false;
        if (filters.state && !(a.location || '').toLowerCase().includes(filters.state.toLowerCase())) return false;
        return true;
    }), [alerts, filters]);

    const mappable   = useMemo(() => filtered.filter(a => a.latitude && a.longitude), [filtered]);
    const feedAlerts = useMemo(() => filtered.filter(a => a.status !== 'RESOLVED').slice(0, 6), [filtered]);

    const filteredStats = useMemo(() => ({
        active:        filtered.filter(a => a.status === 'ACTIVE').length,
        monitoring:    filtered.filter(a => a.status === 'MONITORING').length,
        resolved:      filtered.filter(a => a.status === 'RESOLVED').length,
        critical:      filtered.filter(a => a.severity === 'CRITICAL').length,
        totalAffected: filtered.reduce((s, a) => s + (a.affectedPopulation || 0), 0),
    }), [filtered]);

    const displayStats = activeCount > 0 ? filteredStats : stats;

    const trendData = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            return { label: DAYS[d.getDay()], key: d.toDateString(), count: 0 };
        });
        filtered.forEach(a => {
            const slot = days.find(d => d.key === new Date(a.createdAt).toDateString());
            if (slot) slot.count++;
        });
        return days;
    }, [filtered]);

    const maxTrend = Math.max(...trendData.map(d => d.count), 1);

    const catData = useMemo(() => {
        const c = {};
        filtered.forEach(a => { c[a.type] = (c[a.type] || 0) + 1; });
        const max = Math.max(...Object.values(c), 1);
        return Object.entries(c)
            .map(([k, v]) => ({ label: k, count: v, pct: Math.round(v / max * 100) }))
            .sort((a, b) => b.count - a.count).slice(0, 6);
    }, [filtered]);

    if (loading) return (
        <div className="page" style={{ display:'flex', alignItems:'center', gap:12, color:'var(--muted)' }}>
            <div className="spinner"/> Loading Command Center…
        </div>
    );

    const FILTER_TOP  = G + 34 + G;
    const BOTTOM_ROW  = G;
    const CHART_RIGHT = G + 36 + G;

    return (
        <div style={{ padding:'14px 18px' }}>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div>
                    <div style={{ fontSize:9, letterSpacing:'0.14em', color:'var(--muted)', fontFamily:'var(--mono)' }}>
                        SITUATIONAL AWARENESS · REAL-TIME
                    </div>
                    <h1 style={{ fontSize:17, fontWeight:700, color:'var(--text)', lineHeight:1.15 }}>Command Center</h1>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {lastFetched && (
                        <span style={{ fontSize:9, color:'var(--muted)', fontFamily:'var(--mono)' }}>
                            {lastFetched.toLocaleTimeString()}
                        </span>
                    )}
                    <LayerControl layers={layers} onToggle={toggleLayer}/>
                    <button onClick={() => setFiltersOpen(o => !o)} style={{
                        display:'flex', alignItems:'center', gap:5,
                        padding:`5px 10px`, borderRadius:6, cursor:'pointer',
                        border:`1px solid ${filtersOpen || activeCount > 0 ? 'var(--blue)' : 'var(--border2)'}`,
                        background: filtersOpen || activeCount > 0 ? 'rgba(51,12,137,0.14)' : 'transparent',
                        color: filtersOpen || activeCount > 0 ? '#a78bfa' : 'var(--muted)',
                        fontFamily:'var(--font)', fontSize:11, fontWeight:600,
                    }}>
                        <FilterIcon size={11}/>
                        Filters
                        {activeCount > 0 && (
                            <span style={{ background:'var(--blue)', color:'#fff', borderRadius:'50%', width:14, height:14, fontSize:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>
                                {activeCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {error && <div className="error-banner" style={{ marginBottom:12 }}>{error}</div>}

            <div style={{
                position: 'relative',
                width: '100%',
                height: 'calc(100vh - 96px)',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid var(--border)',
            }}>
                <OperationalMap
                    alerts={mappable}
                    teamLocations={teamLocations}
                    teams={teams}
                    layers={layers}
                    height="100%"
                    onTeamClick={handleTeamClick}
                    selectedTeamId={selectedTeam?.loc?.teamId}
                    flyToTeam={flyToTeam}
                />

                {filtersOpen && (
                    <div style={{ ...OV, top: FILTER_TOP, left: G, width: 218, padding:'11px 12px' }}>
                        <div style={{ fontSize:9, letterSpacing:'0.12em', color:'var(--muted)', fontFamily:'var(--mono)', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            FILTERS
                            {activeCount > 0 && (
                                <button onClick={clearFilters} style={{ background:'none', border:'none', color:'#a78bfa', fontSize:9, cursor:'pointer', fontFamily:'var(--mono)', letterSpacing:'0.06em' }}>
                                    CLEAR ALL
                                </button>
                            )}
                        </div>
                        {[
                            { label:'STATUS',   key:'status',   opts:['ACTIVE','MONITORING','RESOLVED'] },
                            { label:'SEVERITY', key:'severity', opts:['CRITICAL','HIGH','MEDIUM','LOW'] },
                            { label:'TYPE',     key:'type',     opts:typeOptions },
                            { label:'TEAM',     key:'team',     opts:teamOptions },
                            { label:'REGION',   key:'state',    opts:stateOptions },
                        ].map(f => (
                            <div key={f.key} style={{ marginBottom:8 }}>
                                <div style={{ fontSize:8, letterSpacing:'0.1em', color:'var(--muted)', fontFamily:'var(--mono)', marginBottom:4 }}>{f.label}</div>
                                <select value={filters[f.key]} onChange={e => setF(f.key, e.target.value)}
                                        style={{ width:'100%', background:'rgba(26,30,40,0.86)', border:'1px solid rgba(46,52,71,0.75)', borderRadius:5, color:'var(--text)', fontFamily:'var(--font)', fontSize:11, padding:'4px 7px', outline:'none', cursor:'pointer' }}>
                                    <option value="">All</option>
                                    {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                        ))}
                        <div style={{ fontSize:9, color:'var(--muted)', fontFamily:'var(--mono)', marginTop:9, paddingTop:9, borderTop:'1px solid rgba(37,42,56,0.75)' }}>
                            {filtered.length} / {alerts.length} alerts
                        </div>
                    </div>
                )}

                {activeCount > 0 && !filtersOpen && (
                    <div style={{ ...OV, top: FILTER_TOP, left: G, padding:'5px 9px', display:'flex', gap:5, flexWrap:'wrap', maxWidth:280 }}>
                        {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => (
                            <span key={k} style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(51,12,137,0.2)', border:'1px solid rgba(51,12,137,0.4)', borderRadius:4, padding:'2px 7px', fontSize:9, color:'#a78bfa', fontFamily:'var(--mono)' }}>
                                {v}
                                <button onClick={() => setF(k, '')} style={{ background:'none', border:'none', cursor:'pointer', color:'#a78bfa', padding:0, fontSize:11, lineHeight:1 }}>×</button>
                            </span>
                        ))}
                    </div>
                )}

                <div style={{ ...OV, bottom: BOTTOM_ROW, left: G, padding:0, overflow:'hidden' }}>
                    <button onClick={() => setStatsOpen(o => !o)}
                            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 10px', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontFamily:'var(--mono)', fontSize:9, letterSpacing:'0.1em' }}>
                        STATS · {filtered.length}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points={statsOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
                        </svg>
                    </button>
                    {statsOpen && (
                        <div style={{ display:'flex', borderTop:'1px solid #252a38' }}>
                            {[
                                { label:'ACT',  val: displayStats.active ?? 0,                           color:'#ef4444' },
                                { label:'MON',  val: displayStats.monitoring ?? 0,                       color:'#f59e0b' },
                                { label:'RES',  val: displayStats.resolved ?? 0,                         color:'#22c55e' },
                                { label:'CRIT', val: displayStats.critical ?? 0,                         color:'#ef4444' },
                                { label:'AFF',  val: (displayStats.totalAffected ?? 0).toLocaleString(), color:'#9ca3af' },
                            ].map((s, i, arr) => (
                                <div key={s.label} style={{ padding:"8px 11px", borderRight: i < arr.length - 1 ? '1px solid rgba(37,42,56,0.8)' : 'none', textAlign:'center', minWidth:50 }}>
                                    <div style={{ fontSize:8, color:'var(--muted)', fontFamily:'var(--mono)', letterSpacing:'0.08em', marginBottom:4 }}>{s.label}</div>
                                    <div style={{ fontSize:13, fontWeight:700, color:s.color, lineHeight:1 }}>{s.val}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ ...OV, bottom: BOTTOM_ROW, right: CHART_RIGHT, width: 190, padding:0, overflow:'hidden' }}>
                    <button onClick={() => setChartsOpen(o => !o)}
                            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 10px', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontFamily:'var(--mono)', fontSize:9, letterSpacing:'0.1em' }}>
                        BY CATEGORY
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points={chartsOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
                        </svg>
                    </button>
                    {chartsOpen && (
                        <div style={{ padding:"9px 11px", borderTop:'1px solid rgba(37,42,56,0.8)' }}>
                            {catData.length === 0
                                ? <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center' }}>No data</div>
                                : catData.map(b => (
                                    <div key={b.label} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7 }}>
                                        <div style={{ fontSize:8, color:'var(--muted)', width:56, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.label}</div>
                                        <div style={{ flex:1, height:5, background:'#1e2330', borderRadius:3, overflow:'hidden' }}>
                                            <div style={{ width:b.pct + '%', height:'100%', background:'#ef4444', borderRadius:3 }}/>
                                        </div>
                                        <div style={{ fontSize:8, color:'var(--muted)', fontFamily:'var(--mono)', minWidth:12, textAlign:'right' }}>{b.count}</div>
                                    </div>
                                ))
                            }
                            <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:28, marginTop:12, paddingTop:12, borderTop:'1px solid #252a38' }}>
                                {trendData.map((d, i) => (
                                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                                        <div style={{ width:'100%', borderRadius:2, background: d.count > 0 ? 'var(--blue)' : '#1e2330', height: Math.max(2, (d.count / maxTrend) * 22) }}/>
                                        <span style={{ fontSize:7, color:'var(--muted)', fontFamily:'var(--mono)' }}>{d.label[0]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ ...OV, bottom: BOTTOM_ROW, left:'50%', transform:'translateX(-50%)', padding:0, overflow:'hidden', minWidth:156 }}>
                    <button onClick={() => setFeedOpen(o => !o)}
                            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'5px 10px', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontFamily:'var(--mono)', fontSize:9, letterSpacing:'0.1em' }}>
                        LIVE FEED ({feedAlerts.length})
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points={feedOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
                        </svg>
                    </button>
                    {feedOpen && (
                        <div style={{ borderTop:'1px solid rgba(37,42,56,0.8)', maxHeight:224, overflowY:'auto', width:350, marginLeft:'50%', transform:'translateX(-50%)' }}>
                            {feedAlerts.length === 0
                                ? <div style={{ padding:'20px 24px', color:'var(--muted)', fontSize:11 }}>
                                    {activeCount > 0 ? 'No alerts match filters.' : alerts.length > 0 ? 'All resolved.' : 'No alerts yet.'}
                                </div>
                                : feedAlerts.map(a => <FeedRow key={a.id} alert={a} onStatus={changeStatus} onAck={ackAlert}/>)
                            }
                            <button className="view-all"
                                    style={{ display:'block', width:'100%', padding:'8px 14px', textAlign:'center', borderTop:'1px solid #252a38', fontSize:10 }}
                                    onClick={() => navigate('/history')}>
                                VIEW ALL →
                            </button>
                        </div>
                    )}
                </div>

                {selectedTeam && (
                    <div style={{
                        position:'absolute', top:0, right:0, bottom:0, width:324, zIndex:900,
                        background:'rgba(13,15,20,0.94)', borderLeft:'1px solid rgba(46,52,71,0.78)',
                        backdropFilter:'blur(14px)', boxShadow:'-6px 0 24px rgba(0,0,0,0.42)',
                        overflowY:'auto',
                    }}>
                        <TeamDetailPanel
                            team={selectedTeam.team}
                            loc={teamLocations.find(l => l.teamId === selectedTeam.loc.teamId) || selectedTeam.loc}
                            alerts={alerts}
                            onClose={handleTeamClose}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function FeedRow({ alert: a, onStatus, onAck }) {
    const c = SEV_COLOR[(a.severity || 'LOW').toUpperCase()] || '#6b7280';
    const statusTime = new Date(a.updatedAt || a.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false });
    return (
        <div style={{ display:'flex', alignItems:'center', gap:9, padding:"8px 12px", borderBottom:'1px solid rgba(26,30,40,0.85)' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:c, flexShrink:0 }}/>
            <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.title} <span style={{ color:'var(--muted)', fontFamily:'var(--mono)', fontSize:9 }}>{statusTime}</span></div>
                <div style={{ fontSize:9, color:'var(--muted)', fontFamily:'var(--mono)' }}>{a.location} · {timeAgo(a.createdAt)}</div>
            </div>
            <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                {!a.acknowledgedAt && a.status !== 'RESOLVED' && (
                    <button className="action-btn ack" style={{ padding:'3px 6px', fontSize:9 }} onClick={() => onAck(a.id)}>Ack</button>
                )}
                {a.status !== 'RESOLVED' && (
                    <button className="action-btn resolve" style={{ padding:'3px 6px', fontSize:9 }} onClick={() => onStatus(a.id, 'RESOLVED')}>Resolve</button>
                )}
            </div>
        </div>
    );
}