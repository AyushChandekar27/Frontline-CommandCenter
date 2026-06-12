import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SearchIcon, XIcon, MapPinIcon } from './Icons';

/**
 * GeoSearch — location autocomplete using OpenStreetMap Nominatim.
 * onSelect(result) => { name, lat, lng, bbox, type }
 */
export default function GeoSearch({ onSelect, onZoom, placeholder = 'Search city, state, country…' }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const debounceRef = useRef(null);
    const wrapRef = useRef(null);

    const search = useCallback(async (q) => {
        if (q.length < 2) { setResults([]); return; }
        setLoading(true);
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=7&accept-language=en`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            const data = await res.json();
            setResults(data.map(d => ({
                id: d.place_id,
                name: d.display_name,
                short: [d.address?.city || d.address?.town || d.address?.village || d.address?.county, d.address?.state, d.address?.country].filter(Boolean).join(', '),
                lat: parseFloat(d.lat),
                lng: parseFloat(d.lon),
                bbox: d.boundingbox ? d.boundingbox.map(Number) : null,
                type: d.type,
            })));
            setOpen(true);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (!query.trim()) { setResults([]); setOpen(false); return; }
        debounceRef.current = setTimeout(() => search(query), 300);
        return () => clearTimeout(debounceRef.current);
    }, [query, search]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (r) => {
        setQuery(r.short || r.name.split(',').slice(0, 2).join(','));
        setOpen(false);
        setResults([]);
        onSelect?.(r);
        onZoom?.(r);
    };

    const clear = () => { setQuery(''); setResults([]); setOpen(false); };

    return (
        <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(13,15,20,0.92)', border: '1px solid #2e3447',
                borderRadius: 8, padding: '0 12px', height: 40,
                backdropFilter: 'blur(12px)',
            }}>
                <SearchIcon size={14} color="#6b7280" />
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    placeholder={placeholder}
                    style={{
                        flex: 1, background: 'none', border: 'none', outline: 'none',
                        color: '#e8eaf0', fontSize: 13, fontFamily: 'inherit',
                    }}
                />
                {loading && <div style={{ width: 14, height: 14, border: '2px solid #2e3447', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
                {query && !loading && (
                    <button onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0, display: 'flex' }}>
                        <XIcon size={13} />
                    </button>
                )}
            </div>

            {open && results.length > 0 && (
                <div style={{
                    position: 'absolute', top: 46, left: 0, right: 0, zIndex: 9999,
                    background: '#13161e', border: '1px solid #252a38', borderRadius: 8,
                    overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                    {results.map((r, i) => (
                        <button key={r.id} onClick={() => handleSelect(r)}
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                                padding: '10px 14px', background: 'none', border: 'none',
                                borderBottom: i < results.length - 1 ? '1px solid #1a1e28' : 'none',
                                cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1a1e28'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            <MapPinIcon size={13} color="#6b7280" style={{ marginTop: 2, flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: 12, color: '#e8eaf0', fontWeight: 500, lineHeight: 1.3 }}>
                                    {r.short || r.name.split(',').slice(0, 2).join(',')}
                                </div>
                                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1, lineHeight: 1.3 }}>
                                    {r.name.length > 60 ? r.name.slice(0, 58) + '…' : r.name}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}