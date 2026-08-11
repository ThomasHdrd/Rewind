import React from 'react';
import {ProgressBar} from '../tracking/ProgressBar.jsx';
export function MediaListItem({title, meta, progress, artworkColor='#3D5A6C', action}) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:14, padding:'10px 0'}}>
      <div style={{width:52, height:78, borderRadius:'var(--radius-sm)', flexShrink:0,
        background:'repeating-linear-gradient(135deg,'+artworkColor+' 0 8px,'+artworkColor+'cc 8px 16px)'}}/>
      <div style={{flex:1, display:'flex', flexDirection:'column', gap:4, minWidth:0}}>
        <div style={{fontSize:15, fontWeight:700, color:'var(--text-primary)'}}>{title}</div>
        <div style={{fontSize:12, color:'var(--text-tertiary)', fontVariantNumeric:'tabular-nums'}}>{meta}</div>
        {progress!=null && <div style={{marginTop:2}}><ProgressBar percent={progress} height={4}/></div>}
      </div>
      {action}
    </div>
  );
}
