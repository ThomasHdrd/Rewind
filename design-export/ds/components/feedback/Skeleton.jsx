import React from 'react';
export function Skeleton({width='100%', height=16, radius=8}) {
  return <div style={{width, height, borderRadius:radius, background:'var(--surface-secondary)'}}/>;
}
