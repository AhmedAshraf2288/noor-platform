import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';

const L = (lang, a, e) => (lang === 'ar' ? a : e);
const isoToLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const localToIso = (v) => (v ? new Date(v).toISOString() : null);
const fmt = (s, lang) => (s ? new Date(s.includes('T') || s.includes('Z') ? s : s.replace(' ', 'T') + 'Z').toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const waLink = (phone, text) => `https://wa.me/${String(phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;

function Bars({ data, k, label, color = 'var(--sky)' }) {
  const max = Math.max(1, ...data.map((d) => d[k]));
  return (
    <div className="bars" role="img" aria-label="chart">
      {data.map((d, i) => (
        <div className="bar-col" key={i}><span className="bar-val">{d[k]}</span><i style={{ height: `${Math.max(4, (d[k] / max) * 100)}%`, background: color }}></i><span className="bar-lbl">{label(d)}</span></div>
      ))}
    </div>
  );
}

/* ---------------- stats dashboard ---------------- */
export function StatsTab({ lang }) {
  const [s, setS] = useState(null);
  useEffect(() => { api.get('/api/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return <div className="panel">...</div>;
  return (
    <div>
      <div className="dash-stats" style={{ marginTop: 0 }}>
        <div className="dstat"><span className="ic g"><Icon name="wallet" size={24} /></span><div><div className="n">{s.revenue}</div><div className="t">{L(lang, 'إجمالي الإيرادات (جنيه)', 'Revenue (EGP)')}</div></div></div>
        <div className="dstat"><span className="ic b"><Icon name="trophy" size={24} /></span><div><div className="n" style={{ fontSize: 18 }}>{s.bestCourse ? s.bestCourse.title : '-'}</div><div className="t">{L(lang, 'الأكثر مبيعاً', 'Best seller')}{s.bestCourse ? ` (${s.bestCourse.sales})` : ''}</div></div></div>
        <div className="dstat"><span className="ic r"><Icon name="users" size={24} /></span><div><div className="n">{s.activeStudents}<small>/{s.students}</small></div><div className="t">{L(lang, 'طلاب نشطين آخر 7 أيام', 'Active last 7 days')}</div></div></div>
        <div className="dstat"><span className="ic v"><Icon name="chart" size={24} /></span><div><div className="n">{s.sales}</div><div className="t">{L(lang, 'عمليات بيع', 'Sales')} · {s.refunds} {L(lang, 'استرداد', 'refunds')}</div></div></div>
      </div>
      <div className="two-col" style={{ marginTop: 18 }}>
        <div className="panel"><h2><Icon name="chart" size={17} /> {L(lang, 'الإيراد آخر 7 أيام', 'Revenue, last 7 days')}</h2><Bars data={s.days} k="revenue" label={(d) => d.day.slice(5)} /></div>
        <div className="panel"><h2><Icon name="users" size={17} /> {L(lang, 'تسجيلات جديدة', 'New signups')}</h2><Bars data={s.days} k="signups" label={(d) => d.day.slice(5)} color="var(--coral)" /></div>
      </div>
      <div className="panel"><h2>{L(lang, 'الإيراد لكل كورس', 'Revenue by course')}</h2>
        {s.byCourse.length === 0 && <p style={{ color: 'var(--gray)', fontWeight: 700 }}>{L(lang, 'لسه مفيش مبيعات', 'No sales yet')}</p>}
        {s.byCourse.map((c, i) => (<div className="rev-row" key={i}><span>{c.title}</span><div className="rev-bar"><i style={{ width: `${(c.revenue / Math.max(1, s.byCourse[0].revenue)) * 100}%` }}></i></div><b>{c.revenue}</b></div>))}
      </div>
    </div>
  );
}

/* ---------------- coupons ---------------- */
export function CouponsTab({ lang, courses, run }) {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ code: '', percent: '10', courseId: '', startsAt: '', endsAt: '' });
  const load = () => api.get('/api/admin/coupons').then((d) => setList(d.coupons));
  useEffect(() => { load(); }, []);
  const add = () => run(api.post('/api/admin/coupons', { code: f.code, percent: Number(f.percent), courseId: f.courseId ? Number(f.courseId) : null, startsAt: localToIso(f.startsAt), endsAt: localToIso(f.endsAt) }).then(() => { setF({ code: '', percent: '10', courseId: '', startsAt: '', endsAt: '' }); load(); }), 'OK');
  return (
    <div className="panel"><h2><Icon name="tag" size={17} /> {L(lang, 'أكواد الخصم', 'Discount codes')}</h2>
      <div className="form-row">
        <input className="inp" dir="ltr" placeholder="CODE10" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        <input className="inp sm" dir="ltr" type="number" min="1" max="100" value={f.percent} onChange={(e) => setF({ ...f, percent: e.target.value })} /> %
        <select className="inp" value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}><option value="">{L(lang, 'كل الكورسات', 'All courses')}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.titleAr}</option>)}</select>
      </div>
      <div className="form-row">
        <label className="lbl">{L(lang, 'من', 'From')}<input className="inp" dir="ltr" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></label>
        <label className="lbl">{L(lang, 'إلى', 'To')}<input className="inp" dir="ltr" type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></label>
        <button className="mini-btn go" disabled={f.code.length < 3} onClick={add}><Icon name="plus" size={12} /> {L(lang, 'إضافة', 'Add')}</button>
      </div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>{L(lang, 'الكود', 'Code')}</th><th>%</th><th>{L(lang, 'الكورس', 'Course')}</th><th>{L(lang, 'الفترة', 'Window')}</th><th>{L(lang, 'استخدام', 'Used')}</th><th></th></tr></thead><tbody>
        {list.map((c) => (<tr key={c.id}><td dir="ltr"><b>{c.code}</b></td><td>{c.percent}%</td><td>{c.course || L(lang, 'الكل', 'All')}</td><td style={{ fontSize: 12 }}>{c.starts_at ? fmt(c.starts_at, lang) : '-'} → {c.ends_at ? fmt(c.ends_at, lang) : '-'}</td><td>{c.used}</td><td><button className="mini-btn no" onClick={() => api.del(`/api/admin/coupons/${c.id}`).then(load)}><Icon name="trash" size={12} /></button></td></tr>))}
      </tbody></table></div>
    </div>
  );
}

/* ---------------- live sessions ---------------- */
export function LiveTab({ lang, courses, run }) {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ courseId: '', title: '', startsAt: '', durationMin: '60', link: '' });
  const [rec, setRec] = useState({});
  const load = () => api.get('/api/admin/live').then((d) => setList(d.sessions));
  useEffect(() => { load(); }, []);
  const add = () => run(api.post('/api/admin/live', { courseId: Number(f.courseId), title: f.title, startsAt: localToIso(f.startsAt), durationMin: Number(f.durationMin), link: f.link }).then(() => { setF({ courseId: '', title: '', startsAt: '', durationMin: '60', link: '' }); load(); }), 'OK');
  return (
    <div className="panel"><h2><Icon name="radio" size={17} /> {L(lang, 'الحصص المباشرة (لايف)', 'Live sessions')}</h2>
      <p className="hint">{L(lang, 'حط رابط الحصة (Zoom / Google Meet / YouTube Live). الرابط بيظهر للطلاب المشتركين قبل الموعد بـ 5 دقايق بس، وبيتبعت تنبيه قبلها بساعة.', 'Paste the session link (Zoom / Meet / YouTube Live). Students enrolled see it 5 minutes before start, with a reminder 1 hour before.')}</p>
      <div className="form-row">
        <select className="inp" value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}><option value="">{L(lang, 'اختار الكورس', 'Pick course')}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.titleAr}</option>)}</select>
        <input className="inp" placeholder={L(lang, 'عنوان الحصة', 'Title')} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </div>
      <div className="form-row">
        <input className="inp" dir="ltr" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
        <input className="inp sm" dir="ltr" type="number" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} /> {L(lang, 'دقيقة', 'min')}
        <input className="inp grow" dir="ltr" placeholder="https://meet.google.com/..." value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
        <button className="mini-btn go" disabled={!f.courseId || !f.title || !f.startsAt || !/^https?:/.test(f.link)} onClick={add}><Icon name="plus" size={12} /> {L(lang, 'جدولة', 'Schedule')}</button>
      </div>
      {list.map((s) => (
        <div className="list-row" key={s.id}>
          <div className="lr-main"><b>{s.title}</b><span>{s.course} · {fmt(s.starts_at, lang)} · {s.duration_min} {L(lang, 'د', 'm')}</span>
            {s.recording && <span className="tag ok"><Icon name="video" size={11} /> {L(lang, 'تم إرفاق التسجيل', 'Recording attached')}</span>}</div>
          <div className="lr-act">
            <input className="inp" dir="ltr" placeholder={L(lang, 'رابط التسجيل بعد الحصة', 'Recording link')} value={rec[s.id] || ''} onChange={(e) => setRec({ ...rec, [s.id]: e.target.value })} />
            <button className="mini-btn ok" disabled={!/^https?:/.test(rec[s.id] || '')} onClick={() => run(api.post(`/api/admin/live/${s.id}/recording`, { link: rec[s.id] }).then(load), 'OK')}>{L(lang, 'حفظ التسجيل', 'Save recording')}</button>
            <button className="mini-btn no" onClick={() => api.del(`/api/admin/live/${s.id}`).then(load)}><Icon name="trash" size={12} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- refunds ---------------- */
export function RefundsTab({ lang, run }) {
  const [list, setList] = useState([]);
  const load = () => api.get('/api/admin/refunds').then((d) => setList(d.refunds));
  useEffect(() => { load(); }, []);
  return (
    <div className="panel"><h2><Icon name="refresh" size={17} /> {L(lang, 'طلبات الاسترداد', 'Refund requests')}</h2>
      <p className="hint">{L(lang, 'الموافقة بتقفل الكورس للطالب. رجّع الفلوس بنفسك على نفس وسيلة الدفع (يدوي).', 'Approving closes the course for the student. Return the money manually via the same payment method.')}</p>
      {list.length === 0 && <p style={{ color: 'var(--gray)', fontWeight: 700 }}>{L(lang, 'مفيش طلبات', 'No requests')}</p>}
      {list.map((r) => (
        <div className="list-row" key={r.id}>
          <div className="lr-main"><b>{r.name}</b><span>{r.title_ar} · {fmt(r.created_at, lang)}</span><span>{r.reason}</span></div>
          <div className="lr-act">{r.status === 'pending' ? <><button className="mini-btn ok" onClick={() => run(api.post(`/api/admin/refunds/${r.id}/decide`, { approve: true }).then(load), 'OK')}>{L(lang, 'موافقة', 'Approve')}</button><button className="mini-btn no" onClick={() => run(api.post(`/api/admin/refunds/${r.id}/decide`, { approve: false }).then(load), 'OK')}>{L(lang, 'رفض', 'Reject')}</button></> : <span className={`tag ${r.status === 'approved' ? 'ok' : 'stop'}`}>{r.status === 'approved' ? L(lang, 'تمت الموافقة', 'Approved') : L(lang, 'مرفوض', 'Rejected')}</span>}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- essay grading ---------------- */
export function GradingTab({ lang, run }) {
  const [list, setList] = useState([]);
  const [pts, setPts] = useState({});
  const [cm, setCm] = useState({});
  const load = () => api.get('/api/admin/grading').then((d) => setList(d.attempts));
  useEffect(() => { load(); }, []);
  return (
    <div className="panel"><h2><Icon name="edit" size={17} /> {L(lang, 'تصحيح الأسئلة المقالية', 'Essay grading')}</h2>
      {list.length === 0 && <p style={{ color: 'var(--gray)', fontWeight: 700 }}>{L(lang, 'مفيش إجابات مقالية مستنية تصحيح', 'Nothing waiting for grading')}</p>}
      {list.map((a) => (
        <div className="q-card" key={a.id}>
          <b>{a.student} · {a.lesson}</b>
          {a.essays.map((e) => (
            <div key={e.id} style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 800 }}>{e.q}</div>
              <div className="essay-ans">{e.your || L(lang, '(بدون إجابة)', '(no answer)')}</div>
              <label className="lbl">{L(lang, 'الدرجة من', 'Grade out of')} {e.points}<input className="inp sm" type="number" min="0" max={e.points} step="0.5" dir="ltr" value={pts[`${a.id}-${e.id}`] ?? ''} onChange={(ev) => setPts({ ...pts, [`${a.id}-${e.id}`]: ev.target.value })} /></label>
            </div>
          ))}
          <input className="inp grow" style={{ marginTop: 10 }} placeholder={L(lang, 'تعليقك للطالب', 'Comment for the student')} value={cm[a.id] || ''} onChange={(e) => setCm({ ...cm, [a.id]: e.target.value })} />
          <button className="mini-btn ok" style={{ marginTop: 10 }} onClick={() => run(api.post(`/api/admin/attempts/${a.id}/grade`, { points: Object.fromEntries(a.essays.map((e) => [String(e.id), Number(pts[`${a.id}-${e.id}`] || 0)])), comment: cm[a.id] || '' }).then(load), L(lang, 'تم التصحيح', 'Graded'))}><Icon name="check" size={12} /> {L(lang, 'حفظ التصحيح', 'Save grade')}</button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- tools: activity, backup, maintenance, theme, import, report, paths, faq, broadcast, absentees, mods ---------------- */
export function ToolsTab({ lang, courses, students, run }) {
  const [ss, setSs] = useState(null);
  const [act, setAct] = useState([]);
  const [csv, setCsv] = useState('');
  const [imp, setImp] = useState(null);
  const [paths, setPaths] = useState([]);
  const [pf, setPf] = useState({ title: '', ids: [] });
  const [faqs, setFaqs] = useState([]);
  const [ff, setFf] = useState({ q: '', a: '', keywords: '' });
  const [bc, setBc] = useState({ title: '', body: '' });
  const [abs, setAbs] = useState([]);
  const [rep, setRep] = useState([]);
  const load = () => {
    api.get('/api/admin/site-settings').then(setSs);
    api.get('/api/admin/activity').then((d) => setAct(d.items));
    api.get('/api/admin/paths').then((d) => setPaths(d.paths));
    api.get('/api/public/faq').then((d) => setFaqs(d.items));
    api.get('/api/admin/absentees').then((d) => setAbs(d.items));
    api.get('/api/admin/report').then((d) => setRep(d.items));
  };
  useEffect(() => { load(); }, []);
  if (!ss) return <div className="panel">...</div>;
  const saveSS = (patch) => run(api.post('/api/admin/site-settings', patch).then(() => { setSs({ ...ss, ...patch }); window.dispatchEvent(new Event('noor-theme')); load(); }), 'OK');
  const readFile = (f) => { if (!f) return; const r = new FileReader(); r.onload = () => setCsv(String(r.result)); r.readAsText(f); };
  return (
    <div>
      <div className="two-col" style={{ marginTop: 0 }}>
        <div className="panel"><h2><Icon name="settings" size={17} /> {L(lang, 'وضع الصيانة', 'Maintenance mode')}</h2>
          <label className="switch-row"><input type="checkbox" checked={ss.maintenance} onChange={(e) => saveSS({ maintenance: e.target.checked })} /> {L(lang, 'تفعيل وضع الصيانة (الطلاب بيشوفوا رسالة بس)', 'Enable (students see a message only)')}</label>
          <textarea className="inp grow" rows={2} placeholder={L(lang, 'رسالة الصيانة', 'Message')} value={ss.maintenanceMsg} onChange={(e) => setSs({ ...ss, maintenanceMsg: e.target.value })} />
          <button className="mini-btn go" style={{ marginTop: 8 }} onClick={() => saveSS({ maintenanceMsg: ss.maintenanceMsg })}>{L(lang, 'حفظ الرسالة', 'Save message')}</button>
          <h2 style={{ marginTop: 24 }}><Icon name="trophy" size={17} /> {L(lang, 'لوحة الشرف', 'Honor board')}</h2>
          <label className="switch-row"><input type="checkbox" checked={ss.leaderboardOn} onChange={(e) => saveSS({ leaderboardOn: e.target.checked })} /> {L(lang, 'إظهار لوحة شرف الفوانيس للطلاب', 'Show the lantern honor board')}</label>
          <h2 style={{ marginTop: 24 }}><Icon name="download" size={17} /> {L(lang, 'نسخة احتياطية', 'Backup')}</h2>
          <a className="mini-btn ok" href="/api/admin/backup"><Icon name="download" size={12} /> {L(lang, 'تحميل نسخة من قاعدة البيانات', 'Download database backup')}</a>
        </div>
        <div className="panel"><h2><Icon name="palette" size={17} /> {L(lang, 'ألوان وشعار الموقع', 'Site colors and logo')}</h2>
          <div className="form-row"><label className="lbl">{L(lang, 'اللون الأساسي', 'Primary')}<input type="color" value={ss.primary || '#43798e'} onChange={(e) => setSs({ ...ss, primary: e.target.value })} /></label>
            <label className="lbl">{L(lang, 'لون التمييز', 'Accent')}<input type="color" value={ss.accent || '#35a9e0'} onChange={(e) => setSs({ ...ss, accent: e.target.value })} /></label>
            <button className="mini-btn go" onClick={() => saveSS({ primary: ss.primary || '', accent: ss.accent || '' })}>{L(lang, 'تطبيق', 'Apply')}</button>
            <button className="mini-btn no" onClick={() => { saveSS({ primary: '', accent: '' }); setSs({ ...ss, primary: '', accent: '' }); }}>{L(lang, 'الافتراضي', 'Reset')}</button></div>
          <div className="form-row"><label className="mini-btn go" style={{ cursor: 'pointer' }}><Icon name="upload" size={12} /> {L(lang, 'رفع شعار', 'Upload logo')}<input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => { const fd = new FormData(); fd.append('logo', e.target.files[0]); run(api.postForm('/api/admin/logo', fd).then(() => { window.dispatchEvent(new Event('noor-theme')); load(); }), 'OK'); }} /></label>
            {ss.hasLogo && <button className="mini-btn no" onClick={() => run(api.del('/api/admin/logo').then(() => { window.dispatchEvent(new Event('noor-theme')); load(); }), 'OK')}>{L(lang, 'حذف الشعار', 'Remove logo')}</button>}</div>
          <h2 style={{ marginTop: 24 }}><Icon name="bell" size={17} /> {L(lang, 'إشعار لكل الطلاب', 'Broadcast')}</h2>
          <input className="inp grow" placeholder={L(lang, 'العنوان', 'Title')} value={bc.title} onChange={(e) => setBc({ ...bc, title: e.target.value })} />
          <input className="inp grow" style={{ marginTop: 8 }} placeholder={L(lang, 'التفاصيل (اختياري)', 'Details')} value={bc.body} onChange={(e) => setBc({ ...bc, body: e.target.value })} />
          <button className="mini-btn go" style={{ marginTop: 8 }} disabled={bc.title.length < 2} onClick={() => run(api.post('/api/admin/broadcast', bc).then(() => setBc({ title: '', body: '' })), 'OK')}>{L(lang, 'إرسال', 'Send')}</button>
        </div>
      </div>

      <div className="panel"><h2><Icon name="users" size={17} /> {L(lang, 'استيراد طلاب من ملف', 'Bulk import students')}</h2>
        <p className="hint">{L(lang, 'ملف CSV بالأعمدة: الاسم، الإيميل، كلمة السر (اختياري)، المحافظة (اختياري). من الإكسيل: حفظ باسم ← CSV. الحسابات بتتفعل تلقائياً.', 'CSV with columns: name, email, password (optional), governorate (optional). From Excel: Save As CSV. Accounts are auto-activated.')}</p>
        <div className="form-row"><label className="mini-btn go" style={{ cursor: 'pointer' }}><Icon name="upload" size={12} /> {L(lang, 'اختار ملف CSV', 'Choose CSV')}<input type="file" accept=".csv,text/csv,text/plain" style={{ display: 'none' }} onChange={(e) => readFile(e.target.files[0])} /></label>
          <button className="mini-btn ok" disabled={!csv} onClick={() => run(api.post('/api/admin/students/import', { csv }).then((d) => { setImp(d); setCsv(''); }), 'OK')}>{L(lang, 'استيراد', 'Import')}</button></div>
        <textarea className="inp grow" rows={3} dir="ltr" placeholder={'Ahmed Ali,ahmed@mail.com,,Cairo'} value={csv} onChange={(e) => setCsv(e.target.value)} />
        {imp && <div className="msg-ok">{L(lang, `تم إنشاء ${imp.created.length} طالب`, `${imp.created.length} students created`)}{imp.skipped.length > 0 && ` · ${L(lang, 'تخطي', 'skipped')} ${imp.skipped.length}`}
          {imp.created.length > 0 && <div className="tbl-wrap"><table className="tbl"><tbody>{imp.created.map((c) => <tr key={c.email}><td>{c.name}</td><td dir="ltr">{c.email}</td><td dir="ltr"><b>{c.password}</b></td></tr>)}</tbody></table></div>}</div>}
      </div>

      <div className="panel"><h2><Icon name="chart" size={17} /> {L(lang, 'تقارير الطلاب', 'Student reports')} <a className="mini-btn ok more" href="/api/admin/report.csv"><Icon name="download" size={12} /> {L(lang, 'تصدير Excel', 'Export Excel')}</a></h2>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>{L(lang, 'الطالب', 'Student')}</th><th>{L(lang, 'الكورس', 'Course')}</th><th>{L(lang, 'الدروس', 'Lessons')}</th><th>{L(lang, 'متوسط الدرجات', 'Avg grade')}</th></tr></thead><tbody>
          {rep.slice(0, 40).map((r, i) => <tr key={i}><td>{r.student}</td><td>{r.course}</td><td>{r.watched}/{r.total}</td><td>{r.avg ? r.avg + '%' : '-'}</td></tr>)}
        </tbody></table></div></div>

      <div className="two-col">
        <div className="panel"><h2><Icon name="grad" size={17} /> {L(lang, 'مسارات التعلم', 'Learning paths')}</h2>
          <input className="inp grow" placeholder={L(lang, 'اسم المسار', 'Path title')} value={pf.title} onChange={(e) => setPf({ ...pf, title: e.target.value })} />
          <div className="chips">{courses.map((c) => <button key={c.id} className={`chip ${pf.ids.includes(c.id) ? 'on' : ''}`} onClick={() => setPf({ ...pf, ids: pf.ids.includes(c.id) ? pf.ids.filter((x) => x !== c.id) : [...pf.ids, c.id] })}>{pf.ids.includes(c.id) ? pf.ids.indexOf(c.id) + 1 + '. ' : ''}{c.titleAr}</button>)}</div>
          <p className="hint">{L(lang, 'الترتيب حسب ترتيب اختيارك للكورسات.', 'Order follows the order you tap.')}</p>
          <button className="mini-btn go" disabled={!pf.title || !pf.ids.length} onClick={() => run(api.post('/api/admin/paths', { title: pf.title, courseIds: pf.ids }).then(() => { setPf({ title: '', ids: [] }); load(); }), 'OK')}>{L(lang, 'إنشاء المسار', 'Create path')}</button>
          {paths.map((p) => <div className="list-row" key={p.id}><div className="lr-main"><b>{p.title}</b><span>{p.courseIds.length} {L(lang, 'كورس', 'courses')}</span></div><button className="mini-btn no" onClick={() => api.del(`/api/admin/paths/${p.id}`).then(load)}><Icon name="trash" size={12} /></button></div>)}
        </div>
        <div className="panel"><h2><Icon name="msg" size={17} /> {L(lang, 'أسئلة البوت الشائعة (FAQ)', 'FAQ bot answers')}</h2>
          <input className="inp grow" placeholder={L(lang, 'السؤال', 'Question')} value={ff.q} onChange={(e) => setFf({ ...ff, q: e.target.value })} />
          <textarea className="inp grow" rows={2} style={{ marginTop: 8 }} placeholder={L(lang, 'الإجابة', 'Answer')} value={ff.a} onChange={(e) => setFf({ ...ff, a: e.target.value })} />
          <input className="inp grow" style={{ marginTop: 8 }} placeholder={L(lang, 'كلمات مفتاحية (اختياري)', 'Keywords')} value={ff.keywords} onChange={(e) => setFf({ ...ff, keywords: e.target.value })} />
          <button className="mini-btn go" style={{ marginTop: 8 }} disabled={ff.q.length < 3 || ff.a.length < 2} onClick={() => run(api.post('/api/admin/faq', ff).then(() => { setFf({ q: '', a: '', keywords: '' }); load(); }), 'OK')}>{L(lang, 'إضافة', 'Add')}</button>
          {faqs.map((f) => <div className="list-row" key={f.id}><div className="lr-main"><b>{f.q}</b></div><button className="mini-btn no" onClick={() => api.del(`/api/admin/faq/${f.id}`).then(load)}><Icon name="trash" size={12} /></button></div>)}
        </div>
      </div>

      <div className="panel"><h2><Icon name="warn" size={17} /> {L(lang, 'الغياب عن الامتحانات (تنبيه ولي الأمر)', 'Exam absentees (parent alert)')}</h2>
        <p className="hint">{L(lang, 'طلاب قفل امتحانهم ومحاولوش. اضغط "واتساب" عشان تبعت لولي الأمر رسالة جاهزة (من غير أي خدمة مدفوعة).', 'Students who never took a closed exam. Tap WhatsApp to message the parent with a ready text (no paid service).')}</p>
        {abs.length === 0 && <p style={{ color: 'var(--gray)', fontWeight: 700 }}>{L(lang, 'لا يوجد غياب', 'No absences')}</p>}
        {abs.slice(0, 20).map((a, i) => <div className="list-row" key={i}><div className="lr-main"><b>{a.name}</b><span>{a.lesson}</span></div>
          {a.parent_phone ? <a className="mini-btn ok" target="_blank" rel="noreferrer" href={waLink(a.parent_phone, `السلام عليكم، نفيد حضرتك بأن الطالب ${a.name} لم يدخل امتحان "${a.lesson}" في موعده. منصة نور.`)}>{L(lang, 'واتساب لولي الأمر', 'WhatsApp parent')}</a> : <span className="tag wait">{L(lang, 'مفيش رقم ولي أمر', 'No parent phone')}</span>}</div>)}
      </div>

      <div className="panel"><h2><Icon name="list" size={17} /> {L(lang, 'سجل نشاط الإدارة', 'Admin activity log')}</h2>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>{L(lang, 'الوقت', 'Time')}</th><th>{L(lang, 'المسؤول', 'By')}</th><th>{L(lang, 'الإجراء', 'Action')}</th></tr></thead><tbody>
          {act.map((a) => <tr key={a.id}><td style={{ fontSize: 12 }}>{fmt(a.created_at, lang)}</td><td>{a.actor_name}</td><td>{a.action} <span style={{ color: 'var(--gray)', fontSize: 12 }}>{/^(POST|PUT|DELETE)/.test(a.detail) ? '' : a.detail}</span></td></tr>)}
        </tbody></table></div></div>
    </div>
  );
}

/* ---------------- per-student extras: ban, moderator, devices, grade sheet ---------------- */
export function StudentExtra({ s, ex, lang, run }) {
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  if (!ex) return null;
  return (
    <div className="stu-extra">
      <button className="mini-btn go" onClick={() => setOpen(!open)}><Icon name="settings" size={12} /> {L(lang, 'المزيد', 'More')}</button>
      {ex.banned ? <span className="tag stop"><Icon name="ban" size={11} /> {L(lang, 'موقوف', 'Banned')}{ex.ban_reason ? `: ${ex.ban_reason}` : ''}</span> : null}
      {ex.is_mod ? <span className="tag go">{L(lang, 'مشرف', 'Moderator')}</span> : null}
      {open && (
        <div className="stu-more">
          <div className="form-row"><input className="inp grow" placeholder={L(lang, 'سبب الإيقاف', 'Reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
            {ex.banned
              ? <button className="mini-btn ok" onClick={() => run(api.post(`/api/admin/students/${s.id}/ban`, { banned: false }), 'OK')}>{L(lang, 'إلغاء الإيقاف', 'Unban')}</button>
              : <button className="mini-btn no" onClick={() => run(api.post(`/api/admin/students/${s.id}/ban`, { banned: true, reason }), 'OK')}><Icon name="ban" size={12} /> {L(lang, 'إيقاف الطالب', 'Ban')}</button>}</div>
          <div className="form-row">
            <button className="mini-btn go" onClick={() => run(api.post(`/api/admin/students/${s.id}/mod`, { mod: !ex.is_mod }), 'OK')}>{ex.is_mod ? L(lang, 'إلغاء المشرف', 'Remove moderator') : L(lang, 'تعيين مشرف (يرد على الأسئلة فقط)', 'Make moderator (answers questions only)')}</button>
            <button className="mini-btn go" onClick={() => run(api.post(`/api/admin/students/${s.id}/devices/reset`, {}), 'OK')}><Icon name="smartphone" size={12} /> {L(lang, `إعادة ضبط الأجهزة (${ex.devices}/2)`, `Reset devices (${ex.devices}/2)`)}</button>
            <a className="mini-btn ok" href={`#/doc/sheet/${s.id}`}><Icon name="print" size={12} /> {L(lang, 'كشف الدرجات', 'Grade sheet')}</a>
          </div>
          <div className="hint">{ex.governorate || '-'} · {ex.school || '-'} · {L(lang, 'آخر ظهور', 'Last seen')}: {ex.last_seen ? fmt(ex.last_seen, lang) : '-'}</div>
        </div>
      )}
    </div>
  );
}

