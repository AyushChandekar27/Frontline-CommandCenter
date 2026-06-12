import React from 'react';
import { XIcon, TeamsIcon, MapPinIcon, AlertTypeIcon, SEV_COLOR } from './icons';

const STATUS_COLOR = { AVAILABLE:'#22c55e', ASSIGNED:'#60a5fa', EN_ROUTE:'#f59e0b', ON_SITE:'#ef4444', RETURNING:'#3b82f6' };
const STATUS_LABEL = { AVAILABLE:'AVAILABLE', ASSIGNED:'ASSIGNED', EN_ROUTE:'EN ROUTE', ON_SITE:'ON SITE', RETURNING:'RETURNING' };

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
    if (!distance || !loc?.speedKmh) return 'Unknown';
    const minutes = Math.round((distance / loc.speedKmh) * 60);
    return minutes > 0 ? `${minutes}m` : 'Now';
}

export default function TeamDetailPanel({ team, loc, alerts = [], onClose }) {
    if (!team && !loc) return null;

    const name    = loc?.teamName || team?.name || 'Unknown Team';
    const status  = loc?.status   || 'AVAILABLE';
    const statusC = STATUS_COLOR[status] || '#6b7280';
    const availC  = STATUS_COLOR[team?.availability] || '#6b7280';

    const teamAlerts = alerts.filter(a =>
        a.assignedTeamName === name || a.assignedTeamId === team?.id
    );

    return (
        <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0,
            width: 322, zIndex: 900,
            background: '#0f1117',
            borderLeft: '1px solid #1e2330',
            display: 'flex', flexDirection: 'column',
            boxShadow: '-12px 0 40px rgba(0,0,0,0.6)',
        }}>

            {/* ── Header ── */}
            <div style={{ padding:'10px 14px 9px', borderBottom:'1px solid #1e2330', display:'flex', alignItems:'flex-start', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:8, background:`${statusC}18`, border:`1px solid ${statusC}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                    <TeamsIcon size={16} color={statusC}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#e8eaf0', lineHeight:1.25, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {name}
                    </div>
                    {team?.specialty && (
                        <div style={{ fontSize:10, color:'#6b7280', marginTop:2, lineHeight:1.35 }}>
                            {team.specialty}
                        </div>
                    )}
                </div>
                <button onClick={onClose}
                        style={{ background:'none', border:'1px solid #1e2330', borderRadius:6, cursor:'pointer', color:'#6b7280', padding:'4px 6px', display:'flex', alignItems:'center', flexShrink:0, transition:'all 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor='#2e3447'; e.currentTarget.style.color='#e8eaf0'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor='#1e2330'; e.currentTarget.style.color='#6b7280'; }}>
                    <XIcon size={14}/>
                </button>
            </div>

            {/* ── Status + Availability badges ── */}
            <div style={{ padding:'9px 14px', borderBottom:'1px solid #1e2330', display:'flex', gap:8, alignItems:'stretch' }}>
                <Badge label="STATUS"       value={STATUS_LABEL[status] || status} color={statusC}/>
                {team?.availability && <Badge label="AVAILABILITY" value={STATUS_LABEL[team.availability] || team.availability} color={availC}/>}
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ flex:1, overflowY:'auto', padding:'10px 14px 16px', minWidth:0 }}>

                {/* Team info */}
                <Section label="TEAM INFO">
                    {team?.members    && <Row icon="👥" label="Personnel"  value={`${team.members} members`}/>}
                    {team?.avgSpeedKmh && <Row icon="⚡" label="Avg speed"  value={`${team.avgSpeedKmh} km/h`}/>}
                    {team?.baseLocation && <Row icon="📍" label="Home base" value={team.baseLocation}/>}
                </Section>

                {/* Live position */}
                {loc && (
                    <Section label="LIVE POSITION">
                        <div style={{ background:'#13161e', border:'1px solid #1e2330', borderRadius:8, padding:'9px 10px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                                <CoordCell label="LAT" value={loc.latitude?.toFixed(5)}/>
                                <div style={{ width:1, background:'#1e2330' }}/>
                                <CoordCell label="LNG" value={loc.longitude?.toFixed(5)}/>
                            </div>
                            {(loc.speedKmh > 0 || loc.headingDegrees != null) && (
                                <div style={{ display:'flex', gap:10, paddingTop:5, borderTop:'1px solid #1e2330' }}>
                                    {loc.speedKmh > 0 && <CoordCell label="SPEED" value={`${loc.speedKmh} km/h`}/>}
                                    {loc.headingDegrees != null && <CoordCell label="HDG" value={`${loc.headingDegrees}°`}/>}
                                </div>
                            )}
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:6, marginTop:8 }}>
                            <Telemetry label="ETA" value={etaLabel(loc)} color={statusC} />
                            <Telemetry label="GPS" value={loc.gpsStatus || 'LOCKED'} color="#22c55e" />
                            <Telemetry label="LINK" value={isStale(loc) ? 'STALE' : (loc.connectionStatus || 'ONLINE')} color={isStale(loc) ? '#ef4444' : '#22c55e'} />
                            <Telemetry label="UPDATED" value={isStale(loc) ? 'No update >30 sec' : timeLabel(loc.lastUpdateAt)} color={isStale(loc) ? '#ef4444' : '#9ca3af'} />
                        </div>
                    </Section>
                )}

                {/* Capabilities */}
                {(team?.handlesTypes || team?.handlesSeverities) && (
                    <Section label="CAPABILITIES">
                        {team.handlesTypes && (
                            <div style={{ marginBottom:5 }}>
                                <div style={{ fontSize:10, color:'#6b7280', letterSpacing:'0.1em', fontFamily:'monospace', marginBottom:5 }}>
                                    INCIDENT TYPES
                                </div>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                                    {team.handlesTypes.split(',').filter(Boolean).map(t => (
                                        <span key={t} style={{ fontSize:10, padding:'2px 8px', borderRadius:5, background:'#13161e', border:'1px solid #2e3447', color:'#9ca3af', fontFamily:'monospace', letterSpacing:'0.03em' }}>
                      {t.trim()}
                    </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {team.handlesSeverities && (
                            <div>
                                <div style={{ fontSize:10, color:'#6b7280', letterSpacing:'0.1em', fontFamily:'monospace', marginBottom:5 }}>
                                    CERTIFIED SEVERITY
                                </div>
                                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                                    {team.handlesSeverities.split(',').filter(Boolean).map(s => {
                                        const c = SEV_COLOR[s.trim()] || '#6b7280';
                                        return (
                                            <span key={s} style={{ fontSize:10, padding:'2px 8px', borderRadius:5, background:`${c}14`, border:`1px solid ${c}35`, color:c, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.06em' }}>
                        {s.trim()}
                      </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </Section>
                )}

                {/* Assigned alerts */}
                <Section label={`ASSIGNED ALERTS`} count={teamAlerts.length}>
                    {teamAlerts.length === 0 ? (
                        <div style={{ fontSize:12, color:'#4b5563', padding:'12px 2px', fontStyle:'italic', lineHeight:1.5 }}>
                            No active assignments
                        </div>
                    ) : teamAlerts.map(a => {
                        const c = SEV_COLOR[(a.severity||'').toUpperCase()] || '#6b7280';
                        return (
                            <div key={a.id} style={{ background:'#13161e', border:`1px solid #1e2330`, borderLeft:`3px solid ${c}`, borderRadius:8, padding:'10px 12px', marginBottom:8 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                                    <AlertTypeIcon type={a.type} size={13} color={c}/>
                                    <span style={{ fontSize:11, fontWeight:600, color:'#e8eaf0', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {a.title}
                  </span>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <span style={{ fontSize:9, fontWeight:700, color:c, fontFamily:'monospace', letterSpacing:'0.07em' }}>{a.severity}</span>
                                    <span style={{ fontSize:9, color:'#374151' }}>·</span>
                                    <span style={{ fontSize:9, color:'#6b7280', fontFamily:'monospace' }}>
                                        {a.status} {new Date(a.updatedAt || a.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false })}
                                    </span>
                                </div>
                                {a.location && (
                                    <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4 }}>
                                        <MapPinIcon size={10} color="#4b5563"/>
                                        <span style={{ fontSize:10, color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.location}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </Section>

            </div>
        </div>
    );
}

function Section({ label, count, children }) {
    return (
        <div style={{ paddingTop:9, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6, minWidth:0 }}>
                <div style={{ fontSize:9, letterSpacing:'0.14em', color:'#4b5563', fontFamily:'monospace', fontWeight:700 }}>
                    {label}
                </div>
                {count !== undefined && (
                    <div style={{ fontSize:9, background:'#13161e', border:'1px solid #1e2330', borderRadius:4, padding:'1px 5px', color:'#6b7280', fontFamily:'monospace' }}>
                        {count}
                    </div>
                )}
                <div style={{ flex:1, height:1, background:'#1a1e28' }}/>
            </div>
            {children}
        </div>
    );
}

function Badge({ label, value, color }) {
    return (
        <div style={{ flex:1, minWidth:0, background:`${color}0f`, border:`1px solid ${color}30`, borderRadius:8, padding:'6px 8px', textAlign:'center' }}>
            <div style={{ fontSize:8, letterSpacing:'0.14em', color:'#4b5563', fontFamily:'monospace', marginBottom:3 }}>
                {label}
            </div>
            <div style={{ fontSize:10, fontWeight:700, color, letterSpacing:'0.08em', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {value}
            </div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div style={{ display:'grid', gridTemplateColumns:'82px minmax(0, 1fr)', alignItems:'center', columnGap:10, padding:'6px 0', borderBottom:'1px solid #13161e', minWidth:0 }}>
            <span style={{ fontSize:11, color:'#6b7280' }}>{label}</span>
            <span style={{ fontSize:11, color:'#e8eaf0', fontWeight:500, textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {value}
      </span>
        </div>
    );
}

function CoordCell({ label, value }) {
    return (
        <div style={{ textAlign:'center', flex:1 }}>
            <div style={{ fontSize:8, letterSpacing:'0.12em', color:'#4b5563', fontFamily:'monospace', marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:11, fontWeight:600, color:'#9ca3af', fontFamily:'monospace', letterSpacing:'0.02em' }}>{value}</div>
        </div>
    );
}

function Telemetry({ label, value, color }) {
    return (
        <div style={{ background:`${color}10`, border:`1px solid ${color}30`, borderRadius:6, padding:'6px 7px', minWidth:0 }}>
            <div style={{ fontSize:8, letterSpacing:'0.12em', color:'#4b5563', fontFamily:'monospace', marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:10, color, fontFamily:'monospace', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</div>
        </div>
    );
}
