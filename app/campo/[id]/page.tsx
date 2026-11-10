'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';import {useParams} from 'next/navigation';
import {Portal} from '@/components/portal';
import {FieldNavigationMap,type CurrentPosition,type FieldPlan} from '@/components/field-navigation-map';
import {Camera,MapPin,Play,Check,ChevronRight,Navigation,RefreshCw,ShieldCheck,LocateFixed,PauseCircle} from 'lucide-react';
import '../jornada.css';

type Stop={id:string;position_order:number;legal_name:string;trade_name:string|null;street:string|null;street_number:string|null;city:string|null;state:string|null;cnpj:string;lat:number|null;lon:number|null;visit_id:string|null;checkin_at:string|null;checkout_at:string|null;review_status:string|null;review_notes?:string|null;has_photo:boolean};
type RouteData={route:{id:string;campaign_name:string;route_date:string;status:string};stops:Stop[];presence:{active:boolean;last_seen_at:string}|null};
const options={operating:[['operating','Está funcionando'],['closed','Está fechada'],['moved','Mudou de endereço'],['unknown','Não consegui confirmar']],
 signage:[['yes','Sim'],['no','Não'],['unknown','Não consegui verificar']],
 regularity:[['none_observed','Nenhuma situação aparente'],['attention','Algo precisa de atenção'],['not_evaluated','Não consegui avaliar']]};
