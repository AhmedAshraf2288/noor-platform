import React, { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import Icon from './Icon.jsx';

// Self-service password change for any logged-in user (student dashboard + admin settings)
export default function ChangePassword() {
  const { t } = useApp();
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      await api.post('/api/auth/change-password', { currentPassword: cur, newPassword: nw });
      setMsg(t('passwordChanged'));
      setCur(''); setNw('');
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div>
      <div className="field"><label>{t('currentPassword')}</label>
        <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} dir="ltr" style={{ textAlign: 'left' }} /></div>
      <div className="field"><label>{t('newPassword')}</label>
        <input type="password" value={nw} onChange={(e) => setNw(e.target.value)} dir="ltr" style={{ textAlign: 'left' }}
          placeholder="8+ • a-z • 0-9" /></div>
      {msg && <div className="msg-ok">{msg}</div>}
      {err && <div className="msg-err">{err}</div>}
      <button className="auth-btn" disabled={busy || !cur || nw.length < 8} onClick={submit}>
        {busy ? '...' : <><Icon name="lock" size={14} /> {t('changePassword')}</>}
      </button>
    </div>
  );
}
