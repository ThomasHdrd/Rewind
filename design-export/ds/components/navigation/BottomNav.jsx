import React from 'react';
const items = [
  {key:'home', label:'Home', d:'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10'},
  {key:'discover', label:'Discover', d:'M12 12l4-8 4 8-4 8-4-8Zm-8 0 4-8 4 8-4 8-4-8Z'},
  {key:'upcoming', label:'Upcoming', d:'M4 5h16v16H4V5Zm0 5h16M8 3v4M16 3v4'},
  {key:'friends', label:'Friends', d:'M8 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 0a4 4 0 1 0 0-8m-14 8c0 5 6 5 6 5s6 0 6-5m2 5c0-3 3-4 3-4'},
  {key:'profile', label:'Profile', d:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c1-3.5 4-5 7-5s6 1.5 7 5'}
];
export function BottomNav({active='home', onChange}) {
  return (
    <div style={{display:'flex', background:'var(--bg-primary)', borderTop:'1px solid var(--divider)',
      padding:'10px 8px calc(10px + env(safe-area-inset-bottom))'}}>
      {items.map(it => {
        const isActive = it.key===active;
        return (
          <button key={it.key} onClick={()=>onChange&&onChange(it.key)} style={{
            flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            background:'transparent', border:'none', cursor:'pointer',
            color: isActive?'var(--brand-primary)':'var(--text-tertiary)'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive?2.4:1.8}><path d={it.d}/></svg>
            <span style={{fontSize:11, fontWeight:600, fontFamily:'var(--font-body)'}}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
