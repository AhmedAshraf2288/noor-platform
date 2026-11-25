import React, { useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Sign, CourseCard, mapCourse, useReveal, useOwned } from './shared.jsx';
import Icon from '../components/Icon.jsx';
import Counters from '../components/Counters.jsx';

export default function Home() {
  const { t, lang, nav, user, lite } = useApp();
  const isOwned = useOwned(user);
  const [courses, setCourses] = useState([]);
  useEffect(() => { api.get('/api/courses').then((d) => setCourses(d.courses.slice(0, 3))).catch(() => {}); }, []);
  useReveal(courses.length);

  // GSAP: hero entrance + continuous floating art
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.timeline()
        .fromTo('.hero-title', { opacity: 0, y: 44, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .9, ease: 'power3.out' }, .1)
        .fromTo('.hero-sub', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: .8, ease: 'power3.out' }, .35)
        .fromTo('.hero .btn-outline-ring', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: .7, ease: 'power3.out' }, .55);
      gsap.to('.hero-art .mini', { y: -17, rotation: 12, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: .7 });
      gsap.to('.hero-art .sparkle', { scale: 1.4, opacity: .45, duration: 1.35, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: .3 });
      gsap.to('.orb', { y: -34, duration: 6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 1.3 });
      gsap.fromTo('.hero-art', { opacity: 0, scale: .92 }, { opacity: 1, scale: 1, duration: 1.1, ease: 'power2.out', delay: .3 });
      // Hanging signs swing gently; feature icons float; track cards tilt in on scroll
      gsap.utils.toArray('.sign-wrap').forEach((w) => {
        gsap.fromTo(w, { rotation: -1.6 }, { rotation: 1.6, transformOrigin: '50% 0%', duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      });
      gsap.to('.feat-card .ic', { y: -7, duration: 1.9, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: .45 });
      gsap.utils.toArray('.track-wrap').forEach((w, i) => {
        gsap.fromTo(w, { y: 70, rotation: i % 2 ? 3 : -3, opacity: 0 },
          { y: 0, rotation: 0, opacity: 1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: w, start: 'top 88%', once: true } });
      });
      gsap.to('.track-card .face', { y: -10, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: .8 });
    });
    return () => ctx.revert();
  }, [lang]);

  return (
    <>
      <section className="hero">
        <span className="orb o1"></span><span className="orb o2"></span><span className="orb o3"></span>
        <div className="container"><div className="hero-grid">
          <div>
            <h1 className="hero-title"><span className="c1">{t('heroTitle1')}</span> <span className="c2">{t('heroTitle2')}</span></h1>
            <p className="hero-sub" dangerouslySetInnerHTML={{ __html: t('heroSub') }}></p>
            {user
              ? <a className="btn-outline-ring" href={user.role === 'admin' ? '#/admin' : '#/student'}>{user.role === 'admin' ? t('openAdminPanel') : t('continueLearning')}</a>
              : <a className="btn-outline-ring" href="#/register">{t('joinUs')}</a>}
          </div>
          <div className="hero-art">
            <span className="ring" style={{ top: 10, right: 40, width: 330, height: 330 }}></span>
            <span className="ring" style={{ bottom: 0, left: 30, width: 260, height: 260, borderColor: 'rgba(224,82,99,.35)' }}></span>
            <img className="sp" style={{ top: -30, right: -10, width: 260 }} src="/spiral-square.svg" />
            <img className="sp" style={{ bottom: -40, left: 0, width: 230 }} src="/spiral-square.svg" />
            <div className="blob1"><Icon name="grad" size={58} strokeWidth={1.3} /></div>
            <div className="blob2"></div>
            <span className="mini" style={{ top: 30, left: 120 }}><Icon name="sparkles" size={30} /></span>
            <span className="mini" style={{ top: 120, left: 60 }}><Icon name="atom" size={36} /></span>
            <span className="sparkle" style={{ top: 56, right: 300 }}><Icon name="sparkles" size={16} /></span>
            <span className="sparkle" style={{ bottom: 120, right: 30, fontSize: 15 }}><Icon name="sparkles" size={16} /></span>
            <span className="sparkle" style={{ top: 220, left: 6, fontSize: 13 }}><Icon name="sparkles" size={16} /></span>

          </div>
        </div></div>
      </section>

      <Counters lang={lang} lite={lite} />
      <section style={{ padding: '60px 0 80px' }}><div className="container">
        <Sign title={t('latestCourses')} />
        <p className="section-sub rv">{t('coursesSub')}</p>
        <div className="course-grid">
          {courses.map((c) => {
            const m = mapCourse(c, lang);
            return <CourseCard key={c.id} c={m} t={t} actions={<>
              <a className="btn-ghost-pill" href={`#/course/${c.id}`}>{t('enterCourse')}</a>
              {isOwned(c.id)
                ? <a className="btn-grad-pill" href={`#/watch/${c.id}`}>{t('watchCourse')}</a>
                : <a className="btn-grad-pill" href={`#/course/${c.id}`}>{t('subscribeNow')}</a>}
            </>} />;
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }} className="rv">
          <a className="btn-solid" href="#/courses">{t('allCourses')}</a>
        </div>
      </div></section>

      <section className="features">
        <span className="star" style={{ top: '12%', right: '8%' }}><Icon name="sparkles" size={16} /></span><span className="star" style={{ top: '20%', left: '12%', fontSize: 11 }}><Icon name="sparkles" size={16} /></span>
        <span className="star" style={{ bottom: '18%', left: '22%' }}><Icon name="sparkles" size={16} /></span><span className="star" style={{ bottom: '30%', right: '6%', fontSize: 12 }}><Icon name="sparkles" size={16} /></span>
        <div className="container">
          <Sign title={lang === 'ar' ? 'ليه جامدين ؟' : 'Why are we cool?'} />
          <div className="feat-grid">
            <div className="feat-card rv"><div className="ic"><Icon name="shield" size={30} /></div><h3>{lang === 'ar' ? 'محتوى محمي' : 'Protected content'}</h3><p>{lang === 'ar' ? 'فيديوهات محمية بتفتح بس للطلاب المشتركين في الكورس.' : 'Protected videos open only for enrolled students.'}</p></div>
            <div className="feat-card rv rv-d1"><div className="ic"><Icon name="bulb" size={30} /></div><h3>{lang === 'ar' ? 'شرح أبسط وسهل' : 'Simple explanation'}</h3><p>{lang === 'ar' ? 'محتوى تعليمي مبسط بطريقة سهلة تساعدك على الفهم بدون تعقيد.' : 'Simple, easy educational content with no complexity.'}</p></div>
            <div className="feat-card rv rv-d2"><div className="ic"><Icon name="card" size={30} /></div><h3>{lang === 'ar' ? 'دفع يدوي سهل' : 'Easy manual payment'}</h3><p>{lang === 'ar' ? 'حول بانستاباي أو محفظتك وابعت الإثبات واتساب والإدارة تفتح لك الكورس.' : 'Pay by InstaPay or wallet, send proof on WhatsApp, admin opens the course.'}</p></div>
          </div>
        </div>
      </section>

      <section className="tracks-sec"><div className="container">
        <img className="dna-ornament rv" src="/dna-wave.svg" />
        <Sign title={lang === 'ar' ? 'عايز تتعلم إيه ؟' : 'What do you want to learn?'} />
        <div className="track-grid">
          <div className="track-wrap"><div className="track-card"><span className="track-badge">{lang === 'ar' ? 'مسار البرمجة' : 'Coding track'}</span>
            <div className="big">{lang === 'ar' ? <>البرمجة<br />والتقنية</> : <>Coding<br />& Tech</>}</div>
            <div className="face"><Icon name="code" size={46} strokeWidth={1.4} /></div>
            <a className="track-link" href="#/courses">{lang === 'ar' ? 'تصفح الكورسات' : 'Browse courses'}</a></div></div>
          <div className="track-wrap"><div className="track-card"><span className="track-badge">{lang === 'ar' ? 'مسار اللغات' : 'Languages track'}</span>
            <div className="big">{lang === 'ar' ? <>اللغات<br />والترجمة</> : <>Languages<br />& Translation</>}</div>
            <div className="face"><Icon name="chat" size={46} strokeWidth={1.4} /></div>
            <a className="track-link" href="#/courses">{lang === 'ar' ? 'تصفح الكورسات' : 'Browse courses'}</a></div></div>
        </div>
      </div></section>
    </>
  );
}
