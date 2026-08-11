import React from 'react';
export function SearchResultRow({title, meta, logged=false, onToggle}) {
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid var(--divider)'}}>
      <div style={{display:'flex', flexDirection:'column'}}>
        <span style={{fontSize:15, fontWeight:600, color:'var(--text-primary)'}}>{title}</span>
        {meta && <span style={{fontSize:12, color:'var(--text-tertiary)'}}>{meta}</span>}
      </div>
      <button onClick={onToggle} style={{width:30, height:30, borderRadius:'50%', border:'none', cursor:'pointer',
        background: logged? 'var(--brand-primary)':'var(--surface-secondary)', color: logged?'var(--text-inverse)':'var(--text-tertiary)'}}>{logged?'✓':'+'}</button>
    </div>
  );
}
