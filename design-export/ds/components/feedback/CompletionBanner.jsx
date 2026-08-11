import React from 'react';
export function CompletionBanner({title, subtitle, actionLabel, onAction}) {
  return (
    <div style={{background:'var(--surface-primary)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)',
      padding:20, textAlign:'center', display:'flex', flexDirection:'column', gap:10, alignItems:'center'}}>
      <span style={{fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>{title}</span>
      {subtitle && <span style={{fontSize:13, color:'var(--text-tertiary)'}}>{subtitle}</span>}
      <button onClick={onAction} style={{background:'var(--brand-primary)', color:'var(--text-inverse)', border:'none',
        borderRadius:'var(--radius-full)', padding:'10px 24px', fontWeight:700, cursor:'pointer'}}>{actionLabel}</button>
    </div>
  );
}
