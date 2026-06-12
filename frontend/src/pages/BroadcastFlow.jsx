import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Polygon, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { createAlert, getAlerts, getTeams } from '../services/api';
import { useNavigate } from 'react-router-dom';
import GeoSearch from './GeoSearch';
import {
    SEV_COLOR, DrawCircleIcon, DrawPolygonIcon, XIcon, CheckIcon,
    AlertTriangleIcon, FireIcon, FloodIcon, EarthquakeIcon,
    StormIcon, HazmatIcon, MedicalIcon, SecurityIcon,
} from './Icons';

const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const ALERT_TYPES = [
    { value: 'Fire', label: 'Fire', Icon: FireIcon, category: 'Natural / Fire' },
    { value: 'Flood', label: 'Flood', Icon: FloodIcon, category: 'Weather / Flood' },
    { value: 'Earthquake', label: 'Earthquake', Icon: EarthquakeIcon, category: 'Seismic' },
    { value: 'Storm', label: 'Storm', Icon: StormIcon, category: 'Weather' },
    { value: 'Chemical/Hazmat', label: 'Chem/Hazmat', Icon: HazmatIcon, category: 'Industrial / Hazmat' },
    { value: 'Medical', label: 'Medical', Icon: MedicalIcon, category: 'Medical' },
    { value: 'Security/Terror', label: 'Security', Icon: SecurityIcon, category: 'Security' },
];

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const SLA_MAP = { CRITICAL: 15, HIGH: 30, MEDIUM: 60, LOW: 120 };
const IMPACTS = ['Localized', 'Multi-block', 'City-wide', 'Regional'];
const DURATIONS = ['Under 1 hour', '1-3 hours', '3-12 hours', '12-24 hours', '24+ hours'];
const CHANNELS = ['SMS', 'Email', 'Push', 'Public Alert'];
const STEPS = ['Target Area', 'Alert Details', 'Review', 'Confirm'];

function DrawOnMap({ drawMode, onCircle, onPolygon }) {
    const [, setPts] = useState([]);
    useMapEvents({
        click(e) {
            if (drawMode === 'circle') onCircle(e.latlng.lat, e.latlng.lng);
            if (drawMode === 'polygon') {
                setPts(prev => {
                    const next = [...prev, [e.latlng.lat, e.latlng.lng]];
                    if (next.length >= 3) onPolygon(next);
                    return next;
                });
            }
        },
    });
    return null;
}

