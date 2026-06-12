import React from 'react';

// ── Severity color map ────────────────────────────────────────
export const SEV_COLOR = {
    CRITICAL: '#ef4444',
    HIGH:     '#f97316',
    MEDIUM:   '#eab308',
    LOW:      '#330C89',
};

// ── Shared SVG wrapper ────────────────────────────────────────
function Icon({ size, color, children, viewBox = '0 0 24 24' }) {
    return (
        <svg width={size} height={size} viewBox={viewBox} fill="none"
             stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {children}
        </svg>
    );
}

// ── Alert type icons ──────────────────────────────────────────

export function FireIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <path d="M12 2c0 4.5-5 7-5 11a5 5 0 0 0 10 0c0-4-5-6.5-5-11z"/>
            <path d="M12 12c0 2.5-2 3.5-2 5a2 2 0 0 0 4 0c0-1.5-2-2.5-2-5z"/>
        </Icon>
    );
}

export function FloodIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* rising water waves */}
            <path d="M2 15c1.5-2 3 2 4.5 0S9 13 10.5 15s3 2 4.5 0S18 13 19.5 15 22 17 22 17"/>
            <path d="M2 19c1.5-2 3 2 4.5 0S9 17 10.5 19s3 2 4.5 0S18 17 19.5 19 22 21 22 21"/>
            {/* cloud / rain source */}
            <path d="M8 8a4 4 0 0 1 8 0"/>
            <path d="M10 8v3M14 8v3"/>
        </Icon>
    );
}

export function EarthquakeIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* seismic waveform */}
            <polyline points="2 12 5 12 7 7 9 17 11 10 13 14 15 9 17 15 19 12 22 12"/>
        </Icon>
    );
}

export function StormIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* cloud + lightning bolt */}
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 0 1 0 9z"/>
            <polyline points="13 11 10 17 14 17 11 23"/>
        </Icon>
    );
}

export function HazmatIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* biohazard-style: outer ring + inner circle + 3 lobes suggested */}
            <circle cx="12" cy="12" r="9"/>
            <circle cx="12" cy="12" r="2.5"/>
            <path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </Icon>
    );
}

export function MedicalIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <path d="M8 2H16a2 2 0 0 1 2 2v3h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2v3a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-3H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V4a2 2 0 0 1 2-2z"/>
        </Icon>
    );
}

export function SecurityIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* shield with center dot */}
            <path d="M12 3L4 7v5c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V7l-8-4z"/>
            <circle cx="12" cy="12" r="2" fill={color} stroke="none"/>
        </Icon>
    );
}

// ── Nav / UI icons ────────────────────────────────────────────

export function DashboardIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* four-panel grid */}
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
        </Icon>
    );
}

export function AlertNavIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* broadcast / alert signal */}
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </Icon>
    );
}

export function TrackingIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* radar / location pulse */}
            <circle cx="12" cy="12" r="3"/>
            <path d="M6.34 6.34a8 8 0 1 0 11.32 0"/>
            <path d="M2 12h2M20 12h2M12 2v2M12 20v2"/>
        </Icon>
    );
}

export function AssignmentIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* clipboard with checkmark */}
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <path d="M9 12l2 2 4-4"/>
        </Icon>
    );
}

export function EscalationIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* upward arrow in circle — escalation */}
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 8v8M8 12l4-4 4 4"/>
        </Icon>
    );
}

export function TeamsIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* two people */}
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </Icon>
    );
}

export function HistoryIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* clock with arrow */}
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M12 7v5l4 2"/>
        </Icon>
    );
}

export function AuditIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* document with lines */}
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="12" y2="17"/>
        </Icon>
    );
}

export function LayersIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
        </Icon>
    );
}

export function DrawCircleIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <circle cx="12" cy="12" r="9"/>
            <circle cx="12" cy="12" r="1" fill={color} stroke="none"/>
        </Icon>
    );
}

export function DrawPolygonIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <polygon points="12 3 21 9 18 20 6 20 3 9"/>
        </Icon>
    );
}

export function SearchIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </Icon>
    );
}

export function XIcon({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
             stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
    );
}

export function AlertTriangleIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </Icon>
    );
}

export function CheckIcon({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
             stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
    );
}

export function MapPinIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
        </Icon>
    );
}

export function UsersIcon({ size = 16, color = 'currentColor' }) {
    return <TeamsIcon size={size} color={color} />;
}

export function TrashIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
        </Icon>
    );
}

export function StatusActiveIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <circle cx="12" cy="12" r="9"/>
            <path d="M8 12l3 3 5-5"/>
        </Icon>
    );
}

export function StatusMonitorIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* eye */}
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        </Icon>
    );
}

export function StatusResolvedIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
        </Icon>
    );
}

export function AcknowledgeIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <polyline points="20 6 9 17 4 12"/>
        </Icon>
    );
}

export function BroadcastIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            {/* signal waves */}
            <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
            <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <circle cx="12" cy="20" r="1" fill={color} stroke="none"/>
        </Icon>
    );
}

export function SignOutIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
        </Icon>
    );
}

export function RefreshIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
        </Icon>
    );
}

export function FilterIcon({ size = 16, color = 'currentColor' }) {
    return (
        <Icon size={size} color={color}>
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </Icon>
    );
}

// ── Type → Icon map ───────────────────────────────────────────

export const TYPE_ICON_MAP = {
    'Fire':              FireIcon,
    'Flood':             FloodIcon,
    'Earthquake':        EarthquakeIcon,
    'Storm':             StormIcon,
    'Chemical/Hazmat':   HazmatIcon,
    'Medical':           MedicalIcon,
    'Security/Terror':   SecurityIcon,
};

export function AlertTypeIcon({ type, size = 16, color }) {
    const Comp = TYPE_ICON_MAP[type] || AlertTriangleIcon;
    return <Comp size={size} color={color || SEV_COLOR.HIGH} />;
}