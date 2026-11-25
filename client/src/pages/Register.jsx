import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useReveal } from './shared.jsx';
import Icon from '../components/Icon.jsx';

const GOVS = ['القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية', 'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء'];
export default function Register() {
  const { t: t0, setUser, nav, user, lang } = useApp();
  const t = (k) => (k === 'gov' ? (lang === 'ar' ? 'المحافظة' : 'Governorate') : t0(k));
  useEffect(() => { if (user) nav(user.role === 'admin' ? '/admin' : '/student'); }, [user]);
  useReveal();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gov, setGov] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const d = await api.post('/api/auth/register', { name, email, password, governorate: gov });
      setUser(d.user);
      setOk(true);
      setTimeout(() => nav('/student'), 1400);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-form"><form className="auth-box rv" onSubmit={submit}>
        <h1>{t('newAccount')}</h1>
        <p className="asub">{t('registerSub')}</p>
        {ok && <div className="msg-ok">{t('accountPendingMsg')}</div>}
        {err && <div className="msg-err">{err}</div>}
        <div className="field"><label>{t('name')}</label><input required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>{t('gov')}</label><select value={gov} onChange={(e) => setGov(e.target.value)}><option value="">-</option>{GOVS.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
        <div className="field"><label>{t('email')}</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@mail.com" dir="ltr" style={{ textAlign: 'left' }} /></div>
        <div className="field"><label>{t('password')}</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" dir="ltr" style={{ textAlign: 'left' }} /></div>
        <button className="auth-btn" disabled={busy}>{busy ? '...' : t('doRegister')}</button>
        <p className="auth-alt">{t('haveAccount')} <a href="#/login">{t('login')}</a></p>
      </form></div>
      <div className="auth-panel">
        <span className="deco-c" style={{ width: 340, height: 340, background: 'rgba(53,169,224,.18)', top: -90, right: -90 }}></span>
        <span className="deco-s" style={{ width: 150, height: 150, background: 'rgba(247,201,72,.2)', bottom: -40, right: 80, transform: 'rotate(20deg)' }}></span>
        <div className="big-txt rv rv-d1">{t('newAccount')} <Icon name="rocket" size={30} className="inl-ic" /><small>{t('registerSub')}</small></div>
      </div>
    </div>
  );
}
