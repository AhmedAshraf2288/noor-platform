import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useReveal } from './shared.jsx';
import Icon from '../components/Icon.jsx';
import LessonExtras from '../components/LessonExtras.jsx';

// Exam card under the video: links to the dedicated timed exam page
function ExamCard({ lesson, t, lang }) {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    api.get(`/api/lessons/${lesson.id}/exam`).then((d) => setMeta(d.hasExam ? d : null)).catch(() => {});
  }, [lesson.id]);
  if (!meta) return null;
  const lockd = meta.state && meta.state.locked;
  return (
    <div className="exam-box">
      <a className="btn-grad-pill exam-go" href={`#/exam/${lesson.id}`}>
        <Icon name="quiz" size={16} /> {t('startExam')}
        {meta.durationMin ? <span className="exam-mini"><Icon name="timer" size={12} /> {meta.durationMin} {t('minutes')}</span> : null}
        {lesson.examBest ? <span className="exam-mini"><Icon name="trophy" size={12} /> {t('bestScore')}: {lesson.examBest.score}/{lesson.examBest.total}</span> : null}
        {lockd ? <span className="exam-mini"><Icon name="lock" size={12} /> {t('lockedTag')}</span> : null}
      </a>
      {meta.window === 'before' && <div className="exam-mini" style={{ marginTop: 8 }}><Icon name="clock" size={12} /> {t('examNotYet')} {meta.openAt ? new Date(meta.openAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</div>}
      {meta.openAt && meta.window === 'before' && <a className="wa-share" style={{ marginTop: 8, display: 'inline-flex' }} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`تذكير: امتحان "${lesson.titleAr}" هيفتح ${new Date(meta.openAt).toLocaleString('ar-EG')} - منصة نور`)}`}><Icon name="share" size={13} /> {lang === 'ar' ? 'ذكّرني على واتساب' : 'Remind me on WhatsApp'}</a>}
      {meta.window === 'after' && <div className="exam-mini" style={{ marginTop: 8 }}>{t('examClosedMsg')}</div>}
    </div>
  );
}

export default function Watch({ courseId }) {
  const { t, lang, user, nav } = useApp();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [current, setCurrent] = useState(null);
  const [done, setDone] = useState([]);
  const vref = useRef(null);
  const lastTick = useRef({ t: 0 });
  const [wrong, setWrong] = useState(null);
  const [err2, setErr2] = useState('');

  useEffect(() => {
    if (!user) { nav('/login'); return; }
    api.get(`/api/courses/${courseId}`)
      .then((d) => {
        if (!d.hasAccess) { nav(`/course/${courseId}`); return; }
        setData(d);
        const first = d.lessons.find((l) => l.hasVideo && !l.locked);
        if (first) setCurrent(first);
      })
      .catch((e) => setErr(e.message));
  }, [user, courseId]);
  useEffect(() => { if (user) api.get('/api/progress').then((d) => setDone(((d.courses || {})[courseId] || {}).lessonIds || [])).catch(() => {}); }, [user, courseId]);
  const markWatched = (id) => { if (done.includes(id)) return; setDone((d) => [...d, id]); api.post(`/api/lessons/${id}/watched`, {}).catch(() => {}); };
  useReveal(data);

  if (!user) return null;
  if (err) return <section className="page-head"><div className="container"><h1>{err}</h1></div></section>;
  if (!data) return <section className="page-head"><div className="container"><h1>...</h1></div></section>;

  const c = data.course;
  const title = lang === 'ar' ? c.titleAr : (c.titleEn || c.titleAr);

  return (
    <section className="dash-head"><div className="container">
      <div className="dash-hello rv"><h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name={c.icon} size={30} /> {title}</h1>
        <p>{data.lessons.length} {t('lessons')} · {done.length}/{data.lessons.length} {t('lanternWatched')}</p>
        <div className="lantern-bar"><i style={{ width: `${data.lessons.length ? Math.round(done.length / data.lessons.length * 100) : 0}%` }}></i></div></div>
      <div className="dash-grid" style={{ marginTop: 30, paddingBottom: 90 }}>
        <div>
          <div className="video-wrap rv" onContextMenu={(e) => e.preventDefault()}>
            {current
              ? <><video key={current.id} ref={vref} controls controlsList="nodownload noplaybackrate" disablePictureInPicture preload="metadata"
                  onLoadedMetadata={() => { api.get(`/api/lessons/${current.id}/resume`).then((r) => { const v = vref.current; if (v && r.sec > 5 && r.sec < v.duration - 5) v.currentTime = r.sec; }).catch(() => {}); }}
                  onEnded={() => markWatched(current.id)}
                  onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration && v.currentTime / v.duration >= 0.9) markWatched(current.id);
                    const now = Date.now(); if (!v.paused && now - lastTick.current.t > 10000) { const delta = lastTick.current.t ? Math.min(30, (now - lastTick.current.t) / 1000) : 0; lastTick.current.t = now; api.post(`/api/lessons/${current.id}/watch`, { pos: v.currentTime, dur: v.duration || 0, delta }).catch(() => {}); } }}
                  src={`/api/videos/${current.id}/stream`}></video>
                  <div className="watermark" aria-hidden="true"><span>{user.name} · #{user.id}</span><span>{user.name} · #{user.id}</span></div></>
              : <div className="video-empty"><span className="big-ic"><Icon name="video" size={46} strokeWidth={1.3} /></span>{lang === 'ar' ? 'الفيديوهات هتترفع قريب' : 'Videos coming soon'}</div>}
          </div>
          {current && <h2 style={{ marginTop: 20, fontWeight: 800, fontSize: 20, color: 'var(--teal-dark)' }}>
            {lang === 'ar' ? current.titleAr : (current.titleEn || current.titleAr)}</h2>}
          {current && <LessonExtras key={`le${current.id}`} lesson={current} lang={lang} user={user} getTime={() => (vref.current ? vref.current.currentTime : 0)} seek={(sec) => { const v = vref.current; if (v) { v.currentTime = sec; v.play().catch(() => {}); window.scrollTo({ top: 0, behavior: 'smooth' }); } }} />}
          {current && current.examCount > 0 && <ExamCard key={`ex${current.id}`} lesson={current} t={t} lang={lang} />}
        </div>
        <div>
          {err2 && <div className="msg-err" onClick={() => setErr2('')}>{err2}</div>}
          <div className="panel rv rv-d1"><h2><Icon name="book" size={18} /> {t('courseContent')}</h2>
            {data.lessons.map((l, i) => (
              <div className={`lesson-item ${current && current.id === l.id ? 'on' : ''}`} key={l.id}
                onClick={() => (l.locked ? setErr2(lang === 'ar' ? 'خلّص الدرس اللي قبله الأول عشان يفتح' : 'Finish the previous lesson first') : l.hasVideo && setCurrent(l))}
                style={{ opacity: l.hasVideo && !l.locked ? 1 : .55, cursor: l.hasVideo ? 'pointer' : 'default' }}>
                <span className="lnum">{i + 1}</span>
                <span className="lt">{lang === 'ar' ? l.titleAr : (l.titleEn || l.titleAr)}
                  {l.examCount > 0 && <span className="ex-badge"><Icon name="quiz" size={12} /> {l.examBest ? `${l.examBest.pct}%` : t('exam')}</span>}
                </span>
                <span className="ld">{l.duration}</span>
                <span>{done.includes(l.id) ? <span className="done-ic"><Icon name="check" size={14} /></span> : l.locked ? <Icon name="lock" size={14} /> : l.hasVideo ? <Icon name="play" size={14} /> : <Icon name="lock" size={14} />}</span>
              </div>
            ))}
          </div>
          <div className="panel rv rv-d2" style={{ marginTop: 18 }}><h2><Icon name="refresh" size={18} /> {lang === 'ar' ? 'المراجعة النهائية' : 'Final review'}</h2>
            <p className="hint">{lang === 'ar' ? 'بتجمع كل الأسئلة اللي غلطت فيها في امتحانات الكورس.' : 'Collects every question you got wrong in this course.'}</p>
            <button className="mini-btn go" onClick={() => api.get(`/api/courses/${courseId}/wrong`).then((d) => setWrong(d.items))}>{lang === 'ar' ? 'اعرض أسئلتي الغلط' : 'Show my wrong answers'}</button>
            {wrong && wrong.length === 0 && <p className="hint">{lang === 'ar' ? 'مفيش أسئلة غلط، ممتاز!' : 'None, great!'}</p>}
            {wrong && wrong.map((w) => <div className="rev-card no" key={w.id}><b>{w.q}</b><div className="hint">{w.lesson}</div>{w.correctText ? <div className="rev-line">{lang === 'ar' ? 'الصح:' : 'Correct:'} {w.correctText}</div> : <div className="hint">{lang === 'ar' ? 'الإجابة بتظهر بعد قفل الامتحان' : 'Answer shown after the exam closes'}</div>}</div>)}
          </div>
        </div>
      </div>
    </div></section>
  );
}
