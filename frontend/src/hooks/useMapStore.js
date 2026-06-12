import { useState, useCallback, useEffect } from 'react';

const DEFAULT_LAYERS = {
    alerts: true,
    heatmap: false,
    boundaries: false,
    teams: true,
};

const LAYERS_KEY = 'frontline.map.layers';

/**
 * Central state for the map system.
 * Keeps layer visibility, drawn zones, selected region, and alert overlays
 * all in one place so AlertMap and BroadcastFlow stay in sync.
 */
export function useMapStore() {
    const [layers, setLayers] = useState(() => {
        try {
            return { ...DEFAULT_LAYERS, ...JSON.parse(localStorage.getItem(LAYERS_KEY) || '{}') };
        } catch {
            return DEFAULT_LAYERS;
        }
    });

    const [drawnZone, setDrawnZone] = useState(null);
    // drawnZone shape: { type: 'circle' | 'polygon', center?, radiusKm?, coordinates?, label? }

    const [selectedRegion, setSelectedRegion] = useState(null);
    // selectedRegion: { name, lat, lng, bbox?, estimatedPop? }

    const [drawMode, setDrawMode] = useState(null);
    // drawMode: null | 'circle' | 'polygon'

    const toggleLayer = useCallback((key) => {
        setLayers(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    useEffect(() => {
        localStorage.setItem(LAYERS_KEY, JSON.stringify(layers));
    }, [layers]);

    const clearZone = useCallback(() => {
        setDrawnZone(null);
        setSelectedRegion(null);
    }, []);

    return {
        layers, toggleLayer,
        drawnZone, setDrawnZone,
        selectedRegion, setSelectedRegion,
        drawMode, setDrawMode,
        clearZone,
    };
}
