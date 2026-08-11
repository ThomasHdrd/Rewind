import React from 'react';
const palette = ['#E2574C','#C9932F','#2DD9A6','#9B6BD9','#4EA1F5'];
export function Avatar({name='', size=40, color, imageColor}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const bg = imageColor || color || palette[name.length % palette.length];
  return (
    <div style={{width:size, height:size, borderRadius:'50%', background:bg, color:'var(--text-inverse)',
      display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-body)', fontWeight:700,
      fontSize:size*0.4, flexShrink:0}}>{initial}</div>
  );
}
