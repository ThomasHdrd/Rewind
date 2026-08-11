import React from 'react';
import {Avatar} from './Avatar.jsx';
export function AvatarGroup({names=[], size=36, max=5}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <div style={{display:'flex'}}>
      {shown.map((n,i)=>
        <div key={i} style={{marginLeft: i===0?0:-size*0.3, border:'2px solid var(--bg-primary)', borderRadius:'50%'}}>
          <Avatar name={n} size={size}/>
        </div>)}
      {rest>0 && <div style={{marginLeft:-size*0.3, width:size, height:size, borderRadius:'50%', background:'var(--surface-secondary)', color:'var(--text-secondary)', border:'2px solid var(--bg-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.32, fontWeight:700}}>+{rest}</div>}
    </div>
  );
}
