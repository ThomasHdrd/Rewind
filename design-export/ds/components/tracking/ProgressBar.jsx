import React from 'react';
export function ProgressBar({percent=0, height=6, color='var(--brand-primary)', track='var(--rating-track)'}) {
  return (
    <div style={{width:'100%', height, borderRadius:'var(--radius-full)', background:track, overflow:'hidden'}}>
      <div style={{width:Math.max(0,Math.min(100,percent))+'%', height:'100%', background:color, borderRadius:'var(--radius-full)'}}/>
    </div>
  );
}
