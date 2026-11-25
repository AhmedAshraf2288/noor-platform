import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { CourseCard, mapCourse, useReveal, useOwned } from './shared.jsx';
import Icon from '../components/Icon.jsx';

export default function Courses() {
  const { t, lang, user } = useApp();
  const isOwned = useOwned(user);
  const [courses, setCourses] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/api/courses').then((d) => setCourses(d.courses)).catch(() => {}); }, []);
  useReveal(courses.length);
  const shown = courses.filter((c) => !q || (c.titleAr + ' ' + c.titleEn).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <section className="page-head"><div className="container">
        <h1><span className="g1">{lang === 'ar' ? 'كل' : 'All'}</span> <span className="g2">{lang === 'ar' ? 'الكورسات' : 'Courses'}</span></h1>
        <p className="sub">{t('coursesPageSub')}</p>
      </div></section>
      <section className="page-sec"><div className="container">
        <div className="search-wrap"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} /><span className="sic"><Icon name="search" size={16} /></span></div>
        <div className="course-grid" style={{ marginTop: 34 }}>
          {shown.map((c) => {
            const m = mapCourse(c, lang);
            return <CourseCard key={c.id} c={m} t={t} actions={<>
              <a className="btn-ghost-pill" href={`#/course/${c.id}`}>{t('enterCourse')}</a>
              {isOwned(c.id)
                ? <a className="btn-grad-pill" href={`#/watch/${c.id}`}>{t('watchCourse')}</a>
                : <a className="btn-grad-pill" href={`#/course/${c.id}`}>{t('subscribeNow')}</a>}
            </>} />;
          })}
        </div>
      </div></section>
    </>
  );
}
