import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useReveal } from './shared.jsx';
import ChangePassword from '../components/ChangePassword.jsx';
import Icon from '../components/Icon.jsx';
import Lantern from '../components/Lantern.jsx';
import StudentExtras from '../components/StudentExtras.jsx';

export default function Student() {
  const { t, lang, user, nav } = useApp();
  const [courses, setCourses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [prog, setProg] = useState({});
  useEffect(() => {
    if (!user) { nav('/login'); return; }
    if (user.role === 'admin') { nav('/admin'); return; }
    Promise.all([api.get('/api/my-courses'), api.get('/api/requests/mine')])
      .then(([c, r]) => { setCourses(c.courses); setRequests(r.requests); })
      .catch(() => {});
    api.get('/api/progress').then((d) => setProg(d.courses || {})).catch(() => {});
  }, [user]);
  useReveal(courses.length + requests.length);
  if (!user) return null;

  const statusTag = (s) => s === 'pending' ? <span className="tag wait">{t('pending')}</span>
    : s === 'approved' ? <span className="tag ok">{t('approved')}</span>
    : <span className="tag stop">{t('rejected')}</span>;

  return (
    <section className="dash-head"><div className="container">
      <div className="dash-hello"><span className="sparkle" style={{ top: 20, left: 30 }}><Icon name="sparkles" size={18} /></span>
        <h1>{t('hello')} {user.name}</h1>
        <p>{lang === 'ar' ? 'دي كورساتك وطلباتك. أي كورس مفتوح تقدر تتفرج عليه فوراً' : 'Your courses and requests. Any open course is watchable now'}</p>
        {!user.active && <p style={{ marginTop: 10 }}><span className="tag wait"><Icon name="clock" size={13} /> {lang === 'ar' ? 'حسابك بانتظار التفعيل من الإدارة' : 'Your account is pending admin activation'}</span></p>}
      </div>
      <div className="dash-grid" style={{ marginTop: 30 }}>
        <div>
          {courses.length > 0 && (
            <div className="panel rv lantern-panel" style={{ marginBottom: 26 }}>
              <h2><Icon name="sparkles" size={18} /> {t('lanternTitle')}</h2>
              <p className="lantern-sub">{t('lanternSub')}</p>
              <div className="lantern-grid">
                {courses.map((c) => {
                  const p = prog[c.id] || { watched: 0, total: c.lesson_count };
                  const pct = p.total ? Math.round((p.watched / p.total) * 100) : 0;
                  const lvl = pct === 0 ? t('lvl0') : pct < 50 ? t('lvl1') : pct < 100 ? t('lvl2') : t('lvl3');
                  return (
                    <a className="lantern-item" key={c.id} href={`#/watch/${c.id}`}>
                      <Lantern pct={pct} size={92} uid={`s${c.id}`} />
                      <b>{lang === 'ar' ? c.title_ar : (c.title_en || c.title_ar)}</b>
                      <span className="lantern-pct">{pct}% · {lvl}</span>
                      <span className="lantern-cnt">{p.watched}/{p.total} {t('lessons')}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          <div className="panel rv"><h2><Icon name="book" size={18} /> {t('myCourses')} <a className="more" href="#/courses">{t('allCourses')} ←</a></h2>
            {courses.length === 0 && <p style={{ color: 'var(--gray)', fontWeight: 700 }}>{t('noCourses')}</p>}
            {courses.map((c) => (
              <div className="my-course" key={c.id}>
                <span className={`mc-ic ${c.theme}`}><Icon name={c.icon} size={26} /></span>
                <div className="mc-b"><div className="mc-t">{lang === 'ar' ? c.title_ar : (c.title_en || c.title_ar)}</div>
                  <div className="mc-m">{c.lesson_count} {t('lessons')}</div></div>
                <a className="mini-btn go" href={`#/watch/${c.id}`}>{t('watchCourse')}</a>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="panel rv"><h2><Icon name="list" size={18} /> {t('myRequests')}</h2>
            {requests.length === 0 && <p style={{ color: 'var(--gray)', fontWeight: 700 }}>{t('noRequests')}</p>}
            {requests.map((r) => (
              <div className="my-course" key={r.id}>
                <span className={`mc-ic ${r.theme}`}><Icon name={r.icon} size={26} /></span>
                <div className="mc-b"><div className="mc-t">{lang === 'ar' ? r.title_ar : (r.title_en || r.title_ar)}</div>
                  <div className="mc-m">{r.method === 'instapay' ? t('methodInstapay') : t('methodWallet')}</div></div>
                {statusTag(r.status)}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 26 }}><StudentExtras lang={lang} courses={courses} user={user} /></div>
          <div className="panel rv rv-d1" style={{ marginTop: 26 }}><h2><Icon name="settings" size={18} /> {t('account')}</h2>
            <p style={{ color: 'var(--gray)', fontWeight: 700, fontSize: 13.5, marginTop: -8, marginBottom: 16 }} dir="ltr">{user.email}</p>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--slate)', marginBottom: 12 }}><Icon name="lock" size={15} /> {t('changePassword')}</h3>
            <ChangePassword />
          </div>
        </div>
      </div>
    </div></section>
  );
}
