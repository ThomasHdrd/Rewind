import React from 'react';
export function UpNextRow({title, meta, actionLabel='VIEW', onAction}) {
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid var(--divider)'}}>
      <div style={{display:'flex', flexDirection:'column', gap:2}}>
        <div style={{fontSize:15, fontWeight:700, color:'var(--text-primary)'}}>{title}</div>
        <div style={{fontSize:12, color:'var(--text-tertiary)'}}>{meta}</div>
      </div>
      <button onClick={onAction} style={{background:'none', border:'none', color:'var(--brand-primary)', fontWeight:700, fontSize:13, letterSpacing:'0.03em', cursor:'pointer'}}>{actionLabel}</button>
    </div>
  );
}
