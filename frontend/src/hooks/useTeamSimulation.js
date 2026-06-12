import { useState, useEffect, useCallback, useRef } from 'react';
import { getTeams, getAssignments, getAlerts, getLatestLocations } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MOVE_INTERVAL = 3000; // ms
const ALERT_SPEED = 0.0008; // degrees per tick when en-route
const RETURN_SPEED = 0.0007;
const ASSIGNED_TICKS = 2;
const ON_SITE_TICKS = 4;

/**
 * Simulates team GPS movement.
 * - Available/assigned/on-site teams hold position.
 * - En-route teams move toward the alert, wait on site, then return to base.
 * Returns: array of { teamId, teamName, latitude, longitude, status, speedKmh, assignedAlertLat, assignedAlertLng, lastUpdateAt }
 */
export function useTeamSimulation() {
    const { user } = useAuth();
    const [locations, setLocations] = useState([]);
    const stateRef = useRef([]);   // mutable positions
    const timer = useRef(null);

    const init = useCallback(async () => {
        try {
            const canReadAlerts = user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
            const [teams, assignments, alerts, stored] = await Promise.all([
                getTeams(),
                canReadAlerts ? getAssignments() : Promise.resolve([]),
                canReadAlerts ? getAlerts() : Promise.resolve([]),
                getLatestLocations(),
            ]);

            const active = assignments.filter(a =>
                ['ASSIGNED', 'EN_ROUTE', 'ON_SITE'].includes(a.status));

            const initial = teams
                .filter(t => t.baseLat && t.baseLng)
                .map(t => {
                    const storedLoc = stored.find(s => s.teamId === t.id);
                    const lat = storedLoc?.latitude ?? t.baseLat + (Math.random() - 0.5) * 0.05;
                    const lng = storedLoc?.longitude ?? t.baseLng + (Math.random() - 0.5) * 0.05;
                    const asgn = active.find(a => a.teamId === t.id);
                    const alert = alerts.find(a => a.id === asgn?.alertId);
                    const targetLat = alert?.latitude ?? null;
                    const targetLng = alert?.longitude ?? null;
                    const hasTarget = targetLat != null && targetLng != null;
                    const status = asgn?.status === 'ON_SITE'
                        ? 'ON_SITE'
                        : asgn?.status === 'EN_ROUTE'
                            ? 'EN_ROUTE'
                            : hasTarget
                                ? 'ASSIGNED'
                                : 'AVAILABLE';

                    return {
                        teamId: t.id,
                        teamName: t.name,
                        icon: t.icon || '🚨',
                        latitude: lat,
                        longitude: lng,
                        status,
                        speedKmh: 0,
                        assignedAlertLat: hasTarget ? targetLat : null,
                        assignedAlertLng: hasTarget ? targetLng : null,
                        _targetLat: hasTarget ? targetLat : null,
                        _targetLng: hasTarget ? targetLng : null,
                        _baseLat: t.baseLat,
                        _baseLng: t.baseLng,
                        _assignedTicks: status === 'ASSIGNED' ? 0 : ASSIGNED_TICKS,
                        _onSiteTicks: asgn?.status === 'ON_SITE' ? 1 : 0,
                        lastUpdateAt: new Date().toISOString(),
                        gpsStatus: 'LOCKED',
                        connectionStatus: 'ONLINE',
                    };
                });

            stateRef.current = initial;
            setLocations(initial.map(clean));
        } catch {
            setTimeout(init, 5000);
        }
    }, [user]);

    useEffect(() => {
        init();
        timer.current = setInterval(tick, MOVE_INTERVAL);
        return () => clearInterval(timer.current);
    }, [init]);

    function tick() {
        stateRef.current = stateRef.current.map(loc => {
            if (loc.status === 'ASSIGNED') {
                const assignedTicks = (loc._assignedTicks || 0) + 1;
                if (assignedTicks >= ASSIGNED_TICKS && loc._targetLat && loc._targetLng) {
                    return {
                        ...loc,
                        status: 'EN_ROUTE',
                        speedKmh: parseFloat((Math.random() * 12 + 48).toFixed(1)),
                        _assignedTicks: assignedTicks,
                        lastUpdateAt: new Date().toISOString(),
                    };
                }
                return {
                    ...loc,
                    speedKmh: 0,
                    _assignedTicks: assignedTicks,
                    lastUpdateAt: new Date().toISOString(),
                };
            }

            if (loc.status === 'RETURNING') {
                const dLat = loc._baseLat - loc.latitude;
                const dLng = loc._baseLng - loc.longitude;
                const dist = Math.sqrt(dLat * dLat + dLng * dLng);

                if (dist < 0.001) {
                    return {
                        ...loc,
                        status: 'AVAILABLE',
                        speedKmh: 0,
                        latitude: loc._baseLat,
                        longitude: loc._baseLng,
                        assignedAlertLat: null,
                        assignedAlertLng: null,
                        _targetLat: null,
                        _targetLng: null,
                        _assignedTicks: 0,
                        _onSiteTicks: 0,
                        lastUpdateAt: new Date().toISOString(),
                    };
                }

                return moveToward(loc, loc._baseLat, loc._baseLng, RETURN_SPEED, 'RETURNING', 35, 47);
            }

            if (loc.status === 'ON_SITE') {
                const onSiteTicks = (loc._onSiteTicks || 0) + 1;
                if (onSiteTicks >= ON_SITE_TICKS) {
                    return {
                        ...loc,
                        status: 'RETURNING',
                        speedKmh: parseFloat((Math.random() * 12 + 35).toFixed(1)),
                        _onSiteTicks: 0,
                        lastUpdateAt: new Date().toISOString(),
                    };
                }
                return { ...loc, speedKmh: 0, _onSiteTicks: onSiteTicks, lastUpdateAt: new Date().toISOString() };
            }

            if (loc.status === 'EN_ROUTE' && loc._targetLat && loc._targetLng) {
                const dLat = loc._targetLat - loc.latitude;
                const dLng = loc._targetLng - loc.longitude;
                const dist = Math.sqrt(dLat * dLat + dLng * dLng);

                if (dist < 0.001) {
                    return {
                        ...loc,
                        status: 'ON_SITE',
                        speedKmh: 0,
                        latitude: loc._targetLat,
                        longitude: loc._targetLng,
                        _onSiteTicks: 0,
                        lastUpdateAt: new Date().toISOString(),
                    };
                }

                return moveToward(loc, loc._targetLat, loc._targetLng, ALERT_SPEED, 'EN_ROUTE', 50, 70);
            }

            return {
                ...loc,
                status: 'AVAILABLE',
                speedKmh: 0,
                lastUpdateAt: new Date().toISOString(),
            };
        });
        setLocations(stateRef.current.map(clean));
    }

    const assignTarget = useCallback((teamId, alertLat, alertLng) => {
        stateRef.current = stateRef.current.map(l =>
            l.teamId === teamId
                ? {
                    ...l,
                    _targetLat: alertLat,
                    _targetLng: alertLng,
                    assignedAlertLat: alertLat,
                    assignedAlertLng: alertLng,
                    status: 'ASSIGNED',
                    speedKmh: 0,
                    _assignedTicks: 0,
                    _onSiteTicks: 0,
                    lastUpdateAt: new Date().toISOString(),
                }
                : l
        );
        setLocations(stateRef.current.map(clean));
    }, []);

    return { locations, assignTarget };
}

function moveToward(loc, targetLat, targetLng, step, status, minSpeed, maxSpeed) {
    const dLat = targetLat - loc.latitude;
    const dLng = targetLng - loc.longitude;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    const nx = loc.latitude + (dLat / dist) * step;
    const ny = loc.longitude + (dLng / dist) * step;
    return {
        ...loc,
        latitude: nx,
        longitude: ny,
        status,
        speedKmh: parseFloat((Math.random() * (maxSpeed - minSpeed) + minSpeed).toFixed(1)),
        lastUpdateAt: new Date().toISOString(),
    };
}

function clean(l) {
    const { _targetLat, _targetLng, _baseLat, _baseLng, _assignedTicks, _onSiteTicks, ...rest } = l;
    return rest;
}
