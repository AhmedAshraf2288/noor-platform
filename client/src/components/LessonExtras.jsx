import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';

const L = (lang, a, e) => (lang === 'ar' ? a : e);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Student tools under the video: timestamped notes, files, Q&A, auto summary, helper, practice questions
export default function LessonExtras({ lesson, lang, getTime, seek, user }) {
  const [tab, setTab] = useState('notes');
  const [notes, setNotes] = useState([]);
  const [nt, setNt] = useState('');
  const [files, setFiles] = useState([]);
  const [qs, setQs] = useState([]);
  const [qt, setQt] = useState('');
  const [sum, setSum] = useState(null);
  const [ask, setAsk] = useState('');
  const [askR, setAskR] = useState(null);
  const [prac, setPrac] = useState(null);
  const [pick, setPick] = useState({});
  const id = lesson.id;
  const loadNotes = () => api.get(`/api/lessons/${id}/notes`).then((d) => setNotes(d.notes)).catch(() => {});
  const loadQs = () => api.get(`/api/lessons/${id}/questions`).then((d) => setQs(d.questions)).catch(() => {});
  useEffect(() => {
    setNotes([]); setAskR(null); setPrac(null); setPick({}); setSum(null);
    loadNotes(); loadQs();
    api.get(`/api/lessons/${id}/files`).then((d) => setFiles(d.files)).catch(() => {});
    api.get(`/api/lessons/${id}/summary`).then(setSum).catch(() => {});
  }, [id]);
  const tabs = [['notes', 'note', L(lang, 'ملاحظاتي', 'My notes')], ['files', 'download', L(lang, 'ملفات', 'Files')], ['qa', 'msg', L(lang, 'أسئلة', 'Q&A')], ['sum', 'bulb', L(lang, 'ملخص ومساعد', 'Summary')], ['prac', 'quiz', L(lang, 'تدريب', 'Practice')]];
  return (
    <div className="lesson-extras">
      <div className="le-tabs">{tabs.map(([k, ic, l]) => <button key={k} className={`le-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}><Icon name={ic} size={14} /> {l}</button>)}</div>
      {tab === 'notes' && (<div>
        <div className="form-row"><input className="inp grow" maxLength={500} placeholder={L(lang, 'اكتب ملاحظة على اللحظة الحالية من الفيديو...', 'Write a note at the current moment...')} value={nt} onChange={(e) => setNt(e.target.value)} />
          <button className="mini-btn go" disabled={!nt.trim()} onClick={() => api.post(`/api/lessons/${id}/notes`, { sec: getTime(), text: nt }).then(() => { setNt(''); loadNotes(); })}><Icon name="plus" size={12} /> {L(lang, 'إضافة', 'Add')}</button></div>
        {notes.length === 0 && <p className="hint">{L(lang, 'اضغط على ملاحظة للرجوع لنفس اللحظة في الفيديو.', 'Tap a note to jump to that moment.')}</p>}
        {notes.map((n) => (<div className="note-row" key={n.id}><button className="note-time" onClick={() => seek(n.sec)}><Icon name="play" size={11} /> {mmss(n.sec)}</button><span>{n.text}</span><button className="mini-btn no" aria-label="delete" onClick={() => api.del(`/api/notes/${n.id}`).then(loadNotes)}><Icon name="trash" size={11} /></button></div>))}
      </div>)}
      {tab === 'files' && (<div>{files.length === 0 && <p className="hint">{L(lang, 'مفيش ملفات للدرس ده', 'No files for this lesson')}</p>}
        {files.map((f) => <a className="file-row" key={f.id} href={`/api/files/${f.id}/download`}><Icon name="file" size={16} /> <span>{f.orig_name}</span><small>{Math.round(f.size / 1024)} KB</small><Icon name="download" size={15} /></a>)}</div>)}
      {tab === 'qa' && (<div>
        <div className="form-row"><input className="inp grow" maxLength={600} placeholder={L(lang, 'اسأل المشرف عن حاجة في الدرس...', 'Ask about this lesson...')} value={qt} onChange={(e) => setQt(e.target.value)} />
          <button className="mini-btn go" disabled={qt.trim().length < 3} onClick={() => api.post(`/api/lessons/${id}/questions`, { text: qt }).then(() => { setQt(''); loadQs(); })}>{L(lang, 'إرسال', 'Send')}</button></div>
        {qs.map((q) => (<div className="qa-row" key={q.id}><b>{q.name}</b><p>{q.text}</p>{q.answer ? <div className="qa-ans"><Icon name="check" size={12} /> {q.answer} <small>({q.answered_by})</small></div> : <span className="tag wait">{L(lang, 'في انتظار الرد', 'Waiting for reply')}</span>}</div>))}
      </div>)}
      {tab === 'sum' && (<div>
        {sum && sum.has ? <div className="sum-box"><b><Icon name="bulb" size={14} /> {L(lang, 'ملخص تلقائي للدرس', 'Auto summary')}</b><ul>{sum.summary.map((s, i) => <li key={i}>{s}</li>)}</ul></div> : <p className="hint">{L(lang, 'الملخص لسه متضافش لهذا الدرس.', 'No summary added yet.')}</p>}
        <p className="hint disclaimer"><Icon name="warn" size={12} /> {L(lang, 'ده مساعد بسيط بيدور في ملخص الدرس بالكلمات المفتاحية، مش ذكاء اصطناعي حقيقي.', 'A simple keyword helper over the lesson notes, not real AI.')}</p>
        <div className="form-row"><input className="inp grow" maxLength={300} placeholder={L(lang, 'اسأل عن نقطة صعبة في الدرس...', 'Ask about a hard point...')} value={ask} onChange={(e) => setAsk(e.target.value)} />
          <button className="mini-btn go" disabled={ask.trim().length < 2} onClick={() => api.post(`/api/lessons/${id}/ask`, { text: ask }).then(setAskR)}>{L(lang, 'وضّح', 'Explain')}</button></div>
        {askR && (askR.found ? <div className="sum-box">{askR.answer.map((a, i) => <p key={i}>{a}</p>)}</div> : <p className="hint">{L(lang, 'ملقيتش إجابة في ملخص الدرس. اسأل في تبويب الأسئلة.', 'Not found in the notes. Use the Q&A tab.')}</p>)}
      </div>)}
      {tab === 'prac' && (<div>
        <button className="mini-btn go" onClick={() => { setPick({}); api.get(`/api/lessons/${id}/practice`).then(setPrac); }}><Icon name="refresh" size={12} /> {L(lang, 'ولّد أسئلة تدريب من الدرس', 'Generate practice questions')}</button>
        <p className="hint disclaimer"><Icon name="warn" size={12} /> {L(lang, 'أسئلة "املأ الفراغ" بتتولد بقالب بسيط من نص الدرس، مش ذكاء اصطناعي حقيقي.', 'Fill-in-the-blank questions made by a simple template from the lesson text, not real AI.')}</p>
        {prac && prac.questions.length === 0 && <p className="hint">{L(lang, 'محتاج ملخص أطول للدرس عشان نولد أسئلة.', 'The lesson needs longer notes to generate questions.')}</p>}
        {prac && prac.questions.map((q, qi) => (<div className="prac-q" key={qi}><b>{qi + 1}. {q.q}</b><div className="prac-opts">{q.options.map((o) => <button key={o} className={`chip ${pick[qi] === o ? (o === q.answer ? 'good' : 'bad') : ''}`} onClick={() => setPick({ ...pick, [qi]: o })}>{o}</button>)}</div></div>))}
      </div>)}
    </div>
  );
}
