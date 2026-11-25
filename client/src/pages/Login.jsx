import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useReveal } from './shared.jsx';
import Icon from '../components/Icon.jsx';

export default function Login() {
  const { t, setUser, nav, user } = useApp();
  useEffect(() => { if (user) nav(user.role === 'admin' ? '/admin' : '/student'); }, [user]);
  useReveal();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const d = await api.post('/api/auth/login', { email, password });
      setUser(d.user);
      nav(d.user.role === 'admin' ? '/admin' : '/student');
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-form"><form className="auth-box rv" onSubmit={submit}>
        <h1>{t('welcomeBack')}</h1>
        <p className="asub">{t('loginSub')}</p>
        {err && <div className="msg-err">{err}</div>}
        <div className="field"><label>{t('email')}</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@mail.com" dir="ltr" style={{ textAlign: 'left' }} /></div>
        <div className="field"><label>{t('password')}</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" dir="ltr" style={{ textAlign: 'left' }} /></div>
        <button className="auth-btn" disabled={busy}>{busy ? '...' : t('doLogin')}</button>
        <p className="auth-alt">{t('noAccount')} <a href="#/register">{t('register')}</a></p>
      </form></div>
      <div className="auth-panel">
        <span className="deco-c" style={{ width: 340, height: 340, background: 'rgba(53,169,224,.18)', top: -90, right: -90 }}></span>
        <span className="deco-c" style={{ width: 220, height: 220, background: 'rgba(224,82,99,.22)', bottom: 60, left: -60 }}></span>
        <img className="sp" style={{ position: 'absolute', top: 40, left: 40, width: 190, opacity: .5, animation: 'spinSlow 26s linear infinite' }} src="/spiral-square.svg" />
        <div className="big-txt rv rv-d1">{t('heroTitle1')}<br />{t('heroTitle2')} <Icon name="sparkles" size={30} className="inl-ic" /><small>{t('loginSub')}</small></div>
      </div>
    </div>
  );
}
