import React, {useState} from 'react';
export function Input({type='text', placeholder, value, onChange, error, disabled, icon}) {
  const [focused, setFocused] = useState(false);
  const Tag = type==='textarea' ? 'textarea' : 'input';
  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--surface-primary)',
        border:'1px solid '+(error?'var(--state-error)':focused?'var(--brand-primary)':'var(--border-default)'),
        borderRadius:'var(--radius-full)', padding: type==='textarea'? '12px 16px':'12px 16px',
        opacity: disabled?0.5:1}}>
        {icon}
        <Tag type={type==='textarea'?undefined:type} placeholder={placeholder} value={value} disabled={disabled}
          onChange={e=>onChange&&onChange(e.target.value)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          rows={type==='textarea'?3:undefined}
          style={{flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text-primary)',
            fontFamily:'var(--font-body)', fontSize:15, resize:'none'}}/>
      </div>
      {error && <span style={{color:'var(--state-error)', fontSize:12}}>{error}</span>}
    </div>
  );
}
