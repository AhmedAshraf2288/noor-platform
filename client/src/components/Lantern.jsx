import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

// "Noor Lantern": an original lantern that fills with light as the student finishes lessons
export default function Lantern({ pct = 0, size = 120, uid = 'l' }) {
  const rect = useRef(null);
  const glow = useRef(null);
  const flame = useRef(null);
  const id = `lt-${uid}`;
  useEffect(() => {
    const y = 150 - (pct / 100) * 110; // glass area spans y 40..150
    if (rect.current) gsap.to(rect.current, { attr: { y, height: 160 - y }, duration: 1.4, ease: 'power3.out' });
    if (glow.current) gsap.to(glow.current, { opacity: pct ? 0.25 + pct / 140 : 0, scale: 1, duration: 1.2, transformOrigin: '50% 50%' });
    let tw;
    if (flame.current && pct > 0) tw = gsap.to(flame.current, { scaleY: 1.12, scaleX: 0.94, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 100%' });
    return () => { if (tw) tw.kill(); };
  }, [pct]);
  return (
    <svg className="lantern" width={size} height={size * 1.25} viewBox="0 0 120 150" role="img" aria-label={`${pct}%`}>
      <defs>
        <clipPath id={`${id}-c`}><path d="M34 40h52l8 14v62l-8 14H34l-8-14V54z" /></clipPath>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE9A8" /><stop offset="1" stopColor="#F4A261" /></linearGradient>
      </defs>
      <circle ref={glow} cx="60" cy="90" r="62" fill="#FFD27A" opacity="0" />
      <path d="M60 4v14" stroke="#274653" strokeWidth="4" strokeLinecap="round" />
      <path d="M44 22a16 16 0 0 1 32 0" fill="none" stroke="#274653" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 40h56l-6-16H38z" fill="#2E7A93" />
      <path d="M34 40h52l8 14v62l-8 14H34l-8-14V54z" fill="#EAF3F8" stroke="#274653" strokeWidth="3.5" strokeLinejoin="round" />
      <g clipPath={`url(#${id}-c)`}><rect ref={rect} x="20" y="150" width="80" height="10" fill={`url(#${id}-g)`} /></g>
      <path d="M52 40v90 M68 40v90" stroke="#274653" strokeWidth="1.6" opacity=".25" />
      {pct > 0 && <path ref={flame} d="M60 118c-8-8-8-16 0-26 8 10 8 18 0 26z" fill="#FFF6D6" stroke="#F4A261" strokeWidth="1.5" />}
      <path d="M30 130h60l-6 14H36z" fill="#274653" />
    </svg>
  );
}
