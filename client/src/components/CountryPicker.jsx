import React, { useEffect, useRef, useState } from 'react';
import { COUNTRIES } from '../countries.js';

function Flag({ iso }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [iso]);
  if (bad) return <span className="ccp-flag-fallback">{iso}</span>;
  return (
    <img className="ccp-flag" src={`/flags/${iso.toLowerCase()}.png`} alt="" loading="lazy"
      onError={() => setBad(true)} />
  );
}

// intl-tel-input style country picker: flag + dial code button, searchable dropdown.
export default function CountryPicker({ value, onChange, lang }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const needle = q.trim().toLowerCase();
  const list = needle
    ? COUNTRIES.filter(([iso, dial, ar, en]) =>
        ar.includes(q.trim()) || en.toLowerCase().includes(needle) || dial.includes(needle.replace(/^\+/, '')))
    : COUNTRIES;

  const pick = (iso, dial) => { onChange({ iso, dial }); setOpen(false); setQ(''); };

  return (
    <div className="ccp" ref={ref}>
      <button type="button" className={`ccp-btn ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox" aria-expanded={open}>
        <Flag iso={value.iso} />
        <span className="ccp-code" dir="ltr">+{value.dial}</span>
        <span className="ccp-chev">▾</span>
      </button>
      {open && (
        <div className="ccp-pop">
          <input className="ccp-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث باسم الدولة أو الكود' : 'Search name or code'} />
          <div className="ccp-list" role="listbox">
            {list.length === 0 && <div className="ccp-empty">{lang === 'ar' ? 'لا توجد نتائج' : 'No results'}</div>}
            {list.map(([iso, dial, ar, en]) => (
              <button type="button" role="option" aria-selected={iso === value.iso}
                className={`ccp-item ${iso === value.iso ? 'on' : ''}`} key={iso} onClick={() => pick(iso, dial)}>
                <Flag iso={iso} />
                <span className="ccp-name">{lang === 'ar' ? ar : en}</span>
                <span className="ccp-dial" dir="ltr">+{dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
