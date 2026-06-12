const TOKEN_KEY = 'fcc_token';
const USER_KEY  = 'fcc_user';

export const saveAuth = (token, username, role) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify({ username, role }));
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
};

export const isLoggedIn = () => !!getToken();

export const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
};

export const hasRole = (...roles) => {
    const user = getUser();
    return user && roles.includes(user.role);
};