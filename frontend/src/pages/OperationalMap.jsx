import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    MapContainer, TileLayer, Circle, Polygon, Polyline,
    useMapEvents, useMap, Marker, Popup, LayerGroup, ZoomControl
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SEV_COLOR } from './Icons';
import GeoSearch from './GeoSearch';

const TILES = [
    { key:'osm',   label:'Street', url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
    { key:'light', label:'Light',  url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
    { key:'dark',  label:'Dark',   url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
];

const STATUS_COLOR = { AVAILABLE:'#22c55e', ASSIGNED:'#60a5fa', EN_ROUTE:'#f59e0b', ON_SITE:'#ef4444', RETURNING:'#3b82f6' };
const STATUS_LABEL = { AVAILABLE:'AVAILABLE', ASSIGNED:'ASSIGNED', EN_ROUTE:'EN ROUTE', ON_SITE:'ON SITE', RETURNING:'RETURNING' };

const OV = {
    position:'absolute', zIndex:800,
    background:'rgba(13,15,20,0.88)',
    border:'1px solid rgba(46,52,71,0.85)',
    borderRadius:7,
    backdropFilter:'blur(14px)',
    boxShadow:'0 2px 16px rgba(0,0,0,0.45)',
};

function Btn({ active, onClick, title, children }) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                width:28, height:28, borderRadius:5, border:'none',
                background: active ? 'rgba(51,12,137,0.45)' : 'transparent',
                color: active ? '#c4b5fd' : '#6b7280',
                cursor:'pointer', fontFamily:'inherit', fontSize:10,
                transition:'all 0.12s',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color='#9ca3af'; e.currentTarget.style.background= active?'rgba(51,12,137,0.45)':'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.color= active?'#c4b5fd':'#6b7280'; e.currentTarget.style.background= active?'rgba(51,12,137,0.45)':'transparent'; }}
        >
            {children}
        </button>
    );
}

function Divider() {
    return <div style={{ width:1, height:16, background:'rgba(46,52,71,0.85)', flexShrink:0 }}/>;
}

function sevStyle(sev) {
    const c = SEV_COLOR[(sev||'').toUpperCase()] || '#6b7280';
    return { color:c, fillColor:c, fillOpacity:0.15, weight:2 };
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
    if (!distance || !loc?.speedKmh) return null;
    const minutes = Math.round((distance / loc.speedKmh) * 60);
    return minutes > 0 ? `ETA ${minutes}m` : 'ETA now';
}

function timeLabel(iso) {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function isStale(loc) {
    if (!loc?.lastUpdateAt) return false;
    return Date.now() - new Date(loc.lastUpdateAt).getTime() > 30000;
}

function makeAlertIcon(sev) {
    const c = SEV_COLOR[(sev||'').toUpperCase()] || '#6b7280';
    return L.divIcon({
        html:`<div style="width:10px;height:10px;border-radius:50%;background:${c};border:2px solid rgba(255,255,255,0.7);box-shadow:0 0 8px ${c}99"></div>`,
        className:'', iconAnchor:[5,5],
    });
}

function makeTeamIcon(status, highlighted, teamName) {
    const c     = STATUS_COLOR[status] || '#6b7280';
    const size  = highlighted ? 18 : 14;
    const pulse = status === 'ON_SITE' || highlighted;
    const tip   = teamName ? `title="${teamName} · ${status}"` : `title="${status}"`;

    return L.divIcon({
        html: `
      <style>
        @keyframes _tmPulse {
          0%,100%{ transform:scale(1);   opacity:.55 }
          50%    { transform:scale(1.9); opacity:0   }
        }
      </style>
      <div ${tip} style="position:relative;width:${size}px;height:${size}px;cursor:pointer;">
        ${pulse ? `<div style="
          position:absolute;inset:0;border-radius:50%;
          background:${c};opacity:.45;
          animation:_tmPulse 1.8s ease-out infinite;">
        </div>` : ''}
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:${c};
          box-shadow:0 0 0 2px rgba(13,15,20,.9),0 0 8px ${c}bb;
          ${highlighted ? `outline:2px solid #fff;outline-offset:2px;` : ''}
        "></div>
      </div>`,
        className: '',
        iconAnchor: [size / 2, size / 2],
    });
}

function HeatLayer({ alerts }) {
    return (
        <LayerGroup>
            {alerts.filter(a=>a.latitude&&a.longitude).map(a=>(
                <Circle key={`h-${a.id}`}
                        center={[a.latitude,a.longitude]}
                        radius={(a.radiusKm||10)*2200}
                        pathOptions={{ color:'transparent', fillColor:SEV_COLOR[(a.severity||'').toUpperCase()]||'#f97316', fillOpacity:0.06, weight:0 }}
                />
            ))}
        </LayerGroup>
    );
}

function DrawHandler({ drawMode, onCircle, onPolyPt, onHover }) {
    useMapEvents({
        click(e) {
            if (drawMode==='circle')  onCircle(e.latlng.lat, e.latlng.lng);
            if (drawMode==='polygon') onPolyPt(e.latlng.lat, e.latlng.lng);
        },
        mousemove(e) { onHover?.(e.latlng.lat, e.latlng.lng); },
    });
    return null;
}

function FlyController({ target }) {
    const map = useMap();
    useEffect(() => {
        if (!target) return;
        if (target.bbox) {
            map.fitBounds(
                [[parseFloat(target.bbox[0]),parseFloat(target.bbox[2])],[parseFloat(target.bbox[1]),parseFloat(target.bbox[3])]],
                { padding:[40,40], maxZoom:14 }
            );
        } else {
            map.flyTo([target.lat, target.lng], target.zoom||11, { duration:1.0 });
        }
    }, [target]); // eslint-disable-line
    return null;
}

// Zoom to bounds of all incident points
function ZoomToFit({ trigger, points }) {
    const map = useMap();
    useEffect(() => {
        if (!trigger || points.length === 0) return;
        if (points.length === 1) {
            map.flyTo(points[0], 9, { duration:0.8 });
        } else {
            map.fitBounds(L.latLngBounds(points), { padding:[48,48], maxZoom:12, duration:0.8 });
        }
    }, [trigger]); // eslint-disable-line
    return null;
}

function ResetView({ trigger }) {
    const map = useMap();
    useEffect(() => {
        if (!trigger) return;
        map.flyTo([37.5,-96], 4, { duration:0.8 });
    }, [trigger]); // eslint-disable-line
    return null;
}

export default function OperationalMap({
                                           alerts=[], teamLocations=[], teams=[],
                                           layers, drawMode, drawnZone, flyTarget,
                                           onZoneUpdate, height=360,
                                           onTeamClick, selectedTeamId, flyToTeam,
                                       }) {
    const [tile, setTile]               = useState('osm');
    const [polyPts, setPolyPts]         = useState([]);
    const [circleKm, setCircleKm]       = useState(10);
    const [coord, setCoord]             = useState({ lat:'—', lng:'—' });
    const [internalFly, setInternalFly] = useState(null);
    const [searchOpen, setSearchOpen]   = useState(false);

    // local layer toggles (override props.layers when set locally)
    const [showCircles, setShowCircles] = useState(true);
    const [showTeams,   setShowTeams]   = useState(true);
    const [showHeat,    setShowHeat]    = useState(false);

    // zoom-to-fit / reset triggers (increment to fire)
    const [fitTrigger,   setFitTrigger]   = useState(0);
    const [resetTrigger, setResetTrigger] = useState(0);

    // fullscreen
    const [fullscreen, setFullscreen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => { setPolyPts([]); }, [drawMode]);

    const handleCircle = useCallback((lat,lng) => {
        onZoneUpdate?.({ type:'circle', center:[lat,lng], radiusKm:circleKm });
    }, [circleKm, onZoneUpdate]);

    const handleCircleRadiusChange = useCallback((radiusKm) => {
        setCircleKm(radiusKm);
        if (drawnZone?.type === 'circle' && drawnZone.center) {
            onZoneUpdate?.({ ...drawnZone, radiusKm });
        }
    }, [drawnZone, onZoneUpdate]);

    const handlePolyPt = useCallback((lat,lng) => {
        setPolyPts(prev => {
            const next = [...prev,[lat,lng]];
            if (next.length >= 3) onZoneUpdate?.({ type:'polygon', coordinates:next });
            return next;
        });
    }, [onZoneUpdate]);

    // Fullscreen via CSS position:fixed
    const toggleFullscreen = useCallback(() => {
        setFullscreen(f => !f);
        // Leaflet needs a size invalidation after layout change
        setTimeout(() => {
            if (wrapRef.current) {
                wrapRef.current.querySelectorAll('.leaflet-container').forEach(el => {
                    el._leaflet_map?.invalidateSize();
                });
            }
        }, 120);
    }, []);

    const activeFly  = flyToTeam || flyTarget || internalFly;
    const tileUrl    = TILES.find(t => t.key === tile)?.url || TILES[0].url;
    const incidentPts = alerts.filter(a=>a.latitude&&a.longitude).map(a=>[a.latitude,a.longitude]);

    const wrapStyle = fullscreen
        ? { position:'fixed', inset:0, zIndex:9000, width:'100vw', height:'100vh' }
        : { position:'relative', height, width:'100%' };

    return (
        <div ref={wrapRef} style={wrapStyle}>

            {/* ── TOP-LEFT: tile switcher ── */}
            <div style={{ ...OV, top:10, left:10, display:'flex', padding:3, gap:2 }}>
                {TILES.map(t => (
                    <button key={t.key} onClick={() => setTile(t.key)} style={{
                        padding:'4px 9px', borderRadius:5, fontSize:10, fontFamily:'inherit',
                        cursor:'pointer', fontWeight:600, border:'none',
                        background: tile===t.key ? 'rgba(51,12,137,0.4)' : 'transparent',
                        color: tile===t.key ? '#c4b5fd' : '#6b7280',
                        transition:'all 0.12s',
                    }}>{t.label}</button>
                ))}
            </div>

            {/* ── TOP-LEFT (below tiles): map control toolbar ── */}
            <div style={{ ...OV, top:48, left:10, display:'flex', alignItems:'center', padding:'3px 5px', gap:2 }}>

                {/* Zoom to fit incidents */}
                <Btn
                    title="Zoom to fit all incidents"
                    active={false}
                    onClick={() => setFitTrigger(n => n+1)}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                    </svg>
                </Btn>

                {/* Reset to default view */}
                <Btn
                    title="Reset to default view (US)"
                    active={false}
                    onClick={() => setResetTrigger(n => n+1)}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                </Btn>

                <Divider/>

                {/* Toggle incident circles */}
                <Btn
                    title={showCircles ? 'Hide incident circles' : 'Show incident circles'}
                    active={showCircles}
                    onClick={() => setShowCircles(v => !v)}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="9"/>
                        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                    </svg>
                </Btn>

                {/* Toggle team markers */}
                <Btn
                    title={showTeams ? 'Hide team markers' : 'Show team markers'}
                    active={showTeams}
                    onClick={() => setShowTeams(v => !v)}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                    </svg>
                </Btn>

                {/* Toggle heatmap */}
                <Btn
                    title={showHeat ? 'Hide heatmap' : 'Show heatmap'}
                    active={showHeat}
                    onClick={() => setShowHeat(v => !v)}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26C17.81 13.47 19 11.38 19 9c0-3.87-3.13-7-7-7z"/>
                        <path d="M9 21h6"/>
                    </svg>
                </Btn>

                <Divider/>

                {/* Fullscreen */}
                <Btn
                    title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    active={fullscreen}
                    onClick={toggleFullscreen}
                >
                    {fullscreen ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>
                        </svg>
                    ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
                        </svg>
                    )}
                </Btn>

            </div>

            {/* ── Search — top-right ── */}
            {!drawMode && (
                <div style={{ position:'absolute', top:10, right:10, zIndex:800, display:'flex', alignItems:'center', gap:6 }}>
                    {searchOpen && (
                        <div style={{ width:240 }}>
                            <GeoSearch placeholder="Find location…" onSelect={r => { setInternalFly(r); setSearchOpen(false); }}/>
                        </div>
                    )}
                    <button
                        onClick={() => setSearchOpen(o => !o)}
                        style={{ ...OV, position:'relative', padding:'5px 10px', border:'none', cursor:'pointer', color: searchOpen?'#a78bfa':'#6b7280', display:'flex', alignItems:'center', gap:5, fontSize:11, fontFamily:'inherit' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        {!searchOpen && 'Search'}
                    </button>
                </div>
            )}

            {/* ── Draw controls ── */}
            {drawMode === 'circle' && (
                <div style={{ ...OV, bottom:44, left:10, padding:'10px 14px', minWidth:190 }}>
                    <div style={{ fontSize:9, letterSpacing:'0.12em', color:'#6b7280', fontFamily:'monospace', marginBottom:6 }}>RADIUS: {circleKm} KM</div>
                    <input type="range" min={1} max={500} value={circleKm}
                           onChange={e => handleCircleRadiusChange(Number(e.target.value))}
                           style={{ width:'100%', accentColor:'#330C89' }}/>
                    <div style={{ fontSize:9, color:'#6b7280', marginTop:4 }}>Click map to place zone</div>
                </div>
            )}
            {drawMode === 'polygon' && (
                <div style={{ ...OV, bottom:44, left:10, padding:'10px 14px' }}>
                    <div style={{ fontSize:9, letterSpacing:'0.12em', color:'#6b7280', fontFamily:'monospace', marginBottom:3 }}>POLYGON · {polyPts.length} PTS</div>
                    <div style={{ fontSize:9, color:'#6b7280' }}>Click to add · 3+ to close</div>
                    {polyPts.length > 0 && (
                        <button onClick={() => setPolyPts([])}
                                style={{ marginTop:6, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:4, color:'#ef4444', fontSize:9, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit' }}>
                            Clear
                        </button>
                    )}
                </div>
            )}

            {/* ── Coord readout ── */}
            <div style={{ position:'absolute', bottom:8, left:8, zIndex:800,
                background:'rgba(13,15,20,0.75)', borderRadius:4, padding:'2px 7px',
                fontFamily:'monospace', fontSize:9, color:'rgba(107,114,128,0.9)',
                pointerEvents:'none', letterSpacing:'0.04em' }}>
                {coord.lat}° {coord.lng}°
            </div>

            {/* Fullscreen ESC hint */}
            {fullscreen && (
                <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)', zIndex:800,
                    background:'rgba(13,15,20,0.75)', borderRadius:4, padding:'3px 10px',
                    fontFamily:'monospace', fontSize:9, color:'#6b7280', pointerEvents:'none' }}>
                    Press button to exit fullscreen
                </div>
            )}

            <MapContainer center={[37.5,-96]} zoom={4}
                          style={{ height:'100%', width:'100%', cursor: drawMode?'crosshair':'grab' }}
                          attributionControl={false} zoomControl={false}>

                <TileLayer url={tileUrl}/>
                <ZoomControl position="bottomright"/>
                <FlyController target={activeFly}/>
                <ZoomToFit trigger={fitTrigger}   points={incidentPts}/>
                <ResetView  trigger={resetTrigger}/>
                <DrawHandler drawMode={drawMode} onCircle={handleCircle} onPolyPt={handlePolyPt}
                             onHover={(lat,lng) => setCoord({ lat:lat.toFixed(4), lng:lng.toFixed(4) })}/>

                {/* Alert zones */}
                {showCircles && alerts.filter(a => a.latitude && a.longitude).map(alert => {
                    const sev = (alert.severity||'LOW').toUpperCase();
                    return (
                        <React.Fragment key={alert.id}>
                            <Circle center={[alert.latitude,alert.longitude]} radius={(alert.radiusKm||5)*1000} pathOptions={sevStyle(sev)}>
                                <Popup><AlertPopup alert={alert}/></Popup>
                            </Circle>
                            <Marker position={[alert.latitude,alert.longitude]} icon={makeAlertIcon(sev)}>
                                <Popup><AlertPopup alert={alert}/></Popup>
                            </Marker>
                        </React.Fragment>
                    );
                })}

                {showHeat && <HeatLayer alerts={alerts}/>}

                {/* Teams */}
                {showTeams && teamLocations.map(loc => {
                    const team       = teams.find(t => t.id === loc.teamId);
                    const isSelected = loc.teamId === selectedTeamId;
                    return (
                        <React.Fragment key={loc.teamId}>
                            {['ASSIGNED','EN_ROUTE','ON_SITE'].includes(loc.status) && loc.assignedAlertLat && (
                                <Polyline
                                    positions={[[loc.latitude,loc.longitude],[loc.assignedAlertLat,loc.assignedAlertLng]]}
                                    pathOptions={{ color:'#f59e0b', weight:isSelected?2.5:1.5, dashArray:'5 4', opacity:isSelected?1:0.6 }}/>
                            )}
                            {isSelected && (
                                <Circle center={[loc.latitude,loc.longitude]} radius={8000}
                                        pathOptions={{ color:STATUS_COLOR[loc.status]||'#6b7280', fillColor:STATUS_COLOR[loc.status]||'#6b7280', fillOpacity:0.08, weight:2, dashArray:'4 3' }}/>
                            )}
                            <Marker position={[loc.latitude,loc.longitude]}
                                    icon={makeTeamIcon(loc.status, isSelected, loc.teamName)}
                                    eventHandlers={{ click: () => onTeamClick?.(loc, team) }}>
                                <Popup><TeamPopup loc={loc} team={team}/></Popup>
                            </Marker>
                        </React.Fragment>
                    );
                })}

                {drawnZone?.type==='circle' && drawnZone.center && (
                    <Circle center={drawnZone.center} radius={drawnZone.radiusKm*1000}
                            pathOptions={{ color:'#330C89', fillColor:'#330C89', fillOpacity:0.18, weight:2, dashArray:'6 4' }}/>
                )}
                {drawnZone?.type==='polygon' && drawnZone.coordinates?.length>=3 && (
                    <Polygon positions={drawnZone.coordinates}
                             pathOptions={{ color:'#330C89', fillColor:'#330C89', fillOpacity:0.18, weight:2, dashArray:'6 4' }}/>
                )}
                {drawMode==='polygon' && polyPts.length>=2 && (
                    <Polyline positions={polyPts}
                              pathOptions={{ color:'#330C89', weight:2, dashArray:'4 3', opacity:0.8 }}/>
                )}
            </MapContainer>
        </div>
    );
}

function AlertPopup({ alert }) {
    const c = SEV_COLOR[(alert.severity||'').toUpperCase()] || '#6b7280';
    return (
        <div style={{ fontFamily:'sans-serif', minWidth:180, fontSize:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:c }}/>
                <span style={{ fontWeight:700, color:c, fontSize:10 }}>{alert.severity}</span>
                <span style={{ color:'#9ca3af', marginLeft:'auto', fontSize:10 }}>
                    {alert.status} {new Date(alert.updatedAt || alert.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false })}
                </span>
            </div>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{alert.title}</div>
            <div style={{ color:'#9ca3af', marginBottom:4 }}>{alert.location}</div>
            {alert.description && (
                <div style={{ color:'#d1d5db', lineHeight:1.5, fontSize:11 }}>
                    {alert.description.slice(0,80)}{alert.description.length>80?'…':''}
                </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', color:'#6b7280', fontSize:10, borderTop:'1px solid #252a38', paddingTop:5, marginTop:6 }}>
                <span>{(alert.affectedPopulation||0).toLocaleString()} affected</span>
                <span>r={alert.radiusKm||5}km</span>
            </div>
        </div>
    );
}

function TeamPopup({ loc, team }) {
    const c = STATUS_COLOR[loc.status] || '#6b7280';
    const eta = etaLabel(loc);
    const distance = distanceKm(loc);
    return (
        <div style={{ fontFamily:'sans-serif', fontSize:12, minWidth:160 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>{loc.teamName}{eta && <span style={{ color:c, fontSize:10, marginLeft:6 }}>{eta}</span>}{distance != null && <span style={{ color:'#6b7280', fontSize:10, marginLeft:6 }}>{distance.toFixed(1)} km</span>}</div>
            <div style={{ color:c, fontSize:10, fontWeight:700, letterSpacing:'0.06em', marginBottom:6 }}>{STATUS_LABEL[loc.status] || loc.status}</div>
            {team?.specialty && <div style={{ color:'#9ca3af', marginBottom:4 }}>{team.specialty}</div>}
            <div style={{ color:'#6b7280', fontSize:10, fontFamily:'monospace' }}>
                {loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}
            </div>
            <div style={{ color:'#6b7280', fontSize:10, marginTop:4 }}>Speed {loc.speedKmh || 0} km/h</div>
            <div style={{ color:isStale(loc) ? '#ef4444' : '#6b7280', fontSize:10 }}>
                {isStale(loc) ? 'No update >30 sec' : `Updated ${timeLabel(loc.lastUpdateAt)}`}
            </div>
            <div style={{ display:'flex', gap:5, marginTop:5, flexWrap:'wrap' }}>
                <span style={{ color:'#22c55e', fontSize:9, border:'1px solid rgba(34,197,94,0.35)', padding:'1px 5px', borderRadius:4 }}>{loc.gpsStatus || 'LOCKED'}</span>
                <span style={{ color:isStale(loc) ? '#ef4444' : '#22c55e', fontSize:9, border:`1px solid ${isStale(loc) ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)'}`, padding:'1px 5px', borderRadius:4 }}>
                    {isStale(loc) ? 'STALE' : (loc.connectionStatus || 'ONLINE')}
                </span>
            </div>
            {team?.members && <div style={{ color:'#9ca3af', fontSize:10, marginTop:4 }}>{team.members} members</div>}
        </div>
    );
}
