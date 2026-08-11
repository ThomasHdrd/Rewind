import React from 'react';
const variants = {
  primary: {bg:'var(--brand-primary)',color:'var(--text-inverse)',border:'none'},
  secondary: {bg:'transparent',color:'var(--text-primary)',border:'1px solid var(--border-default)'},
  tertiary: {bg:'var(--surface-secondary)',color:'var(--text-primary)',border:'none'},
  ghost: {bg:'transparent',color:'var(--brand-primary)',border:'none'},
  destructive: {bg:'transparent',color:'var(--state-error)',border:'1px solid var(--state-error)'}
};
const sizes = { sm:{padding:'8px 14px',fontSize:14}, md:{padding:'12px 20px',fontSize:15}, lg:{padding:'16px 24px',fontSize:16} };
export function Button({variant='primary', size='md', disabled=false, loading=false, children, onClick, style}) {
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;
  return (
    <button onClick={disabled||loading?undefined:onClick} disabled={disabled||loading} style={{
      fontFamily:'var(--font-body)', fontWeight:700, borderRadius:'var(--radius-full)',
      cursor: disabled||loading?'not-allowed':'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
      opacity: disabled?0.4:1, transition:'transform .12s ease, opacity .12s ease',
      ...v, ...s, ...style
    }} onMouseDown={e=>{if(!disabled&&!loading)e.currentTarget.style.transform='scale(0.97)';}}
       onMouseUp={e=>{e.currentTarget.style.transform='scale(1)';}}>
      {loading ? <span style={{width:14,height:14,border:'2px solid currentColor',borderRightColor:'transparent',borderRadius:'50%',animation:'ds-spin .7s linear infinite'}}/> : children}
    </button>
  );
}
