import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Renders text with $...$ (inline) and $$...$$ (block) LaTeX segments via KaTeX. Everything else stays plain text.
export default function MathText({ text, className }) {
  const parts = String(text || '').split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const block = p.startsWith('$$') && p.endsWith('$$') && p.length > 4;
        const inline = !block && p.startsWith('$') && p.endsWith('$') && p.length > 2;
        if (!block && !inline) return <React.Fragment key={i}>{p}</React.Fragment>;
        try {
          const html = katex.renderToString(p.slice(block ? 2 : 1, block ? -2 : -1), { throwOnError: false, displayMode: block, output: 'html' });
          return <span key={i} dir="ltr" className={block ? 'math-block' : 'math-inline'} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch { return <React.Fragment key={i}>{p}</React.Fragment>; }
      })}
    </span>
  );
}
