import React from 'react';
export function Toast({message, actionLabel, onAction}) {
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:16,
      background:'var(--ink-950)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)',
      padding:'14px 16px', boxShadow:'var(--elevation-2)'}}>
      <span style={{color:'var(--text-primary)', fontSize:14}}>{message}</span>
      {actionLabel && <button onClick={onAction} style={{background:'none', border:'none', color:'var(--brand-primary)', fontWeight:700, fontSize:13, cursor:'pointer', textDecoration:'underline'}}>{actionLabel}</button>}
    </div>
  );
}
