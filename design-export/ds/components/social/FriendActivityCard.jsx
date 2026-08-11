import React from 'react';
import {Avatar} from './Avatar.jsx';
import {Reaction} from './Reaction.jsx';
export function FriendActivityCard({name, action, timeAgo, mediaTitle, artworkColor='#3D5A6C', rating, likeCount}) {
  return (
    <div style={{background:'var(--surface-primary)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', padding:14, display:'flex', flexDirection:'column', gap:10}}>
      <div style={{display:'flex', alignItems:'center', gap:10}}>
        <Avatar name={name} size={34}/>
        <div style={{display:'flex', flexDirection:'column'}}>
          <span style={{fontSize:13, color:'var(--text-primary)'}}><b>{name}</b> {action}</span>
          <span style={{fontSize:11, color:'var(--text-tertiary)'}}>{timeAgo}</span>
        </div>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <div style={{width:44, height:64, borderRadius:'var(--radius-xs)', flexShrink:0,
          background:'repeating-linear-gradient(135deg,'+artworkColor+' 0 8px,'+artworkColor+'cc 8px 16px)'}}/>
        <div style={{display:'flex', flexDirection:'column', gap:4}}>
          <span style={{fontSize:14, fontWeight:700, color:'var(--text-primary)'}}>{mediaTitle}</span>
          {rating && <span style={{color:'var(--rating)', fontSize:12}}>{'★'.repeat(Math.round(rating))}</span>}
        </div>
      </div>
      <div style={{display:'flex', gap:16, borderTop:'1px solid var(--divider)', paddingTop:8}}>
        <Reaction icon="♡" count={likeCount}/>
        <Reaction icon="💬" count={0}/>
      </div>
    </div>
  );
}
