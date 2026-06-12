import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm]       = useState({ username:'', password:'' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) { setError('Enter username and password.'); return; }
    setLoading(true);
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
      <div style={{ minHeight:'100vh', background:'#0d0f14', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ background:'#13161e', border:'1px solid #252a38', borderRadius:14, padding:'40px 36px', width:380 }}>
          <div style={{ marginBottom:28, textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:700, letterSpacing:'0.1em', color:'#e8eaf0', fontFamily:'Albert Sans, sans-serif' }}>
              FRONTLINE
            </div>
            <div style={{ fontSize:10, color:'#6b7280', fontFamily:'monospace', letterSpacing:'0.1em', marginTop:3 }}>
              COMMAND CENTER · V2.0
            </div>
          </div>

          <div style={{ fontSize:16, fontWeight:600, color:'#e8eaf0', marginBottom:4, fontFamily:'Albert Sans, sans-serif' }}>Sign in</div>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:22 }}>Enter your credentials to access the system.</div>

          {error && (
              <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:7, padding:'9px 12px', marginBottom:16, color:'#ef4444', fontSize:12 }}>
                {error}
              </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:10, letterSpacing:'0.1em', color:'#6b7280', fontWeight:700, marginBottom:5, fontFamily:'monospace' }}>USERNAME</label>
              <input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username:e.target.value }))}
                  placeholder="your username"
                  autoComplete="username"
                  style={{ width:'100%', background:'#1a1e28', border:'1px solid #252a38', borderRadius:7, color:'#e8eaf0', fontFamily:'Albert Sans, sans-serif', fontSize:13, padding:'9px 12px', outline:'none', boxSizing:'border-box' }}
              />
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={{ display:'block', fontSize:10, letterSpacing:'0.1em', color:'#6b7280', fontWeight:700, marginBottom:5, fontFamily:'monospace' }}>PASSWORD</label>
              <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password:e.target.value }))}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ width:'100%', background:'#1a1e28', border:'1px solid #252a38', borderRadius:7, color:'#e8eaf0', fontFamily:'Albert Sans, sans-serif', fontSize:13, padding:'9px 12px', outline:'none', boxSizing:'border-box' }}
              />
            </div>

            <button type="submit" disabled={loading}
                    style={{ width:'100%', background: loading?'#1e2330':'#330C89', color:'#fff', border:'none', borderRadius:7, padding:'10px 0', fontSize:13, fontWeight:600, fontFamily:'Albert Sans, sans-serif', cursor: loading?'default':'pointer', letterSpacing:'0.04em' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/*<div style={{ marginTop:20, padding:'10px 12px', background:'#1a1e28', borderRadius:7, fontSize:10, color:'#6b7280', fontFamily:'monospace', lineHeight:1.7 }}>*/}
          {/*  Default logins:<br/>*/}
          {/*  superadmin / superadmin123<br/>*/}
          {/*  admin / admin123<br/>*/}
          {/*  team1 / team123*/}
          {/*</div>*/}
        </div>
      </div>
  );
}