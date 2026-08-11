import React from 'react';
export function XPProgress({level, levelName, xp, xpToNext}) {
  const pct = Math.min(100, xp/(xp+xpToNext)*100);
  return (
    <div style={{background:'var(--surface-primary)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', padding:16, display:'flex', flexDirection:'column', gap:10}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', flexDirection:'column'}}>
          <span style={{fontSize:11, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Level {level}</span>
          <span style={{fontSize:17, fontWeight:700, color:'var(--text-primary)'}}>{levelName}</span>
        </div>
        <div style={{width:32, height:32, borderRadius:'50%', background:'var(--brand-primary)', color:'var(--text-inverse)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800}}>+</div>
      </div>
      <div style={{height:6, borderRadius:'var(--radius-full)', background:'var(--rating-track)'}}>
        <div style={{width:pct+'%', height:'100%', borderRadius:'var(--radius-full)', background:'var(--brand-primary)'}}/>
      </div>
      <span style={{fontSize:12, color:'var(--text-tertiary)'}}>{xp} XP · {xpToNext} XP to next level</span>
    </div>
  );
}
