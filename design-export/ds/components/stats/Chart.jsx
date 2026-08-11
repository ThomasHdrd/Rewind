import React from 'react';
export function Chart({values=[], height=90}) {
  const max = Math.max(...values, 1);
  return (
    <div style={{display:'flex', alignItems:'flex-end', gap:6, height}}>
      {values.map((v,i)=>(
        <div key={i} style={{flex:1, height:(v/max*100)+'%', borderRadius:3,
          background: i===values.length-1? 'var(--brand-primary)':'var(--surface-interactive)'}}/>
      ))}
    </div>
  );
}
