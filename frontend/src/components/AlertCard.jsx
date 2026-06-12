// ── Drop-in replacement for AlertCard used in Dashboard.jsx ──
// Replace the AlertCard function in Dashboard.jsx with this one.
// Also add these imports at the top of Dashboard.jsx:
//   import { AlertTypeIcon, MapPinIcon, UsersIcon, SEV_COLOR,
//            StatusActiveIcon, StatusMonitorIcon, StatusResolvedIcon,
//            AcknowledgeIcon } from '../components/icons';

import React from 'react';
import {
    AlertTypeIcon, MapPinIcon, UsersIcon, SEV_COLOR,
    AcknowledgeIcon, StatusMonitorIcon, StatusResolvedIcon,
} from './icons';

function timeAgo(iso) {
    if (!iso) return '—';
    const m = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function timeHHmm(iso) {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function AlertCard({ alert: a, onStatus, onAck }) {
    const sev = (a.severity || 'LOW').toLowerCase();
    const sevColor = SEV_COLOR[(a.severity || 'LOW').toUpperCase()];

    return (
        <div className={`alert-card ${sev}`}>
            <div className="card-top">
                <div className="card-type">
                    <div className="type-icon">
                        <AlertTypeIcon type={a.type} size={14} color={sevColor}/>
                    </div>
                    <div>
                        <div className="type-name">{(a.type || '').toUpperCase()}</div>
                        <div className={`type-severity sev-${sev}`}>{a.severity}</div>
                    </div>
                </div>
                <div className={`status-pill status-${(a.status || '').toLowerCase()}`}>
                    {a.status} {timeHHmm(a.updatedAt || a.createdAt)}
                </div>
            </div>

            <div className="card-title">{a.title}</div>

            <div className="card-location" style={{ display:'flex', alignItems:'center', gap:5 }}>
                <MapPinIcon size={11} color="#6b7280"/>
                {a.location}
            </div>

            <div className="card-desc">{a.description}</div>

            <div className="card-footer">
        <span style={{ display:'flex', alignItems:'center', gap:4 }}>
          <UsersIcon size={11} color="#6b7280"/>
            {(a.affectedPopulation || 0).toLocaleString()}
        </span>
                <span>{timeAgo(a.createdAt)}</span>
            </div>

            <div className="card-actions">
                {!a.acknowledgedAt && a.status !== 'RESOLVED' && (
                    <button className="action-btn ack"
                            onClick={() => onAck(a.id)}
                            style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'center' }}>
                        <AcknowledgeIcon size={11}/>
                        Ack
                    </button>
                )}
                {a.status === 'ACTIVE' && (
                    <button className="action-btn monitor"
                            onClick={() => onStatus(a.id, 'MONITORING')}
                            style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'center' }}>
                        <StatusMonitorIcon size={11}/>
                        Monitor
                    </button>
                )}
                {a.status !== 'RESOLVED' && (
                    <button className="action-btn resolve"
                            onClick={() => onStatus(a.id, 'RESOLVED')}
                            style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'center' }}>
                        <StatusResolvedIcon size={11}/>
                        Resolve
                    </button>
                )}
            </div>
        </div>
    );
}
