import React, { createContext, useContext, useState, useCallback } from 'react';
import { getUser, saveAuth, clearAuth } from '../services/auth';
import { login as apiLogin } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(getUser);   // init from localStorage

    const login = useCallback(async (username, password) => {
        const data = await apiLogin(username, password);
        saveAuth(data.token, data.username, data.role);
        setUser({ username: data.username, role: data.role });
        return data;
    }, []);

    const logout = useCallback(() => {
        clearAuth();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoggedIn: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}