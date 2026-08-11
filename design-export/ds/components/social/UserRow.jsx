import React from 'react';
import {Avatar} from './Avatar.jsx';
export function UserRow({name, subtitle, action}) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:12, padding:'10px 0'}}>
      <Avatar name={name}/>
      <div style={{flex:1, display:'flex', flexDirection:'column'}}>
        <span style={{fontSize:14, fontWeight:700, color:'var(--text-primary)'}}>{name}</span>
        {subtitle && <span style={{fontSize:12, color:'var(--text-tertiary)'}}>{subtitle}</span>}
      </div>
      {action}
    </div>
  );
}
