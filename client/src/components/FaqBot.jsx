import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';

// Simple FAQ bot: keyword matching against admin-written answers (not real AI)
export default function FaqBot({ lang }) {
  const [open, setOpen] = useState(false);
  const [faq, setFaq] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const end = useRef(null);
  useEffect(() => { if (open && !faq.length) api.get('/api/public/faq').then((d) => setFaq(d.items)).catch(() => {}); }, [open]);
  useEffect(() => { if (end.current) end.current.scrollTop = end.current.scrollHeight; }, [msgs, open]);
  const ask = (q) => {
    if (!q.trim()) return;
    setMsgs((m) => [...m, { me: true, t: q }]); setText('');
    api.post('/api/public/faq-ask', { text: q }).then((r) => setMsgs((m) => [...m, { t: r.answer }])).catch(() => {});
  };
  return (
    <>
      <button className="faq-fab" onClick={() => setOpen(!open)} aria-label="help"><Icon name={open ? 'x' : 'msg'} size={22} /></button>
      {open && (
        <div className="faq-box">
          <div className="faq-head"><Icon name="msg" size={16} /> {lang === 'ar' ? 'مساعد نور (إجابات جاهزة)' : 'Noor helper (ready answers)'}</div>
          <div className="faq-body" ref={end}>
            <div className="faq-m bot">{lang === 'ar' ? 'أهلاً! اسألني عن الاشتراك أو الدفع أو الامتحانات. (ده بوت بسيط بيدور بكلمات مفتاحية، مش ذكاء اصطناعي.)' : 'Hi! Ask about subscribing, payment or exams. (A simple keyword bot, not real AI.)'}</div>
            {msgs.map((m, i) => <div key={i} className={`faq-m ${m.me ? 'me' : 'bot'}`}>{m.t}</div>)}
            {msgs.length === 0 && <div className="faq-chips">{faq.slice(0, 5).map((f) => <button key={f.id} onClick={() => ask(f.q)}>{f.q}</button>)}</div>}
          </div>
          <form className="faq-in" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={lang === 'ar' ? 'اكتب سؤالك...' : 'Type your question...'} maxLength={200} />
            <button type="submit"><Icon name="check" size={16} /></button>
          </form>
        </div>
      )}
    </>
  );
}
