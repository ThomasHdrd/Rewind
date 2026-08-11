import React from 'react';
export function BottomSheet({children, height='auto'}) {
  return (
    <div style={{background:'var(--surface-elevated)', borderRadius:'20px 20px 0 0', border:'1px solid var(--border-default)',
      borderBottom:'none', padding:'12px 20px 24px', display:'flex', flexDirection:'column', gap:16, height}}>
      <div style={{width:36, height:4, borderRadius:2, background:'var(--border-default)', margin:'0 auto'}}/>
      {children}
    </div>
  );
}