/* ---------------- lesson tools: notes, files, analytics ---------------- */
export function LessonTools({ lesson, lang, run }) {
  const [notes, setNotes] = useState(null);
  const [files, setFiles] = useState([]);
  const [an, setAn] = useState(null);
  const load = () => {
    api.get(`/api/admin/lessons/${lesson.id}/notes`).then((d) => setNotes(d.notes));
    api.get(`/api/lessons/${lesson.id}/files`).then((d) => setFiles(d.files)).catch(() => {});
    api.get(`/api/admin/lessons/${lesson.id}/analytics`).then(setAn).catch(() => {});
  };
  useEffect(() => { load(); }, [lesson.id]);
  if (notes === null) return <div style={{ padding: 12 }}>...</div>;
  const mm = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return (
    <div className="exam-editor">
      <h3><Icon name="file" size={16} /> {L(lang, 'ملخص الدرس (بيستخدمه الملخص التلقائي والمساعد وتوليد الأسئلة)', 'Lesson notes (used by auto-summary, assistant and practice questions)')}</h3>
      <textarea className="inp grow" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={L(lang, 'اكتب شرح الدرس في جمل واضحة...', 'Write the lesson explanation in clear sentences...')} />
      <button className="mini-btn ok" style={{ margin: '8px 0 16px' }} onClick={() => run(api.put(`/api/admin/lessons/${lesson.id}/notes`, { notes }), 'OK')}><Icon name="save" size={12} /> {L(lang, 'حفظ الملخص', 'Save notes')}</button>
      <h3><Icon name="download" size={16} /> {L(lang, 'ملفات الدرس (PDF / ملازم)', 'Lesson files (PDF / notes)')}</h3>
      {files.map((f) => <div className="list-row" key={f.id}><div className="lr-main"><b>{f.orig_name}</b><span>{Math.round(f.size / 1024)} KB</span></div><button className="mini-btn no" onClick={() => api.del(`/api/files/${f.id}`).then(load)}><Icon name="trash" size={12} /></button></div>)}
      <label className="mini-btn go" style={{ cursor: 'pointer' }}><Icon name="upload" size={12} /> {L(lang, 'رفع ملف', 'Upload file')}<input type="file" style={{ display: 'none' }} onChange={(e) => { const fd = new FormData(); fd.append('file', e.target.files[0]); run(api.postForm(`/api/lessons/${lesson.id}/files`, fd).then(load), 'OK'); e.target.value = ''; }} /></label>
      <h3 style={{ marginTop: 18 }}><Icon name="chart" size={16} /> {L(lang, 'إحصائيات مشاهدة الدرس', 'Watch statistics')}</h3>
      {an && an.viewers > 0 ? (<>
        <div className="hint">{L(lang, `${an.viewers} مشاهد · متوسط وقت المشاهدة ${mm(an.avgWatchSec)} من ${mm(an.durSec)}`, `${an.viewers} viewers · avg watch ${mm(an.avgWatchSec)} of ${mm(an.durSec)}`)}</div>
        <div className="hint">{L(lang, 'أين توقف الطلاب (كل عمود = 10% من الفيديو):', 'Where viewers stopped (each bar = 10% of the video):')}</div>
        <Bars data={an.stopBuckets.map((v, i) => ({ v, i }))} k="v" label={(d) => `${d.i * 10}%`} color="var(--coral)" />
      </>) : <div className="hint">{L(lang, 'لسه مفيش بيانات مشاهدة.', 'No watch data yet.')}</div>}
    </div>
  );
}