function haversineKm(aLat, aLng, bLat, bLng) {
    const nums = [aLat, aLng, bLat, bLng].map(Number);
    if (!nums.every(Number.isFinite)) return null;
    const [lat1, lon1, lat2, lon2] = nums;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function zonePoint(zone) {
    if (!zone) return null;
    return zone.type === 'circle' ? zone.center : zone.coordinates?.[0];
}

export default function BroadcastFlow() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const mapRef = useRef(null);

    const [drawMode, setDrawMode] = useState('circle');
    const [zone, setZone] = useState(null);
    const [circleRadius, setCircleRadius] = useState(10);
    const [locationName, setLocationName] = useState('');

    const [existingAlerts, setExistingAlerts] = useState([]);
    const [teams, setTeams] = useState([]);
    const [approval, setApproval] = useState(false);
    const [channels, setChannels] = useState({ SMS: true, Email: true, Push: true, 'Public Alert': false });
    const [checks, setChecks] = useState({ target: false, content: false, command: false });

    const [form, setForm] = useState({
        type: 'Fire',
        incidentCategory: 'Natural / Fire',
        severity: 'HIGH',
        status: 'ACTIVE',
        title: '',
        description: '',
        affectedPopulation: 0,
        reportingUnit: 'OPS Console',
        predictedImpact: 'Multi-block',
        evacuationRequired: false,
        shelterRequired: false,
        safetyInstructions: '',
        estimatedDuration: '1-3 hours',
    });

    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        Promise.all([getAlerts(), getTeams()])
            .then(([alerts, responseTeams]) => {
                setExistingAlerts(alerts || []);
                setTeams(responseTeams || []);
            })
            .catch(() => {});
    }, []);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleZoneSearch = useCallback((r) => {
        setZone({ type: 'circle', center: [r.lat, r.lng], radiusKm: circleRadius });
        setLocationName(r.short || r.name.split(',')[0]);
        mapRef.current?.setView([r.lat, r.lng], 13);
    }, [circleRadius]);

    const handleCircle = useCallback((lat, lng) => {
        setZone({ type: 'circle', center: [lat, lng], radiusKm: circleRadius });
        setLocationName(prev => prev || `${lat.toFixed(3)}, ${lng.toFixed(3)}`);
    }, [circleRadius]);

    const handleRadiusChange = useCallback((radiusKm) => {
        setCircleRadius(radiusKm);
        setZone(prev => prev?.type === 'circle' ? { ...prev, radiusKm } : prev);
    }, []);

    const handlePolygon = useCallback((pts) => {
        setZone({ type: 'polygon', coordinates: pts });
    }, []);

    const radiusKm = zone?.type === 'circle' ? zone.radiusKm : 5;
    const areaKm = zone?.type === 'circle' ? Math.round(Math.PI * radiusKm ** 2) : null;
    const affectedPopulation = Number(form.affectedPopulation);
    const populationLabel = Number.isFinite(affectedPopulation) && affectedPopulation > 0
        ? affectedPopulation.toLocaleString()
        : 'Unavailable';

    const duplicateAlerts = useMemo(() => {
        const point = zonePoint(zone);
        if (!point) return [];
        return existingAlerts.filter(a => {
            if (['RESOLVED', 'CANCELLED'].includes(a.status)) return false;
            const dist = haversineKm(point[0], point[1], a.latitude, a.longitude);
            return dist != null && dist <= Math.max(radiusKm, 5);
        });
    }, [existingAlerts, radiusKm, zone]);

    const assignedTeams = useMemo(() => {
        const type = form.type.toLowerCase();
        const severity = form.severity.toLowerCase();
        return teams.filter(t => {
            const handlesType = (t.handlesTypes || '').toLowerCase();
            const handlesSeverity = (t.handlesSeverities || '').toLowerCase();
            const typeMatch = !handlesType || handlesType.includes(type);
            const severityMatch = !handlesSeverity || handlesSeverity.includes(severity);
            return typeMatch && severityMatch;
        }).slice(0, 3);
    }, [form.severity, form.type, teams]);

    const missingFields = useMemo(() => {
        const missing = [];
        if (!zone) missing.push('Target area');
        if (!form.title.trim()) missing.push('Incident title');
        if (!form.safetyInstructions.trim()) missing.push('Public safety instructions');
        if (!form.reportingUnit.trim()) missing.push('Reporting unit');
        return missing;
    }, [form.reportingUnit, form.safetyInstructions, form.title, zone]);

    const canConfirm = approval && Object.values(channels).some(Boolean) && Object.values(checks).every(Boolean) && missingFields.length === 0;

    const handleType = (type) => {
        const selected = ALERT_TYPES.find(t => t.value === type);
        setForm(f => ({ ...f, type, incidentCategory: selected?.category || f.incidentCategory }));
    };

    const handleBroadcast = async () => {
        if (!canConfirm) return;
        setSubmitting(true);
        try {
            const point = zonePoint(zone);
            const description = [
                form.description,
                `Impact: ${form.predictedImpact}`,
                `Duration: ${form.estimatedDuration}`,
                `Evacuation required: ${form.evacuationRequired ? 'Yes' : 'No'}`,
                `Shelter required: ${form.shelterRequired ? 'Yes' : 'No'}`,
                `Instructions: ${form.safetyInstructions}`,
                `Channels: ${CHANNELS.filter(c => channels[c]).join(', ')}`,
            ].filter(Boolean).join('\n');

            await createAlert({
                type: form.type,
                severity: form.severity,
                status: form.status,
                title: form.title,
                description,
                affectedPopulation: Number(form.affectedPopulation) || 0,
                reportingUnit: form.reportingUnit,
                latitude: point[0],
                longitude: point[1],
                location: locationName || `${point[0].toFixed(3)}, ${point[1].toFixed(3)}`,
                radiusKm,
                slaMinutes: SLA_MAP[form.severity],
            });
            setDone(true);
            setTimeout(() => navigate('/'), 2000);
        } catch {
            alert('Broadcast failed. Check backend connection.');
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckIcon size={24} color="#22c55e" />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#e8eaf0' }}>Alert Broadcast</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Redirecting to dashboard...</div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <div className="eyebrow">BROADCAST PROTOCOL - SECURED</div>
                <h1>Issue New Alert</h1>
                <p>Define target zone, validate incident details, review operational risk, and confirm broadcast.</p>
            </div>

            <div className="step-nav" style={{ marginBottom: 24 }}>
                {STEPS.map((s, i) => (
                    <button key={s} onClick={() => i < step && setStep(i)}
                        className={`step-btn ${step === i ? 'active' : ''} ${step > i ? 'done' : ''}`}>
                        <span className="step-num">{step > i ? 'OK' : i + 1}</span>
                        {s}
                    </button>
                ))}
            </div>

            {step === 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
                    <div className="panel" style={{ overflow: 'hidden' }}>
                        <div className="panel-header">
                            <div className="panel-title">Select Alert Zone</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <MapTool active={drawMode === 'circle'} onClick={() => setDrawMode('circle')} Icon={DrawCircleIcon} label="Circle" />
                                <MapTool active={drawMode === 'polygon'} onClick={() => setDrawMode('polygon')} Icon={DrawPolygonIcon} label="Polygon" />
                                {zone && (
                                    <button onClick={() => setZone(null)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        <XIcon size={12} /> Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ height: 420, position: 'relative', cursor: 'crosshair' }}>
                            {drawMode === 'circle' && (
                                <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 900, background: 'rgba(13,15,20,0.92)', border: '1px solid #2e3447', borderRadius: 7, padding: '10px 14px', backdropFilter: 'blur(12px)', minWidth: 180 }}>
                                    <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#6b7280', fontFamily: 'monospace', marginBottom: 6 }}>RADIUS: {circleRadius} KM</div>
                                    <input type="range" min={1} max={500} value={circleRadius} onChange={e => handleRadiusChange(Number(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6' }} />
                                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Click map to place</div>
                                </div>
                            )}
                            {drawMode === 'polygon' && (
                                <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 900, background: 'rgba(13,15,20,0.92)', border: '1px solid #2e3447', borderRadius: 7, padding: '10px 14px' }}>
                                    <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#6b7280', fontFamily: 'monospace' }}>Click 3+ points to form polygon</div>
                                </div>
                            )}
                            <MapContainer ref={mapRef} center={[37.5, -96]} zoom={4} style={{ height: '100%' }} attributionControl={false} zoomControl={false}>
                                <TileLayer url={DARK_TILE} />
                                <DrawOnMap drawMode={drawMode} onCircle={handleCircle} onPolygon={handlePolygon} />
                                {zone?.type === 'circle' && zone.center && (
                                    <Circle center={zone.center} radius={zone.radiusKm * 1000}
                                        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.18, weight: 2 }} />
                                )}
                                {zone?.type === 'polygon' && zone.coordinates?.length >= 3 && (
                                    <Polygon positions={zone.coordinates}
                                        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.18, weight: 2 }} />
                                )}
                            </MapContainer>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="step-panel" style={{ padding: 16 }}>
                            <SectionLabel>SEARCH LOCATION</SectionLabel>
                            <GeoSearch onSelect={handleZoneSearch} />
                        </div>

                        <div className="step-panel" style={{ padding: 16 }}>
                            <SectionLabel>ZONE SUMMARY</SectionLabel>
                            {zone ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <SummaryRow label="Type" value={zone.type === 'circle' ? 'Circle radius' : 'Polygon boundary'} />
                                    {zone.type === 'circle' && <SummaryRow label="Radius" value={`${zone.radiusKm} km`} />}
                                    {areaKm != null && <SummaryRow label="Area" value={`${areaKm.toLocaleString()} km2`} />}
                                    {zone.type === 'polygon' && <SummaryRow label="Points" value={zone.coordinates.length} />}
                                    <SummaryRow label="Location" value={locationName || 'Custom map point'} />
                                    <SummaryRow label="Est. population" value={populationLabel} />
                                    <SummaryRow label="Affected facilities" value="Unavailable" />
                                    <SummaryRow label="Hospitals nearby" value="Unavailable" />
                                    <SummaryRow label="Shelters nearby" value="Unavailable" />
                                </div>
                            ) : (
                                <div style={{ fontSize: 12, color: '#6b7280' }}>Draw a zone on the map to see summary.</div>
                            )}
                        </div>

                        <button disabled={!zone} onClick={() => setStep(1)}
                            className="btn btn-primary"
                            style={{ width: '100%', opacity: zone ? 1 : 0.4, justifyContent: 'center' }}>
                            Next: Alert Details
                        </button>
                    </div>
                </div>
            )}

            {step === 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 16, alignItems: 'start' }}>
                    <div className="step-panel">
                        <div className="step-title"><h2>Alert Details</h2></div>

                        <div className="form-full form-group" style={{ marginBottom: 14 }}>
                            <label>INCIDENT TITLE *</label>
                            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Wildfire spreading near ridge" />
                        </div>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label>INCIDENT CATEGORY</label>
                                <input value={form.incidentCategory} onChange={e => set('incidentCategory', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>ESTIMATED DURATION</label>
                                <select value={form.estimatedDuration} onChange={e => set('estimatedDuration', e.target.value)}>
                                    {DURATIONS.map(d => <option key={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 14 }}>
                            <label>INCIDENT TYPE</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 6 }}>
                                {ALERT_TYPES.map(({ value, label, Icon }) => (
                                    <button key={value} onClick={() => handleType(value)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${form.type === value ? '#3b82f6' : '#252a38'}`, background: form.type === value ? 'rgba(59,130,246,0.1)' : '#1a1e28', color: form.type === value ? '#60a5fa' : '#9ca3af' }}>
                                        <Icon size={13} color={form.type === value ? '#60a5fa' : '#6b7280'} /> {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 14 }}>
                            <label>SEVERITY</label>
                            <div style={{ display: 'flex', gap: 7, marginTop: 6 }}>
                                {SEVERITIES.map(s => (
                                    <button key={s} onClick={() => set('severity', s)}
                                        style={{ flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${form.severity === s ? SEV_COLOR[s] : '#252a38'}`, background: form.severity === s ? `${SEV_COLOR[s]}18` : '#1a1e28', color: form.severity === s ? SEV_COLOR[s] : '#6b7280' }}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label>PREDICTED IMPACT</label>
                                <select value={form.predictedImpact} onChange={e => set('predictedImpact', e.target.value)}>
                                    {IMPACTS.map(i => <option key={i}>{i}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>AFFECTED POPULATION (EST.)</label>
                                <input type="number" min="0" value={form.affectedPopulation} onChange={e => set('affectedPopulation', Number(e.target.value))} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                            <Toggle label="Evacuation Required" checked={form.evacuationRequired} onChange={v => set('evacuationRequired', v)} />
                            <Toggle label="Shelter Required" checked={form.shelterRequired} onChange={v => set('shelterRequired', v)} />
                        </div>

                        <div className="form-group form-full" style={{ marginBottom: 14 }}>
                            <label>PUBLIC SAFETY INSTRUCTIONS *</label>
                            <textarea value={form.safetyInstructions} onChange={e => set('safetyInstructions', e.target.value)} placeholder="Clear public action guidance, evacuation routes, shelter directions, or stay-away instructions." />
                        </div>

                        <div className="form-group form-full" style={{ marginBottom: 14 }}>
                            <label>DESCRIPTION</label>
                            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Situation summary and operational context." />
                        </div>

                        <div className="form-row-2">
                            <div className="form-group">
                                <label>REPORTING UNIT *</label>
                                <input value={form.reportingUnit} onChange={e => set('reportingUnit', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>SLA TARGET</label>
                                <input value={`${SLA_MAP[form.severity]} minutes`} readOnly />
                            </div>
                        </div>

                        <div className="step-actions">
                            <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
                            <button className="btn btn-primary" disabled={!form.title.trim()} onClick={() => setStep(2)}>Next: Review</button>
                        </div>
                    </div>

                    <div className="preview-panel">
                        <SectionLabel>LIVE PREVIEW</SectionLabel>
                        <AlertPreviewCard form={form} locationName={locationName} />
                        <div className="sla-preview" style={{ marginTop: 14 }}>
                            <div className="sla-preview-label">SLA ON BROADCAST</div>
                            <div className="sla-countdown" style={{ color: SEV_COLOR[form.severity] }}>{SLA_MAP[form.severity]} min</div>
                            <div className="sla-preview-sub">Until escalation target</div>
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
                    <div className="panel" style={{ overflow: 'hidden' }}>
                        <div className="panel-header">
                            <div className="panel-title">Incident Review</div>
                            <span style={{ fontSize: 10, color: SEV_COLOR[form.severity], fontFamily: 'monospace', fontWeight: 700 }}>{form.severity}</span>
                        </div>
                        <div style={{ height: 340 }}>
                            <MapContainer center={zone?.type === 'circle' ? zone.center : zone?.coordinates?.[0] || [37.5, -96]} zoom={zone ? 8 : 4}
                                style={{ height: '100%' }} attributionControl={false} zoomControl={false}>
                                <TileLayer url={DARK_TILE} />
                                {zone?.type === 'circle' && (
                                    <Circle center={zone.center} radius={zone.radiusKm * 1000}
                                        pathOptions={{ color: SEV_COLOR[form.severity], fillColor: SEV_COLOR[form.severity], fillOpacity: 0.2, weight: 2 }} />
                                )}
                                {zone?.type === 'polygon' && (
                                    <Polygon positions={zone.coordinates}
                                        pathOptions={{ color: SEV_COLOR[form.severity], fillColor: SEV_COLOR[form.severity], fillOpacity: 0.2, weight: 2 }} />
                                )}
                            </MapContainer>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="step-panel" style={{ padding: 18 }}>
                            <SectionLabel>REVIEW SUMMARY</SectionLabel>
                            <SummaryRow label="Location" value={locationName || 'Custom zone'} />
                            <SummaryRow label="Radius" value={`${radiusKm} km`} />
                            <SummaryRow label="Affected population" value={populationLabel} />
                            <SummaryRow label="Severity" value={form.severity} color={SEV_COLOR[form.severity]} />
                            <SummaryRow label="Assigned teams" value={assignedTeams.length ? assignedTeams.map(t => t.name).join(', ') : 'Auto assignment pending'} />
                            <SummaryRow label="Instructions" value={form.safetyInstructions || 'Missing'} color={form.safetyInstructions ? undefined : '#ef4444'} />
                            <SummaryRow label="SLA target" value={`${SLA_MAP[form.severity]} min`} />
                        </div>

                        {(duplicateAlerts.length > 0 || missingFields.length > 0) && (
                            <div className="step-panel" style={{ padding: 16, borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.06)' }}>
                                <SectionLabel>VALIDATION WARNINGS</SectionLabel>
                                {duplicateAlerts.length > 0 && (
                                    <WarningLine text={`${duplicateAlerts.length} active incident(s) detected near this target area.`} />
                                )}
                                {missingFields.map(field => <WarningLine key={field} text={`Missing required field: ${field}`} />)}
                            </div>
                        )}

                        <div className="step-actions" style={{ padding: 0, border: 'none' }}>
                            <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
                            <button className="btn btn-primary" disabled={missingFields.length > 0} onClick={() => setStep(3)}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div style={{ maxWidth: 680, margin: '0 auto', paddingTop: 20 }}>
                    <div style={{ textAlign: 'center', marginBottom: 22 }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <AlertTriangleIcon size={24} color="#ef4444" />
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#e8eaf0', marginBottom: 8 }}>Final Broadcast Approval</div>
                        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                            Confirm target, message content, delivery channels, and command authorization before issuing this alert.
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                        <div className="step-panel" style={{ padding: 18 }}>
                            <SectionLabel>CONFIRMATION CHECKLIST</SectionLabel>
                            <CheckRow label="Target area and radius verified" checked={checks.target} onChange={v => setChecks(c => ({ ...c, target: v }))} />
                            <CheckRow label="Public instructions reviewed" checked={checks.content} onChange={v => setChecks(c => ({ ...c, content: v }))} />
                            <CheckRow label="Command duty officer approval recorded" checked={checks.command} onChange={v => setChecks(c => ({ ...c, command: v }))} />
                        </div>

                        <div className="step-panel" style={{ padding: 18 }}>
                            <SectionLabel>BROADCAST CHANNELS</SectionLabel>
                            {CHANNELS.map(channel => (
                                <CheckRow key={channel} label={channel} checked={channels[channel]} onChange={v => setChannels(c => ({ ...c, [channel]: v }))} />
                            ))}
                        </div>
                    </div>

                    <div className="step-panel" style={{ padding: 18, marginBottom: 18 }}>
                        <CheckRow label="I authorize broadcast of this emergency incident alert." checked={approval} onChange={setApproval} strong />
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
                        <button className="btn btn-danger" disabled={submitting || !canConfirm} onClick={handleBroadcast} style={{ minWidth: 180, justifyContent: 'center', opacity: canConfirm ? 1 : 0.45 }}>
                            {submitting ? 'Broadcasting...' : 'BROADCAST ALERT'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SectionLabel({ children }) {
    return <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#6b7280', fontFamily: 'monospace', marginBottom: 10 }}>{children}</div>;
}

function MapTool({ active, onClick, Icon, label }) {
    return (
        <button onClick={onClick}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, border: `1px solid ${active ? '#3b82f6' : '#252a38'}`, background: active ? 'rgba(59,130,246,0.1)' : 'transparent', color: active ? '#60a5fa' : '#6b7280', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Icon size={13} /> {label}
        </button>
    );
}

function Toggle({ label, checked, onChange }) {
    return (
        <button type="button" onClick={() => onChange(!checked)}
            style={{ flex: 1, border: `1px solid ${checked ? '#f59e0b' : '#252a38'}`, background: checked ? 'rgba(245,158,11,0.12)' : '#1a1e28', color: checked ? '#fbbf24' : '#9ca3af', borderRadius: 6, padding: '8px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {checked ? 'YES' : 'NO'} - {label}
        </button>
    );
}

function CheckRow({ label, checked, onChange, strong }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', color: strong ? '#e8eaf0' : '#9ca3af', fontSize: 12, fontWeight: strong ? 700 : 500, cursor: 'pointer' }}>
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: '#3b82f6' }} />
            {label}
        </label>
    );
}

function WarningLine({ text }) {
    return (
        <div style={{ color: '#fbbf24', fontSize: 12, lineHeight: 1.5, marginBottom: 5 }}>
            {text}
        </div>
    );
}

function SummaryRow({ label, value, color }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #1a1e28', fontSize: 12 }}>
            <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>{label}</span>
            <strong style={{ color: color || '#e8eaf0', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</strong>
        </div>
    );
}

function AlertPreviewCard({ form, locationName }) {
    const sev = form.severity || 'HIGH';
    return (
        <div style={{ background: '#1a1e28', border: `1px solid ${SEV_COLOR[sev]}40`, borderLeft: `3px solid ${SEV_COLOR[sev]}`, borderRadius: 9, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#13161e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangleIcon size={14} color={SEV_COLOR[sev]} />
                </div>
                <div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#6b7280' }}>{form.type.toUpperCase()}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: SEV_COLOR[sev] }}>{sev}</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'monospace', color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', padding: '2px 7px', borderRadius: 4 }}>ACTIVE</div>
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#e8eaf0', marginBottom: 3 }}>{form.title || 'Incident title...'}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{locationName || 'Location pending'}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>{form.safetyInstructions || form.description || 'Public safety instructions will appear here.'}</div>
        </div>
    );
}
