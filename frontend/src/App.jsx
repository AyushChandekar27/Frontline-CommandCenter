import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage    from './pages/LoginPage';
import Dashboard    from './pages/Dashboard';
import CreateAlert  from './pages/CreateAlert';
import History      from './pages/History';
import Teams        from './pages/Teams';
import LiveTracking from './pages/LiveTracking';
import Assignments  from './pages/Assignments';
import Escalations  from './pages/Escalations';
import AuditLogs    from './pages/AuditLogs';
import ProtectedRoute from './components/ProtectedRoute';
import { getAlerts, getAssignments, getEscalations, getLatestLocations } from './services/api';
import {
    DashboardIcon, AlertNavIcon, TrackingIcon, AssignmentIcon,
    EscalationIcon, TeamsIcon, HistoryIcon, AuditIcon,
    BroadcastIcon, SignOutIcon,
} from './components/icons';
import './styles/global.css';

const NOTICE_COLOR = {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    WARNING: '#f59e0b',
    INFO: '#60a5fa',
    SUCCESS: '#22c55e',
};

const NAV = [
    { to:'/',            exact:true,  label:'Dashboard',   roles:['ADMIN','SUPER_ADMIN'],  Icon:DashboardIcon  },
    { to:'/create',      exact:false, label:'Issue Alert', roles:['ADMIN','SUPER_ADMIN'],  Icon:AlertNavIcon   },
    { to:'/tracking',    exact:false, label:'Live Track',  roles:null,                    Icon:TrackingIcon   },
    { to:'/assignments', exact:false, label:'Assignments', roles:['ADMIN','SUPER_ADMIN'],  Icon:AssignmentIcon },
    { to:'/escalations', exact:false, label:'Escalations', roles:['ADMIN','SUPER_ADMIN'],  Icon:EscalationIcon },
    { to:'/teams',       exact:false, label:'Teams',       roles:null,                    Icon:TeamsIcon      },
    { to:'/history',     exact:false, label:'History',     roles:['ADMIN','SUPER_ADMIN'],  Icon:HistoryIcon    },
    { to:'/audit',       exact:false, label:'Audit Logs',  roles:['ADMIN','SUPER_ADMIN'],  Icon:AuditIcon      },
];

function Sidebar() {
    const navigate      = useNavigate();
    const { user, logout } = useAuth();
    const visible       = NAV.filter(n => !n.roles || (user && n.roles.includes(user.role)));

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="brand">FRONTLINE</div>
                <div className="version">COMMAND CENTER · V2.0</div>
            </div>
            <nav className="sidebar-nav">
                <label>NAVIGATION</label>
                {visible.map(({ to, exact, label, Icon }) => (
                    <NavLink key={to} to={to} end={exact}
                             className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                        <Icon size={15}/>
                        {label}
                    </NavLink>
                ))}
            </nav>
            <div className="sidebar-footer">
                {user && (
                    <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:11, color:'var(--text)', fontWeight:600 }}>{user.username}</div>
                        <div style={{ fontSize:9, color:'var(--muted)', fontFamily:'var(--mono)', letterSpacing:'0.08em' }}>{user.role}</div>
                    </div>
                )}
                <div className="status-dot"><div className="dot"/>SYSTEM OK</div>
                <button
                    onClick={() => { logout(); navigate('/login'); }}
                    style={{ marginTop:10, background:'none', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', fontFamily:'var(--font)', fontSize:11, padding:'6px 10px', cursor:'pointer', width:'100%', textAlign:'left', display:'flex', alignItems:'center', gap:7, transition:'all 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.color='var(--text)'; e.currentTarget.style.borderColor='var(--border2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border)'; }}
                >
                    <SignOutIcon size={13}/> Sign out
                </button>
            </div>
        </aside>
    );
}

