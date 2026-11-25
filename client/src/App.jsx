import { sget, sset, sdel } from './secureStore.js';
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { api } from './api.js';
import { dict } from './i18n.js';
import Home from './pages/Home.jsx';
import Courses from './pages/Courses.jsx';
import Course from './pages/Course.jsx';
import Payment from './pages/Payment.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Student from './pages/Student.jsx';
import Watch from './pages/Watch.jsx';
import Admin from './pages/Admin.jsx';
import Exam from './pages/Exam.jsx';
import Icon from './components/Icon.jsx';
import Bell from './components/Bell.jsx';
import FaqBot from './components/FaqBot.jsx';
import { Live, Leaderboard, Paths, Verify, Doc, Parent, Mod } from './pages/Extra.jsx';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

function parseHash() {
  const h = window.location.hash.replace(/^#/, '') || '/';
  const parts = h.split('/').filter(Boolean);
  return { path: h, parts };
}

function NotFound() {
  const { t } = useApp();
  return (
    <section className="page-head"><div className="container" style={{ textAlign: 'center' }}>
      <h1 style={{ fontSize: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}><Icon name="compass" size={52} /> 404</h1>
      <h1><span className="g1">{t('notFoundTitle')}</span></h1>
      <p className="sub">{t('notFoundMsg')}</p>
      <p style={{ marginTop: 22 }}><a className="btn-outline-ring" href="#/">{t('backHome')}</a></p>
    </div></section>
  );
}
export default function App() {
  const [route, setRoute] = useState(parseHash());
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);
  const [lang, setLang] = useState(() => sget('noor-lang') || 'ar');
  const [dark, setDark] = useState(() => sget('noor-dark') === '1');
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState({});
  const [lite, setLite] = useState(() => sget('noor-lite') === '1');
  const loadTheme = useCallback(() => api.get('/api/public/theme').then(setTheme).catch(() => {}), []);
  useEffect(() => { loadTheme(); window.addEventListener('noor-theme', loadTheme); return () => window.removeEventListener('noor-theme', loadTheme); }, [loadTheme]);
  useEffect(() => {
    const r = document.documentElement.style;
    if (theme.primary) { r.setProperty('--teal', theme.primary); r.setProperty('--teal-dark', theme.primary); } else { r.removeProperty('--teal'); r.removeProperty('--teal-dark'); }
    if (theme.accent) r.setProperty('--sky', theme.accent); else r.removeProperty('--sky');
  }, [theme]);
  useEffect(() => { document.body.classList.toggle('lite', lite); sset('noor-lite', lite ? '1' : '0'); }, [lite]);
  const menuRef = useRef(null);

  const t = useCallback((k) => (dict[lang] && dict[lang][k]) || dict.ar[k] || k, [lang]);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    sset('noor-lang', lang);
  }, [lang]);

  useEffect(() => {
    document.body.classList.toggle('dark', dark);
    sset('noor-dark', dark ? '1' : '0');
  }, [dark]);

  useEffect(() => {
    api.get('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setBooted(true));
  }, []);

  // Close the mobile menu and jump to top whenever the route changes
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0); }, [route.path]);

  // GSAP: soft fade/slide on every page change
  const pageRef = useRef(null);
  useEffect(() => {
    if (pageRef.current) gsap.fromTo(pageRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .45, ease: 'power2.out' });
  }, [route.path, booted]);

  // GSAP: slide the mobile menu in/out
  useEffect(() => {
    if (!menuRef.current) return;
    if (menuOpen) {
      gsap.fromTo(menuRef.current, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: .38, ease: 'power3.out' });
      gsap.fromTo(menuRef.current.querySelectorAll('a'), { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: .3, stagger: .06, delay: .08, ease: 'power2.out' });
    } else {
      gsap.to(menuRef.current, { height: 0, opacity: 0, duration: .28, ease: 'power2.in' });
    }
  }, [menuOpen]);

  const nav = (to) => { window.location.hash = to; window.scrollTo(0, 0); };
  const logout = async () => { try { await api.logout(); } catch { /* ignore */ } setUser(null); nav('/'); };

  const ctx = { user, setUser, t, lang, setLang, dark, setDark, nav, lite, setLite, theme };

  let page = null;
  const [p0, p1] = route.parts;
  if (!p0) page = <Home />;
  else if (p0 === 'courses') page = <Courses />;
  else if (p0 === 'course' && p1) page = <Course id={p1} />;
  else if (p0 === 'payment' && p1) page = <Payment courseId={p1} />;
  else if (p0 === 'login') page = <Login />;
  else if (p0 === 'register') page = <Register />;
  else if (p0 === 'student') page = <Student />;
  else if (p0 === 'watch' && p1) page = <Watch courseId={p1} />;
  else if (p0 === 'admin') page = <Admin />;
  else if (p0 === 'exam' && p1) page = <Exam lessonId={p1} />;
  else if (p0 === 'live') page = <Live />;
  else if (p0 === 'leaderboard') page = <Leaderboard />;
  else if (p0 === 'paths') page = <Paths />;
  else if (p0 === 'verify' && p1) page = <Verify code={p1} />;
  else if (p0 === 'doc' && p1 && route.parts[2]) page = <Doc kind={p1} id={route.parts[2]} />;
  else if (p0 === 'parent' && p1) page = <Parent token={p1} />;
  else if (p0 === 'mod') page = <Mod />;
  else page = <NotFound />;

  const maint = theme.maintenance && !(user && user.role === 'admin') && p0 !== 'login';
  if (maint) page = (<section className="page-head"><div className="container" style={{ textAlign: 'center' }}><h1 style={{ display: 'flex', justifyContent: 'center' }}><Icon name="settings" size={56} /></h1><h1><span className="g1">{lang === 'ar' ? 'الموقع تحت الصيانة' : 'Under maintenance'}</span></h1><p className="sub">{theme.maintenanceMsg || (lang === 'ar' ? 'هنرجع قريب جداً، شكراً لصبرك.' : 'We will be back very soon.')}</p><p style={{ marginTop: 18 }}><a className="login-link" href="#/login">{t('login')}</a></p></div></section>);

  return (
    <AppCtx.Provider value={ctx}>
      <nav className="navbar"><div className="container">
        <a className="logo-stack" href="#/" style={{ cursor: 'pointer' }}>
          {theme.logoUrl ? <img className="site-logo" src={theme.logoUrl} alt="logo" /> : <><span className="l1">نــور</span>
          <span className="l2">التعليمية<svg viewBox="0 0 100 8" preserveAspectRatio="none"><path d="M2 5 Q 50 9 98 3" stroke="#43798E" strokeWidth="2.4" fill="none" strokeLinecap="round"/></svg></span></>}
        </a>
        <div className="toggle" onClick={() => setDark(!dark)}><span><Icon name="sun" size={12} /></span><span><Icon name="moon" size={12} /></span><span className="knob"></span></div>
        <button className="lang-btn lite-btn" title={lang === 'ar' ? 'وضع الإنترنت الضعيف' : 'Light mode for slow internet'} onClick={() => setLite(!lite)}>{lite ? (lang === 'ar' ? 'عادي' : 'Full') : (lang === 'ar' ? 'خفيف' : 'Lite')}</button>
        <button className="lang-btn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'EN' : 'عربي'}</button>
        <div className="nav-spacer"></div>
        <div className="nav-links">
          {user && user.role !== 'admin' && <a className="login-link" href="#/live">{lang === 'ar' ? 'لايف' : 'Live'}</a>}
          {user && user.role !== 'admin' && <a className="login-link" href="#/leaderboard">{lang === 'ar' ? 'لوحة الشرف' : 'Honor'}</a>}
          <a className="login-link" href="#/paths">{lang === 'ar' ? 'المسارات' : 'Paths'}</a>
          {user && user.role === 'mod' && <a className="login-link" href="#/mod">{lang === 'ar' ? 'المشرف' : 'Mod'}</a>}
          {user && user.role === 'admin' && <a className="login-link" href="#/admin">{t('adminTag')} <Icon name="shield" size={13} /></a>}
          {user && user.role !== 'admin' && <a className="login-link" href="#/student">{t('myDashboard')} <Icon name="book" size={13} /></a>}
          {user && <Bell lang={lang} />}
          {user
            ? <a className="btn-solid" href="#/" onClick={(e) => { e.preventDefault(); logout(); }}>{t('logout')}</a>
            : <>
                <a className="login-link" href="#/login">{t('login')}</a>
                <a className="btn-solid" href="#/register">{t('register')}</a>
              </>}
        </div>
        <button className={`burger ${menuOpen ? 'open' : ''}`} aria-label="menu" onClick={() => setMenuOpen(!menuOpen)}>
          <span></span><span></span><span></span>
        </button>
      </div>
      <div ref={menuRef} className="mobile-menu" style={{ height: 0, opacity: 0, overflow: 'hidden' }}>
        {user && user.role === 'admin' && <a href="#/admin">{t('adminTag')} <Icon name="shield" size={13} /></a>}
        {user && user.role !== 'admin' && <a href="#/student">{t('myDashboard')} <Icon name="book" size={13} /></a>}
        <a href="#/courses">{t('allCourses')}</a>
        <a href="#/paths">{lang === 'ar' ? 'المسارات' : 'Paths'}</a>
        {user && user.role !== 'admin' && <a href="#/live">{lang === 'ar' ? 'حصص لايف' : 'Live'}</a>}
        {user && user.role !== 'admin' && <a href="#/leaderboard">{lang === 'ar' ? 'لوحة الشرف' : 'Honor board'}</a>}
        {user && user.role === 'mod' && <a href="#/mod">{lang === 'ar' ? 'لوحة المشرف' : 'Moderator'}</a>}
        {user && <a href="#/student">{lang === 'ar' ? 'الإشعارات' : 'Notifications'} <Icon name="bell" size={13} /></a>}
        {user
          ? <a href="#/" onClick={(e) => { e.preventDefault(); logout(); }}>{t('logout')}</a>
          : <>
              <a href="#/login">{t('login')}</a>
              <a href="#/register">{t('register')}</a>
            </>}
      </div>
      <div className="progress-track"><div className="progress-moving" id="pbar"></div></div></nav>
      <ScrollBar />
      <div className="page-fade" key={route.path} ref={pageRef}>
        {booted ? page : <div style={{ padding: 200, textAlign: 'center', fontWeight: 800 }}>نور...</div>}
      </div>
      <FaqBot lang={lang} />
      <footer className="footer">
        <div className="flogo"><span className="l1">نــور</span><span className="l2">التعليمية</span></div>
        <p className="tag">التعلم أسهل من أي وقت</p>
        <div className="hr"></div>
        <div className="dev"><span><span className="brackets">&lt;</span> Developed By <span className="brackets">&gt;</span> فريق نور</span>
        <span><span className="brackets">&lt;</span> All Copy Rights Reserved @2026 <span className="brackets">&gt;</span></span></div>
      </footer>
    </AppCtx.Provider>
  );
}

function ScrollBar() {
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const bar = document.getElementById('pbar');
      if (bar) bar.style.width = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) * 100).toFixed(2) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return null;
}
