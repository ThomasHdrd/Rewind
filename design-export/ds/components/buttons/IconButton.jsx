import React from 'react';
export function IconButton({icon, active=false, size=40, onClick, style, filled=false}) {
  return (
    <button onClick={onClick} style={{
      width:size, height:size, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
      background: filled? 'var(--brand-primary)': active? 'var(--surface-interactive)':'var(--surface-secondary)',
      border: filled? 'none':'1px solid var(--border-default)', color: filled? 'var(--text-inverse)': active?'var(--brand-primary)':'var(--text-secondary)',
      cursor:'pointer', flexShrink:0, ...style
    }}>{icon}</button>
  );
}