const post=async(path:string,body:unknown)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível concluir a operação.');return d};
async function gpsOnce(){return new Promise<CurrentPosition>((resolve,reject)=>{if(!navigator.geolocation)return reject(Error('Seu celular não disponibiliza GPS.'));navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy}),()=>reject(Error('Autorize o uso da localização nas permissões do navegador e tente novamente.')),{enableHighAccuracy:true,timeout:18000,maximumAge:0})})}
async function compactPhoto(file:File):Promise<File>{
 const img=await createImageBitmap(file);const ratio=Math.min(1,1280/Math.max(img.width,img.height));
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*ratio));c.height=Math.max(1,Math.round(img.height*ratio));
 const ctx=c.getContext('2d');if(!ctx){img.close();throw Error('Não foi possível preparar a foto.')}
 ctx.drawImage(img,0,0,c.width,c.height);img.close();
 const blob=await new Promise<Blob|null>(resolve=>c.toBlob(resolve,'image/jpeg',0.74));
 if(!blob)throw Error('Não foi possível converter a fotografia.');
 if(blob.size>2*1024*1024)throw Error('Foto muito grande. Tente outra imagem.');
 return new File([blob],'fachada.jpg',{type:'image/jpeg'});
}
function Choice({title,value,choices,onChange}:{title:string;value:string;choices:string[][];onChange:(v:string)=>void}){
 return <fieldset className="field-choice"><legend>{title}</legend>
 {choices.map(([key,name])=><label key={key} className={value===key?'field-option selected':'field-option'}>
 <input type="radio" name={title} checked={value===key} onChange={()=>onChange(key)}/><span>{name}</span>{value===key&&<Check size={23}/>}</label>)}
 </fieldset>
}
function SlideArrival({onConfirm,disabled}:{onConfirm:()=>void;disabled:boolean}){
 const [value,setValue]=useState(0);
 return <div className="arrival-confirm"><label htmlFor="slide-arrival">Deslize até o final para confirmar chegada</label>
 <input id="slide-arrival" type="range" min="0" max="100" step="1" value={value} disabled={disabled} onChange={e=>{const n=Number(e.target.value);setValue(n);if(n>=95){setValue(0);onConfirm()}}} aria-label="Deslizar para confirmar que chegou à empresa"/>
 <div className="arrival-hint"><span>Arraste para a direita</span><span>{value}%</span></div>
 <button type="button" className="field-link-button" disabled={disabled} onClick={onConfirm}>Não consegue deslizar? Toque aqui para confirmar chegada.</button>
 </div>
}
export default function CampoGuiado(){
 const {id}=useParams<{id:string}>(),[data,setData]=useState<RouteData|null>(null),[plan,setPlan]=useState<FieldPlan|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[progress,setProgress]=useState('');
 const [started,setStarted]=useState(false),[position,setPosition]=useState<CurrentPosition|null>(null),[follow,setFollow]=useState(true),[photoBusy,setPhotoBusy]=useState(false);
 const [operating,setOperating]=useState(''),[signage,setSignage]=useState(''),[regularity,setRegularity]=useState(''),[notes,setNotes]=useState('');
 const lastSent=useRef(0),positionRef=useRef<CurrentPosition|null>(null);
 async function reload(){const r=await fetch('/api/campo/'+encodeURIComponent(id),{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível abrir a jornada.');setData(d)}
 useEffect(()=>{void reload().catch(e=>setError(e.message))},[id]);
 const ordered=useMemo(()=>{
  if(!data)return [];
  const order=plan?.order||[];const byId=new Map(data.stops.map(x=>[x.id,x]));
  return [...order.map(x=>byId.get(x)).filter((x):x is Stop=>Boolean(x)),...data.stops.filter(x=>!order.includes(x.id))];
 },[data,plan]);
 const complete=ordered.filter(x=>Boolean(x.checkout_at)).length;
 const current=ordered.find(x=>!x.checkout_at);
 const index=current?ordered.indexOf(current)+1:ordered.length;
 const stage=!plan?'prepare':!started?'ready':!current?'done':!current.checkin_at?'travel':!current.has_photo?'photo':'form';
 const targetPoint=plan?.points.find(x=>x.id===current?.id);
 async function calculate(){
  setBusy(true);setError('');setMessage('');
  try{
   let start:CurrentPosition|undefined;
   try{start=await gpsOnce();setPosition(start)}catch{ /* A rota também pode começar pela primeira empresa. */ }
   for(let batch=1;batch<=12;batch++){
    setProgress('Localizando os endereços · etapa '+batch);
    const r=await fetch('/api/rotas/'+encodeURIComponent(id)+'/otimizar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start}),cache:'no-store'});
    const d=await r.json();
    if(r.ok){setPlan(d);if(d.route_warning)setMessage(d.route_warning);break}
    if(r.status===422&&d.retryable===true&&batch<12)continue;
    throw Error(d.error||'O percurso não pôde ser calculado.');
   }
  }catch(e){setError(e instanceof Error?e.message:'Erro ao calcular o mapa')}
  finally{setBusy(false);setProgress('')}
 }
 async function begin(){
  setBusy(true);setError('');try{
   const p=await gpsOnce();setPosition(p);
   await post('/api/campo/localizacao',{action:'start',route_id:id,consent:true,...p});
   setStarted(true);setMessage('Localização compartilhada com a central enquanto esta jornada estiver aberta.');
   await reload();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar o GPS.')}
  finally{setBusy(false)}
 }
 async function stopTracking(){
  setBusy(true);try{await post('/api/campo/localizacao',{action:'stop'});setStarted(false);setMessage('Acompanhamento GPS encerrado. A central não recebe mais sua posição.')}
  catch(e){setError(e instanceof Error?e.message:'Erro ao interromper acompanhamento')}
  finally{setBusy(false)}
 }
 useEffect(()=>{
  if(!started||!navigator.geolocation)return;
  let watch:number|undefined;
  const onPoint=(p:GeolocationPosition)=>{
   const currentPoint={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy};
   positionRef.current=currentPoint;setPosition(currentPoint);
   if(Date.now()-lastSent.current<20000)return;
   lastSent.current=Date.now();
   void post('/api/campo/localizacao',{action:'ping',route_id:id,...currentPoint}).catch(e=>setError(e instanceof Error?e.message:'GPS desconectado.'));
  };
  function resume(){
   if(document.visibilityState==='visible'&&watch===undefined)watch=navigator.geolocation.watchPosition(onPoint,()=>setError('Sem sinal GPS. Confirme a permissão de localização.'),{enableHighAccuracy:true,maximumAge:10000,timeout:18000});
   else if(document.visibilityState==='hidden'&&watch!==undefined){navigator.geolocation.clearWatch(watch);watch=undefined}
  }
  resume();document.addEventListener('visibilitychange',resume);
  // Heartbeat quando o agente está parado: watchPosition pode não emitir novos eventos.
  const heartbeat=window.setInterval(()=>{
   const p=positionRef.current;
   if(document.visibilityState!=='visible'||!p||Date.now()-lastSent.current<18000)return;
   lastSent.current=Date.now();
   void post('/api/campo/localizacao',{action:'ping',route_id:id,...p}).catch(e=>setError(e instanceof Error?e.message:'GPS desconectado.'));
  },25000);
  return()=>{document.removeEventListener('visibilitychange',resume);window.clearInterval(heartbeat);if(watch!==undefined)navigator.geolocation.clearWatch(watch)};
 },[started,id]);
 useEffect(()=>{
  if(!started)return;
  const leave=()=>{navigator.sendBeacon('/api/campo/localizacao',new Blob([JSON.stringify({action:'stop'})],{type:'application/json'}))};
  window.addEventListener('pagehide',leave);return()=>{window.removeEventListener('pagehide',leave);leave()};
 },[started]);
 async function arrive(){
  if(!current)return;setBusy(true);setError('');
  try{const p=await gpsOnce();setPosition(p);await post('/api/campo/visita',{action:'arrive',stop_id:current.id,...p});await reload();setMessage('Chegada confirmada. Agora fotografe a fachada.')}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível confirmar a chegada.')}
  finally{setBusy(false)}
 }
 async function photo(file:File|undefined){
  if(!file||!current?.visit_id)return;
  setPhotoBusy(true);setError('');
  try{
   const jpeg=await compactPhoto(file);const f=new FormData();f.append('visit_id',current.visit_id);f.append('photo',jpeg);
   const r=await fetch('/api/campo/foto',{method:'POST',body:f});const d=await r.json();if(!r.ok)throw Error(d.error||'Falha no envio da foto.');
   setMessage('Foto protegida e recebida pela central. Agora responda às perguntas.');await reload();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível enviar a fotografia.')}
  finally{setPhotoBusy(false)}
 }
 async function finish(){
  if(!current?.visit_id)return;setBusy(true);setError('');setMessage('');
  try{
   await post('/api/campo/visita',{action:'finish',stop_id:current.id,visit_id:current.visit_id,operating_status:operating,signage_status:signage,regularity_note:regularity,notes});
   setOperating('');setSignage('');setRegularity('');setNotes('');
   await reload();setMessage('Visita enviada para conferência da central. Continue para a próxima empresa.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir a visita.')}
  finally{setBusy(false)}
 }
 return <Portal title="Minha jornada" subtitle={data?.route.campaign_name||'Siga cada etapa, uma de cada vez.'}>
 <div className="field-guide">
 <div className="field-progress-top"><div><span className="field-kicker">JORNADA DE CAMPO</span><strong>{complete} de {ordered.length} visitas registradas</strong></div><span className="field-progress-tag">{started?'GPS ativo':'GPS desligado'}</span></div>
 <div className="field-progress-track"><div style={{width:(ordered.length?100*complete/ordered.length:0)+'%'}}/></div>
 {error&&<div role="alert" className="field-error">{error}</div>}
 {message&&<div role="status" className="field-success">{message}</div>}
 {!data&&<div className="field-stage">Carregando sua jornada...</div>}
 {data&&stage==='prepare'&&<section className="field-stage">
 <div className="field-step">ETAPA 1 DE 4</div><h2>Prepare sua rota</h2><p>Vamos organizar as empresas e mostrar o caminho no mapa.</p>
 <div className="field-big-number">{data.stops.length} <span>empresas para visitar</span></div>
 <button className="field-primary" disabled={busy} onClick={()=>void calculate()}><Navigation size={26}/> {busy?'Calculando o caminho...':'Calcular melhor caminho'} <ChevronRight size={24}/></button>
 {progress&&<p role="status" className="field-muted">{progress}</p>}
 </section>}
 {data&&stage==='ready'&&<section className="field-stage">
 <div className="field-step">ETAPA 2 DE 4</div><h2>Pronto para sair?</h2><p>O mapa já está preparado. Durante a jornada, a central poderá acompanhar sua localização enquanto esta tela estiver aberta e o GPS estiver permitido.</p>
 {plan&&<FieldNavigationMap plan={plan} targetId={current?.id} current={position} compact/>}
 <div className="field-privacy"><ShieldCheck size={24}/><span>O rastreamento só começa quando você tocar em Iniciar. Você pode parar quando quiser. Não guardamos o histórico do trajeto.</span></div>
 <button className="field-primary" disabled={busy} onClick={()=>void begin()}><Play size={27}/> {busy?'Iniciando GPS...':'Iniciar minha jornada'} <ChevronRight size={24}/></button>
 <button className="field-minor" onClick={()=>void calculate()} disabled={busy}>Recalcular caminho</button>
 </section>}
 {data&&started&&current&&<section className="field-stage">
 <div className="field-step">EMPRESA {index} DE {ordered.length}</div>
 <h2>{stage==='travel'?'Siga até esta empresa':stage==='photo'?'Você chegou!':'Conclua sua visita'}</h2>
 <div className="field-target"><strong>{current.trade_name||current.legal_name}</strong><span>{[current.street,current.street_number,current.city,current.state].filter(Boolean).join(', ')}</span><small>CNPJ {current.cnpj}</small></div>
 {plan&&stage==='travel'&&<><FieldNavigationMap plan={plan} current={position} follow={follow} targetId={current.id}/>
 <label className="field-follow"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/><LocateFixed size={20}/> Acompanhar meu GPS no mapa</label>
 {plan.route_warning&&<p className="field-warning">O mapa está mostrando os endereços, mas o cálculo completo pelas ruas não está disponível.</p>}
 {(!targetPoint||plan.partial&&plan.missing?.some(x=>x.id===current.id))&&<p className="field-warning">Este endereço ainda não possui localização confirmada no mapa. Confira a fachada antes de registrar a visita.</p>}
 <SlideArrival disabled={busy} onConfirm={()=>void arrive()}/></>}
 {stage==='photo'&&<div className="field-camera"><Camera size={50}/><h3>Fotografe a fachada</h3><p>Mostre a entrada e a identificação do estabelecimento. Evite fotografar pessoas, placas de veículos ou documentos.</p>
 <label className={photoBusy?'field-photo-button busy':'field-photo-button'}><Camera size={26}/>{photoBusy?'Enviando foto...':'Abrir câmera ou escolher foto'}
 <input type="file" accept="image/*" capture="environment" disabled={photoBusy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';void photo(f)}}/></label>
 <p className="field-muted">A foto será armazenada de forma privada e excluída após a análise da central, ou no limite de retenção.</p>
 </div>}
 {stage==='form'&&<div className="field-form">
 {current.review_status==='needs_more'&&current.review_notes&&<p className="field-warning">A central pediu um ajuste: {current.review_notes}</p>}
 <div className="field-confirm-photo"><Check size={22}/> Foto recebida. Falta responder às perguntas.</div>
 <Choice title="O estabelecimento está funcionando?" choices={options.operating} value={operating} onChange={setOperating}/>
 <Choice title="Há identificação visível na fachada?" choices={options.signage} value={signage} onChange={setSignage}/>
 <Choice title="O que você observou sobre a regularidade aparente?" choices={options.regularity} value={regularity} onChange={setRegularity}/>
 <label className="field-note">Observações adicionais (opcional)<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000} rows={4} placeholder="Ex.: entrada fechada, placa diferente, outro nome comercial..."/></label>
 <p className="field-muted">Essas respostas são observações preliminares, não uma fiscalização ou conclusão jurídica.</p>
 <button className="field-primary" disabled={busy||!operating||!signage||!regularity} onClick={()=>void finish()}><Check size={26}/> {busy?'Enviando...':'Enviar visita à central'} <ChevronRight size={24}/></button>
 </div>}
 </section>}
 {data&&started&&!current&&<section className="field-stage"><div className="field-step">JORNADA CONCLUÍDA</div><h2>Visitas enviadas!</h2><p>Você registrou {complete} visitas. A central realizará a validação e poderá solicitar ajustes.</p>
 <button className="field-primary" disabled={busy} onClick={()=>void stopTracking()}><PauseCircle size={26}/> Encerrar localização</button></section>}
 {data&&<div className="field-footer-actions">
 {started&&<button className="field-stop" onClick={()=>void stopTracking()} disabled={busy}><PauseCircle size={20}/> Parar compartilhamento de GPS</button>}
 <Link href="/rotas" className="field-minor">Voltar às minhas rotas</Link>
 </div>}
 </div>
 </Portal>;
}
