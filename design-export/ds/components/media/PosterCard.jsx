import React from 'react';
import {WatchStatusBadge} from '../tracking/WatchStatusBadge.jsx';
export function PosterCard({title, status, artworkColor='#8B4A43', width=110}) {
  return (
    <div style={{width, display:'flex', flexDirection:'column', gap:8}}>
      <div style={{position:'relative', width:'100%', aspectRatio:'2/3', borderRadius:'var(--radius-poster)',
        background:'repeating-linear-gradient(135deg,'+artworkColor+' 0 10px,'+artworkColor+'cc 10px 20px)',
        border:'1px solid var(--border-subtle)', overflow:'hidden'}}>
        {status && <div style={{position:'absolute', top:8, left:8}}><WatchStatusBadge status={status}/></div>}
      </div>
      {title && <div style={{fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{title}</div>}
    </div>
  );
}
