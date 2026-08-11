import React from 'react';
function Star({filled, half}) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill={filled?'var(--rating)':'none'} stroke="var(--rating)" strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>;
}
export function Rating({mode='community', value=0, max=5, count, interactive=false, onChange}) {
  if (mode==='community') {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:'0.06em',color:'var(--text-tertiary)',textTransform:'uppercase'}}>Community</div>
        <div style={{display:'flex',gap:4}}>{Array.from({length:max}).map((_,i)=><div key={i} style={{width:22,height:6,borderRadius:3,background: i < Math.round(value) ? 'var(--rating)' : 'var(--rating-track)'}}/>)}</div>
        <div style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>{value.toFixed(1)}/{max} {count?<span style={{color:'var(--text-tertiary)',fontWeight:400}}>· {count} ratings</span>:null}</div>
      </div>
    );
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      <div style={{fontSize:11,fontWeight:600,letterSpacing:'0.06em',color:'var(--text-tertiary)',textTransform:'uppercase'}}>Your Rating</div>
      <div style={{display:'flex',gap:4}}>{Array.from({length:max}).map((_,i)=>
        <button key={i} onClick={()=>interactive&&onChange&&onChange(i+1)} style={{background:'none',border:'none',padding:0,cursor:interactive?'pointer':'default'}}>
          <Star filled={i < value}/>
        </button>)}</div>
      <div style={{fontSize:13,color: value?'var(--text-primary)':'var(--brand-primary)',fontWeight:600}}>{value? value+'/'+max : 'Tap to rate'}</div>
    </div>
  );
}
