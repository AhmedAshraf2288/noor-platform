import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useReveal } from './shared.jsx';
import { normalizeWhatsApp } from '../countries.js';
import Icon from '../components/Icon.jsx';

export default function Payment({ courseId }) {
  const { t, lang, user, nav } = useApp();
  const [site, setSite] = useState(null);
  const [course, setCourse] = useState(null);
  const [method, setMethod] = useState('instapay');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const [code, setCode] = useState('');
  const [cp, setCp] = useState(null);

  useEffect(() => {
    if (!user) { nav('/login'); return; }
    Promise.all([api.get('/api/site'), api.get(`/api/courses/${courseId}`)])
      .then(([s, c]) => { setSite(s); setCourse(c); })
      .catch((e) => setErr(e.message));
  }, [user, courseId]);
  useReveal(course);

  if (!user) return null;
  if (!site || !course) return <section className="page-head"><div className="container"><h1>...</h1></div></section>;

  const c = course.course;
  const title = lang === 'ar' ? c.titleAr : (c.titleEn || c.titleAr);
  const canPay = user.role === 'admin' || user.active;

  const waText = encodeURIComponent(lang === 'ar'
    ? `أهلاً، أنا ${user.name}. دفعت اشتراك "${c.titleAr}" بمبلغ ${cp ? cp.final : c.price} جنيه عن طريق ${method === 'instapay' ? 'انستاباي' : 'المحفظة الإلكترونية'}، وده إثبات التحويل:`
    : `Hi, I'm ${user.name}. I paid ${c.price} EGP for "${c.titleEn || c.titleAr}" via ${method}, here is my proof:`);
  // Normalize the saved international number (admin picks country code + types the number in settings)
  const waNumber = normalizeWhatsApp(site.whatsapp);
  const waLink = `https://wa.me/${waNumber}?text=${waText}`;

  const copy = async (val, key) => {
    try { await navigator.clipboard.writeText(val); } catch { /* clipboard may be unavailable */ }
    setCopied(key); setTimeout(() => setCopied(''), 1500);
  };

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await api.post('/api/requests', { courseId: Number(courseId), method, couponCode: cp ? code : '' });
      setDone(true);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <>
      <section className="page-head"><div className="container">
        <h1><span className="g1">{lang === 'ar' ? 'طرق' : 'Payment'}</span> <span className="g2">{lang === 'ar' ? 'الدفع' : 'Methods'}</span></h1>
        <p className="sub">{t('paymentSub')}</p>
      </div></section>
      <section className="page-sec" style={{ paddingTop: 0 }}><div className="container">
        {!canPay && <div className="msg-err rv in">{t('accountNotActive')}</div>}
        {err && <div className="msg-err rv in">{err}</div>}
        <div className="two-col" style={{ marginTop: 0 }}>
          <div>
            <div className="panel rv"><h2><Icon name="wallet" size={18} /> {lang === 'ar' ? 'الكورس المختار' : 'Selected course'}</h2>
              <div className="my-course"><span className={`mc-ic ${c.theme}`}><Icon name={c.icon} size={26} /></span>
                <div className="mc-b"><div className="mc-t">{title}</div><div className="mc-m">{course.lessons.length} {t('lessons')}</div></div>
                <span className="price-pill"><span className="num">{c.price}</span><span className="cur">{t('currency')}</span></span></div>
            </div>
            <div className="panel rv"><h2><Icon name="tag" size={18} /> {lang === 'ar' ? 'كود خصم' : 'Discount code'}</h2>
              <div className="form-row"><input className="inp grow" dir="ltr" placeholder="CODE" value={code} onChange={(e) => { setCode(e.target.value); setCp(null); }} />
                <button className="mini-btn go" disabled={!code} onClick={() => api.post('/api/coupons/check', { code, courseId: Number(courseId) }).then((r) => { setCp(r); setErr(''); }).catch((e) => { setCp(null); setErr(e.message); })}>{lang === 'ar' ? 'تطبيق' : 'Apply'}</button></div>
              {cp && <div className="msg-ok">{lang === 'ar' ? `خصم ${cp.percent}%: السعر بعد الخصم ${cp.final} جنيه (بدل ${cp.base})` : `${cp.percent}% off: ${cp.final} EGP (was ${cp.base})`}</div>}
            </div>
            <div className="panel rv"><h2><Icon name="bank" size={18} /> {lang === 'ar' ? 'اختر طريقة الدفع' : 'Choose payment method'}</h2>
              <div className="my-course" onClick={() => setMethod('instapay')} style={{ cursor: 'pointer', border: method === 'instapay' ? '2px solid var(--sky)' : '2px solid transparent', borderRadius: 14, padding: 12 }}>
                <span className="mc-ic" style={{ background: 'linear-gradient(135deg,#6D28D9,#A78BFA)' }}><Icon name="zap" size={20} /></span>
                <div className="mc-b"><div className="mc-t">{t('instapay')}</div><div className="mc-m" dir="ltr" style={{ textAlign: 'end' }}>{site.instapay}</div></div>
                <button className="mini-btn go" onClick={(e) => { e.stopPropagation(); copy(site.instapay, 'i'); }}>{copied === 'i' ? t('copied') : t('copy')}</button></div>
              <div className="my-course" onClick={() => setMethod('wallet')} style={{ cursor: 'pointer', border: method === 'wallet' ? '2px solid var(--sky)' : '2px solid transparent', borderRadius: 14, padding: 12 }}>
                <span className="mc-ic" style={{ background: 'linear-gradient(135deg,#B91C1C,#F87171)' }}><Icon name="phone" size={20} /></span>
                <div className="mc-b"><div className="mc-t">{t('wallet')}{site.walletName ? ` (${site.walletName})` : ''}</div><div className="mc-m" dir="ltr" style={{ textAlign: 'end' }}>{site.wallet}</div></div>
                <button className="mini-btn go" onClick={(e) => { e.stopPropagation(); copy(site.wallet, 'w'); }}>{copied === 'w' ? t('copied') : t('copy')}</button></div>
            </div>
            <div className="panel rv" style={{ textAlign: 'center' }}>
              <h2 style={{ justifyContent: 'center' }}><Icon name="phone" size={18} /> {lang === 'ar' ? 'بعد التحويل' : 'After transfer'}</h2>
              <p style={{ color: 'var(--gray)', fontWeight: 700, fontSize: 14, lineHeight: 2, marginBottom: 18 }}>
                {lang === 'ar' ? 'خد سكرين شوت من التحويل وابعته لفريق المبيعات على واتساب، وبعدين أكد طلبك هنا.' : 'Take a screenshot of the transfer, send it to sales on WhatsApp, then confirm your request here.'}
              </p>
              <a className="wa-btn" href={waLink} target="_blank" rel="noreferrer">{t('sendWhatsapp')}</a>
              {done
                ? <div className="tag wait" style={{ marginTop: 14, fontSize: 14, padding: '12px 18px' }}>{t('requestPending')}</div>
                : <button className="auth-btn" style={{ marginTop: 14 }} disabled={busy || !canPay} onClick={submit}>
                    {busy ? '...' : t('confirmRequest')}
                  </button>}
            </div>
          </div>
          <div>
            <div className="side-card rv"><h3><Icon name="list" size={17} /> {t('steps')}</h3>
              <div className="steps">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div className="step" key={n}><span className="snum">{n}</span>
                    <div><b>{t('step' + n)}</b><p>{t('step' + n + 'd')}</p></div></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div></section>
    </>
  );
}
