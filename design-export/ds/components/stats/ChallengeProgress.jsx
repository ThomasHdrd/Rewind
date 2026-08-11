import React from 'react';
export function ChallengeProgress({icon, label, current, total, xpReward}) {
  const pct = total? (current/total*100):0;
  return (
    <div style={{display:'flex', alignItems:'center', gap:12, padding:'10px 0'}}>
      <div style={{width:32, height:32, borderRadius:'50%', background:'var(--surface-secondary)', display:'flex', alignItems:'center', justifyContent:'center'}}>{icon}</div>
      <div style={{flex:1, display:'flex', flexDirection:'column', gap:4}}>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:13}}>
          <span style={{color:'var(--text-primary)', fontWeight:600}}>{label}</span>
          <span style={{color:'var(--brand-primary)', fontWeight:700}}>+{xpReward} XP</span>
        </div>
        <div style={{height:5, borderRadius:'var(--radius-full)', background:'var(--rating-track)'}}>
          <div style={{width:pct+'%', height:'100%', borderRadius:'var(--radius-full)', background:'var(--brand-primary)'}}/>
        </div>
        <span style={{fontSize:11, color:'var(--text-tertiary)'}}>{current}/{total}</span>
      </div>
    </div>
  );
}
