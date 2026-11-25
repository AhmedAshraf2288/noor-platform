import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useReveal } from './shared.jsx';
import Icon from '../components/Icon.jsx';
import Lantern from '../components/Lantern.jsx';

const L = (lang, a, e) => (lang === 'ar' ? a : e);
const fmt = (s, lang) => (s ? new Date(s).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const Head = ({ a, b }) => (<section className="page-head"><div className="container"><h1><span className="g1">{a}</span></h1>{b && <p className="sub">{b}</p>}</div></section>);

/* ---- live sessions (16, 95, 96) ---- */
export function Live() {
  const { lang, user, nav } = useApp();
  const [list, setList] = useState(null);
  useEffect(() => { if (!user) { nav('/login'); return; } const f = () => api.get('/api/live').then((d) => setList(d.sessions)).catch(() => setList([])); f(); const iv = setInterval(f, 30000); return () => clearInterval(iv); }, [user]);
  useReveal(list && list.length);
  if (!user) return null;
  return (<><Head a={L(lang, 'الحصص المباشرة', 'Live sessions')} b={L(lang, 'رابط الحصة بيفتح قبل الموعد بـ 5 دقايق للطلاب المشتركين', 'The link opens 5 minutes before start for enrolled students')} />
    <section className="page-sec" style={{ paddingTop: 0 }}><div className="container narrow">
      {list && list.length === 0 && <div className="panel"><p style={{ fontWeight: 700, color: 'var(--gray)' }}>{L(lang, 'مفيش حصص مجدولة حالياً', 'No sessions scheduled')}</p></div>}
      {(list || []).map((s) => (
        <div className="panel live-card rv" key={s.id}>
          <span className={`live-dot ${s.open ? 'on' : ''}`}></span>
          <div className="lr-main"><b>{s.title}</b><span>{s.course}</span><span><Icon name="calendar" size={12} /> {fmt(s.startsAt, lang)} · {s.durationMin} {L(lang, 'دقيقة', 'min')}</span></div>
          <div className="lr-act">
            {s.open && s.link ? <a className="btn-grad-pill" href={s.link} target="_blank" rel="noreferrer"><Icon name="radio" size={14} /> {L(lang, 'ادخل الحصة الآن', 'Join now')}</a>
              : s.ended ? (s.recording ? <a className="btn-ghost-pill" href={s.recording} target="_blank" rel="noreferrer"><Icon name="video" size={14} /> {L(lang, 'تسجيل الحصة', 'Recording')}</a> : <span className="tag wait">{L(lang, 'انتهت', 'Ended')}</span>)
              : <span className="tag wait"><Icon name="clock" size={12} /> {L(lang, 'لسه ما بدأتش', 'Not started')}</span>}
          </div>
        </div>))}
    </div></section></>);
}

/* ---- lantern honor board (5, 98) ---- */
export function Leaderboard() {
  const { lang, user, nav } = useApp();
  const [by, setBy] = useState('all');
  const [d, setD] = useState(null);
  useEffect(() => { if (!user) { nav('/login'); return; } api.get(`/api/leaderboard?by=${by}`).then(setD).catch(() => setD({ on: false, items: [] })); }, [user, by]);
  if (!user) return null;
  return (<><Head a={L(lang, 'لوحة شرف الفوانيس', 'Lantern honor board')} b={L(lang, 'الترتيب بحسب النور: 10 نقاط لكل درس + درجات الامتحانات', 'Ranked by light: 10 per lesson + exam scores')} />
    <section className="page-sec" style={{ paddingTop: 0 }}><div className="container narrow">
      <div className="chips" style={{ justifyContent: 'center' }}>
        {[['all', L(lang, 'الكل', 'All')], ['governorate', L(lang, 'محافظتي', 'My governorate')], ['school', L(lang, 'مدرستي', 'My school')]].map(([k, l]) => <button key={k} className={`chip ${by === k ? 'on' : ''}`} onClick={() => setBy(k)}>{l}</button>)}
      </div>
      {d && !d.on && <div className="panel"><p style={{ fontWeight: 700 }}>{L(lang, 'لوحة الشرف مقفولة حالياً من الإدارة', 'The honor board is currently off')}</p></div>}
      {d && d.on && d.items.length === 0 && <div className="panel"><p style={{ fontWeight: 700 }}>{by !== 'all' && !d.scope ? L(lang, 'اكتب محافظتك/مدرستك في صفحة حسابي الأول', 'Set your governorate/school in My Account first') : L(lang, 'لسه مفيش ترتيب', 'No ranking yet')}</p></div>}
      {d && d.on && d.items.length > 0 && <div className="panel lb">{d.items.map((r) => (
        <div className={`lb-row ${r.id === d.me ? 'me' : ''} r${r.rank}`} key={r.id}>
          <span className="lb-rank">{r.rank <= 3 ? <Icon name="trophy" size={18} /> : r.rank}</span>
          <Lantern pct={Math.min(100, r.light)} size={38} uid={`lb${r.id}`} />
          <div className="lr-main"><b>{r.name}</b><span>{r.governorate || ''} {r.school ? '· ' + r.school : ''}</span></div>
          <span className="lb-light">{r.light}</span>
        </div>))}</div>}
    </div></section></>);
}

/* ---- learning paths (34) ---- */
export function Paths() {
  const { lang } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/api/paths').then(setD).catch(() => setD({ paths: [] })); }, []);
  useReveal(d && d.paths.length);
  return (<><Head a={L(lang, 'مسارات التعلم', 'Learning paths')} b={L(lang, 'كورسات مرتبة خطوة بخطوة مع نسبة تقدمك', 'Courses in order with your progress')} />
    <section className="page-sec" style={{ paddingTop: 0 }}><div className="container narrow">
      {d && d.paths.length === 0 && <div className="panel"><p style={{ fontWeight: 700, color: 'var(--gray)' }}>{L(lang, 'لسه مفيش مسارات', 'No paths yet')}</p></div>}
      {(d ? d.paths : []).map((p) => (
        <div className="panel rv" key={p.id}><h2><Icon name="grad" size={18} /> {p.title} <span className="more">{p.pct}%</span></h2>
          <div className="lantern-bar"><i style={{ width: `${p.pct}%` }}></i></div>
          <div className="path-steps">{p.courses.map((c, i) => (
            <a className="path-step" href={`#/course/${c.id}`} key={c.id}><span className="ps-n">{i + 1}</span><span className="ps-t">{lang === 'ar' ? c.title_ar : (c.title_en || c.title_ar)}</span><span className="ps-p">{c.watched}/{c.total}</span></a>))}</div>
        </div>))}
    </div></section></>);
}

/* ---- certificate verification (1) ---- */
export function Verify({ code }) {
  const { lang } = useApp();
  const [d, setD] = useState(undefined);
  useEffect(() => { api.get(`/api/verify/${encodeURIComponent(code)}`).then(setD).catch(() => setD(null)); }, [code]);
  return (<><Head a={L(lang, 'التحقق من الشهادة', 'Certificate verification')} />
    <section className="page-sec" style={{ paddingTop: 0 }}><div className="container narrow">
      <div className={`panel verify ${d ? 'ok' : 'no'}`}>
        {d === undefined && <p>...</p>}
        {d === null && <><Icon name="x" size={40} /><h2>{L(lang, 'الشهادة غير صحيحة أو غير موجودة', 'Certificate not found')}</h2></>}
        {d && <><Icon name="check" size={40} /><h2>{L(lang, 'شهادة صحيحة', 'Valid certificate')}</h2>
          <p><b>{d.student}</b></p><p>{d.course}</p><p>{d.kind === 'excellence' ? L(lang, 'شهادة تفوق', 'Certificate of excellence') : L(lang, 'شهادة إتمام', 'Certificate of completion')} · {d.pct}% · {d.date}</p><p dir="ltr" className="hint">{d.code}</p></>}
      </div></div></section></>);
}

/* ---- printable documents: certificate / invoice / grade sheet (save as PDF from the print dialog) ---- */
export function Doc({ kind, id }) {
  const { lang, user, nav } = useApp();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!user) { nav('/login'); return; }
    const url = kind === 'cert' ? `/api/certificates/${id}/data` : kind === 'invoice' ? `/api/invoices/${id}` : id === 'me' ? '/api/my/gradesheet' : `/api/admin/students/${id}/gradesheet`;
    api.get(url).then(setD).catch((e) => setErr(e.message));
  }, [user, kind, id]);
  if (!user) return null;
  if (err) return <section className="page-head"><div className="container"><h1>{err}</h1></div></section>;
  if (!d) return <section className="page-head"><div className="container"><h1>...</h1></div></section>;
  return (
    <section className="doc-page"><div className="container">
      <div className="doc-bar no-print"><button className="btn-grad-pill" onClick={() => window.print()}><Icon name="print" size={15} /> {L(lang, 'حفظ / طباعة PDF', 'Save / Print PDF')}</button><button className="btn-ghost-pill" onClick={() => window.history.back()}>{L(lang, 'رجوع', 'Back')}</button></div>
      {kind === 'cert' && (
        <div className={`cert ${d.kind}`}><div className="cert-in">
          <div className="cert-logo">نور</div>
          <h1>{d.kind === 'excellence' ? 'شهادة تفوق' : 'شهادة إتمام'}</h1>
          <p className="cert-l">تشهد منصة نور التعليمية بأن</p>
          <h2 className="cert-name">{d.student}</h2>
          <p className="cert-l">{d.kind === 'excellence' ? 'قد تفوق بتقدير ممتاز في كورس' : 'قد أتم بنجاح كورس'}</p>
          <h3 className="cert-course">{d.course}</h3>
          <p className="cert-l">بمتوسط درجات {d.pct}% · بتاريخ {d.date}</p>
          <div className="cert-foot"><img src={d.qr} alt="QR" width="110" height="110" /><div dir="ltr"><span>{L(lang, 'امسح للتحقق', 'Scan to verify')}</span><b>{d.code}</b></div></div>
        </div></div>)}
      {kind === 'invoice' && (
        <div className="invoice"><div className="inv-head"><div className="cert-logo sm">نور</div><div><h1>{L(lang, 'فاتورة', 'Invoice')}</h1><span dir="ltr">{d.no}</span></div></div>
          <div className="inv-grid"><div><span>{L(lang, 'الطالب', 'Student')}</span><b>{d.student}</b></div><div><span>{L(lang, 'التاريخ', 'Date')}</span><b>{d.date}</b></div><div><span>{L(lang, 'طريقة الدفع', 'Method')}</span><b>{d.method}</b></div></div>
          <table className="tbl"><tbody><tr><td>{d.course}</td><td>{d.base}</td></tr>{d.coupon && <tr><td>{L(lang, 'خصم', 'Discount')} ({d.coupon})</td><td>-{d.discount}</td></tr>}<tr className="inv-total"><td>{L(lang, 'الإجمالي (جنيه)', 'Total (EGP)')}</td><td>{d.amount}</td></tr></tbody></table>
          <p className="hint">{L(lang, 'تم الدفع يدوياً وتأكيده من الإدارة.', 'Paid manually and confirmed by admin.')}</p></div>)}
      {kind === 'sheet' && (
        <div className="invoice"><div className="inv-head"><div className="cert-logo sm">نور</div><div><h1>{L(lang, 'كشف درجات رسمي', 'Official grade sheet')}</h1><span>{d.student.name} · {d.date}</span></div></div>
          {d.courses.length === 0 && <p>-</p>}
          {d.courses.map((c) => (<div key={c.title} style={{ marginTop: 16 }}><h3>{c.title} <span className="hint">({c.watched}/{c.total} {L(lang, 'درس', 'lessons')})</span></h3>
            <table className="tbl"><thead><tr><th>{L(lang, 'الامتحان', 'Exam')}</th><th>{L(lang, 'أفضل درجة', 'Best')}</th><th>{L(lang, 'محاولات', 'Tries')}</th></tr></thead><tbody>{c.exams.map((e, i) => <tr key={i}><td>{e.lesson}</td><td>{e.pending ? L(lang, 'قيد التصحيح', 'Grading') : e.pct + '%'}</td><td>{e.tries}</td></tr>)}</tbody></table></div>))}
        </div>)}
    </div></section>);
}

