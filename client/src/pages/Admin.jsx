import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useReveal } from './shared.jsx';
import { COUNTRIES, flagEmoji, splitWhatsApp, joinWhatsApp } from '../countries.js';
import CountryPicker from '../components/CountryPicker.jsx';
import ChangePassword from '../components/ChangePassword.jsx';
import Icon, { COURSE_ICONS } from '../components/Icon.jsx';
import { StatsTab, CouponsTab, LiveTab, RefundsTab, GradingTab, ToolsTab, StudentExtra, LessonTools, ExamEditor } from './AdminExtra.jsx';

export default function Admin() {
  const { t, lang, user, nav } = useApp();
  const [tab, setTab] = useState('requests');
  const [students, setStudents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [courses, setCourses] = useState([]);
  const [site, setSite] = useState({ whatsapp: '', instapay: '', wallet: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [grantSel, setGrantSel] = useState({});
  const [extra, setExtra] = useState({});

  const load = () => {
    Promise.all([
      api.get('/api/admin/students'),
      api.get('/api/admin/requests'),
      api.get('/api/admin/courses'),
      api.get('/api/site'),
      api.get('/api/admin/students-extra'),
    ]).then(([s, r, c, si, ex]) => {
      setExtra(Object.fromEntries(ex.students.map((x) => [x.id, x])));
      setStudents(s.students); setRequests(r.requests); setCourses(c.courses); setSite(si);
    }).catch((e) => setErr(e.message));
  };

  useEffect(() => {
    if (!user) { nav('/login'); return; }
    if (user.role !== 'admin') { nav('/student'); return; }
    load();
  }, [user]);
  // Re-run reveals when data lands or the tab changes (new .rv elements enter the DOM)
  useReveal(tab + students.length + requests.length + courses.length);
  if (!user || user.role !== 'admin') return null;

  const run = (p, okMsg) => p.then(() => { setMsg(okMsg); load(); setTimeout(() => setMsg(''), 2500); })
    .catch((e) => { setErr(e.message); setTimeout(() => setErr(''), 3500); });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <section className="dash-head"><div className="container">
      <div className="dash-hello rv" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.12) 1.6px,transparent 1.6px),linear-gradient(135deg,#5B4B8A,#2B1B3C)' }}>
        <h1>{t('adminPanel')}</h1>
        <p>{lang === 'ar' ? 'إدارة الطلاب وطلبات الاشتراك والفيديوهات من مكان واحد' : 'Manage students, subscription requests and videos in one place'}</p>
      </div>
      <div className="dash-stats">
        <div className="dstat rv"><span className="ic b"><Icon name="users" size={24} /></span><div><div className="n">{students.length}</div><div className="t">{lang === 'ar' ? 'طالب مسجل' : 'Students'}</div></div></div>
        <div className="dstat rv rv-d1"><span className="ic g"><Icon name="clock" size={24} /></span><div><div className="n">{pendingCount}</div><div className="t">{lang === 'ar' ? 'طلب بانتظار المراجعة' : 'Pending requests'}</div></div></div>
        <div className="dstat rv rv-d2"><span className="ic r"><Icon name="book" size={24} /></span><div><div className="n">{courses.length}</div><div className="t">{lang === 'ar' ? 'كورس' : 'Courses'}</div></div></div>
        <div className="dstat rv rv-d3"><span className="ic v"><Icon name="video" size={24} /></span><div><div className="n">{courses.reduce((a, c) => a + c.lessons.filter((l) => l.hasVideo).length, 0)}</div><div className="t">{lang === 'ar' ? 'فيديو مرفوع' : 'Videos'}</div></div></div>
      </div>
      {msg && <div className="msg-ok">{msg}</div>}
      {err && <div className="msg-err">{err}</div>}
      <div className="tabs">
        <button className={`tab ${tab === 'requests' ? 'on' : ''}`} onClick={() => setTab('requests')}>{t('requests')} {pendingCount > 0 && <span className="tag wait">{pendingCount}</span>}</button>
        <button className={`tab ${tab === 'students' ? 'on' : ''}`} onClick={() => setTab('students')}>{t('students')}</button>
        <button className={`tab ${tab === 'courses' ? 'on' : ''}`} onClick={() => setTab('courses')}>{t('coursesAdmin')}</button>
        <button className={`tab ${tab === 'settings' ? 'on' : ''}`} onClick={() => setTab('settings')}>{t('settings')}</button>
        {[['stats', lang === 'ar' ? 'الإحصائيات' : 'Stats'], ['coupons', lang === 'ar' ? 'أكواد الخصم' : 'Coupons'], ['live', lang === 'ar' ? 'لايف' : 'Live'], ['grading', lang === 'ar' ? 'التصحيح' : 'Grading'], ['refunds', lang === 'ar' ? 'الاسترداد' : 'Refunds'], ['tools', lang === 'ar' ? 'أدوات الموقع' : 'Site tools']].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>))}
      </div>
      <div style={{ paddingBottom: 90 }}>
        {tab === 'requests' && <RequestsTab requests={requests} t={t} lang={lang} run={run} />}
        {tab === 'students' && <StudentsTab students={students} courses={courses} t={t} lang={lang} run={run} grantSel={grantSel} setGrantSel={setGrantSel} extra={extra} />}
        {tab === 'courses' && <CoursesTab courses={courses} t={t} lang={lang} run={run} />}
        {tab === 'stats' && <StatsTab lang={lang} />}
        {tab === 'coupons' && <CouponsTab lang={lang} courses={courses} run={run} />}
        {tab === 'live' && <LiveTab lang={lang} courses={courses} run={run} />}
        {tab === 'grading' && <GradingTab lang={lang} run={run} />}
        {tab === 'refunds' && <RefundsTab lang={lang} run={run} />}
        {tab === 'tools' && <ToolsTab lang={lang} courses={courses} students={students} run={run} />}
        {tab === 'settings' && <SettingsTab site={site} setSite={setSite} t={t} lang={lang} run={run} />}
      </div>
    </div></section>
  );
}

