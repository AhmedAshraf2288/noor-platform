import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';

function Count({ to, lite }) {
  const [v, setV] = useState(lite ? to : 0);
  const ref = useRef(null);
  useEffect(() => {
    if (lite) { setV(to); return undefined; }
    let raf, started = false;
    const run = () => { const t0 = performance.now(); const step = (n) => { const p = Math.min(1, (n - t0) / 1400); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); };
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting && !started) { started = true; run(); } }, { threshold: .3 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, lite]);
  return <span ref={ref}>{v.toLocaleString('en-US')}</span>;
}

// Animated live counters: students enrolled, courses, lessons (read live from the database)
export default function Counters({ lang, lite }) {
  const [s, setS] = useState(null);
  useEffect(() => { const f = () => api.get('/api/public/stats').then(setS).catch(() => {}); f(); const iv = setInterval(f, 30000); return () => clearInterval(iv); }, []);
  if (!s) return null;
  const items = [['users', s.students, lang === 'ar' ? 'طالب مسجل' : 'Students'], ['book', s.courses, lang === 'ar' ? 'كورس' : 'Courses'], ['video', s.lessons, lang === 'ar' ? 'درس' : 'Lessons'], ['grad', s.enrollments, lang === 'ar' ? 'اشتراك' : 'Enrollments']];
  return (
    <section className="counters"><div className="container"><div className="counter-grid">
      {items.map(([ic, n, l]) => (<div className="counter" key={l}><Icon name={ic} size={26} /><b><Count to={n} lite={lite} /></b><span>{l}</span></div>))}
    </div></div></section>
  );
}