/* ---- parent view (20, 136) ---- */
export function Parent({ token }) {
  const { lang } = useApp();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get(`/api/parent/${token}`).then(setD).catch((e) => setErr(e.message)); }, [token]);
  return (<><Head a={L(lang, 'تقرير ولي الأمر', 'Parent report')} b={d ? d.name : ''} />
    <section className="page-sec" style={{ paddingTop: 0 }}><div className="container narrow">
      {err && <div className="msg-err">{err}</div>}
      {d && (<>
        <div className="dash-stats" style={{ marginTop: 0 }}><div className="dstat"><span className="ic g"><Icon name="play" size={22} /></span><div><div className="n">{d.lessonsThisWeek}</div><div className="t">{L(lang, 'دروس هذا الأسبوع', 'Lessons this week')}</div></div></div></div>
        {d.missedExams.length > 0 && <div className="msg-err"><Icon name="warn" size={14} /> {L(lang, 'امتحانات غاب عنها: ', 'Missed exams: ')}{d.missedExams.join('، ')}</div>}
        {d.courses.map((c) => (<div className="panel" key={c.title}><h2>{c.title} <span className="more">{c.watched}/{c.total}</span></h2><div className="lantern-bar"><i style={{ width: `${c.total ? (c.watched / c.total) * 100 : 0}%` }}></i></div>
          {c.exams.map((e, i) => <div className="rev-line" key={i}>{e.lesson}: <b>{e.pending ? L(lang, 'قيد التصحيح', 'grading') : e.pct + '%'}</b></div>)}</div>))}
      </>)}
    </div></section></>);
}

