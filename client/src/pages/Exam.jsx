import { sget, sset, sdel } from '../secureStore.js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import MathText from '../components/MathText.jsx';

const L = (lang, a, e) => (lang === 'ar' ? a : e);

// Timed exam page. The server draws 5 random questions from the bank (random order of questions and options),
// answers autosave every moment (so a dropped connection loses nothing), a warning shows one minute before the end,
// and leaving the page counts as a strike (3 strikes lock the exam).
export default function Exam({ lessonId }) {
  const { t, lang, user, nav } = useApp();
  const [meta, setMeta] = useState(null);
  const [exam, setExam] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [locked, setLocked] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [warn, setWarn] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(null);
  const [expired, setExpired] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [minWarn, setMinWarn] = useState(false);
  const [review, setReview] = useState(null);
  const submittedRef = useRef(false);
  const activeRef = useRef(false);
  const lastStrikeRef = useRef(0);
  const answersRef = useRef({});
  const dirtyRef = useRef(false);
  const lsKey = `noor-exam-${lessonId}-${user ? user.id : 0}`;

  const loadMeta = useCallback(() => { api.get(`/api/lessons/${lessonId}/exam`).then(setMeta).catch((e) => setErr(e.message)); }, [lessonId]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const setAns = (qid, val) => setAnswers((a) => { const n = { ...a, [String(qid)]: val }; answersRef.current = n; dirtyRef.current = true; try { sset(lsKey, JSON.stringify(n)); } catch (e) { /* ignore */ } return n; });

  // autosave: debounce on change + retry loop while offline
  const flush = useCallback(() => {
    if (!activeRef.current || !dirtyRef.current) return Promise.resolve();
    return api.post(`/api/lessons/${lessonId}/exam/save`, { answers: answersRef.current })
      .then(() => { dirtyRef.current = false; setSaveState('saved'); })
      .catch(() => setSaveState('offline'));
  }, [lessonId]);
  useEffect(() => {
    if (!exam) return undefined;
    const iv = setInterval(flush, 2500);
    const onOnline = () => flush();
    window.addEventListener('online', onOnline);
    return () => { clearInterval(iv); window.removeEventListener('online', onOnline); };
  }, [exam, flush]);

  const submit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true; activeRef.current = false; setBusy(true);
    api.post(`/api/lessons/${lessonId}/exam/submit`, { answers: answersRef.current })
      .then((r) => { setResult(r); setExam(null); try { sdel(lsKey); } catch (e) { /* ignore */ } loadMeta(); })
      .catch((e) => {
        if (e.status === undefined) { submittedRef.current = false; activeRef.current = true; setErr(L(lang, 'مفيش اتصال. إجاباتك محفوظة، جرب التسليم تاني', 'Offline. Your answers are saved, try submitting again')); return; }
        if (/مخالفات/.test(e.message)) setLocked(true); else if (/انتهى/.test(e.message)) setExpired(true); else setErr(e.message);
        setExam(null); loadMeta();
      })
      .finally(() => setBusy(false));
  }, [lessonId, loadMeta, lang, lsKey]);
  const submitRef = useRef(submit); submitRef.current = submit;

  const strike = useCallback(() => {
    if (!activeRef.current || submittedRef.current) return;
    const now = Date.now(); if (now - lastStrikeRef.current < 2000) return; lastStrikeRef.current = now;
    api.post(`/api/lessons/${lessonId}/exam/strike`, {}).then((r) => {
      setStrikes(r.strikes);
      if (r.locked) { activeRef.current = false; submittedRef.current = true; setExam(null); setLocked(true); }
      else { setWarn(t('strikeWarn').replace('{n}', String(r.maxStrikes - r.strikes))); setTimeout(() => setWarn(''), 4200); }
    }).catch(() => {});
  }, [lessonId, t]);

  useEffect(() => {
    if (!exam) return undefined;
    const onVis = () => { if (document.hidden) strike(); };
    const onPageHide = () => { if (activeRef.current && !submittedRef.current) fetch(`/api/lessons/${lessonId}/exam/strike`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {}); };
    document.addEventListener('visibilitychange', onVis); window.addEventListener('blur', strike); window.addEventListener('pagehide', onPageHide);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', strike); window.removeEventListener('pagehide', onPageHide); };
  }, [exam, strike, lessonId]);

  useEffect(() => {
    if (!exam || !exam.durationMin) return undefined;
    const end = Date.parse(exam.startedAt) + exam.durationMin * 60000;
    const tick = () => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000)); setLeft(s);
      if (s <= 60 && s > 0) setMinWarn(true);
      if (s <= 0) submitRef.current();
    };
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, [exam]);

  useEffect(() => { if (exam) gsap.fromTo('.exam-q-card', { opacity: 0, x: lang === 'ar' ? -34 : 34 }, { opacity: 1, x: 0, duration: .45, ease: 'power3.out' }); }, [idx, exam, lang]);

  if (!user) { nav('/login'); return null; }

  const start = () => {
    setErr(''); setBusy(true);
    api.post(`/api/lessons/${lessonId}/exam/start`, {}).then((d) => {
      let saved = d.answers || {};
      try { const ls = JSON.parse(sget(lsKey) || '{}'); saved = { ...ls, ...saved }; } catch (e) { /* ignore */ }
      setExam(d); setAnswers(saved); answersRef.current = saved; dirtyRef.current = Object.keys(saved).length > 0; setIdx(0); setResult(null); setMinWarn(false); setSaveState('');
      setStrikes(d.strikes); submittedRef.current = false; activeRef.current = true;
      if (d.durationMin) setLeft(d.durationMin * 60);
    }).catch((e) => { if (/مخالفات/.test(e.message)) setLocked(true); else setErr(e.message); loadMeta(); }).finally(() => setBusy(false));
  };
  const loadReview = () => api.get(`/api/lessons/${lessonId}/exam/review`).then(setReview).catch((e) => setErr(e.message));

  const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  /* ---------- question renderers ---------- */
  const renderQ = (q) => {
    const a = answers[String(q.id)];
    if (q.type === 'mcq' || q.type === 'tf') return (
      <div className="exam-opts">{q.options.map((o) => (
        <label key={o.i} className={`exam-opt ${a === o.i ? 'on' : ''}`}><input type="radio" name={`q${q.id}`} checked={a === o.i} onChange={() => setAns(q.id, o.i)} /><MathText text={o.t} /></label>))}</div>);
    if (q.type === 'essay') return <textarea className="exam-essay" rows={6} placeholder={L(lang, 'اكتب إجابتك هنا...', 'Write your answer...')} value={a || ''} onChange={(e) => setAns(q.id, e.target.value)} />;
    if (q.type === 'order') {
      const cur = Array.isArray(a) ? a : q.items;
      const move = (i, d) => { const n = cur.slice(); const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setAns(q.id, n); };
      return (<div className="exam-order"><p className="hint">{L(lang, 'رتّب العناصر بالأسهم:', 'Reorder with the arrows:')}</p>
        {cur.map((it, i) => (<div className="ord-row" key={it + i}><span className="ord-n">{i + 1}</span><span className="ord-t"><MathText text={it} /></span><button className="ord-b" aria-label="up" onClick={() => move(i, -1)}>↑</button><button className="ord-b" aria-label="down" onClick={() => move(i, 1)}>↓</button></div>))}
        {!Array.isArray(a) && <button className="btn-ghost-pill" style={{ marginTop: 8 }} onClick={() => setAns(q.id, q.items)}>{L(lang, 'اعتماد هذا الترتيب', 'Confirm this order')}</button>}</div>);
    }
    if (q.type === 'match') {
      const m = a || {};
      return (<div className="exam-match">{q.left.map((l) => (<div className="match-row" key={l}><span className="match-l"><MathText text={l} /></span>
        <select value={m[l] || ''} onChange={(e) => setAns(q.id, { ...m, [l]: e.target.value })}><option value="">{L(lang, 'اختار...', 'Choose...')}</option>{q.right.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>))}</div>);
    }
    return null;
  };
  const answered = (q) => { const a = answers[String(q.id)]; return a !== undefined && a !== '' && !(typeof a === 'object' && !Array.isArray(a) && Object.keys(a).length === 0); };

  /* ---------- active ---------- */
  if (exam) {
    const q = exam.questions[idx]; const total = exam.questions.length;
    return (
      <section className="exam-page"><div className="container">
        <div className="exam-top">
          <div className="exam-top-row">
            <span className="exam-chip"><Icon name="quiz" size={14} /> {t('question')} {idx + 1} / {total}</span>
            {left !== null && <span className={`exam-chip timer ${left < 60 ? 'danger' : ''}`}><Icon name="timer" size={14} /> {mmss(left)}</span>}
            <span className={`exam-chip strikes ${strikes > 0 ? 'hit' : ''}`}><Icon name="warn" size={14} /> {strikes}/{exam.maxStrikes}</span>
            <span className={`exam-chip save ${saveState}`}>{saveState === 'offline' ? L(lang, 'غير متصل - محفوظ على جهازك', 'Offline - saved on device') : saveState === 'saved' ? L(lang, 'تم الحفظ تلقائياً', 'Autosaved') : L(lang, 'حفظ تلقائي', 'Autosave on')}</span>
          </div>
          <div className="exam-dots">{exam.questions.map((qq, i) => (<button key={qq.id} className={`exam-dot ${i === idx ? 'on' : ''} ${answered(qq) ? 'done' : ''}`} onClick={() => setIdx(i)} aria-label={`${i + 1}`}>{i + 1}</button>))}</div>
        </div>
        {minWarn && left > 0 && <div className="exam-warn min"><Icon name="timer" size={15} /> {L(lang, 'باقي أقل من دقيقة! راجع إجاباتك وسلّم.', 'Less than a minute left! Review and submit.')}</div>}
        {warn && <div className="exam-warn"><Icon name="warn" size={15} /> {warn}</div>}
        {err && <div className="msg-err">{err}</div>}
        <div className="exam-q-card" key={q.id}>
          <div className="q-pts">{q.points} {L(lang, 'درجة', 'pt')}</div>
          <h2><MathText text={q.q} /></h2>
          {q.image && <img className="exam-q-img" src={q.image} alt="" loading="lazy" />}
          {renderQ(q)}
        </div>
        <div className="exam-nav">
          <button className="btn-ghost-pill" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>{t('prevQ')}</button>
          {idx < total - 1 ? <button className="btn-grad-pill" onClick={() => setIdx((i) => i + 1)}>{t('nextQ')}</button>
            : <button className="btn-grad-pill" disabled={busy} onClick={submit}>{busy ? '...' : <><Icon name="check" size={15} /> {t('submitExam')}</>}</button>}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--gray)' }}>{t('answeredOf').replace('{a}', String(exam.questions.filter(answered).length)).replace('{t}', String(total))}</div>
      </div></section>
    );
  }

  /* ---------- review (model answers after the window ends) ---------- */
  if (review) return (
    <section className="exam-page"><div className="container"><div className="exam-intro" style={{ textAlign: 'start' }}>
      <h1 style={{ textAlign: 'center' }}>{L(lang, 'الإجابات النموذجية', 'Model answers')}</h1>
      {review.feedback && <div className="msg-ok">{L(lang, 'تعليق المصحح: ', 'Grader comment: ')}{review.feedback}</div>}
      {review.items.length === 0 && <p style={{ fontWeight: 700 }}>{L(lang, 'مفيش محاولة سابقة', 'No attempt yet')}</p>}
      {review.items.map((it, i) => (<div className={`rev-card ${it.right ? 'ok' : 'no'}`} key={it.id}><b>{i + 1}. <MathText text={it.q} /></b>{it.image && <img className="exam-q-img" src={it.image} alt="" loading="lazy" />}
        <div className="rev-line"><span>{L(lang, 'الإجابة الصحيحة:', 'Correct:')}</span> <MathText text={it.correctText} /></div>
        <div className="rev-line"><span>{L(lang, 'إجابتك:', 'Yours:')}</span> {it.your === null || it.your === undefined ? '-' : typeof it.your === 'object' ? JSON.stringify(it.your) : String(it.your)}</div></div>))}
      <div style={{ textAlign: 'center' }}><button className="btn-ghost-pill" onClick={() => setReview(null)}>{t('backToCourse')}</button></div>
    </div></div></section>
  );

  /* ---------- result ---------- */
  if (result) return (
    <section className="exam-page"><div className="container">
      <div className={`exam-result-card ${result.passed ? 'pass' : 'fail'}`}>
        <div className="exam-result-ic"><Icon name={result.passed ? 'trophy' : 'refresh'} size={52} strokeWidth={1.4} /></div>
        <h1>{result.pending ? L(lang, 'تم استلام امتحانك', 'Exam received') : result.passed ? t('examPassed') : t('examFailed')}</h1>
        <div className="exam-score-big">{result.score} / {result.total}</div>
        <div className="exam-pct">{result.pct}%</div>
        {result.pending && <div className="tag wait" style={{ fontSize: 13 }}>{L(lang, 'فيه أسئلة مقالية لسه بتتصحح، الدرجة هتتحدث', 'Essay questions are being graded; your score will update')}</div>}
        {result.cohort && result.cohort.avg !== null && (<div className="cohort"><div className="cohort-row"><span>{L(lang, 'نتيجتك', 'You')}</span><div className="cohort-bar"><i style={{ width: `${result.pct}%` }}></i></div><b>{result.pct}%</b></div>
          <div className="cohort-row"><span>{L(lang, 'متوسط الدفعة', 'Cohort avg')}</span><div className="cohort-bar avg"><i style={{ width: `${result.cohort.avg}%` }}></i></div><b>{result.cohort.avg}%</b></div>
          <div className="hint">{result.pct >= result.cohort.avg ? L(lang, 'أعلى من متوسط الدفعة، برافو!', 'Above the cohort average!') : L(lang, 'أقل من متوسط الدفعة، كمّل مذاكرة.', 'Below the cohort average, keep studying.')} ({result.cohort.n} {L(lang, 'طالب', 'students')})</div></div>)}
        <div className="exam-review">{result.results.map((r, i) => (<div key={r.id} className={`exam-rev-row ${r.pending ? '' : r.right ? 'ok' : 'no'}`}><Icon name={r.pending ? 'clock' : r.right ? 'check' : 'x'} size={14} /> {t('question')} {i + 1}</div>))}</div>
        <p className="hint">{L(lang, 'الإجابات النموذجية بتظهر بعد انتهاء وقت الامتحان.', 'Model answers appear after the exam window ends.')}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
          {meta && meta.window === 'open' && !(meta.state && meta.state.locked) && (!meta.maxAttempts || meta.attempts < meta.maxAttempts) && <button className="btn-ghost-pill" onClick={start}><Icon name="refresh" size={14} /> {t('retryExam')}</button>}
          {result.window === 'after' && <button className="btn-ghost-pill" onClick={loadReview}>{L(lang, 'الإجابات النموذجية', 'Model answers')}</button>}
          <button className="btn-grad-pill" onClick={() => window.history.back()}>{t('backToCourse')}</button>
        </div>
      </div></div></section>
  );

  /* ---------- intro ---------- */
  const m = meta; const isLocked = locked || (m && m.state && m.state.locked);
  const noTries = m && m.maxAttempts && m.attempts >= m.maxAttempts;
  return (
    <section className="exam-page"><div className="container"><div className="exam-intro">
      <div className="exam-result-ic"><Icon name="quiz" size={52} strokeWidth={1.4} /></div>
      <h1>{t('examPageTitle')}</h1>
      {err && <div className="msg-err">{err}</div>}
      {expired && <div className="msg-err">{t('examTimeUp')}</div>}
      {!m && !err && <p style={{ fontWeight: 700 }}>...</p>}
      {m && !m.hasExam && <p style={{ fontWeight: 700 }}>{t('noExamYet')}</p>}
      {m && m.hasExam && (<>
        <div className="exam-meta-grid">
          <div className="exam-meta"><Icon name="quiz" size={17} /><b>{m.questionCount}</b><span>{t('questionsCount')}</span></div>
          <div className="exam-meta"><Icon name="timer" size={17} /><b>{m.durationMin ? `${m.durationMin} ${t('minutes')}` : '-'}</b><span>{t('examDuration')}</span></div>
          <div className="exam-meta"><Icon name="calendar" size={17} /><b>{fmtDT(m.openAt)}</b><span>{t('examOpenAt')}</span></div>
          <div className="exam-meta"><Icon name="calendar" size={17} /><b>{fmtDT(m.closeAt)}</b><span>{t('examCloseAt')}</span></div>
          {m.maxAttempts && <div className="exam-meta"><Icon name="refresh" size={17} /><b>{m.attempts}/{m.maxAttempts}</b><span>{L(lang, 'المحاولات', 'Attempts')}</span></div>}
        </div>
        {m.best && <div className="tag go" style={{ fontSize: 14 }}><Icon name="trophy" size={13} /> {t('bestScore')}: {m.best.score}/{m.best.total}</div>}
        {m.cohort && m.cohort.avg !== null && m.best && <div className="hint">{L(lang, `متوسط الدفعة ${m.cohort.avg}% (${m.cohort.n} طالب)`, `Cohort average ${m.cohort.avg}% (${m.cohort.n} students)`)}</div>}
        {m.pendingGrade && <div className="tag wait">{L(lang, 'في انتظار تصحيح الأسئلة المقالية', 'Waiting for essay grading')}</div>}
        {m.state && m.state.strikes > 0 && !isLocked && <div className="tag wait" style={{ fontSize: 13 }}><Icon name="warn" size={13} /> {t('strikesUsed').replace('{n}', String(m.state.strikes)).replace('{m}', String(m.maxStrikes))}</div>}
        <div className="exam-rules"><Icon name="shield" size={15} /> {t('examRules')}</div>
        {isLocked ? <div className="msg-err" style={{ textAlign: 'center' }}><Icon name="lock" size={15} /> {t('examLockedMsg')}</div>
          : m.window === 'before' ? <div className="tag wait" style={{ fontSize: 15, padding: '12px 20px' }}><Icon name="clock" size={15} /> {t('examNotYet')} {fmtDT(m.openAt)}</div>
          : m.window === 'after' ? <><div className="msg-err" style={{ textAlign: 'center' }}>{t('examClosedMsg')}</div><button className="btn-grad-pill" onClick={loadReview}>{L(lang, 'الإجابات النموذجية', 'Model answers')}</button></>
          : noTries ? <div className="msg-err" style={{ textAlign: 'center' }}>{L(lang, 'استنفدت عدد المحاولات المسموح بها', 'You used all allowed attempts')}</div>
          : <button className="btn-grad-pill" style={{ fontSize: 17, padding: '14px 40px' }} disabled={busy} onClick={start}>{busy ? '...' : <><Icon name="play" size={15} /> {t('startExam')}</>}</button>}
        <div style={{ marginTop: 22 }}><button className="btn-ghost-pill" onClick={() => window.history.back()}>{t('backToCourse')}</button></div>
      </>)}
    </div></div></section>
  );
}
