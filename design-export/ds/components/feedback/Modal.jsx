import React from 'react';
export function Modal({title, children, onClose}) {
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(4,7,12,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100}}>
      <div style={{background:'var(--surface-elevated)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-lg)',
        padding:24, width:320, display:'flex', flexDirection:'column', gap:14}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <span style={{fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>{title}</span>
          <button onClick={onClose} style={{background:'none', border:'none', color:'var(--text-tertiary)', fontSize:18, cursor:'pointer'}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