/* ---- moderator: answer lesson questions only (55) ---- */
export function Mod() {
  const { lang, user, nav } = useApp();
  const [list, setList] = useState([]);
  const [ans, setAns] = useState({});
  const load = () => api.get('/api/mod/questions').then((d) => setList(d.questions)).catch(() => nav('/'));
  useEffect(() => { if (!user) { nav('/login'); return; } if (user.role !== 'mod' && user.role !== 'admin') { nav('/'); return; } load(); }, [user]);
  if (!user) return null;
  return (<><Head a={L(lang, 'لوحة المشرف', 'Moderator panel')} b={L(lang, 'ردّ على أسئلة الطلاب. مفيش وصول للإيرادات أو الإعدادات.', 'Answer student questions. No access to revenue or settings.')} />
    <section className="page-sec" style={{ paddingTop: 0 }}><div className="container narrow">
      {list.length === 0 && <div className="panel"><p style={{ fontWeight: 700 }}>{L(lang, 'مفيش أسئلة', 'No questions')}</p></div>}
      {list.map((q) => (<div className="panel" key={q.id}><b>{q.name}</b> <span className="hint">· {q.lesson}</span><p style={{ margin: '8px 0', fontWeight: 700 }}>{q.text}</p>
        {q.answer ? <div className="msg-ok">{q.answer}</div> : <><textarea className="inp grow" rows={2} value={ans[q.id] || ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} /><button className="mini-btn ok" style={{ marginTop: 8 }} disabled={!ans[q.id]} onClick={() => api.post(`/api/mod/questions/${q.id}/answer`, { answer: ans[q.id] }).then(load)}>{L(lang, 'إرسال الرد', 'Reply')}</button></>}</div>))}
    </div></section></>);
}
