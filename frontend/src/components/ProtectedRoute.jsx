import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
    const { isLoggedIn, user } = useAuth();
    if (!isLoggedIn) return <Navigate to="/login" replace />;
    if (roles && user && !roles.includes(user.role)) {
        return <Navigate to={user.role === 'TEAM' ? '/tracking' : '/'} replace />;
    }
    return children;
}
