import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';

const L = (lang, a, e) => (lang === 'ar' ? a : e);

function Chart({ pts, lang }) {
  if (pts.length === 0) return <p className="hint">{L(lang, 'لسه مفيش امتحانات', 'No exams yet')}</p>;
  const W = 300, H = 110, P = 14;
  const xs = (i) => (pts.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (pts.length - 1));
  const ys = (v) => H - P - (v / 100) * (H - 2 * P);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${xs(i)} ${ys(p.pct)}`).join(' ');
  return (
    <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="progress chart">
      {[0, 50, 100].map((g) => <g key={g}><line x1={P} x2={W - P} y1={ys(g)} y2={ys(g)} className="grid" /><text x="2" y={ys(g) + 3} className="axis">{g}</text></g>)}
      <path d={d} className="ln" fill="none" />
      {pts.map((p, i) => <circle key={i} cx={xs(i)} cy={ys(p.pct)} r="4" className="dot"><title>{`${p.lesson}: ${p.pct}%`}</title></circle>)}
    </svg>
  );
}

// Everything extra a student sees on their dashboard
export default function StudentExtras({ lang, courses, user }) {
  const [hist, setHist] = useState([]);
  const [certs, setCerts] = useState({ certificates: [], eligible: [] });
  const [inv, setInv] = useState([]);
  const [refs, setRefs] = useState([]);
  const [prof, setProf] = useState({ governorate: '', school: '', parentPhone: '', parentToken: null });
  const [devs, setDevs] = useState({ devices: [], max: 2 });
  const [msg, setMsg] = useState('');
  const [rf, setRf] = useState({ courseId: '', reason: '' });
  const [saved, setSaved] = useState(false);
  const load = () => {
    api.get('/api/my/exam-history').then((d) => setHist(d.attempts.filter((a) => !a.pending))).catch(() => {});
    api.get('/api/certificates/mine').then(setCerts).catch(() => {});
    api.get('/api/invoices/mine').then((d) => setInv(d.invoices)).catch(() => {});
    api.get('/api/refunds/mine').then((d) => setRefs(d.refunds)).catch(() => {});
    api.get('/api/profile').then(setProf).catch(() => {});
    api.get('/api/devices').then(setDevs).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };
  const origin = window.location.origin;
  const parentUrl = prof.parentToken ? `${origin}/#/parent/${prof.parentToken}` : '';
  const waParent = prof.parentPhone && parentUrl ? `https://wa.me/${prof.parentPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`تقرير متابعة ${user.name} على منصة نور:\n${parentUrl}`)}` : '';
  return (
    <>
      {msg && <div className="msg-ok">{msg}</div>}
      <div className="panel rv"><h2><Icon name="chart" size={18} /> {L(lang, 'تقدمي في الامتحانات', 'My exam progress')}</h2>
        <Chart pts={hist} lang={lang} />
        {hist.length > 0 && <div className="hint">{L(lang, `آخر نتيجة ${hist[hist.length - 1].pct}% · عدد المحاولات ${hist.length}`, `Last ${hist[hist.length - 1].pct}% · ${hist.length} attempts`)}</div>}
        <a className="mini-btn ok" href="#/doc/sheet/me"><Icon name="print" size={12} /> {L(lang, 'كشف الدرجات الرسمي (PDF)', 'Official grade sheet (PDF)')}</a>
      </div>
      <div className="panel rv"><h2><Icon name="award" size={18} /> {L(lang, 'شهاداتي', 'My certificates')}</h2>
        {certs.eligible.map((c) => (<div className="list-row" key={c.id}><div className="lr-main"><b>{c.title_ar}</b><span>{L(lang, 'خلصت الكورس! تقدر تطلع الشهادة', 'Completed! Get your certificate')}</span></div><button className="mini-btn ok" onClick={() => api.post(`/api/courses/${c.id}/certificate`, {}).then(() => { flash('OK'); load(); }).catch((e) => flash(e.message))}>{L(lang, 'إصدار الشهادة', 'Issue')}</button></div>))}
        {certs.certificates.map((c) => (<div className="list-row" key={c.code}><div className="lr-main"><b>{c.title_ar}</b><span>{c.kind === 'excellence' ? L(lang, 'شهادة تفوق', 'Excellence') : L(lang, 'شهادة إتمام', 'Completion')} · {c.pct}%</span></div><a className="mini-btn go" href={`#/doc/cert/${c.code}`}><Icon name="print" size={12} /> PDF</a></div>))}
        {certs.eligible.length === 0 && certs.certificates.length === 0 && <p className="hint">{L(lang, 'خلّص كل دروس كورس وانجح في امتحاناته عشان تاخد شهادة بكود QR للتحقق.', 'Finish a course and pass its exams to earn a QR-verifiable certificate.')}</p>}
      </div>
      <div className="panel rv"><h2><Icon name="file" size={18} /> {L(lang, 'فواتيري', 'My invoices')}</h2>
        {inv.length === 0 && <p className="hint">{L(lang, 'مفيش مشتريات لسه', 'No purchases yet')}</p>}
        {inv.map((i) => <div className="list-row" key={i.id}><div className="lr-main"><b>{i.title_ar}</b><span dir="ltr">{i.no} · {i.amount} EGP</span></div><a className="mini-btn go" href={`#/doc/invoice/${i.id}`}><Icon name="print" size={12} /> PDF</a></div>)}
      </div>
      <div className="panel rv"><h2><Icon name="refresh" size={18} /> {L(lang, 'طلب استرداد', 'Refund request')}</h2>
        <div className="form-row"><select className="inp" value={rf.courseId} onChange={(e) => setRf({ ...rf, courseId: e.target.value })}><option value="">{L(lang, 'اختار الكورس', 'Pick course')}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title_ar}</option>)}</select></div>
        <textarea className="inp grow" rows={2} placeholder={L(lang, 'سبب الاسترداد', 'Reason')} value={rf.reason} onChange={(e) => setRf({ ...rf, reason: e.target.value })} />
        <button className="mini-btn go" style={{ marginTop: 8 }} disabled={!rf.courseId || rf.reason.length < 3} onClick={() => api.post('/api/refunds', { courseId: Number(rf.courseId), reason: rf.reason }).then(() => { setRf({ courseId: '', reason: '' }); flash(L(lang, 'اتبعت الطلب للإدارة', 'Sent to admin')); load(); }).catch((e) => flash(e.message))}>{L(lang, 'إرسال الطلب', 'Send request')}</button>
        {refs.map((r) => <div className="list-row" key={r.id}><div className="lr-main"><b>{r.title_ar}</b></div><span className={`tag ${r.status === 'approved' ? 'ok' : r.status === 'pending' ? 'wait' : 'stop'}`}>{r.status === 'approved' ? L(lang, 'تمت الموافقة', 'Approved') : r.status === 'pending' ? L(lang, 'قيد المراجعة', 'Pending') : L(lang, 'مرفوض', 'Rejected')}</span></div>)}
      </div>
      <div className="panel rv"><h2><Icon name="users" size={18} /> {L(lang, 'ولي الأمر والبيانات', 'Parent and profile')}</h2>
        <div className="form-row"><input className="inp" placeholder={L(lang, 'المحافظة', 'Governorate')} value={prof.governorate} onChange={(e) => setProf({ ...prof, governorate: e.target.value })} />
          <input className="inp" placeholder={L(lang, 'المدرسة', 'School')} value={prof.school} onChange={(e) => setProf({ ...prof, school: e.target.value })} /></div>
        <div className="form-row"><input className="inp grow" dir="ltr" placeholder={L(lang, 'رقم واتساب ولي الأمر (مثال 201012345678)', 'Parent WhatsApp (e.g. 201012345678)')} value={prof.parentPhone} onChange={(e) => setProf({ ...prof, parentPhone: e.target.value })} /></div>
        <button className="mini-btn ok" onClick={() => api.post('/api/profile', { governorate: prof.governorate, school: prof.school, parentPhone: prof.parentPhone }).then(() => { setSaved(true); flash(L(lang, 'اتحفظت البيانات', 'Saved')); })}>{L(lang, 'حفظ', 'Save')}</button>
        <div className="parent-box">
          {!prof.parentToken ? <button className="mini-btn go" onClick={() => api.post('/api/parent/link', { phone: prof.parentPhone }).then(() => load())}><Icon name="link" size={12} /> {L(lang, 'إنشاء رابط متابعة لولي الأمر', 'Create parent progress link')}</button>
            : <><div className="hint" dir="ltr" style={{ wordBreak: 'break-all' }}>{parentUrl}</div>
              <div className="form-row"><a className="mini-btn ok" href={parentUrl}><Icon name="eye" size={12} /> {L(lang, 'معاينة', 'Preview')}</a>
                {waParent ? <a className="mini-btn go" target="_blank" rel="noreferrer" href={waParent}><Icon name="share" size={12} /> {L(lang, 'ابعت التقرير الأسبوعي لولي الأمر', 'Send weekly report to parent')}</a> : <span className="hint">{L(lang, 'اكتب رقم ولي الأمر واحفظ عشان زر واتساب يظهر', 'Save the parent number to enable WhatsApp')}</span>}
                <button className="mini-btn no" onClick={() => api.post('/api/parent/revoke', {}).then(load)}>{L(lang, 'إلغاء الرابط', 'Revoke')}</button></div></>}
        </div>
      </div>
      <div className="panel rv"><h2><Icon name="smartphone" size={18} /> {L(lang, 'أجهزتي', 'My devices')} <span className="more">{devs.devices.length}/{devs.max}</span></h2>
        <p className="hint">{L(lang, 'الحساب بيشتغل على جهازين بحد أقصى. أي دخول من جهاز جديد بيجيلك إشعار.', 'Your account works on 2 devices at most. A new device triggers an alert.')}</p>
        {devs.devices.map((d) => <div className="list-row" key={d.id}><div className="lr-main"><b style={{ fontSize: 13 }}>{(d.ua || '').slice(0, 60) || '-'}</b><span>{L(lang, 'أول دخول', 'First')}: {d.first_seen} · {L(lang, 'آخر', 'Last')}: {d.last_seen}</span></div></div>)}
      </div>
    </>
  );
}
