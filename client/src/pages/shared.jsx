import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Icon from '../components/Icon.jsx';
import { api } from '../api.js';

gsap.registerPlugin(ScrollTrigger);
document.documentElement.classList.remove('no-gsap');

// Reveals .rv children with GSAP when they enter the viewport (staggered, smooth)
export function useReveal(dep) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current || document;
    const els = root.querySelectorAll ? Array.from(root.querySelectorAll('.rv:not(.in)')) : [];
    if (!els.length) return undefined;
    const groups = new Map();
    els.forEach((el) => { const p = el.parentElement; groups.set(p, (groups.get(p) || 0) + 1); });
    const seen = new Map();
    const tweens = els.map((el) => {
      const base = el.classList.contains('rv-d1') ? .08 : el.classList.contains('rv-d2') ? .18 : el.classList.contains('rv-d3') ? .28 : 0;
      const p = el.parentElement;
      const gi = seen.get(p) || 0; seen.set(p, gi + 1);
      const delay = base + gi * .09;
      return gsap.fromTo(el, { opacity: 0, y: 40, scale: .96 }, {
        opacity: 1, y: 0, scale: 1, duration: .9, delay, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onComplete: () => { el.classList.add('in'); gsap.set(el, { clearProps: 'all' }); },
      });
    });
    ScrollTrigger.refresh();
    return () => tweens.forEach((tw) => { if (tw.scrollTrigger) tw.scrollTrigger.kill(); tw.kill(); });
  }, [dep]);
  return ref;
}

export function Sign({ title }) {
  return (
    <div className="sign-wrap rv">
      <svg className="sign-ropes" width="150" viewBox="0 0 150 60"><circle cx="75" cy="6" r="4" fill="#8A6D5A"/><path d="M75 8 L28 56" stroke="#B08968" strokeWidth="2.6" fill="none"/><path d="M75 8 L122 56" stroke="#B08968" strokeWidth="2.6" fill="none"/></svg>
      <div className="sign"><h2>{title}</h2></div>
    </div>
  );
}

export function CourseCard({ c, t, actions }) {
  return (
    <div className="course-card rv">
      <div className={`course-cover ${c.theme} ${c.coverUrl ? 'has-img' : ''}`}>{c.coverUrl && <img className="cover-img" src={c.coverUrl} alt="" loading="lazy" />}<span className="logo-mark">نور</span>{!c.coverUrl && <span className="ic-big"><Icon name={c.icon} size={56} strokeWidth={1.3} /></span>}</div>
      <div className="course-body"><h3>{c.title}</h3><div className="teal-divider"></div>
        <p className="desc">{c.desc}</p>
        <div className="course-actions">{actions}</div>
        <div className="course-foot"><div className="dates">{c.lessonCount} {t('lessons')} <Icon name="video" size={14} /></div>
          <span className="price-pill"><span className="num">{c.price}</span><span className="cur">{t('currency')}</span></span></div>
      </div>
    </div>
  );
}

export function mapCourse(c, lang) {
  return {
    id: c.id,
    title: lang === 'ar' ? c.titleAr : (c.titleEn || c.titleAr),
    desc: lang === 'ar' ? c.descAr : (c.descEn || c.descAr),
    price: c.price, icon: c.icon, theme: c.theme, coverUrl: c.coverUrl || null, lessonCount: c.lessonCount ?? c.lesson_count ?? 0,
  };
}

// Course ids the logged-in user can already open (admin: all). Used to swap "subscribe" buttons for "watch".
export function useOwned(user) {
  const [owned, setOwned] = React.useState(new Set());
  const [all, setAll] = React.useState(false);
  React.useEffect(() => {
    if (!user) { setOwned(new Set()); setAll(false); return; }
    if (user.role === 'admin') { setAll(true); return; }
    api.get('/api/my-courses').then((d) => setOwned(new Set(d.courses.map((c) => c.id)))).catch(() => {});
  }, [user && user.id]);
  return (id) => all || owned.has(id);
}
