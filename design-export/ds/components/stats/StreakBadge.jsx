import React from 'react';
export function StreakBadge({icon, value, label}) {
  return (
    <div style={{background:'var(--surface-primary)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', padding:14, textAlign:'center', flex:1}}>
      <div style={{fontSize:20}}>{icon}</div>
      <div style={{fontFamily:'var(--font-body)', fontWeight:800, fontSize:20, color:'var(--text-primary)', marginTop:4}}>{value}</div>
      <div style={{fontSize:11, color:'var(--text-tertiary)'}}>{label}</div>
    </div>
  );
}
