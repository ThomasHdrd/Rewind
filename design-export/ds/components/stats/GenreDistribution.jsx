import React from 'react';
export function GenreDistribution({data=[]}) {
  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      {data.map((d,i)=>(
        <div key={i} style={{display:'flex', flexDirection:'column', gap:4}}>
          <div style={{display:'flex', justifyContent:'space-between', fontSize:13}}>
            <span style={{color:'var(--text-primary)', fontWeight:600}}>{d.label}</span>
            <span style={{color:'var(--text-tertiary)'}}>{d.percent}%</span>
          </div>
          <div style={{height:6, borderRadius:'var(--radius-full)', background:'var(--rating-track)'}}>
            <div style={{width:d.percent+'%', height:'100%', borderRadius:'var(--radius-full)', background:'var(--brand-primary)', opacity: 1 - i*0.15}}/>
          </div>
        </div>
      ))}
    </div>
  );
}
