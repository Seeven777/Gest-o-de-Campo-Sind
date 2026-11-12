'use client';
import {useState} from 'react';
import {ChevronDown,ExternalLink,LocateFixed,MapPin,MoreHorizontal,Navigation} from 'lucide-react';

type Props={
 stopId:string;index:number;total:number;name:string;distanceLabel:string;distanceKind:string;
 wazeUrl:string|null;driving:boolean;busy:boolean;gpsUnavailable:boolean;
 gpsMessage:string;navigationError:boolean;error:string;
 onArrive:()=>void;onGpsFix:()=>void;onReport:()=>void;onBreak:()=>void;
 onBlockedWaze:()=>void;
};

/** Uma ação prioritária por etapa. Todo controle requer veículo estacionado. */
export function CrewTravelPanel(p:Props){
 const [expanded,setExpanded]=useState(false);
 return <section className="crew-travel-footer crew-modern-footer" aria-label="Próxima empresa">
  <div className="crew-bottom-sheet">
   <span className="crew-sheet-grip" aria-hidden="true"/>
   <div className="crew-sheet-heading">
    <div className="crew-sheet-company">
     <span>PRÓXIMA PARADA · {p.index} DE {p.total}</span>
     <strong title={p.name}>{p.name}</strong>
    </div>
    <div className="crew-sheet-distance">
     <strong>{p.distanceLabel}</strong><span>{p.distanceKind}</span>
    </div>
   </div>
   <div className="crew-sheet-actions">
    {p.gpsUnavailable?
     <button type="button" className="crew-arrived crew-recover" disabled={p.busy||p.driving}
      title={p.driving?'Pare o veículo em segurança antes de usar.':undefined} onClick={p.onGpsFix}>
      <LocateFixed size={21}/>{p.busy?'LOCALIZANDO...':'AJUSTAR GPS'}
     </button>:
     <button type="button" className="crew-arrived" disabled={p.busy||p.driving}
      title={p.driving?'Pare o veículo em segurança antes de registrar a chegada.':'Confirmar chegada com veículo parado'}
      onClick={p.onArrive}><MapPin size={22}/> CHEGUEI!</button>}
    {p.wazeUrl&&<a className={'crew-waze-link crew-sheet-waze'+(p.driving?' is-driving':'')}
     href={p.wazeUrl} target="_blank" rel="noopener noreferrer" tabIndex={p.driving?-1:0}
     aria-disabled={p.driving} title="Abrir o Waze com o veículo parado, para orientação por voz"
     onClick={e=>{if(p.driving){e.preventDefault();p.onBlockedWaze()}}}>
     <Navigation size={19} aria-hidden="true"/><span>WAZE</span>
     <ExternalLink size={14} aria-hidden="true"/></a>}
   </div>
   {p.gpsUnavailable&&<p className="crew-sheet-alert" role="status">
    {p.gpsMessage||'Sinal GPS indisponível'}. Aguarde o sinal com o veículo parado.</p>}
   {p.navigationError&&<p className="crew-sheet-note">Confira o endereço antes de seguir. O trajeto viário está indisponível.</p>}
   {p.error&&!p.gpsUnavailable&&<p className="crew-sheet-alert" role="alert">{p.error}</p>}
   <button type="button" className="crew-more-trigger" aria-expanded={expanded&&!p.driving}
    disabled={p.driving} onClick={()=>setExpanded(v=>!v)}>
    <MoreHorizontal size={18} aria-hidden="true"/> Outras opções
    <ChevronDown className={expanded&&!p.driving?'crew-chevron-up':''} size={17} aria-hidden="true"/>
   </button>
   {expanded&&!p.driving&&<div className="crew-extra-actions">
    <button type="button" onClick={()=>{setExpanded(false);p.onReport()}}>Relatório pessoal</button>
    <button type="button" onClick={()=>{setExpanded(false);p.onBreak()}}>Registrar parada</button>
   </div>}
  </div>
 </section>;
}