/* ---------------- exam editor (question bank with 5 types) ---------------- */
const TYPES = [['mcq', 'اختيار من متعدد', 'Multiple choice'], ['tf', 'صح / غلط', 'True / False'], ['essay', 'مقالي', 'Essay'], ['order', 'ترتيب', 'Ordering'], ['match', 'توصيل', 'Matching']];
const blankQ = (type = 'mcq') => ({ type, q: '', options: ['', '', '', ''], correct: 0, items: ['', '', ''], pairs: [['', ''], ['', '']], model: '', points: 1, image: null });

export function ExamEditor({ lessonId, lang, run, close }) {
  const [qs, setQs] = useState(null);
  const [openAt, setOpenAt] = useState('');
  const [closeAt, setCloseAt] = useState('');
  const [dur, setDur] = useState('');
  const [maxAtt, setMaxAtt] = useState('');
  const [locks, setLocks] = useState([]);
  const loadLocks = () => api.get(`/api/admin/lessons/${lessonId}/exam/locks`).then((d) => setLocks(d.locked)).catch(() => {});
  useEffect(() => { loadLocks(); }, [lessonId]);
  useEffect(() => {
    api.get(`/api/admin/lessons/${lessonId}/exam`).then((d) => {
      const list = d.questions.map((q) => ({ ...blankQ(q.type), ...q, options: q.type === 'mcq' ? q.options : ['', '', '', ''] }));
      while (list.length < 5) list.push(blankQ());
      setQs(list); setOpenAt(isoToLocal(d.openAt)); setCloseAt(isoToLocal(d.closeAt)); setDur(d.durationMin ? String(d.durationMin) : ''); setMaxAtt(d.maxAttempts ? String(d.maxAttempts) : '');
    }).catch(() => setQs(Array.from({ length: 5 }, () => blankQ())));
  }, [lessonId]);
  if (!qs) return <div style={{ padding: 14 }}>...</div>;
  const set = (i, patch) => setQs((a) => a.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const filled = (q) => {
    if (q.q.trim().length < 2) return false;
    if (q.type === 'mcq') return q.options.every((o) => o.trim()) && q.options[q.correct];
    if (q.type === 'order') return q.items.filter((x) => x.trim()).length >= 2;
    if (q.type === 'match') return q.pairs.filter((p) => p[0].trim() && p[1].trim()).length >= 2;
    return true;
  };
  const used = qs.filter((q) => q.q.trim());
  const timesOk = !!(openAt && closeAt && Number(dur) >= 1 && new Date(closeAt) > new Date(openAt));
  const valid = timesOk && used.length >= 5 && used.every(filled);
  const save = () => {
    const payload = used.map((q) => ({ type: q.type, q: q.q.trim(), options: q.type === 'mcq' ? q.options.map((o) => o.trim()) : [], correct: q.correct, items: q.items.map((x) => x.trim()).filter(Boolean), pairs: q.pairs.filter((p) => p[0].trim() && p[1].trim()).map((p) => [p[0].trim(), p[1].trim()]), model: q.model, points: Number(q.points) || 1, image: q.image }));
    run(api.put(`/api/admin/lessons/${lessonId}/exam`, { questions: payload, openAt: localToIso(openAt), closeAt: localToIso(closeAt), durationMin: Number(dur), maxAttempts: maxAtt ? Number(maxAtt) : null }), lang === 'ar' ? 'الامتحان اتحفظ' : 'Saved');
    close();
  };
  const upImg = (i, f) => { if (!f) return; const fd = new FormData(); fd.append('image', f); api.postForm('/api/admin/question-image', fd).then((d) => set(i, { image: d.name })).catch(() => {}); };
  return (
    <div className="exam-editor">
      <h3><Icon name="quiz" size={17} /> {L(lang, 'بنك أسئلة الدرس', 'Lesson question bank')}</h3>
      <p className="hint">{L(lang, 'ضيف أسئلة كتير (5 على الأقل). كل طالب بيطلعله 5 أسئلة عشوائية، وترتيب الأسئلة والاختيارات بيختلف من طالب للتاني. اكتب المعادلات بين علامتي $ مثل $x^2+1$.', 'Add many questions (min 5). Each student gets 5 random ones, in random order. Write math between $ signs, e.g. $x^2+1$.')}</p>
      <div className="exam-sched">
        <label>{L(lang, 'يفتح في', 'Opens')}<input className="inp" type="datetime-local" dir="ltr" value={openAt} onChange={(e) => setOpenAt(e.target.value)} /></label>
        <label>{L(lang, 'يقفل في', 'Closes')}<input className="inp" type="datetime-local" dir="ltr" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} /></label>
        <label>{L(lang, 'المدة (دقيقة)', 'Minutes')}<input className="inp sm" type="number" min="1" dir="ltr" value={dur} onChange={(e) => setDur(e.target.value)} /></label>
        <label>{L(lang, 'أقصى عدد محاولات', 'Max attempts')}<input className="inp sm" type="number" min="1" dir="ltr" placeholder="∞" value={maxAtt} onChange={(e) => setMaxAtt(e.target.value)} /></label>
      </div>
      <div className="lock-box"><b><Icon name="lock" size={14} /> {L(lang, 'طلاب الامتحان مقفول عليهم', 'Locked students')}</b>
        {locks.length === 0 ? <span className="lock-none">{L(lang, 'مفيش', 'None')}</span> : locks.map((u) => (<div className="lock-row" key={u.id}><span>{u.name}</span><button className="mini-btn ok" onClick={() => api.post(`/api/admin/lessons/${lessonId}/exam/unlock`, { userId: u.id }).then(loadLocks)}>{L(lang, 'إعادة فتح', 'Reopen')}</button></div>))}</div>
      {qs.map((q, i) => (
        <div className="q-card" key={i}>
          <div className="q-head"><b>{L(lang, 'سؤال', 'Q')} {i + 1}</b>
            <select className="inp" value={q.type} onChange={(e) => set(i, { type: e.target.value })}>{TYPES.map((t) => <option key={t[0]} value={t[0]}>{L(lang, t[1], t[2])}</option>)}</select>
            <label className="lbl">{L(lang, 'درجات', 'Pts')}<input className="inp sm" type="number" min="1" max="10" dir="ltr" value={q.points} onChange={(e) => set(i, { points: e.target.value })} /></label>
            <button className="mini-btn no" onClick={() => setQs((a) => a.filter((_, j) => j !== i))}><Icon name="x" size={12} /></button></div>
          <textarea className="inp grow" rows={2} placeholder={L(lang, 'نص السؤال (ينفع LaTeX بين $ $)', 'Question text (LaTeX between $ $)')} value={q.q} onChange={(e) => set(i, { q: e.target.value })} />
          <div className="form-row">
            <label className="mini-btn go" style={{ cursor: 'pointer' }}><Icon name="image" size={12} /> {q.image ? L(lang, 'تغيير الصورة', 'Change image') : L(lang, 'صورة للسؤال', 'Add image')}<input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => { upImg(i, e.target.files[0]); e.target.value = ''; }} /></label>
            {q.image && <><img className="q-thumb" src={`/api/question-image/${q.image}`} alt="" /><button className="mini-btn no" onClick={() => set(i, { image: null })}><Icon name="trash" size={12} /></button></>}
          </div>
          {q.type === 'mcq' && <div className="opt-grid">{q.options.map((o, oi) => (<label className={`opt-row ${q.correct === oi ? 'on' : ''}`} key={oi}><input type="radio" checked={q.correct === oi} onChange={() => set(i, { correct: oi })} /><input className="bare" placeholder={`${L(lang, 'اختيار', 'Option')} ${oi + 1}`} value={o} onChange={(e) => set(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} />{q.correct === oi && <Icon name="check" size={14} />}</label>))}</div>}
          {q.type === 'tf' && <div className="form-row">{['صح', 'غلط'].map((t, ti) => <label key={ti} className={`opt-row ${q.correct === ti ? 'on' : ''}`}><input type="radio" checked={q.correct === ti} onChange={() => set(i, { correct: ti })} /> {L(lang, t, ti ? 'False' : 'True')}</label>)}</div>}
          {q.type === 'essay' && <textarea className="inp grow" rows={2} placeholder={L(lang, 'الإجابة النموذجية (بتظهر للطلاب بعد انتهاء الامتحان)', 'Model answer (shown after the exam closes)')} value={q.model} onChange={(e) => set(i, { model: e.target.value })} />}
          {q.type === 'order' && <div><div className="hint">{L(lang, 'اكتب العناصر بالترتيب الصحيح (هتتخلط للطالب):', 'Type items in the correct order (shuffled for students):')}</div>{q.items.map((x, xi) => <input key={xi} className="inp grow" style={{ marginTop: 6 }} placeholder={`${xi + 1}`} value={x} onChange={(e) => set(i, { items: q.items.map((y, k) => (k === xi ? e.target.value : y)) })} />)}<button className="mini-btn go" style={{ marginTop: 6 }} onClick={() => set(i, { items: [...q.items, ''] })}><Icon name="plus" size={12} /></button></div>}
          {q.type === 'match' && <div><div className="hint">{L(lang, 'اكتب كل زوج صح (العمود الأيمن ↔ الأيسر):', 'Type each correct pair:')}</div>{q.pairs.map((p, pi) => <div className="form-row" key={pi}><input className="inp grow" value={p[0]} onChange={(e) => set(i, { pairs: q.pairs.map((y, k) => (k === pi ? [e.target.value, y[1]] : y)) })} /><span>↔</span><input className="inp grow" value={p[1]} onChange={(e) => set(i, { pairs: q.pairs.map((y, k) => (k === pi ? [y[0], e.target.value] : y)) })} /></div>)}<button className="mini-btn go" onClick={() => set(i, { pairs: [...q.pairs, ['', '']] })}><Icon name="plus" size={12} /></button></div>}
        </div>
      ))}
      <div className="form-row"><button className="mini-btn go" onClick={() => setQs((a) => [...a, blankQ()])}><Icon name="plus" size={12} /> {L(lang, 'سؤال جديد', 'Add question')}</button>
        <button className="mini-btn ok" disabled={!valid} onClick={save}><Icon name="save" size={12} /> {L(lang, 'حفظ الامتحان', 'Save exam')} ({used.length})</button>
        {!valid && <span style={{ fontSize: 12, color: 'var(--rose)', fontWeight: 800 }}>{timesOk ? L(lang, 'محتاج 5 أسئلة مكتملة على الأقل', 'Need at least 5 complete questions') : L(lang, 'حدد الفتح والقفل والمدة', 'Set open/close times and duration')}</span>}</div>
    </div>
  );
}
