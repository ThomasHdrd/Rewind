import React from 'react';
export function StatisticCard({value, label}) {
  return (
    <div style={{background:'var(--surface-primary)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)',
      padding:14, display:'flex', flexDirection:'column', gap:4, minWidth:90}}>
      <span style={{fontFamily:'var(--font-body)', fontWeight:800, fontSize:22, color:'var(--text-primary)'}}>{value}</span>
      <span style={{fontSize:11, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.04em'}}>{label}</span>
    </div>
  );
}
