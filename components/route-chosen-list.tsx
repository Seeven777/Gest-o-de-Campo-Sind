'use client';
import {useState} from 'react';
import {ArrowDown,ArrowUp,ChevronDown,X} from 'lucide-react';
export function RouteChosenList({ids,names,onMove,onRemove}:{
 ids:string[];names:Record<string,string>;onMove:(index:number,direction:-1|1)=>void;onRemove:(id:string)=>void
}){
 const [expanded,setExpanded]=useState(false);
 if(!ids.length)return null;
 return <section className="routes-chosen-list" aria-label="Empresas selecionadas em ordem de visita">
  <button type="button" className="routes-chosen-toggle" onClick={()=>setExpanded(x=>!x)} aria-expanded={expanded}>
   <span><strong>{ids.length} empresas escolhidas</strong><small>{expanded?'Ajuste a ordem e remova empresas.':'Ver ou alterar ordem das paradas'}</small></span><ChevronDown className={expanded?'is-open':''} size={19}/>
  </button>
  {expanded&&<ol>{ids.map((id,index)=><li key={id}>
   <span className="routes-chosen-index">{index+1}</span>
   <span>{names[id]||'Empresa selecionada'}</span>
   <button type="button" disabled={index===0} onClick={()=>onMove(index,-1)} aria-label={'Mover '+(names[id]||'empresa')+' para cima'} title="Mover para cima"><ArrowUp size={16}/></button>
   <button type="button" disabled={index===ids.length-1} onClick={()=>onMove(index,1)} aria-label={'Mover '+(names[id]||'empresa')+' para baixo'} title="Mover para baixo"><ArrowDown size={16}/></button>
   <button type="button" className="routes-remove" onClick={()=>onRemove(id)} aria-label={'Remover '+(names[id]||'empresa')} title="Retirar da rota"><X size={17}/></button>
  </li>)}</ol>}
 </section>;
}
