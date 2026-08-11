import React from 'react';
import {Input} from '../inputs/Input.jsx';
import {BottomSheet} from '../feedback/BottomSheet.jsx';
import {SearchResultRow} from './SearchResultRow.jsx';
export function QuickLogSheet({recent=[]}) {
  return (
    <BottomSheet>
      <span style={{fontFamily:'var(--font-body)', fontWeight:800, fontSize:20, color:'var(--text-primary)'}}>What did you watch?</span>
      <Input type="search" placeholder="Search a title..."/>
      <div>
        <div style={{fontSize:11, color:'var(--text-tertiary)', letterSpacing:'0.06em', marginBottom:4}}>RECENT</div>
        {recent.map((r,i)=><SearchResultRow key={i} title={r.title} meta={r.meta} logged={r.logged}/>)}
      </div>
    </BottomSheet>
  );
}
