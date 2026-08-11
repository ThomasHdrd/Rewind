import React from 'react';
import {ProgressBar} from '../tracking/ProgressBar.jsx';
export function ContinueWatchingCard({title, episodeMeta, ratio, percent, artworkColor='#274257', variant='featured'}) {
  const compact = variant==='compact';
  return (
    <div style={{position:'relative', borderRadius:'var(--radius-lg)', overflow:'hidden', height: compact?150:210,
      background:'repeating-linear-gradient(135deg,'+artworkColor+' 0 14px,'+artworkColor+'cc 14px 28px)',
      display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:16}}>
      <div style={{position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 40%, rgba(4,7,12,0.9) 100%)'}}/>
      <div style={{position:'absolute', top:12, right:12, width:32, height:32, borderRadius:'50%', background:'rgba(8,10,15,0.6)',
        display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-primary)', zIndex:1}}>✓</div>
      <div style={{position:'relative', zIndex:1, display:'flex', flexDirection:'column', gap:8}}>
        <div style={{fontFamily:'var(--font-body)', fontWeight:800, fontSize: compact?16:20, color:'var(--text-primary)'}}>{title}</div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
          <span style={{fontSize:13, color:'var(--text-secondary)'}}>{episodeMeta}</span>
          <span style={{fontSize:13, fontWeight:700, color:'var(--brand-primary)'}}>{ratio} · {percent}%</span>
        </div>
        <ProgressBar percent={percent}/>
      </div>
    </div>
  );
}
