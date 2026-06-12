import React, { useState } from 'react';
import { MapContainer, TileLayer, Circle, Polyline, Popup, useMapEvents, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const SEV_COLOR = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' };
const SEV_FILL = { CRITICAL: 0.18, HIGH: 0.14, MEDIUM: 0.12, LOW: 0.10 };
const TEAM_STATUS_COLOR = { AVAILABLE: '#22c55e', EN_ROUTE: '#f59e0b', ON_SITE: '#ef4444', RETURNING: '#3b82f6' };
const TEAM_STATUS_LABEL = { AVAILABLE:'AVAILABLE', EN_ROUTE:'EN ROUTE', ON_SITE:'ON SITE', RETURNING:'RETURNING' };

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

function teamDivIcon(icon, status) {
    return L.divIcon({
        html: `<div style="font-size:18px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.6))" title="${status}">${icon || '🚨'}</div>`,
        className: '',
        iconAnchor: [12, 12],
    });
}

function CoordTracker({ onMove }) {
    useMapEvents({ mousemove: (e) => onMove(e.latlng) });
    return null;
}

function MapClickHandler({ onClick }) {
    useMapEvents({ click: (e) => onClick && onClick(e.latlng.lat, e.latlng.lng) });
    return null;
}

/**
 * AlertMap
 * alerts      — live alert objects from API
 * teamLocations — live team location objects (optional)
 * teams       — team objects with icon field (optional)
 * height      — px (default 360)
 * onClick     — (lat,lng) callback for CreateAlert map selection
 * selected    — { lat, lng, radiusKm, severity } preview for CreateAlert
 */
export default function AlertMap({ alerts = [], teamLocations = [], teams = [], height = 360, onClick, selected }) {
    const [coord, setCoord] = useState({ lat: '—', lng: '—' });

    return (
        <div className="map-container" style={{ height, position: 'relative' }}>
            <div className="map-coords">LAT {coord.lat}° · LON {coord.lng}°</div>

            <MapContainer center={[37.5, -96]} zoom={4}
                style={{ height: '100%', width: '100%' }} attributionControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <CoordTracker onMove={l => setCoord({ lat: l.lat.toFixed(4), lng: l.lng.toFixed(4) })} />
                {onClick && <MapClickHandler onClick={onClick} />}

                {/* ── Alert danger circles ── */}
                {alerts.filter(a => a.latitude && a.longitude).map(alert => {
                    const sev = (alert.severity || 'LOW').toUpperCase();
                    const color = SEV_COLOR[sev] || '#6b7280';
                    const fill = SEV_FILL[sev] || 0.10;
                    const radius = (alert.radiusKm || 5) * 1000;
                    return (
                        <Circle key={alert.id}
                            center={[alert.latitude, alert.longitude]}
                            radius={radius}
                            pathOptions={{ color, fillColor: color, fillOpacity: fill, weight: 2 }}>
                            <Popup>
                                <AlertPopup alert={alert} color={color} />
                            </Popup>
                        </Circle>
                    );
                })}

                {/* ── Team markers + lines to assigned alert ── */}
                {teamLocations.map(loc => {
                    const team = teams.find(t => t.id === loc.teamId);
                    const teamIcon = teamDivIcon(team?.icon || '🚨', loc.status);
                    const statusColor = TEAM_STATUS_COLOR[loc.status] || '#6b7280';
                    const statusLabel = TEAM_STATUS_LABEL[loc.status] || loc.status;
                    const eta = etaLabel(loc);
                    const distance = distanceKm(loc);
                    const assignment = loc.assignedAlertLat && loc.assignedAlertLng;
                    return (
                        <React.Fragment key={loc.teamId}>
                            {assignment && (
                                <Polyline
                                    positions={[[loc.latitude, loc.longitude], [loc.assignedAlertLat, loc.assignedAlertLng]]}
                                    pathOptions={{ color: '#f59e0b', weight: 1.5, dashArray: '6 4', opacity: 0.7 }}
                                />
                            )}
                            <Marker position={[loc.latitude, loc.longitude]} icon={teamIcon}>
                                <Popup>
                                    <div style={{ fontFamily: 'sans-serif', fontSize: 12, minWidth: 140 }}>
                                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{loc.teamName}{eta && <span style={{ color: statusColor, fontSize: 10, marginLeft: 6 }}>{eta}</span>}{distance != null && <span style={{ color: '#9ca3af', fontSize: 10, marginLeft: 6 }}>{distance.toFixed(1)} km</span>}</div>
                                        <div style={{ color: statusColor }}>{statusLabel}</div>
                                        <div style={{ color: '#9ca3af', fontSize: 10 }}>
                                            {loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}
                                        </div>
                                        {loc.speedKmh > 0 && <div style={{ color: '#9ca3af', fontSize: 10 }}>{loc.speedKmh?.toFixed(1)} km/h</div>}
                                    </div>
                                </Popup>
                            </Marker>
                        </React.Fragment>
                    );
                })}

                {/* ── CreateAlert preview ── */}
                {selected?.lat && (
                    <Circle
                        center={[selected.lat, selected.lng]}
                        radius={(selected.radiusKm || 5) * 1000}
                        pathOptions={{ color: SEV_COLOR[selected.severity?.toUpperCase()] || '#3b82f6', fillOpacity: 0.12, weight: 2 }}>
                        <Popup>Preview location</Popup>
                    </Circle>
                )}
            </MapContainer>

            <div className="map-pin-count">{alerts.filter(a => a.latitude).length} ALERTS · {teamLocations.length} TEAMS</div>
        </div>
    );
}

function AlertPopup({ alert, color }) {
    return (
        <div style={{ fontFamily: 'sans-serif', minWidth: 190, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontWeight: 700, color, fontSize: 11, letterSpacing: '0.05em' }}>{alert.severity}</span>
                <span style={{ color: '#9ca3af', marginLeft: 'auto', fontSize: 10 }}>
                    {alert.status} {new Date(alert.updatedAt || alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{alert.title}</div>
            <div style={{ color: '#9ca3af', marginBottom: 4 }}>📍 {alert.location}</div>
            {alert.description && (
                <div style={{ color: '#d1d5db', lineHeight: 1.5, marginBottom: 6, fontSize: 11 }}>
                    {alert.description.length > 90 ? alert.description.slice(0, 88) + '…' : alert.description}
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', fontSize: 10, borderTop: '1px solid #374151', paddingTop: 5 }}>
                <span>👥 {(alert.affectedPopulation || 0).toLocaleString()}</span>
                <span>⬤ r={alert.radiusKm || 5}km</span>
                <span>{alert.type}</span>
            </div>
        </div>
    );
}
