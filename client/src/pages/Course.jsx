import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useReveal } from './shared.jsx';
import Icon from '../components/Icon.jsx';

export default function Course({ id }) {
  const { t, lang, user, nav } = useApp();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get(`/api/courses/${id}`).then(setData).catch((e) => setErr(e.message)); }, [id, user]);
  useReveal(data);

  if (err) return <section className="page-head"><div className="container"><h1>{err}</h1></div></section>;
  if (!data) return <section className="page-head"><div className="container"><h1>...</h1></div></section>;

  const c = data.course;
  const title = lang === 'ar' ? c.titleAr : (c.titleEn || c.titleAr);
  const desc = lang === 'ar' ? c.descAr : (c.descEn || c.descAr);
  const locked = !data.hasAccess;

  return (
    <section className="course-hero"><div className="container">
      <div className={`ch-banner ${c.theme} ${c.coverUrl ? 'has-img' : ''}`}>{c.coverUrl ? <img className="cover-img" src={c.coverUrl} alt="" /> : <span className="ic-big"><Icon name={c.icon} size={72} strokeWidth={1.2} /></span>}</div>
      <div className="ch-info rv"><div className="ch-card">
        <div><h1>{title}</h1><div className="meta">{data.lessons.length} {t('lessons')}</div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {!data.hasAccess && <span className="price-pill"><span className="num">{c.price}</span><span className="cur">{t('currency')}</span></span>}
          {data.hasAccess
            ? <a className="btn-grad-pill" style={{ padding: '12px 28px', fontSize: 15 }} href={`#/watch/${c.id}`}>{t('watchCourse')}</a>
            : data.requestStatus === 'pending'
              ? <span className="tag wait" style={{ fontSize: 14, padding: '10px 18px' }}>{t('pending')}</span>
              : <a className="btn-grad-pill" style={{ padding: '12px 28px', fontSize: 15 }}
                  href={user ? `#/payment/${c.id}` : '#/login'}
                  onClick={(e) => { if (!user) { e.preventDefault(); nav('/login'); } }}>{t('subscribeNow')}</a>}
        </div>
      </div></div>
      <div className="share-row"><a className="wa-share" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${title} - منصة نور\n${window.location.origin}/#/course/${c.id}`)}`}><Icon name="share" size={15} /> {lang === 'ar' ? 'شارك الكورس على واتساب' : 'Share on WhatsApp'}</a>
        {c.sequential && <span className="tag go"><Icon name="lock" size={12} /> {lang === 'ar' ? 'الدروس بتفتح بالترتيب' : 'Lessons unlock in order'}</span>}</div>
      <div className="two-col">
        <div className="lessons rv">
          <div className="lessons-head"><h2><Icon name="book" size={19} /> {t('courseContent')}</h2></div>
          {data.lessons.map((l, i) => (
            <div className="lesson" key={l.id}><div className="lrow">
              <span className="lnum">{i + 1}</span>
              <span className="lt">{lang === 'ar' ? l.titleAr : (l.titleEn || l.titleAr)}
                {l.examCount > 0 && <span className="ex-badge"><Icon name="quiz" size={12} /> {lang === 'ar' ? 'امتحان' : 'Quiz'}</span>}
              </span>
              <span className="ld">{l.duration}</span>
              <span className="lic">{locked || l.locked ? <Icon name="lock" size={15} /> : (l.hasVideo ? <Icon name="play" size={15} /> : '—')}</span>
            </div></div>
          ))}
        </div>
        <div>
          <div className="side-card rv"><h3><Icon name="sparkles" size={17} /> {lang === 'ar' ? 'عن الكورس' : 'About'}</h3>
            <p style={{ color: 'var(--gray)', fontSize: 14, fontWeight: 700, lineHeight: 2 }}>{desc}</p>
          </div>
          {locked && (
            <div className="side-card rv"><h3><Icon name="card" size={17} /> {lang === 'ar' ? 'الاشتراك' : 'Subscribe'}</h3>
              <p style={{ color: 'var(--gray)', fontSize: 13.5, fontWeight: 700, lineHeight: 2, marginBottom: 14 }}>
                {lang === 'ar' ? 'الكورس بيتفتح بعد الدفع اليدوي وموافقة الإدارة على طلبك.' : 'The course opens after manual payment and admin approval.'}
              </p>
              {data.requestStatus !== 'pending' &&
                <a className="btn-solid" style={{ width: '100%', justifyContent: 'center' }}
                   href={user ? `#/payment/${c.id}` : '#/login'}>{user ? t('goPayment') : t('mustLogin')}</a>}
              {data.requestStatus === 'pending' && <span className="tag wait">{t('requestPending')}</span>}
            </div>
          )}
        </div>
      </div>
      <div style={{ height: 90 }}></div>
    </div></section>
  );
}
