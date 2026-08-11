import React from 'react';
import {Avatar} from './Avatar.jsx';
export function Comment({name, text}) {
  return (
    <div style={{display:'flex', gap:12, padding:'10px 0'}}>
      <Avatar name={name} size={32}/>
      <div style={{display:'flex', flexDirection:'column', gap:2}}>
        <span style={{fontSize:13, fontWeight:700, color:'var(--text-primary)'}}>{name}</span>
        <span style={{fontSize:13, color:'var(--text-secondary)'}}>{text}</span>
      </div>
    </div>
  );
}
