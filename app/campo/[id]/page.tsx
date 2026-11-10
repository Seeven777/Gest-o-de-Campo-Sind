'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {Portal} from '@/components/portal';
import {FieldNavigationMap,type CurrentPosition,type FieldPlan} from '@/components/field-navigation-map';
import {ArrowLeft,ArrowRight,Camera,Check,CheckCircle2,ChevronRight,ClipboardCheck,Flag,LocateFixed,MapPin,MapPinned,Navigation,PauseCircle,Play,Route as RouteIcon,ShieldCheck,X} from 'lucide-react';
import '../jornada.css';

type Stop={
 id:string;position_order:number;legal_name:string;trade_name:string|null;street:string|null;street_number:string|null;
 city:string|null;state:string|null;cnpj:string;lat:number|null;lon:number|null;
 visit_id:string|null;checkin_at:string|null;checkout_at:string|null;review_status:string|null;review_notes?:string|null;has_photo:boolean;
};
type RouteData={
 route:{id:string;campaign_name:string;route_date:string;status:string};
 stops:Stop[];
 presence:{active:boolean;last_seen_at:string}|null;
};
type AnswerKey='address_match'|'operating_status'|'pet_activity_match'|'signage_status'|'regularity_note';
type Answers=Record<AnswerKey,string>;
type Choice={value:string;label:string};
type Question={key:AnswerKey;title:string;help:string;choices:Choice[]};
const yesNo:Choice[]=[
 {value:'yes',label:'Sim, confere'},{value:'no',label:'Não confere'},{value:'unknown',label:'Não consegui verificar'}
];
const questions:Question[]=[
 {key:'address_match',title:'O endereço corresponde ao cadastro?',help:'Confira rua, número e localização. Se houver divergência, descreva ao final.',choices:yesNo},
 {key:'operating_status',title:'Qual é a situação do estabelecimento?',help:'Registre o que encontrou ao chegar.',choices:[
  {value:'operating',label:'Está funcionando'},{value:'closed',label:'Está fechado'},
  {value:'moved',label:'Mudou de endereço'},{value:'not_found',label:'Não encontrei a empresa'},
  {value:'unknown',label:'Não foi possível confirmar'}
 ]},
 {key:'pet_activity_match',title:'A atividade está ligada ao setor pet?',help:'Considere o que for visível ou informado no local. Não presuma apenas pelo CNAE.',choices:[
  {value:'yes',label:'Sim, é do setor pet'},{value:'no',label:'Não parece ser do setor pet'},
  {value:'unknown',label:'Não consegui verificar'}
 ]},
 {key:'signage_status',title:'Existe identificação visível na fachada?',help:'Exemplo: placa, nome comercial ou identificação do estabelecimento.',choices:[
  {value:'yes',label:'Sim'},{value:'no',label:'Não'},{value:'unknown',label:'Não foi possível verificar'}
 ]},
 {key:'regularity_note',title:'Como estavam as condições aparentes do local?',help:'Anote apenas condições observáveis. Isto não representa uma avaliação jurídica.',choices:[
  {value:'none_observed',label:'Nada preocupante observado'},
  {value:'attention',label:'Há uma situação que precisa de atenção'},
  {value:'not_evaluated',label:'Não consegui avaliar'}
 ]}
];
const blankAnswers=():Answers=>({address_match:'',operating_status:'',pet_activity_match:'',signage_status:'',regularity_note:''});
const send=async(path:string,body:unknown)=>{
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível concluir a operação.');return data;
};
const gpsOnce=()=>new Promise<CurrentPosition>((resolve,reject)=>{
 if(!navigator.geolocation)return reject(Error('Seu celular não disponibiliza GPS.'));
 navigator.geolocation.getCurrentPosition(
  p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy}),
  ()=>reject(Error('Autorize o GPS nas permissões do navegador e tente novamente.')),
  {enableHighAccuracy:true,maximumAge:0,timeout:18000});
});
async function compressedPhoto(file:File):Promise<File>{
 let w=0,h=0,draw:(ctx:CanvasRenderingContext2D,width:number,height:number)=>void;
 if(typeof createImageBitmap==='function'){
  const img=await createImageBitmap(file);w=img.width;h=img.height;
  draw=(ctx,width,height)=>{ctx.drawImage(img,0,0,width,height);img.close()};
 }else{
  const src=URL.createObjectURL(file);const img=new Image();
  try{await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('Não foi possível abrir a imagem.'));img.src=src})}
  finally{URL.revokeObjectURL(src)}
  w=img.naturalWidth;h=img.naturalHeight;draw=(ctx,width,height)=>ctx.drawImage(img,0,0,width,height);
 }
 const ratio=Math.min(1,1280/Math.max(w,h));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Não foi possível preparar a imagem.');
 draw(ctx,canvas.width,canvas.height);
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.75));
 if(!blob||blob.size>2*1024*1024)throw Error('Imagem muito grande. Tire outra foto da fachada.');
 return new File([blob],'fachada.jpg',{type:'image/jpeg'});
}
function straightDistance(a:CurrentPosition|null,b:{lat:number;lon:number}|undefined):number|null{
 if(!a||!b)return null;
 const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
 return 2*6371000*Math.asin(Math.min(1,Math.sqrt(h)));
}
function fmtDistance(d:number|null){
 if(d===null)return 'Distância indisponível';
 return d<1000?Math.round(d)+' metros':(d/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' km';
}
function ArrivalSlider({disabled,onConfirm}:{disabled:boolean;onConfirm:()=>void}){
 const [value,setValue]=useState(0),current=useRef(0);
 const update=(n:number)=>{current.current=n;setValue(n)};
 const release=()=>{const approved=current.current>=92;update(0);if(approved&&!disabled)onConfirm()};
 return <div className="navigator-arrival">
  <label htmlFor="navigator-arrival-slider">Deslize para confirmar chegada</label>
  <div className="navigator-slider-line">
   <input id="navigator-arrival-slider" type="range" min="0" max="100" step="1"
    value={value} disabled={disabled}
    onChange={e=>update(Number(e.target.value))}
    onPointerUp={release} onPointerCancel={()=>update(0)}
    onKeyUp={e=>{if(e.key==='ArrowRight'||e.key==='End'||e.key===' '||e.key==='Enter')release()}}
    style={{background:`linear-gradient(to right,#f36a21 ${value}%,#e7eeea ${value}%)`}}
    aria-label="Arraste o controle para a direita até o final para confirmar chegada"/>
   <span className="navigator-slider-end" aria-hidden="true"><Check size={21}/></span>
  </div>
  <p className="navigator-slider-hint">Arraste até o final <ArrowRight size={17}/></p>
  <button type="button" className="navigator-text-button" disabled={disabled} onClick={onConfirm}>
   Não consegue arrastar? Confirmar por toque
  </button>
 </div>;
}
function QuestionView({question,value,onChange}:{question:Question;value:string;onChange:(value:string)=>void}){
 return <fieldset className="navigator-question">
  <legend>{question.title}</legend><p>{question.help}</p>
  <div className="navigator-answer-list">
  {question.choices.map(opt=><label key={opt.value} className={'navigator-answer'+(value===opt.value?' chosen':'')}>
   <input type="radio" name={question.key} value={opt.value} checked={value===opt.value} onChange={()=>onChange(opt.value)}/>
   <span>{opt.label}</span>{value===opt.value&&<CheckCircle2 size={23} aria-hidden="true"/>}
  </label>)}
  </div>
 </fieldset>;
}
export default function CampoGuiado(){
 const {id}=useParams<{id:string}>();
 const [data,setData]=useState<RouteData|null>(null),[plan,setPlan]=useState<FieldPlan|null>(null);
 const [started,setStarted]=useState(false),[position,setPosition]=useState<CurrentPosition|null>(null),[follow,setFollow]=useState(true);
 const [busy,setBusy]=useState(false),[photoBusy,setPhotoBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[progress,setProgress]=useState('');
 const [showStops,setShowStops]=useState(false),[arrivalDialog,setArrivalDialog]=useState(false),[recenterToken,setRecenterToken]=useState(0);
 const [questionIndex,setQuestionIndex]=useState(0),[answers,setAnswers]=useState<Answers>(blankAnswers),[notes,setNotes]=useState('');
 const sentAt=useRef(0),positionRef=useRef<CurrentPosition|null>(null);
 const cacheKey='sind-jornada-plan:'+id;
 async function reload(){
  const r=await fetch('/api/campo/'+encodeURIComponent(id),{cache:'no-store'});const d=await r.json();
  if(!r.ok)throw Error(d.error||'Não foi possível abrir sua jornada.');
  setData(d as RouteData);
  return d as RouteData;
 }
 useEffect(()=>{
  let alive=true;
  fetch('/api/campo/'+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{
   const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível carregar a rota.');
   if(!alive)return;
   const route=d as RouteData;setData(route);
   if(route.presence?.active&&route.presence.last_seen_at&&Date.now()-new Date(route.presence.last_seen_at).getTime()<120000)setStarted(true);
   try{
    const raw=sessionStorage.getItem('sind-jornada-plan:'+id);
    if(raw){
     const cached=JSON.parse(raw) as {expires:number;stopIds:string;plan:FieldPlan};
     if(cached.expires>Date.now()&&cached.stopIds===route.stops.map(s=>s.id).sort().join(','))setPlan(cached.plan);
    }
   }catch{ /* Cache opcional. A rota pode ser recalculada. */ }
  }).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Erro ao abrir jornada.')});
  return()=>{alive=false};
 },[id]);
 const ordered=useMemo(()=>{
  if(!data)return [];
  const sequence=plan?.order||[],byId=new Map(data.stops.map(x=>[x.id,x]));
  return [...sequence.map(x=>byId.get(x)).filter((s):s is Stop=>!!s),...data.stops.filter(s=>!sequence.includes(s.id))];
 },[data,plan]);
 const complete=ordered.filter(x=>!!x.checkout_at).length;
 const current=ordered.find(x=>!x.checkout_at);
 const activeIndex=current?ordered.indexOf(current)+1:ordered.length;
 const stage=!data?'loading':!current?'done':current.checkin_at?(current.has_photo?'questions':'photo'):!plan?'prepare':!started?'ready':'travel';
 const target=plan?.points.find(p=>p.id===current?.id);
 const distance=straightDistance(position,target);
 const questionnaireEnd=questionIndex===questions.length;
 const nextQuestion=questions[questionIndex];
 const gpsActive=started;
 const remaining=ordered.length-complete;
 async function calculate(){
  if(!data)return;
  setBusy(true);setError('');setNotice('');
  try{
   let start:CurrentPosition|undefined;
   try{start=await gpsOnce();positionRef.current=start;setPosition(start)}catch{ /* Usa primeira parada quando localização não estiver disponível. */ }
   let saved:FieldPlan|null=null;
   for(let batch=1;batch<=12;batch++){
    setProgress('Preparando endereços · tentativa '+batch);
    const r=await fetch('/api/rotas/'+encodeURIComponent(id)+'/otimizar',{
     method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start}),cache:'no-store'
    });
    const d=await r.json();
    if(r.ok){saved=d as FieldPlan;break}
    if(r.status===422&&d.retryable===true&&batch<12)continue;
    throw Error(d.error||'Não foi possível calcular a rota.');
   }
   if(!saved)throw Error('Não foi possível concluir o cálculo. Tente novamente.');
   setPlan(saved);
   try{sessionStorage.setItem(cacheKey,JSON.stringify({expires:Date.now()+8*3600000,stopIds:data.stops.map(s=>s.id).sort().join(','),plan:saved}))}catch{}
   if(saved.route_warning)setNotice(saved.route_warning);
  }catch(e){setError(e instanceof Error?e.message:'Falha no cálculo.')}
  finally{setBusy(false);setProgress('')}
 }
 async function begin(){
  setBusy(true);setError('');setNotice('');
  try{
   const p=await gpsOnce();positionRef.current=p;setPosition(p);
   await send('/api/campo/localizacao',{action:'start',route_id:id,consent:true,...p});
   setStarted(true);setNotice('Jornada iniciada. A central recebe sua posição somente enquanto o GPS está ativo.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar a localização.')}
  finally{setBusy(false)}
 }
 async function stopTracking(){
  setBusy(true);setError('');
  try{await send('/api/campo/localizacao',{action:'stop'});setStarted(false);setNotice('GPS encerrado. A central não recebe mais posições.')}
  catch(e){setError(e instanceof Error?e.message:'Falha ao interromper GPS.')}
  finally{setBusy(false)}
 }
 useEffect(()=>{
  if(!started||!navigator.geolocation)return;
  let watch:number|undefined;
  const ping=(p:CurrentPosition)=>{
   positionRef.current=p;setPosition(p);
   if(Date.now()-sentAt.current<20000)return;
   sentAt.current=Date.now();
   void send('/api/campo/localizacao',{action:'ping',route_id:id,...p}).catch(e=>setError(e instanceof Error?e.message:'GPS desconectado.'));
  };
  const resume=()=>{
   if(document.visibilityState==='visible'&&watch===undefined){
    watch=navigator.geolocation.watchPosition(
     p=>ping({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy}),
     ()=>setError('GPS indisponível. Confira as permissões de localização.'),
     {enableHighAccuracy:true,maximumAge:10000,timeout:18000});
   }else if(document.visibilityState==='hidden'&&watch!==undefined){
    navigator.geolocation.clearWatch(watch);watch=undefined;
   }
  };
  resume();document.addEventListener('visibilitychange',resume);
  const heartbeat=window.setInterval(()=>{
   if(document.visibilityState!=='visible'||!positionRef.current||Date.now()-sentAt.current<18000)return;
   sentAt.current=Date.now();
   void send('/api/campo/localizacao',{action:'ping',route_id:id,...positionRef.current}).catch(()=>{});
  },25000);
  return()=>{document.removeEventListener('visibilitychange',resume);window.clearInterval(heartbeat);if(watch!==undefined)navigator.geolocation.clearWatch(watch)};
 },[started,id]);
 useEffect(()=>{
  if(!started)return;
  const leave=()=>{try{navigator.sendBeacon('/api/campo/localizacao',new Blob([JSON.stringify({action:'stop'})],{type:'application/json'}))}catch{}};
  window.addEventListener('pagehide',leave);
  return()=>{window.removeEventListener('pagehide',leave);leave()};
 },[started]);
 async function arrive(){
  if(!current||busy)return;
  setArrivalDialog(false);setBusy(true);setError('');setNotice('');
  try{
   const p=await gpsOnce();setPosition(p);positionRef.current=p;
   await send('/api/campo/visita',{action:'arrive',stop_id:current.id,...p});
   await reload();
   setNotice('Chegada registrada. Agora tire uma foto da fachada.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar a chegada.')}
  finally{setBusy(false)}
 }
 async function uploadPhoto(file:File|undefined){
  if(!file||!current?.visit_id)return;
  setPhotoBusy(true);setError('');setNotice('');
  try{
   const jpeg=await compressedPhoto(file),form=new FormData();form.append('visit_id',current.visit_id);form.append('photo',jpeg);
   const r=await fetch('/api/campo/foto',{method:'POST',body:form}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Não foi possível enviar a foto.');
   await reload();setNotice('Foto recebida e protegida. Responda às perguntas para concluir.');
  }catch(e){setError(e instanceof Error?e.message:'Erro no envio da fotografia.')}
  finally{setPhotoBusy(false)}
 }
 async function finish(){
  if(!current?.visit_id||questions.some(q=>!answers[q.key]))return;
  setBusy(true);setError('');setNotice('');
  try{
   await send('/api/campo/visita',{action:'finish',stop_id:current.id,visit_id:current.visit_id,...answers,notes});
   const d=await reload();
   setQuestionIndex(0);setAnswers(blankAnswers());setNotes('');
   setFollow(true);setRecenterToken(n=>n+1);setShowStops(false);
   if(d.stops.every(s=>!!s.checkout_at)){
    await send('/api/campo/localizacao',{action:'stop'}).catch(()=>{});
    setStarted(false);setNotice('Todas as visitas foram enviadas. O GPS foi encerrado.');
   }else setNotice('Visita enviada à central. Próxima parada carregada automaticamente!');
  }catch(e){setError(e instanceof Error?e.message:'Falha ao enviar visita. Suas respostas continuam na tela.')}
  finally{setBusy(false)}
 }
 const answer=(key:AnswerKey,value:string)=>setAnswers(old=>({...old,[key]:value}));
 return <Portal title="Minha jornada" subtitle="Navegação e confirmação de visitas" immersive>
 <div className="navigator-root">
  <div className="navigator-map-frame">
   {plan?<FieldNavigationMap plan={plan} targetId={current?.id} current={position} follow={follow}
    immersive completedIds={ordered.filter(s=>!!s.checkout_at).map(s=>s.id)} recenterToken={recenterToken}/>:
    <div className="navigator-empty-map" aria-hidden="true"><MapPinned size={86}/></div>}
  </div>
  {(stage==='photo'||stage==='questions')&&<div className="navigator-map-shade" aria-hidden="true"/>}
  <header className="navigator-top-panel">
   <div className="navigator-top-line"><span className="navigator-kicker"><RouteIcon size={16}/> ROTA EM CAMPO</span>
    <span className={'navigator-live-tag'+(gpsActive?' on':'')}><span/>{gpsActive?'GPS ativo':'GPS parado'}</span></div>
   <strong className="navigator-top-title">{current?.trade_name||current?.legal_name||data?.route.campaign_name||'Sua jornada'}</strong>
   <span className="navigator-address">{current?[current.street,current.street_number,current.city].filter(Boolean).join(', '):stage==='done'?'Todas as visitas registradas':'Preparando o percurso'}</span>
   <div className="navigator-progress-line">
    <span><Flag size={16}/> {complete} de {ordered.length||'–'} concluídas</span>
    {current&&<span>Parada {activeIndex} de {ordered.length}</span>}
   </div>
   <div className="navigator-progress-bar"><span style={{width:ordered.length?complete/ordered.length*100+'%':'0%'}}/></div>
  </header>
  {plan&&(stage==='ready'||stage==='travel')&&<nav className="navigator-map-actions" aria-label="Controles do mapa">
   <button type="button" onClick={()=>setShowStops(x=>!x)} aria-pressed={showStops} title="Visualizar paradas">
    <RouteIcon size={23}/><span>Paradas</span></button>
   <button type="button" onClick={()=>{setFollow(true);setRecenterToken(n=>n+1)}} title="Centralizar o GPS" disabled={!position}>
    <LocateFixed size={24}/><span>Centralizar</span></button>
  </nav>}
  {showStops&&plan&&(stage==='ready'||stage==='travel')&&<aside className="navigator-stops-panel" aria-label="Lista de paradas">
   <div className="navigator-stops-heading"><strong>Empresas da jornada</strong><button aria-label="Fechar lista de paradas" onClick={()=>setShowStops(false)}><X size={22}/></button></div>
   <ol>{ordered.map((s,i)=><li key={s.id} className={s.checkout_at?'done':s.id===current?.id?'active':''}>
    <span>{s.checkout_at?<Check size={18}/>:i+1}</span><div><strong>{s.trade_name||s.legal_name}</strong><small>{[s.street,s.street_number,s.city].filter(Boolean).join(', ')}</small></div>
   </li>)}</ol>
  </aside>}
  {(stage==='prepare'||stage==='loading'||stage==='ready'||stage==='travel'||stage==='done')&&
  <section className="navigator-sheet" aria-label="Próxima ação da jornada">
   <div className="navigator-sheet-grip" aria-hidden="true"/>
   {error&&<p className="navigator-error" role="alert">{error}</p>}
   {notice&&<p className="navigator-notice" role="status">{notice}</p>}
   {stage==='loading'&&<><h2>Preparando sua jornada...</h2><p>Consultando suas empresas e a rota atribuída.</p></>}
   {stage==='prepare'&&<><span className="navigator-sheet-eyebrow">PASSO 1 · ORGANIZAR</span>
    <h2>Vamos encontrar o melhor caminho?</h2>
    <p>{remaining} {remaining===1?'empresa para visitar':'empresas para visitar'}. O mapa mostrará a ordem sugerida.</p>
    <button type="button" className="navigator-primary" disabled={busy} onClick={()=>void calculate()}>
     <Navigation size={25}/>{busy?'Calculando...':'Calcular percurso'}<ChevronRight size={24}/></button>
    {progress&&<p className="navigator-small" role="status">{progress}</p>}
    <p className="navigator-small">O cálculo não inclui trânsito em tempo real.</p></>}
   {stage==='ready'&&<><span className="navigator-sheet-eyebrow">PASSO 2 · COMEÇAR</span>
    <h2>Sua próxima parada está no mapa</h2><p>Para iniciar o acompanhamento, permita o uso do GPS.</p>
    {plan?.route_warning&&<p className="navigator-warning">Alguns trechos podem não ter rota desenhada. Confira os endereços.</p>}
    <div className="navigator-consent"><ShieldCheck size={22}/><span>A central receberá sua última localização durante a jornada. Você pode interromper a qualquer momento.</span></div>
    <button type="button" className="navigator-primary" disabled={busy} onClick={()=>void begin()}>
     <Play size={25}/>{busy?'Iniciando...':'Iniciar navegação'}<ChevronRight size={24}/></button>
    <button type="button" className="navigator-secondary-link" disabled={busy} onClick={()=>void calculate()}>Recalcular percurso</button></>}
   {stage==='travel'&&<><div className="navigator-arrival-meta">
    <span><MapPin size={19}/> PRÓXIMA PARADA</span>
    <strong>{fmtDistance(distance)}</strong>
    <small>{distance===null?'Aguardando coordenadas':'Distância em linha reta, não é o trajeto pelas ruas'}</small>
   </div>
    {!target&&<p className="navigator-warning">Endereço sem posição exata no mapa. Confira cuidadosamente o local antes de registrar a chegada.</p>}
    {plan?.route_warning&&<p className="navigator-warning">O trajeto nas ruas não foi calculado. Os pontos no mapa são apenas referências.</p>}
    <ArrivalSlider disabled={busy} onConfirm={()=>setArrivalDialog(true)}/>
    <button type="button" className="navigator-stop-link" onClick={()=>void stopTracking()} disabled={busy}>
     <PauseCircle size={19}/> Parar compartilhamento de GPS</button>
   </>}
   {stage==='done'&&<div className="navigator-finished"><CheckCircle2 size={54}/>
    <span className="navigator-sheet-eyebrow">JORNADA FINALIZADA</span><h2>Visitas enviadas!</h2>
    <p>As informações seguiram para análise da central. Se houver alguma correção necessária, a equipe será avisada.</p>
    {started&&<button className="navigator-primary" onClick={()=>void stopTracking()} disabled={busy}><PauseCircle size={23}/> Encerrar localização</button>}
    <Link className="navigator-secondary-link" href="/agente">Voltar ao Meu dia</Link></div>}
  </section>}
  {(stage==='photo'||stage==='questions')&&<section className="navigator-form-sheet" aria-label="Registro da visita">
   <div className="navigator-sheet-grip" aria-hidden="true"/>
   <div className="navigator-form-header">
    <span><ClipboardCheck size={18}/> VISITA À EMPRESA · {activeIndex}/{ordered.length}</span>
    <strong>{current?.trade_name||current?.legal_name}</strong>
   </div>
   {error&&<p className="navigator-error" role="alert">{error}</p>}
   {notice&&<p className="navigator-notice" role="status">{notice}</p>}
   {stage==='photo'&&<div className="navigator-photo-step">
    <div className="navigator-photo-emblem"><Camera size={39}/></div>
    <span className="navigator-sheet-eyebrow">ETAPA 1 · COMPROVAÇÃO</span><h2>Fotografe a fachada</h2>
    <p>Inclua a entrada e o nome do estabelecimento, quando visível. Evite fotografar pessoas ou documentos.</p>
    <label className={'navigator-camera-button'+(photoBusy?' uploading':'')}>
     <Camera size={25}/>{photoBusy?'Enviando foto...':'Tirar foto ou escolher imagem'}
     <input type="file" accept="image/*" capture="environment" disabled={photoBusy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void uploadPhoto(file)}}/>
    </label>
    <p className="navigator-small">A foto será mantida em armazenamento privado temporário e removida após a análise.</p>
   </div>}
   {stage==='questions'&&<div className="navigator-question-step">
    {current?.review_status==='needs_more'&&current.review_notes&&<p className="navigator-warning">A central solicitou uma correção: {current.review_notes}</p>}
    <div className="navigator-step-counter"><span>{questionnaireEnd?'ETAPA FINAL · OBSERVAÇÕES':'PERGUNTA '+(questionIndex+1)+' DE '+questions.length}</span><span><Check size={15}/> Foto recebida</span></div>
    <div className="navigator-step-track"><span style={{width:(questionIndex/questions.length)*100+'%'}}/></div>
    {questionnaireEnd?<div className="navigator-notes-step">
     <h2>Algo mais que a central precisa saber?</h2>
     <p>Informe divergências, condições do local ou outros detalhes relevantes. Não registre dados pessoais desnecessários.</p>
     <label htmlFor="navigator-visit-notes">Observações adicionais (opcional)</label>
     <textarea id="navigator-visit-notes" rows={4} maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}
      placeholder="Exemplo: fachada com outro nome, estabelecimento fechado, mudança de endereço..."/>
     <p className="navigator-small">Suas respostas são observações de campo, não uma conclusão sobre regularidade jurídica.</p>
    </div>:
    <QuestionView question={nextQuestion} value={answers[nextQuestion.key]} onChange={v=>answer(nextQuestion.key,v)}/>}
    <div className="navigator-question-actions">
     <button type="button" className="navigator-back" disabled={busy||questionIndex===0} onClick={()=>setQuestionIndex(i=>Math.max(0,i-1))}><ArrowLeft size={20}/> Voltar</button>
     {questionnaireEnd?
     <button type="button" className="navigator-next navigator-submit" disabled={busy||questions.some(q=>!answers[q.key])} onClick={()=>void finish()}>
      {busy?'Enviando visita...':'Enviar e ir para a próxima'}<ArrowRight size={22}/></button>:
     <button type="button" className="navigator-next" disabled={!answers[nextQuestion.key]} onClick={()=>setQuestionIndex(i=>i+1)}>
      Continuar<ArrowRight size={22}/></button>}
    </div>
   </div>}
  </section>}
  {arrivalDialog&&<div className="navigator-modal-backdrop" role="presentation">
   <section className="navigator-modal" role="dialog" aria-modal="true" aria-labelledby="navigator-confirm-title">
    <MapPin size={34} color="#ef6c29"/>
    <h2 id="navigator-confirm-title">Você está em frente à empresa?</h2>
    <p>Confirme apenas quando estiver no endereço. Sua localização e o horário serão enviados à central.</p>
    {distance!==null&&distance>500&&<p className="navigator-warning">Seu GPS está a aproximadamente {fmtDistance(distance)} da coordenada cadastrada, que pode estar imprecisa. Confira o endereço antes de continuar.</p>}
    <button className="navigator-primary" disabled={busy} onClick={()=>void arrive()}><CheckCircle2 size={24}/> Sim, cheguei ao local</button>
    <button className="navigator-back navigator-modal-cancel" disabled={busy} onClick={()=>setArrivalDialog(false)}>Cancelar e continuar a rota</button>
   </section>
  </div>}
 </div>
 </Portal>;
}
