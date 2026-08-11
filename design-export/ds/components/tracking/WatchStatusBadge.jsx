import React from 'react';
const map = {
  watching:{color:'var(--media-watching)', label:'WATCHING'},
  watchlist:{color:'var(--media-watchlist)', label:'WATCHLIST'},
  watched:{color:'var(--media-watched)', label:'WATCHED'},
  paused:{color:'var(--media-paused)', label:'PAUSED'},
  dropped:{color:'var(--media-dropped)', label:'DROPPED'}
};
export function WatchStatusBadge({status='watching'}) {
  const s = map[status] || map.watching;
  return (
    <span style={{display:'inline-flex', alignItems:'center', gap:5, padding:'4px 9px', borderRadius:'var(--radius-xs)',
      background:'rgba(0,0,0,0.55)', color:s.color, fontFamily:'var(--font-body)', fontWeight:700, fontSize:11,
      letterSpacing:'0.04em'}}>
      <span style={{width:6,height:6,borderRadius:'50%',background:s.color}}/>{s.label}
    </span>
  );
}