function Topbar() {
    const location    = useLocation();
    const { user }    = useAuth();
    const [time, setTime] = React.useState('');

    React.useEffect(() => {
        const tick = () => setTime(new Date().toUTCString().split(' ')[4]);
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, []);

    const page = NAV.find(n => n.exact
        ? location.pathname === n.to
        : location.pathname.startsWith(n.to))?.label || 'Dashboard';

    return (
        <div className="topbar">
            <div className="breadcrumb">/ OPERATIONS / <span>{page.toUpperCase()}</span></div>
            <div className="topbar-right">
                <span className="utc-time">UTC {time}</span>
                <NotificationCenter user={user}/>
                {user && ['ADMIN','SUPER_ADMIN'].includes(user.role) && (
                    <NavLink to="/create" style={{ textDecoration:'none' }}>
                        <button className="btn btn-danger" style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <BroadcastIcon size={13}/> ISSUE ALERT
                        </button>
                    </NavLink>
                )}
            </div>
        </div>
    );
}

function NotificationCenter({ user }) {
    const [open, setOpen] = React.useState(false);
    const [events, setEvents] = React.useState([]);
    const [readAt, setReadAt] = React.useState(() => Number(localStorage.getItem('cc_notice_read_at') || 0));

    React.useEffect(() => {
        if (!user) return;

        const load = async () => {
            const canReadOps = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
            const [alerts, assignments, escalations, locations] = await Promise.all([
                canReadOps ? getAlerts().catch(() => []) : Promise.resolve([]),
                canReadOps ? getAssignments().catch(() => []) : Promise.resolve([]),
                canReadOps ? getEscalations().catch(() => []) : Promise.resolve([]),
                getLatestLocations().catch(() => []),
            ]);
            setEvents(buildEvents(alerts, assignments, escalations, locations));
        };

        load();
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, [user]);

    const unread = events.filter(e => e.ts > readAt).length;

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next) {
            const now = Date.now();
            setReadAt(now);
            localStorage.setItem('cc_notice_read_at', String(now));
        }
    };

    return (
        <div style={{ position:'relative' }}>
            <button
                onClick={toggle}
                title="Operational notifications"
                style={{
                    position:'relative',
                    height:32,
                    minWidth:36,
                    border:'1px solid var(--border)',
                    borderRadius:7,
                    background:open ? 'var(--bg3)' : 'transparent',
                    color:'var(--muted)',
                    cursor:'pointer',
                    fontFamily:'var(--font)',
                    fontSize:12,
                }}>
                OPS
                {unread > 0 && (
                    <span style={{ position:'absolute', top:-5, right:-5, width:16, height:16, borderRadius:'50%', background:'#ef4444', color:'#fff', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800 }}>
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>
            {open && (
                <div style={{
                    position:'absolute',
                    top:38,
                    right:0,
                    width:320,
                    maxHeight:420,
                    overflowY:'auto',
                    background:'#0f1117',
                    border:'1px solid var(--border2)',
                    borderRadius:8,
                    boxShadow:'0 18px 50px rgba(0,0,0,0.55)',
                    zIndex:1200,
                    padding:8,
                }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 6px 8px' }}>
                        <div style={{ fontSize:10, color:'var(--muted)', fontFamily:'var(--mono)', letterSpacing:'0.12em' }}>NOTIFICATION CENTER</div>
                        <div style={{ fontSize:10, color:'var(--muted)', fontFamily:'var(--mono)' }}>{events.length}</div>
                    </div>
                    {events.length === 0 ? (
                        <div style={{ color:'var(--muted)', fontSize:12, padding:14 }}>No operational events.</div>
                    ) : events.slice(0, 18).map(e => (
                        <div key={e.id} style={{
                            display:'grid',
                            gridTemplateColumns:'8px 1fr auto',
                            gap:8,
                            alignItems:'start',
                            padding:'8px 7px',
                            borderTop:'1px solid var(--border)',
                            background:e.ts > readAt ? `${e.color}0f` : 'transparent',
                        }}>
                            <div style={{ width:7, height:7, borderRadius:'50%', background:e.color, marginTop:5 }} />
                            <div style={{ minWidth:0 }}>
                                <div style={{ color:'var(--text)', fontSize:12, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.title}</div>
                                <div style={{ color:'var(--muted)', fontSize:10, lineHeight:1.4, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{e.detail}</div>
                            </div>
                            <div style={{ color:'var(--muted)', fontSize:9, fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>{timeAgo(e.ts)}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function buildEvents(alerts, assignments, escalations, locations) {
    const now = Date.now();
    const events = [];

    alerts.forEach(a => {
        events.push({
            id:`alert-${a.id}`,
            title:'Alert created',
            detail:a.title || a.location || 'New incident',
            ts:new Date(a.createdAt || a.updatedAt || now).getTime(),
            color:NOTICE_COLOR[(a.severity || '').toUpperCase()] || NOTICE_COLOR.INFO,
        });
        if (a.status === 'RESOLVED') {
            events.push({
                id:`resolved-${a.id}`,
                title:'Incident resolved',
                detail:a.title || a.location || 'Incident closed',
                ts:new Date(a.updatedAt || a.createdAt || now).getTime(),
                color:NOTICE_COLOR.SUCCESS,
            });
        }
        if (a.slaBreached) {
            events.push({
                id:`sla-${a.id}`,
                title:'SLA breached',
                detail:a.title || a.location || 'Response target missed',
                ts:new Date(a.escalatedAt || a.updatedAt || a.createdAt || now).getTime(),
                color:NOTICE_COLOR.CRITICAL,
            });
        }
    });

    assignments.forEach(a => {
        events.push({
            id:`assignment-${a.id}`,
            title:'Team assigned',
            detail:`${a.teamName || 'Team'} -> ${a.alertId?.slice(0, 8) || 'incident'}`,
            ts:new Date(a.assignedAt || now).getTime(),
            color:NOTICE_COLOR.INFO,
        });
    });

    escalations.forEach(e => {
        events.push({
            id:`escalation-${e.id}`,
            title:'Escalation triggered',
            detail:e.title || e.location || 'Escalated incident',
            ts:new Date(e.escalatedAt || e.updatedAt || e.createdAt || now).getTime(),
            color:NOTICE_COLOR.WARNING,
        });
    });

    locations.forEach(l => {
        const ts = new Date(l.updatedAt || l.lastUpdateAt || l.timestamp || now).getTime();
        if (now - ts > 30000) {
            events.push({
                id:`tracking-${l.teamId || l.id}`,
                title:'Tracking offline',
                detail:l.teamName || 'Team GPS stale',
                ts,
                color:NOTICE_COLOR.CRITICAL,
            });
        }
    });

    return events
        .filter(e => Number.isFinite(e.ts))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 50);
}

function timeAgo(ts) {
    const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

function AppShell() {
    return (
        <div className="app-shell">
            <Sidebar/>
            <div className="main">
                <Topbar/>
                <Routes>
                    <Route path="/"            element={<ProtectedRoute roles={['ADMIN','SUPER_ADMIN']}><Dashboard/></ProtectedRoute>}/>
                    <Route path="/create"      element={<ProtectedRoute roles={['ADMIN','SUPER_ADMIN']}><CreateAlert/></ProtectedRoute>}/>
                    <Route path="/tracking"    element={<ProtectedRoute><LiveTracking/></ProtectedRoute>}/>
                    <Route path="/assignments" element={<ProtectedRoute roles={['ADMIN','SUPER_ADMIN']}><Assignments/></ProtectedRoute>}/>
                    <Route path="/escalations" element={<ProtectedRoute roles={['ADMIN','SUPER_ADMIN']}><Escalations/></ProtectedRoute>}/>
                    <Route path="/teams"       element={<ProtectedRoute><Teams/></ProtectedRoute>}/>
                    <Route path="/history"     element={<ProtectedRoute roles={['ADMIN','SUPER_ADMIN']}><History/></ProtectedRoute>}/>
                    <Route path="/audit"       element={<ProtectedRoute roles={['ADMIN','SUPER_ADMIN']}><AuditLogs/></ProtectedRoute>}/>
                    <Route path="*"            element={<Navigate to="/" replace/>}/>
                </Routes>
            </div>
        </div>
    );
}

function RootRouter() {
    const { isLoggedIn } = useAuth();
    return (
        <Routes>
            <Route path="/login" element={isLoggedIn ? <Navigate to="/" replace/> : <LoginPage/>}/>
            <Route path="/*"     element={isLoggedIn ? <AppShell/> : <Navigate to="/login" replace/>}/>
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <RootRouter/>
            </AuthProvider>
        </BrowserRouter>
    );
}
