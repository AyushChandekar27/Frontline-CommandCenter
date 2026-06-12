import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTeamSimulation } from '../hooks/useTeamSimulation';
import { getTeams, getAlerts } from '../services/api';
import { useAuth } from '../context/AuthContext';
import OperationalMap from '../components/OperationalMap';
import TeamDetailPanel from '../components/TeamDetailPanel';
import { SearchIcon, TeamsIcon } from '../components/icons';

const STATUS_COLOR = { AVAILABLE:'#22c55e', ASSIGNED:'#60a5fa', EN_ROUTE:'#f59e0b', ON_SITE:'#ef4444', RETURNING:'#3b82f6' };
const STATUS_LABEL = { AVAILABLE:'AVAILABLE', ASSIGNED:'ASSIGNED', EN_ROUTE:'EN ROUTE', ON_SITE:'ON SITE', RETURNING:'RETURNING' };
const STATUS_OPTS  = ['ALL','AVAILABLE','ASSIGNED','EN_ROUTE','ON_SITE','RETURNING'];

function distanceKm(loc) {
    if (!loc?.assignedAlertLat || !loc?.assignedAlertLng) return null;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(loc.assignedAlertLat - loc.latitude);
    const dLng = toRad(loc.assignedAlertLng - loc.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(loc.latitude)) * Math.cos(toRad(loc.assignedAlertLat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaLabel(loc) {
    const distance = distanceKm(loc);
    if (!distance || !loc?.speedKmh) return null;
    const minutes = Math.round((distance / loc.speedKmh) * 60);
    return minutes > 0 ? `ETA ${minutes}m` : 'ETA now';
}

function isStale(loc) {
    if (!loc?.lastUpdateAt) return false;
    return Date.now() - new Date(loc.lastUpdateAt).getTime() > 30000;
}

function timeLabel(iso) {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

export default function LiveTracking() {
    const { user }                 = useAuth();
    const canReadAlerts = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);
    const { locations } = useTeamSimulation(canReadAlerts);
    const [teams, setTeams]      = useState([]);
    const [alerts, setAlerts]    = useState([]);
    const [search, setSearch]    = useState('');
    const [statusF, setStatusF]  = useState('ALL');
    const [selected, setSelected] = useState(null); // { loc, team }
    const [flyToTeam, setFlyToTeam] = useState(null);

    useEffect(() => {
        getTeams().then(setTeams).catch(() => {});
        if (user && ['ADMIN','SUPER_ADMIN'].includes(user.role)) {
            getAlerts().then(setAlerts).catch(() => {});
        }
    }, [user]);

    // Counts per status
    const counts = useMemo(() => {
        const c = { AVAILABLE:0, ASSIGNED:0, EN_ROUTE:0, ON_SITE:0, RETURNING:0 };
        locations.forEach(l => { if (c[l.status] !== undefined) c[l.status]++; });
        return c;
    }, [locations]);

    // Filtered list for sidebar
    const filtered = useMemo(() => locations.filter(loc => {
        if (statusF !== 'ALL' && loc.status !== statusF) return false;
        if (search && !loc.teamName?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    }), [locations, search, statusF]);

    // Click handler — select team, fly map to it
    const handleTeamClick = useCallback((loc, team) => {
        setSelected({ loc, team: team || teams.find(t => t.id === loc.teamId) });
        setFlyToTeam({ lat: loc.latitude, lng: loc.longitude, zoom: 10 });
    }, [teams]);

    const handleClose = useCallback(() => {
        setSelected(null);
        setFlyToTeam(null);
    }, []);

    const layers = { alerts: false, heatmap: false, boundaries: false, teams: true };

    return (
        <div className="page">
            <div className="page-header">
                <div className="eyebrow">REAL-TIME · SIMULATED GPS</div>
                <h1>Live Tracking</h1>
                <p>Operational team telemetry with route state, ETA, GPS status, and stale update warnings.</p>
            </div>

            {/* Status summary cards */}
            <div className="stats-row" style={{ gridTemplateColumns:'repeat(5,1fr)', marginBottom:20 }}>
                {Object.entries(counts).map(([s, c]) => (
                    <div
                        key={s}
                        className="stat-card"
                        onClick={() => setStatusF(statusF === s ? 'ALL' : s)}
                        style={{ cursor:'pointer', borderColor: statusF === s ? STATUS_COLOR[s] : 'var(--border)', transition:'border-color 0.15s' }}
                    >
                        <div className="stat-label">
                            <span className="indicator" style={{ background: STATUS_COLOR[s] }}/>{STATUS_LABEL[s]}
                        </div>
                        <div className="stat-value" style={{ fontSize:28, color: STATUS_COLOR[s] }}>{c}</div>
                        <div className="stat-sub">TEAMS</div>
                    </div>
                ))}
            </div>

            {/* Main layout */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16 }}>

                {/* Map panel — side panel overlays it when open */}
                <div className="panel" style={{ overflow:'hidden', position:'relative' }}>
                    <div className="panel-header">
                        <div className="panel-title">
                            <span className="live-badge">LIVE</span> Team Positions
                        </div>
                        <div className="legend">
                            {Object.entries(STATUS_COLOR).map(([s,c]) => (
                                <div className="legend-item" key={s}>
                                    <div className="legend-dot" style={{ background:c }}/>{STATUS_LABEL[s] || s}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Map + slide-in panel share same container */}
                    <div style={{ position:'relative', height:480 }}>
                        <OperationalMap
                            alerts={[]}
                            teamLocations={locations}
                            teams={teams}
                            layers={layers}
                            height={480}
                            onTeamClick={handleTeamClick}
                            selectedTeamId={selected?.loc?.teamId}
                            flyToTeam={flyToTeam}
                        />

                        {/* TeamDetailPanel slides in over right side of map */}
                        {selected && (
                            <TeamDetailPanel
                                team={selected.team}
                                loc={locations.find(l => l.teamId === selected.loc.teamId) || selected.loc}
                                alerts={alerts}
                                onClose={handleClose}
                            />
                        )}
                    </div>
                </div>

                {/* Team list sidebar */}
                <div className="panel" style={{ overflow:'hidden', display:'flex', flexDirection:'column' }}>
                    <div className="panel-header">
                        <div className="panel-title">
                            <TeamsIcon size={13}/>
                            Teams
                        </div>
                        <span style={{ fontSize:10, color:'var(--muted)', fontFamily:'var(--mono)' }}>
              {filtered.length}/{locations.length}
            </span>
                    </div>

                    {/* Search */}
                    <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
                        <div className="search-box" style={{ height:34 }}>
                            <SearchIcon size={13} color="var(--muted)"/>
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search teams…"
                            />
                        </div>
                    </div>

                    {/* Status filter pills */}
                    <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', display:'flex', gap:4, flexWrap:'wrap' }}>
                        {STATUS_OPTS.map(s => (
                            <button key={s} onClick={() => setStatusF(s)}
                                    style={{
                                        padding:'3px 9px', borderRadius:4, fontSize:9, fontWeight:700,
                                        letterSpacing:'0.06em', fontFamily:'var(--mono)', cursor:'pointer',
                                        border:`1px solid ${statusF===s ? (STATUS_COLOR[s]||'var(--blue)') : 'var(--border)'}`,
                                        background: statusF===s ? `${STATUS_COLOR[s]||'#330C89'}18` : 'transparent',
                                        color: statusF===s ? (STATUS_COLOR[s]||'#a78bfa') : 'var(--muted)',
                                        transition:'all 0.12s',
                                    }}>
                                {STATUS_LABEL[s] || s}
                            </button>
                        ))}
                    </div>

                    {/* Team rows */}
                    <div style={{ flex:1, overflowY:'auto', maxHeight:380 }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding:20, color:'var(--muted)', fontSize:13 }}>
                                {locations.length === 0
                                    ? 'No teams with base coordinates.'
                                    : 'No teams match filter.'}
                            </div>
                        ) : filtered.map(loc => {
                            const team = teams.find(t => t.id === loc.teamId);
                            const isSelected = selected?.loc?.teamId === loc.teamId;
                            const c = STATUS_COLOR[loc.status] || '#6b7280';
                            const eta = etaLabel(loc);
                            const distance = distanceKm(loc);

                            return (
                                <div
                                    key={loc.teamId}
                                    onClick={() => handleTeamClick(loc, team)}
                                    style={{
                                        padding:'10px 14px',
                                        borderBottom:'1px solid var(--border)',
                                        display:'flex', alignItems:'center', gap:10,
                                        cursor:'pointer',
                                        background: isSelected ? `${c}10` : 'transparent',
                                        borderLeft: isSelected ? `3px solid ${c}` : '3px solid transparent',
                                        transition:'all 0.12s',
                                    }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background='var(--bg3)'; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background='transparent'; }}
                                >
                                    {/* Status dot */}
                                    <div style={{ width:8, height:8, borderRadius:'50%', background:c, flexShrink:0 }}/>

                                    <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{ fontSize:12, fontWeight:600, color: isSelected ? 'var(--text)' : 'var(--dim)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                            {loc.teamName}
                                            {eta && <span style={{ color:c, fontSize:9, fontFamily:'var(--mono)', marginLeft:6 }}>{eta}</span>}
                                            {distance != null && <span style={{ color:'var(--muted)', fontSize:9, fontFamily:'var(--mono)', marginLeft:6 }}>{distance.toFixed(1)} km</span>}
                                        </div>
                                        <div style={{ fontSize:10, color:'var(--muted)', fontFamily:'var(--mono)', marginTop:1 }}>
                                            {loc.latitude?.toFixed(3)}, {loc.longitude?.toFixed(3)}
                                            {` · ${loc.speedKmh || 0} km/h`}
                                        </div>
                                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:5 }}>
                                            <TelemetryChip label="ETA" value={eta || 'Unknown'} color={c} />
                                            <TelemetryChip label="GPS" value={loc.gpsStatus || 'LOCKED'} color="#22c55e" />
                                            <TelemetryChip label="LINK" value={isStale(loc) ? 'STALE' : (loc.connectionStatus || 'ONLINE')} color={isStale(loc) ? '#ef4444' : '#22c55e'} />
                                        </div>
                                        <div style={{ fontSize:9, color:isStale(loc) ? '#ef4444' : 'var(--muted)', fontFamily:'var(--mono)', marginTop:4 }}>
                                            {isStale(loc) ? 'No update >30 sec' : `Updated ${timeLabel(loc.lastUpdateAt)}`}
                                        </div>
                                        {team?.specialty && (
                                            <div style={{ fontSize:9, color:'var(--muted)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                                {team.specialty}
                                            </div>
                                        )}
                                    </div>

                                    {/* Status badge */}
                                    <div style={{
                                        fontSize:8, fontWeight:700, letterSpacing:'0.07em',
                                        color:c, fontFamily:'var(--mono)',
                                        background:`${c}15`, border:`1px solid ${c}35`,
                                        borderRadius:4, padding:'2px 6px', flexShrink:0,
                                    }}>
                                        {STATUS_LABEL[loc.status] || loc.status}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TelemetryChip({ label, value, color }) {
    return (
        <span style={{
            fontSize:8,
            color,
            fontFamily:'var(--mono)',
            border:`1px solid ${color}35`,
            background:`${color}12`,
            borderRadius:4,
            padding:'2px 5px',
            letterSpacing:'0.04em',
            whiteSpace:'nowrap',
        }}>
            {label} {value}
        </span>
    );
}
