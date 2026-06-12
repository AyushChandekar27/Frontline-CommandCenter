import React, { useState } from 'react';
import { LayersIcon } from './Icons';

const LAYER_DEFS = [
    { key: 'alerts', label: 'Alert Zones', color: '#ef4444', desc: 'Incident radius overlays' },
    { key: 'heatmap', label: 'Density Heatmap', color: '#f97316', desc: 'Risk intensity surface' },
    { key: 'boundaries', label: 'Admin Boundaries', color: '#3b82f6', desc: 'Jurisdiction outlines' },
    { key: 'teams', label: 'Team Positions', color: '#22c55e', desc: 'Live response units' },
];

const DEFAULT_LAYERS = { alerts: true, heatmap: false, boundaries: false, teams: true };

export default function LayerControl({ layers, onToggle }) {
    const [open, setOpen] = useState(false);
    const setLayer = (key, value) => {
        if (!!layers[key] !== value) onToggle(key);
    };
    const setAll = (value) => LAYER_DEFS.forEach(l => setLayer(l.key, value));
    const resetLayers = () => LAYER_DEFS.forEach(l => setLayer(l.key, DEFAULT_LAYERS[l.key]));

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                title="Toggle map layers"
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: open ? '#1a1e28' : 'rgba(13,15,20,0.92)',
                    border: `1px solid ${open ? '#3b82f6' : '#2e3447'}`,
                    borderRadius: 7, padding: '6px 10px', cursor: 'pointer',
                    color: open ? '#e8eaf0' : '#9ca3af', backdropFilter: 'blur(12px)',
                    fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                    transition: 'all 0.15s',
                }}
            >
                <LayersIcon size={14} color={open ? '#3b82f6' : '#6b7280'} />
                Layers
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 36, right: 0, width: 184, zIndex: 1000,
                    background: 'rgba(19,22,30,0.96)', border: '1px solid rgba(46,52,71,0.9)', borderRadius: 8,
                    boxShadow: '0 10px 28px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.02)', overflow: 'hidden',
                    backdropFilter: 'blur(14px)',
                }}>
                    <div style={{ padding: '7px 9px 6px', borderBottom: '1px solid #1a1e28', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 9, letterSpacing: '0.12em', color: '#6b7280', fontFamily: 'monospace', fontWeight: 700 }}>MAP LAYERS</span>
                        <button onClick={resetLayers} title="Reset layers" style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 9, fontFamily: 'monospace', padding: 0 }}>
                            RESET
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '6px 8px', borderBottom: '1px solid #1a1e28' }}>
                        <button onClick={() => setAll(true)} style={{ background: '#1a1e28', border: '1px solid #2e3447', borderRadius: 4, color: '#9ca3af', fontSize: 9, padding: '4px 0', cursor: 'pointer', fontFamily: 'monospace' }}>
                            SHOW ALL
                        </button>
                        <button onClick={() => setAll(false)} style={{ background: '#1a1e28', border: '1px solid #2e3447', borderRadius: 4, color: '#9ca3af', fontSize: 9, padding: '4px 0', cursor: 'pointer', fontFamily: 'monospace' }}>
                            HIDE ALL
                        </button>
                    </div>
                    {LAYER_DEFS.map(l => (
                        <button key={l.key} onClick={() => onToggle(l.key)}
                            title={l.desc}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                padding: '7px 9px', background: 'none', border: 'none',
                                borderBottom: '1px solid #1a1e2880', cursor: 'pointer',
                                transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1a1e28'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            {/* Toggle indicator */}
                            <div style={{
                                width: 28, height: 16, borderRadius: 8, position: 'relative',
                                background: layers[l.key] ? l.color : '#252a38',
                                transition: 'background 0.2s', flexShrink: 0,
                            }}>
                                <div style={{
                                    position: 'absolute', top: 3, left: layers[l.key] ? 14 : 3,
                                    width: 10, height: 10, borderRadius: '50%', background: '#fff',
                                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }} />
                            </div>
                            <div style={{ minWidth: 0, textAlign: 'left' }}>
                                <div style={{ fontSize: 11, color: layers[l.key] ? '#e8eaf0' : '#6b7280', fontFamily: 'inherit', lineHeight: 1.2 }}>
                                    {l.label}
                                </div>
                                <div style={{ fontSize: 9, color: '#4b5563', lineHeight: 1.25, marginTop: 1 }}>
                                    {l.desc}
                                </div>
                            </div>
                        </button>
                    ))}
                    {layers.heatmap && (
                        <div style={{ padding: '7px 9px', background: 'rgba(13,15,20,0.65)' }}>
                            <div style={{ fontSize: 8, letterSpacing: '0.1em', color: '#6b7280', fontFamily: 'monospace', marginBottom: 5 }}>RISK</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 8, color: '#6b7280', fontFamily: 'monospace' }}>
                                <span>LOW</span>
                                <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'linear-gradient(90deg,#22c55e,#f59e0b,#ef4444)' }} />
                                <span>HIGH</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
