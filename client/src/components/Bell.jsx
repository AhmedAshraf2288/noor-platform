import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';

// In-site notification bell (new lessons/courses, exam results, reminders, live sessions)
export default function Bell({ lang }) {
  const [d, setD] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const load = () => api.get('/api/notifications').then(setD).catch(() => {});
  useEffect(() => { load(); const iv = setInterval(load, 60000); return () => clearInterval(iv); }, []);
  const toggle = () => { const n = !open; setOpen(n); if (n && d.unread) api.post('/api/notifications/read', {}).then(() => setD((x) => ({ ...x, unread: 0 }))).catch(() => {}); };
  return (
    <div className="bell-wrap">
      <button className="bell-btn" onClick={toggle} aria-label="notifications"><Icon name="bell" size={19} />{d.unread > 0 && <span className="bell-dot">{d.unread}</span>}</button>
      {open && (
        <div className="bell-pop" onClick={() => setOpen(false)}>
          <b className="bell-h">{lang === 'ar' ? 'الإشعارات' : 'Notifications'}</b>
          {d.items.length === 0 && <p className="bell-empty">{lang === 'ar' ? 'مفيش إشعارات' : 'Nothing yet'}</p>}
          {d.items.map((i) => (
            <a key={i.id} className={`bell-item ${i.read ? '' : 'new'}`} href={i.link || '#/student'}><b>{i.title}</b>{i.body && <span>{i.body}</span>}</a>
          ))}
        </div>
      )}
    </div>
  );
}