function RequestsTab({ requests, t, lang, run }) {
  return (
    <div className="panel rv"><h2>{t('requests')}</h2>
      {requests.length === 0 && <p style={{ color: 'var(--gray)', fontWeight: 700 }}>{t('noRequests')}</p>}
      {requests.length > 0 && (
        <table className="tbl"><thead><tr>
          <th>{t('student')}</th><th>{t('course')}</th><th>{t('method')}</th><th>{t('status')}</th><th>{t('action')}</th>
        </tr></thead><tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>{r.student_name}<br /><span style={{ fontSize: 11, color: 'var(--gray)' }} dir="ltr">{r.student_email}</span></td>
              <td>{lang === 'ar' ? r.title_ar : (r.title_en || r.title_ar)}</td>
              <td>{r.method === 'instapay' ? t('methodInstapay') : t('methodWallet')}</td>
              <td>{r.status === 'pending' ? <span className="tag wait">{t('pending')}</span>
                : r.status === 'approved' ? <span className="tag ok">{t('statusApproved')}</span>
                : <span className="tag stop">{t('statusRejected')}</span>}</td>
              <td>{r.status === 'pending' && (<>
                <button className="mini-btn ok" onClick={() => run(api.post(`/api/admin/requests/${r.id}/decide`, { approve: true }), t('statusApproved'))}>{t('approve')}</button>{' '}
                <button className="mini-btn no" onClick={() => run(api.post(`/api/admin/requests/${r.id}/decide`, { approve: false }), t('statusRejected'))}>{t('reject')}</button>
              </>)}</td>
            </tr>
          ))}
        </tbody></table>
      )}
    </div>
  );
}

