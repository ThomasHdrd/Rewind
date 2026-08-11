import React from 'react';
export function EpisodeRow({number, title, runtime, rating, ratingCount, watched=false, isNext=false, onToggle}) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:14, padding:'12px 0', borderBottom:'1px solid var(--divider)'}}>
      <button onClick={onToggle} style={{width:28, height:28, borderRadius:'50%', flexShrink:0, cursor:'pointer',
        background: watched? 'rgba(253,115,109,0.15)':'transparent', border:'1.5px solid '+(watched?'var(--brand-primary)':'var(--border-default)'),
        color:'var(--brand-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13}}>
        {watched ? '✓' : ''}
      </button>
      <div style={{flex:1, display:'flex', flexDirection:'column', gap:2}}>
        <div style={{fontSize:15, fontWeight:700, color:'var(--text-primary)'}}>E{number} · {title} {isNext && <span style={{color:'var(--brand-primary)', fontSize:11, fontWeight:700, marginLeft:6}}>NEXT</span>}</div>
        <div style={{fontSize:12, color:'var(--text-tertiary)', fontVariantNumeric:'tabular-nums'}}>{runtime} min{rating? ' · ★ '+rating+'/5'+(ratingCount?' ('+ratingCount+')':''):''}</div>
      </div>
      <span style={{color:'var(--text-tertiary)'}}>›</span>
    </div>
  );
}
