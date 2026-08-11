import React from 'react';
export function EmptyState({title, subtitle, actionLabel, onAction, variant='default'}) {
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'48px 24px', textAlign:'center'}}>
      <div style={{width:56, height:56, borderRadius: variant==='square'?'12px':'50%', border:'2px dashed var(--border-default)'}}/>
      <span style={{fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>{title}</span>
      {subtitle && <span style={{fontSize:13, color:'var(--text-tertiary)', maxWidth:240}}>{subtitle}</span>}
      {actionLabel && <button onClick={onAction} style={{marginTop:8, background:'var(--brand-primary)', color:'var(--text-inverse)', border:'none',
        borderRadius:'var(--radius-full)', padding:'10px 20px', fontWeight:700, cursor:'pointer'}}>{actionLabel}</button>}
    </div>
  );
}