function StudentsTab({ students, courses, t, lang, run, grantSel, setGrantSel, extra }) {
  return (
    <div className="panel rv"><h2>{t('students')}</h2>
      <table className="tbl"><thead><tr>
        <th>{t('student')}</th><th>{lang === 'ar' ? 'الكورسات المفتوحة' : 'Open courses'}</th><th>{t('status')}</th><th>{t('action')}</th>
      </tr></thead><tbody>
        {students.map((s) => (
          <tr key={s.id}>
            <td>{s.name}<br /><span style={{ fontSize: 11, color: 'var(--gray)' }} dir="ltr">{s.email}</span></td>
            <td>{s.courses || '—'}</td>
            <td>{s.active ? <span className="tag ok">{t('active')}</span> : <span className="tag stop">{t('inactive')}</span>}</td>
            <td>
              <button className={`mini-btn ${s.active ? 'no' : 'ok'}`}
                onClick={() => run(api.post(`/api/admin/students/${s.id}/active`, { active: !s.active }), 'OK')}>
                {s.active ? t('deactivate') : t('activate')}
              </button>{' '}
              <select value={(grantSel[s.id] && grantSel[s.id].c) || ''} onChange={(e) => setGrantSel({ ...grantSel, [s.id]: { c: e.target.value } })}
                style={{ fontFamily: 'inherit', fontWeight: 700, borderRadius: 8, padding: '5px 8px', border: '2px solid #DCE8EE' }}>
                <option value="">{lang === 'ar' ? 'اختار كورس…' : 'Pick course…'}</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{lang === 'ar' ? c.titleAr : (c.titleEn || c.titleAr)}</option>)}
              </select>{' '}
              <button className="mini-btn go" disabled={!(grantSel[s.id] && grantSel[s.id].c)}
                onClick={() => run(api.post(`/api/admin/students/${s.id}/courses`, { courseId: Number(grantSel[s.id].c), grant: true }), 'OK')}>
                {t('openCourse')}
              </button>{' '}
              <button className="mini-btn no" disabled={!(grantSel[s.id] && grantSel[s.id].c)}
                onClick={() => run(api.post(`/api/admin/students/${s.id}/courses`, { courseId: Number(grantSel[s.id].c), grant: false }), 'OK')}>
                {t('closeCourse')}
              </button>
              <StudentExtra s={s} ex={extra[s.id]} lang={lang} run={run} />
            </td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

function CoursesTab({ courses, t, lang, run }) {
  const [forms, setForms] = useState({});
  const [prog, setProg] = useState({}); // cid -> { pct, state }
  const [examFor, setExamFor] = useState(null); // lesson id whose exam editor is open
  const [toolsFor, setToolsFor] = useState(null);
  const [flags, setFlags] = useState({});
  useEffect(() => { api.get('/api/admin/courses-flags').then((d) => setFlags(Object.fromEntries(d.courses.map((c) => [c.id, c.sequential])))).catch(() => {}); }, [courses.length]);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null); // course id being edited, null = create mode
  const [coverFile, setCoverFile] = useState(null);
  const [coverPrev, setCoverPrev] = useState(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [curCover, setCurCover] = useState(null);
  const pickCover = (f) => { if (!f) return; setCoverFile(f); setRemoveCover(false); const r = new FileReader(); r.onload = () => setCoverPrev(r.result); r.readAsDataURL(f); };
  const resetCover = () => { setCoverFile(null); setCoverPrev(null); setRemoveCover(false); setCurCover(null); };
  const [nc, setNc] = useState({ titleAr: '', titleEn: '', descAr: '', descEn: '', price: '', icon: 'book', theme: 'cv1' });
  const setF = (cid, k, v) => setForms((f) => ({ ...f, [cid]: { ...f[cid], [k]: v } }));

  const blankCourse = { titleAr: '', titleEn: '', descAr: '', descEn: '', price: '', icon: 'book', theme: 'cv1' };
  const startEdit = (c) => {
    setEditing(c.id);
    setNc({ titleAr: c.titleAr, titleEn: c.titleEn || '', descAr: c.descAr || '', descEn: '', price: String(c.price), icon: c.icon, theme: c.theme });
    resetCover(); setCurCover(c.coverUrl || null);
    setShowNew(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelForm = () => { setShowNew(false); setEditing(null); setNc(blankCourse); resetCover(); };

  const saveCourse = () => {
    if (!nc.titleAr.trim()) return;
    const payload = { ...nc, price: nc.price.trim() || '0' };
    const cf = coverFile, rm = removeCover, eid = editing;
    const job = (async () => {
      let id = eid;
      if (eid) await api.put(`/api/admin/courses/${eid}`, payload);
      else id = (await api.post('/api/admin/courses', payload)).id;
      if (cf) { const fd = new FormData(); fd.append('cover', cf); await api.postForm(`/api/admin/courses/${id}/cover`, fd); }
      else if (rm && eid) await api.del(`/api/admin/courses/${eid}/cover`);
    })();
    run(job, eid ? t('courseUpdated') : t('courseAdded'));
    setNc(blankCourse); setEditing(null); setShowNew(false); resetCover();
  };

  const upload = (cid) => {
    const f = forms[cid] || {};
    if (!f.title || !f.file || (prog[cid] && prog[cid].state === 'up')) return;
    const fd = new FormData();
    fd.append('titleAr', f.title);
    fd.append('titleEn', f.titleEn || '');
    fd.append('duration', f.duration || '');
    fd.append('video', f.file);
    setProg((p) => ({ ...p, [cid]: { pct: 0, state: 'up' } }));
    api.postFormProgress(`/api/admin/courses/${cid}/lessons`, fd, (pct) =>
      setProg((p) => ({ ...p, [cid]: { pct, state: 'up' } })))
      .then(() => {
        setProg((p) => ({ ...p, [cid]: { pct: 100, state: 'done' } }));
        setForms((ff) => ({ ...ff, [cid]: {} }));
        run(Promise.resolve(), t('uploadDone'));
        setTimeout(() => setProg((p) => ({ ...p, [cid]: null })), 4000);
      })
      .catch((e) => {
        setProg((p) => ({ ...p, [cid]: { pct: 0, state: 'err', msg: e.message } }));
        setTimeout(() => setProg((p) => ({ ...p, [cid]: null })), 5000);
      });
  };

  const replaceVideo = (lid, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('video', file);
    const key = `v${lid}`;
    setProg((p) => ({ ...p, [key]: { pct: 0, state: 'up' } }));
    api.postFormProgress(`/api/admin/lessons/${lid}/video`, fd, (pct) =>
      setProg((p) => ({ ...p, [key]: { pct, state: 'up' } })))
      .then(() => {
        setProg((p) => ({ ...p, [key]: { pct: 100, state: 'done' } }));
        run(Promise.resolve(), t('uploadDone'));
        setTimeout(() => setProg((p) => ({ ...p, [key]: null })), 4000);
      })
      .catch((e) => {
        setProg((p) => ({ ...p, [key]: { pct: 0, state: 'err', msg: e.message } }));
        setTimeout(() => setProg((p) => ({ ...p, [key]: null })), 5000);
      });
  };

  return (
    <div>
      <div className="panel rv" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0 }}><Icon name="plus" size={17} /> {editing ? t('editCourse') : t('newCourse')}</h2>
          <button className="mini-btn go" onClick={() => (showNew ? cancelForm() : setShowNew(true))}>{showNew ? t('cancel') : t('addCourse')}</button>
        </div>
        {showNew && (
          <div style={{ marginTop: 16 }}>
            <div className="field"><label>{t('courseTitleAr')}</label><input value={nc.titleAr} onChange={(e) => setNc({ ...nc, titleAr: e.target.value })} /></div>
            <div className="field"><label>{t('courseTitleEn')}</label><input dir="ltr" style={{ textAlign: 'left' }} value={nc.titleEn} onChange={(e) => setNc({ ...nc, titleEn: e.target.value })} /></div>
            <div className="field"><label>{t('courseDesc')}</label><textarea rows={3} value={nc.descAr} onChange={(e) => setNc({ ...nc, descAr: e.target.value })}
              style={{ width: '100%', border: '2px solid #DCE8EE', borderRadius: 10, padding: '10px 14px', fontFamily: 'inherit', fontWeight: 700, resize: 'vertical' }} /></div>
            <div className="field cover-field"><label>{t('coverImage')}</label>
              <div className="cover-row">
                <div className="cover-prev">{(coverPrev || (curCover && !removeCover)) ? <img src={coverPrev || curCover} alt="" /> : <Icon name="image" size={26} />}</div>
                <label className="mini-btn go" style={{ cursor: 'pointer', margin: 0 }}><Icon name="upload" size={12} /> {(coverPrev || (curCover && !removeCover)) ? t('changeCover') : t('addCover')}
                  <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => { pickCover(e.target.files[0]); e.target.value = ''; }} /></label>
                {(coverPrev || (curCover && !removeCover)) && <button type="button" className="mini-btn no" onClick={() => { setCoverFile(null); setCoverPrev(null); if (curCover) setRemoveCover(true); }}><Icon name="trash" size={12} /> {t('removeCover')}</button>}
                <span className="cover-hint">{t('coverHint')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
              <input placeholder={t('pricePh')} value={nc.price} onChange={(e) => setNc({ ...nc, price: e.target.value })} dir="ltr"
                style={{ width: 120, border: '2px solid #DCE8EE', borderRadius: 10, padding: '10px 14px', fontFamily: 'inherit', fontWeight: 700, textAlign: 'center' }} />
              <div className="icon-pick">{COURSE_ICONS.map((k) => (
                <button type="button" key={k} className={`icon-pick-btn ${nc.icon === k ? 'on' : ''}`} onClick={() => setNc({ ...nc, icon: k })} aria-label={k}><Icon name={k} size={18} /></button>
              ))}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {['cv1', 'cv2', 'cv3'].map((th) => (
                  <button key={th} className={`theme-dot ${th} ${nc.theme === th ? 'on' : ''}`} onClick={() => setNc({ ...nc, theme: th })} aria-label={th}></button>
                ))}
              </div>
              <button className="mini-btn go" disabled={!nc.titleAr.trim()} onClick={saveCourse}>{editing ? <><Icon name="edit" size={13} /> {t('save')}</> : <><Icon name="check" size={13} /> {t('create')}</>}</button>
            </div>
          </div>
        )}
      </div>
      {courses.map((c, ci) => (
        <div className={`panel admin-course rv ${ci % 3 === 1 ? 'rv-d1' : ci % 3 === 2 ? 'rv-d2' : ''}`} key={c.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={c.icon} size={22} /> {lang === 'ar' ? c.titleAr : (c.titleEn || c.titleAr)} <span className="more">{c.price} {t('currency')}</span></h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="switch-row" style={{ margin: 0 }}><input type="checkbox" checked={!!flags[c.id]} onChange={(e) => { setFlags({ ...flags, [c.id]: e.target.checked }); api.post(`/api/admin/courses/${c.id}/sequential`, { on: e.target.checked }); }} /> {lang === 'ar' ? 'قفل ترتيب الدروس' : 'Lock lesson order'}</label>
              <button className="mini-btn go" onClick={() => startEdit(c)}><Icon name="edit" size={12} /> {t('edit')}</button>
              <button className="mini-btn no" onClick={() => { if (window.confirm(t('confirmDelCourse'))) run(api.del(`/api/admin/courses/${c.id}`), 'OK'); }}><Icon name="trash" size={12} /> {t('deleteCourse')}</button>
            </div>
          </div>
          <table className="tbl"><tbody>
            {c.lessons.map((l) => (
              <React.Fragment key={l.id}>
                <tr>
                  <td>{lang === 'ar' ? l.titleAr : (l.titleEn || l.titleAr)}</td>
                  <td>{l.duration}</td>
                  <td>{l.hasVideo ? <span className="tag ok"><Icon name="video" size={12} /></span> : <span className="tag wait">{t('noVideo')}</span>}
                    {' '}{l.examCount > 0
                      ? <span className="tag go"><Icon name="quiz" size={12} /> {l.examCount}</span>
                      : <span className="tag wait">{t('noExam')}</span>}</td>
                  <td>
                    <button className="mini-btn go" onClick={() => setExamFor(examFor === l.id ? null : l.id)}><Icon name="quiz" size={12} /> {t('exam')}</button>{' '}
                    <button className="mini-btn go" onClick={() => setToolsFor(toolsFor === l.id ? null : l.id)}><Icon name="file" size={12} /> {lang === 'ar' ? 'ملفات وإحصائيات' : 'Files & stats'}</button>{' '}
                    <label className="mini-btn ok" style={{ cursor: 'pointer', margin: 0 }}>
                      {l.hasVideo ? <><Icon name="video" size={12} /> {t('replaceVideo')}</> : <><Icon name="upload" size={12} /> {t('uploadVideo')}</>}
                      <input type="file" accept="video/mp4,video/webm,video/quicktime" style={{ display: 'none' }}
                        onChange={(e) => { replaceVideo(l.id, e.target.files[0]); e.target.value = ''; }} />
                    </label>{' '}
                    <button className="mini-btn no" onClick={() => run(api.del(`/api/admin/lessons/${l.id}`), 'OK')}>{t('delete')}</button>
                  </td>
                </tr>
                {examFor === l.id && (
                  <tr><td colSpan={4} style={{ background: 'var(--soft, #F4F9FB)' }}>
                    <ExamEditor lessonId={l.id} lang={lang} run={run} close={() => setExamFor(null)} />
                  </td></tr>
                )}
                {toolsFor === l.id && (
                  <tr><td colSpan={4} style={{ background: 'var(--soft, #F4F9FB)' }}><LessonTools lesson={l} lang={lang} run={run} /></td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody></table>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder={t('lessonTitle')} value={(forms[c.id] && forms[c.id].title) || ''} onChange={(e) => setF(c.id, 'title', e.target.value)}
              style={{ flex: 2, minWidth: 160, border: '2px solid #DCE8EE', borderRadius: 10, padding: '10px 14px', fontFamily: 'inherit', fontWeight: 700 }} />
            <input placeholder={t('durationPh')} value={(forms[c.id] && forms[c.id].duration) || ''} onChange={(e) => setF(c.id, 'duration', e.target.value)}
              style={{ flex: 1, minWidth: 110, border: '2px solid #DCE8EE', borderRadius: 10, padding: '10px 14px', fontFamily: 'inherit', fontWeight: 700 }} />
            <label className={`file-drop ${(forms[c.id] && forms[c.id].file) ? 'has' : ''}`} style={{ flex: 2, minWidth: 180, margin: 0 }}>
              {(forms[c.id] && forms[c.id].file) ? forms[c.id].file.name : <><Icon name="video" size={13} /> MP4</>}
              <input type="file" accept="video/mp4,video/webm,video/quicktime" style={{ display: 'none' }} onChange={(e) => setF(c.id, 'file', e.target.files[0])} />
            </label>
            <button className="mini-btn go" disabled={!(forms[c.id] && forms[c.id].title && forms[c.id].file) || (prog[c.id] && prog[c.id].state === 'up')} onClick={() => upload(c.id)}>{t('upload')}</button>
          </div>
          {prog[c.id] && prog[c.id].state === 'up' && (
            <div className="up-wrap">
              <div className="up-bar"><div className="up-fill" style={{ width: prog[c.id].pct + '%' }}></div></div>
              <div className="up-txt"><Icon name="upload" size={13} /> {t('uploading')} {prog[c.id].pct}%</div>
            </div>
          )}
          {prog[c.id] && prog[c.id].state === 'done' && <div className="up-txt ok"><Icon name="check" size={13} /> {t('uploadDone')}</div>}
          {prog[c.id] && prog[c.id].state === 'err' && <div className="up-txt err"><Icon name="x" size={13} /> {prog[c.id].msg}</div>}
          {c.lessons.map((l) => {
            const pr = prog[`v${l.id}`];
            if (!pr) return null;
            if (pr.state === 'up') return (
              <div className="up-wrap" key={`vp${l.id}`}>
                <div className="up-bar"><div className="up-fill" style={{ width: pr.pct + '%' }}></div></div>
                <div className="up-txt"><Icon name="upload" size={13} /> {t('uploading')} ({lang === 'ar' ? l.titleAr : (l.titleEn || l.titleAr)}) {pr.pct}%</div>
              </div>);
            if (pr.state === 'done') return <div className="up-txt ok" key={`vp${l.id}`}><Icon name="check" size={13} /> {t('uploadDone')}</div>;
            return <div className="up-txt err" key={`vp${l.id}`}><Icon name="x" size={13} /> {pr.msg}</div>;
          })}
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ site, setSite, t, lang, run }) {
  const set = (k) => (e) => setSite({ ...site, [k]: e.target.value });
  const parsed = splitWhatsApp(site.whatsapp);
  // Country choice is sticky: clearing/retyping the number must not reset it
  const [cc, setCc] = useState(null);
  useEffect(() => { if (!cc && site.whatsapp) setCc(splitWhatsApp(site.whatsapp)); }, [site.whatsapp]);
  const cur = cc || parsed;
  const pickCode = ({ iso, dial }) => {
    setCc({ iso, dial });
    setSite({ ...site, whatsapp: joinWhatsApp(dial, parsed.local) });
  };
  const typeLocal = (e) => setSite({ ...site, whatsapp: joinWhatsApp(cur.dial, e.target.value) });
  return (
    <div className="panel rv"><h2>{t('settings')}</h2>
      <div className="field"><label>{t('whatsappNumber')}</label>
        <div className="cc-group" dir="ltr">
          <CountryPicker value={cur} onChange={pickCode} lang={lang} />
          <input style={{ textAlign: 'left' }} placeholder="1012345678" value={parsed.local} onChange={typeLocal} inputMode="numeric" />
        </div>
      </div>
      <div className="field"><label>{t('instapayAddr')}</label><input dir="ltr" style={{ textAlign: 'left' }} value={site.instapay || ''} onChange={set('instapay')} /></div>
      <div className="field"><label>{t('walletNumber')}</label><input dir="ltr" style={{ textAlign: 'left' }} value={site.wallet || ''} onChange={set('wallet')} /></div>
      <button className="auth-btn" onClick={() => run(api.post('/api/admin/settings', { whatsapp: site.whatsapp, instapay: site.instapay, wallet: site.wallet }), 'OK')}>{t('save')}</button>
      <h2 style={{ marginTop: 30 }}><Icon name="lock" size={16} /> {t('changePassword')}</h2>
      <ChangePassword />
    </div>
  );
}
