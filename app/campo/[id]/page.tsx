'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {Portal} from '@/components/portal';
import {FieldNavigationMap,type ActiveLeg,type CurrentPosition,type FieldPlan} from '@/components/field-navigation-map';
import {ArrowLeft,ArrowRight,Camera,Check,CheckCircle2,ChevronRight,ClipboardCheck,Flag,LocateFixed,MapPin,MapPinned,Navigation,Play,Route as RouteIcon,ShieldCheck,X,ZoomIn,ZoomOut,RefreshCw,Maximize2,RotateCcw,CornerUpLeft,CornerUpRight,MoveUp,MoreHorizontal} from 'lucide-react';
import '../jornada.css';

type Stop={
 id:string;position_order:number;legal_name:string;trade_name:string|null;street:string|null;street_number:string|null;
 city:string|null;state:string|null;cnpj:string;lat:number|null;lon:number|null;
 visit_id:string|null;checkin_at:string|null;checkout_at:string|null;review_status:string|null;review_notes?:string|null;has_photo:boolean;
};
type ArrivalPhase='locating'|'saving'|null;
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
const wallTime=()=>Date.now();
const blankAnswers=():Answers=>({address_match:'',operating_status:'',pet_activity_match:'',signage_status:'',regularity_note:''});
async function apiResponse<T extends {error?:string}>(response:Response):Promise<T>{
 const raw=await response.text();
 if(!raw.trim())throw Error('O servidor não retornou dados (HTTP '+response.status+'). Tente novamente.');
 try{return JSON.parse(raw) as T}
 catch{throw Error('A resposta do servidor foi inválida (HTTP '+response.status+'). Tente novamente.')}
}
const send=async<T extends {error?:string}={error?:string;ok?:boolean}>(path:string,body:unknown):Promise<T>=>{
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
 const data=await apiResponse<T>(r);
 if(!r.ok)throw Error(data.error||'Não foi possível concluir a operação.');return data;
};
type GpsFailure=Error&{geoCode:number};
let lastGpsFix:{point:CurrentPosition;at:number}|null=null;
const locationError=(code:number):GpsFailure=>{
 const message=code===1
  ?'O navegador não conseguiu acessar a localização. Confira a permissão DESTE site e se a localização do aparelho está ligada.'
  :code===2
  ?'O GPS está temporariamente sem sinal. Sua permissão pode estar ativa; tente novamente em local aberto.'
  :code===3
  ?'A localização demorou para responder. Isso não significa que a permissão foi negada. Tente localizar novamente.'
  :'Este navegador não disponibiliza localização por GPS. Abra o aplicativo em HTTPS.';
 return Object.assign(new Error(message),{geoCode:code});
};
function rememberGps(point:CurrentPosition){
 if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||!Number.isFinite(point.accuracy))return;
 lastGpsFix={point,at:point.timestamp&&point.timestamp>0?point.timestamp:Date.now()};
}
async function permissionState():Promise<PermissionState|null>{
 try{
  if(!navigator.permissions?.query)return null;
  const state=await navigator.permissions.query({name:'geolocation'});
  return state.state;
 }catch{return null}
}
const gpsOnce=(options:PositionOptions={enableHighAccuracy:true,maximumAge:30000,timeout:12000})=>new Promise<CurrentPosition>((resolve,reject)=>{
 if(!navigator.geolocation)return reject(locationError(0));
 navigator.geolocation.getCurrentPosition(
  p=>{const point={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,heading:p.coords.heading,speed:p.coords.speed,timestamp:p.timestamp};rememberGps(point);resolve(point)},
  error=>reject(locationError(error.code)),
  options);
});
async function gpsForNavigation(cached:CurrentPosition|null,updatedAt:number,forceFresh=false):Promise<CurrentPosition>{
 const previous=cached&&Date.now()-updatedAt<30000?{point:cached,at:updatedAt}:lastGpsFix;
 if(!forceFresh&&previous&&Date.now()-previous.at<45000&&previous.point.accuracy<=1000){
  const permission=await permissionState();
  if(permission==='denied')throw locationError(1);
  if(permission==='granted')return previous.point;
  // Quando a permissão voltou a 'prompt', solicite uma posição nova ao navegador.
 }
 try{return await gpsOnce({enableHighAccuracy:true,maximumAge:forceFresh?0:45000,timeout:12000})}
 catch(error){
  if((error as GpsFailure).geoCode===1)throw error;
  // Em desktop, aparelhos sem receptor de GPS ou após trocar de rota,
  // uma medição por rede costuma estar disponível antes do sinal preciso.
  return gpsOnce({enableHighAccuracy:false,maximumAge:forceFresh?12000:60000,timeout:10000});
 }
}
/** Espera por leituras de precisão: estimativas por rede não comprovam chegada. */
const gpsAccurateFix=(previous:CurrentPosition|null=null):Promise<CurrentPosition>=>{
 if(!navigator.geolocation)return Promise.reject(locationError(0));
 if(previous?.timestamp&&Date.now()-previous.timestamp<8000&&previous.accuracy<=250)
  return Promise.resolve(previous);
 return new Promise((resolve,reject)=>{
  let done=false,best:CurrentPosition|null=null;
  const finish=(point?:CurrentPosition,error?:Error)=>{
   if(done)return;done=true;
   window.clearTimeout(timeout);
   navigator.geolocation.clearWatch(watch);
   if(point)resolve(point);else reject(error||new Error('Não foi possível obter GPS preciso.'));
  };
  const timeout=window.setTimeout(()=>{
   if(best&&best.accuracy<=500)finish(best);
   else finish(undefined,new Error(best?
    'Localização aproximada (margem de '+Math.ceil(best.accuracy)+' m). Ative a localização precisa do aparelho e tente novamente com o veículo parado.':
    'O celular ainda não enviou uma localização precisa. Verifique a localização do sistema, aguarde o sinal e tente novamente com o veículo parado.'));
  },22000);
  const watch=navigator.geolocation.watchPosition(
   raw=>{
    const point:CurrentPosition={lat:raw.coords.latitude,lon:raw.coords.longitude,
     accuracy:raw.coords.accuracy,heading:raw.coords.heading,speed:raw.coords.speed,timestamp:raw.timestamp};
    if(!Number.isFinite(point.accuracy)||point.accuracy<0||Date.now()-raw.timestamp>15000)return;
    if(!best||point.accuracy<best.accuracy)best=point;
    rememberGps(point);
    if(point.accuracy<=250)finish(point);
   },
   error=>{if(error.code===1)finish(undefined,locationError(1));},
   {enableHighAccuracy:true,maximumAge:0,timeout:18000}
  );
 });
};
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
 return <CampoGuiadoSession key={id} id={id}/>;
}
function CampoGuiadoSession({id}:{id:string}){
 const [data,setData]=useState<RouteData|null>(null),[plan,setPlan]=useState<FieldPlan|null>(null);
 const [started,setStarted]=useState(false),[position,setPosition]=useState<CurrentPosition|null>(null),[follow,setFollow]=useState(true),[gpsRestart,setGpsRestart]=useState(0),[gpsIssue,setGpsIssue]=useState(false),[signalTick,setSignalTick]=useState(0),[lastGpsAt,setLastGpsAt]=useState(0);
 const [busy,setBusy]=useState(false),[photoBusy,setPhotoBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[progress,setProgress]=useState(''),[retryCount,setRetryCount]=useState(0);
 const [showStops,setShowStops]=useState(false),[arrivalDialog,setArrivalDialog]=useState(false),[recenterToken,setRecenterToken]=useState(0);
 const [questionIndex,setQuestionIndex]=useState(0),[answers,setAnswers]=useState<Answers>(blankAnswers),[notes,setNotes]=useState('');
 const [arrivalPhase,setArrivalPhase]=useState<ArrivalPhase>(null);
 const [leg,setLeg]=useState<ActiveLeg|null>(null),[legBusy,setLegBusy]=useState(false),[legError,setLegError]=useState('');
 const [rerouteToken,setRerouteToken]=useState(0),[fitToken,setFitToken]=useState(0),[zoomCommand,setZoomCommand]=useState<{id:number;delta:1|-1}|undefined>(undefined);
 const [showGuide,setShowGuide]=useState(true),[mapToolsOpen,setMapToolsOpen]=useState(false);
 const sentAt=useRef(0),positionRef=useRef<CurrentPosition|null>(null),positionUpdatedAt=useRef(0);
 const cacheKey='sind-jornada-plan:'+id;
 async function reload(){
  const r=await fetch('/api/campo/'+encodeURIComponent(id),{cache:'no-store'});
  const d=await apiResponse<RouteData & {error?:string}>(r);
  if(!r.ok)throw Error(d.error||'Não foi possível abrir sua jornada (HTTP '+r.status+').');
  setData(d as RouteData);
  return d as RouteData;
 }
 useEffect(()=>{
  let alive=true;setError('');
  fetch('/api/campo/'+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{
   const d=await apiResponse<RouteData & {error?:string}>(r);
   if(!r.ok)throw Error(d.error||'Não foi possível carregar a rota (HTTP '+r.status+').');
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
 },[id,retryCount]);
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
 const gpsStale=started&&!!position&&signalTick>0&&signalTick-lastGpsAt>90000;
 const gpsNeedsRecovery=started&&(gpsIssue||gpsStale);
 const gpsActive=started&&!!position&&!gpsNeedsRecovery;
 const gpsLowAccuracy=started&&(!position||position.accuracy>500||gpsNeedsRecovery);
 const gpsAccuracyText=position&&Number.isFinite(position.accuracy)?'Precisão estimada: ±'+Math.round(position.accuracy).toLocaleString('pt-BR')+' m':'';
 const gpsLabel=!started?'GPS parado':gpsNeedsRecovery?'GPS instável':position?'GPS ativo':'Buscando GPS';
 const remaining=ordered.length-complete;
 const currentStopId=current?.id;
 const havePosition=!!position;
 useEffect(()=>{
  if(!started||!currentStopId||!target||!havePosition){setLeg(null);setLegBusy(false);return}
  const p=positionRef.current;
  if(!p)return;
  const ctrl=new AbortController();
  let alive=true;
  setLeg(null);setLegError('');setLegBusy(true);
  (async()=>{
   try{
    const r=await fetch('/api/campo/'+encodeURIComponent(id)+'/trecho',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({stop_id:currentStopId,lat:p.lat,lon:p.lon}),
     signal:ctrl.signal,cache:'no-store'});
    const route=await apiResponse<ActiveLeg & {error?:string}>(r);
    if(!r.ok)throw Error(route.error||'Não foi possível obter as orientações.');
    if(alive)setLeg(route);
   }catch(e){
    if(alive&&!ctrl.signal.aborted)setLegError(e instanceof Error?e.message:'Orientações indisponíveis.');
   }finally{if(alive)setLegBusy(false)}
  })();
  return()=>{alive=false;ctrl.abort()};
 // O mapa consulta um novo trecho somente ao iniciar, trocar de parada ou pedir recálculo.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[id,started,currentStopId,target?.lat,target?.lon,havePosition,rerouteToken]);
 const navigationStatus=useMemo(()=>{
  if(!leg||!position||!leg.geometry.coordinates.length)return null;
  const coordinates=leg.geometry.coordinates;
  let near=Number.POSITIVE_INFINITY,nearest=0;
  // Rota existente: localiza o ponto mais próximo para exibir a próxima manobra.
  for(let i=0;i<coordinates.length;i++){
   const [lon,lat]=coordinates[i];
   const dlat=(position.lat-lat)*111000,dlon=(position.lon-lon)*111000*Math.cos(position.lat*Math.PI/180);
   const sq=dlat*dlat+dlon*dlon;
   if(sq<near){near=sq;nearest=i}
  }
  const offset=Math.sqrt(near);
  const next=leg.steps.find(step=>step.route_index>nearest+1&&step.type!==11)||leg.steps.find(step=>step.type===10)||null;
  return {offRoute:offset>200,step:next,distanceToTurn:next?straightDistance(position,{lat:next.at[1],lon:next.at[0]}):null};
 },[leg,position]);
 const nextTurn=navigationStatus?.step;
 const turnIcon=nextTurn?.type===0||nextTurn?.type===2||nextTurn?.type===4||nextTurn?.type===12?
  <CornerUpLeft size={26}/>:nextTurn?.type===1||nextTurn?.type===3||nextTurn?.type===5||nextTurn?.type===13?
  <CornerUpRight size={26}/>:nextTurn?.type===9?<RotateCcw size={26}/>:<MoveUp size={26}/>;
 async function calculate(){
  if(!data)return;
  setBusy(true);setError('');setNotice('');
  try{
   let start:CurrentPosition|undefined;
   try{start=await gpsOnce({enableHighAccuracy:false,maximumAge:60000,timeout:6000});positionRef.current=start;positionUpdatedAt.current=start.timestamp||Date.now();setLastGpsAt(positionUpdatedAt.current);setPosition(start)}catch{ /* A otimização pode usar a primeira parada sem GPS, evitando travar a tela. */ }
   let saved:FieldPlan|null=null;
   for(let batch=1;batch<=12;batch++){
    setProgress('Preparando endereços · tentativa '+batch);
    const r=await fetch('/api/rotas/'+encodeURIComponent(id)+'/otimizar',{
     method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start}),cache:'no-store'
    });
    const d=await apiResponse<FieldPlan & {retryable?:boolean;error?:string}>(r);
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
 async function begin(forceFresh=false){
  setBusy(true);setError('');setNotice('');
  try{
   const p=await gpsForNavigation(positionRef.current,positionUpdatedAt.current,forceFresh);
   positionRef.current=p;positionUpdatedAt.current=p.timestamp||Date.now();setLastGpsAt(positionUpdatedAt.current);setPosition(p);rememberGps(p);
   await send('/api/campo/localizacao',{action:'start',route_id:id,consent:true,...p});
   sentAt.current=Date.now();setStarted(true);setGpsIssue(false);setGpsRestart(n=>n+1);setRerouteToken(n=>n+1);setNotice('Localização iniciada. Siga o mapa e pare o veículo antes de confirmar a chegada.');
  }catch(e){if((e as GpsFailure)?.geoCode!==undefined)setGpsIssue(true);setError(e instanceof Error?e.message:'Não foi possível iniciar a localização.')}
  finally{setBusy(false)}
 }
 async function improveGps(){
  if(busy||!started)return;
  setBusy(true);setError('');setNotice('');
  try{
   const fix=await gpsAccurateFix(positionRef.current);
   positionRef.current=fix;positionUpdatedAt.current=fix.timestamp||Date.now();
   setLastGpsAt(positionUpdatedAt.current);setPosition(fix);setGpsIssue(false);
   setNotice('Sinal GPS atualizado. Confirme a chegada somente na empresa, com o veículo parado.');
   void send('/api/campo/localizacao',{action:'ping',route_id:id,...fix}).catch(()=>{});
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível melhorar o GPS.');}
  finally{setBusy(false)}
 }
 useEffect(()=>{
  if(!started)return;
  setSignalTick(Date.now());
  const timer=window.setInterval(()=>setSignalTick(Date.now()),20000);
  return()=>window.clearInterval(timer);
 },[started]);
 useEffect(()=>{
  if(!started||!navigator.geolocation)return;
  let watch:number|undefined,alive=true;
  const ping=(p:CurrentPosition)=>{
   positionRef.current=p;positionUpdatedAt.current=p.timestamp||Date.now();rememberGps(p);setLastGpsAt(positionUpdatedAt.current);setPosition(p);setGpsIssue(false);
   setError(old=>/GPS|localizaç|permissão|navegador/i.test(old)?'':old);
   if(Date.now()-sentAt.current<20000)return;
   sentAt.current=Date.now();
   void send('/api/campo/localizacao',{action:'ping',route_id:id,...p}).catch(e=>setError(e instanceof Error?e.message:'GPS desconectado.'));
  };
  const resume=()=>{
   if(document.visibilityState==='visible'&&watch===undefined){
    watch=navigator.geolocation.watchPosition(
     p=>ping({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,heading:p.coords.heading,speed:p.coords.speed,timestamp:p.timestamp}),
     e=>{void (async()=>{
       const state=e.code===1?await permissionState():null;
       if(!alive)return;
       setGpsIssue(true);
       if(e.code===1&&state==='denied'){
        setStarted(false);setPosition(null);positionRef.current=null;
        void send('/api/campo/localizacao',{action:'stop',route_id:id}).catch(()=>{});
       }
       setError(state==='granted'&&e.code===1
        ?'A permissão deste site está ativa, mas o dispositivo não entregou a localização. Verifique a localização do sistema e toque em Reativar GPS.'
        :locationError(e.code).message);
      })()},
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
  return()=>{alive=false;document.removeEventListener('visibilitychange',resume);window.clearInterval(heartbeat);if(watch!==undefined)navigator.geolocation.clearWatch(watch)};
 },[started,id,gpsRestart]);
 useEffect(()=>{
  if(!started)return;
  const leave=()=>{try{navigator.sendBeacon('/api/campo/localizacao',new Blob([JSON.stringify({action:'stop',route_id:id})],{type:'application/json'}))}catch{}};
  window.addEventListener('pagehide',leave);
  return()=>{window.removeEventListener('pagehide',leave);leave()};
 },[started]);
 async function arrive(){
  if(!current||busy)return;
  const stopId=current.id;
  setArrivalDialog(false);setMapToolsOpen(false);setBusy(true);setArrivalPhase('locating');setError('');setNotice('');
  try{
   // Acompanhamento GPS já ativo: evite aguardar outra aquisição de até 18 segundos
   // quando existe uma medição recente e suficientemente precisa.
   let fix=positionRef.current;
   if(!fix||wallTime()-positionUpdatedAt.current>12000||fix.accuracy>500){
    fix=await gpsAccurateFix(fix);
    positionRef.current=fix;positionUpdatedAt.current=fix.timestamp||wallTime();setLastGpsAt(positionUpdatedAt.current);setPosition(fix);setGpsIssue(false);
   }
   setArrivalPhase('saving');
   const result=await send<{id?:string;error?:string}>('/api/campo/visita',{action:'arrive',stop_id:stopId,...fix});
   if(!result.id||!/^[0-9a-f-]{36}$/i.test(result.id))throw Error('O servidor não confirmou o registro. Atualize sua jornada antes de tentar novamente.');
   // A API já confirmou o check-in. Atualize somente esta parada, sem novo GET bloqueante.
   const visitId=result.id;
   setData(previous=>previous?{...previous,stops:previous.stops.map(stop=>
    stop.id===stopId?{...stop,visit_id:visitId,checkin_at:new Date().toISOString(),has_photo:false}:stop
   )}:previous);
   setNotice('Chegada registrada! Agora tire uma foto da fachada.');
  }catch(e){if((e as GpsFailure)?.geoCode!==undefined)setGpsIssue(true);setError(e instanceof Error?e.message:'Não foi possível registrar a chegada.')}
  finally{setArrivalPhase(null);setBusy(false)}
 }
 async function uploadPhoto(file:File|undefined){
  if(!file||!current?.visit_id)return;
  setPhotoBusy(true);setError('');setNotice('');
  try{
   const jpeg=await compressedPhoto(file),form=new FormData();form.append('visit_id',current.visit_id);form.append('photo',jpeg);
   const r=await fetch('/api/campo/foto',{method:'POST',body:form}),d=await apiResponse<{error?:string}>(r);
   if(!r.ok)throw Error(d.error||'Não foi possível enviar a foto.');
   // O upload confirmado é suficiente para liberar o questionário sem esperar outra consulta.
   const uploadedId=current.visit_id;
   setData(previous=>previous?{...previous,stops:previous.stops.map(stop=>
    stop.visit_id===uploadedId?{...stop,has_photo:true}:stop
   )}:previous);
   setNotice('Foto recebida e protegida. Responda às perguntas para concluir.');
  }catch(e){setError(e instanceof Error?e.message:'Erro no envio da fotografia.')}
  finally{setPhotoBusy(false)}
 }
 async function finish(){
  if(!current?.visit_id||questions.some(q=>!answers[q.key]))return;
  const stopId=current.id,visitId=current.visit_id;
  const isLast=ordered.every(stop=>stop.id===stopId||!!stop.checkout_at);
  setBusy(true);setError('');setNotice('');
  try{
   await send('/api/campo/visita',{action:'finish',stop_id:stopId,visit_id:visitId,...answers,notes});
   // Resposta confirmada: avança diretamente, sem esperar outra consulta de toda a rota.
   setData(previous=>previous?{...previous,stops:previous.stops.map(stop=>
    stop.id===stopId?{...stop,checkout_at:new Date().toISOString(),review_status:'pending'}:stop
   )}:previous);
   setQuestionIndex(0);setAnswers(blankAnswers());setNotes('');
   setFollow(true);setRecenterToken(n=>n+1);setShowStops(false);setShowGuide(true);setMapToolsOpen(false);
   if(isLast){
    setNotice('Todas as visitas foram enviadas à central.');
    try{
     await send('/api/campo/localizacao',{action:'stop',route_id:id});
     setStarted(false);positionRef.current=null;setPosition(null);setNotice('Jornada concluída e GPS encerrado automaticamente.');
    }catch{
     setError('Visitas salvas. Não foi possível confirmar o encerramento do GPS; a central desativa o sinal após expirar.');
    }
   }else {setNotice('Visita enviada. Próxima empresa no mapa.');setLeg(null);setLegError('');setRerouteToken(n=>n+1);}
  }catch(e){setError(e instanceof Error?e.message:'Falha ao enviar visita. Suas respostas continuam na tela.')}
  finally{setBusy(false)}
 }
 const answer=(key:AnswerKey,value:string)=>setAnswers(old=>({...old,[key]:value}));
 return <Portal title="Minha jornada" subtitle="Navegação e confirmação de visitas" immersive>
 <div className={'navigator-root'+((stage==='photo'||stage==='questions')?' navigator-form-mode':'')}>
   <div className="navigator-mobile-top">
    <Link href="/agente" className="navigator-mobile-back" aria-label="Voltar para Meu dia"><ArrowLeft size={22}/></Link>
    <div className="navigator-mobile-top-copy"><strong>Minha jornada</strong>
     <span>{current?'Parada '+activeIndex+' de '+ordered.length:stage==='done'?'Concluída':'Organizar percurso'}</span></div>
    <span className={'navigator-mobile-gps'+(gpsActive?' active':'')}><span/>{gpsLabel}</span>
   </div>
  <div className="navigator-map-frame">
   {plan?<FieldNavigationMap plan={plan} targetId={current?.id} current={position} follow={follow}
    immersive completedIds={ordered.filter(s=>!!s.checkout_at).map(s=>s.id)} recenterToken={recenterToken}
    fitToken={fitToken} zoomCommand={zoomCommand} activeLeg={leg}
    onManualPan={()=>setFollow(false)}/>:
    <div className="navigator-empty-map" aria-hidden="true"><MapPinned size={86}/></div>}
  </div>
  {(stage==='photo'||stage==='questions')&&<div className="navigator-map-shade" aria-hidden="true"/>}
  {arrivalPhase&&<div className="navigator-action-progress" role="status" aria-live="polite" aria-label="Confirmando a chegada">
   <div className="navigator-action-card">
    <div className="navigator-action-pulse">{arrivalPhase==='locating'?<LocateFixed size={35}/>:<CheckCircle2 size={35}/>}</div>
    <strong>{arrivalPhase==='locating'?'Conferindo sua localização...':'Registrando sua chegada...'}</strong>
    <p>{arrivalPhase==='locating'?'Verificando a posição do celular.':'Enviando a confirmação à central.'}</p>
    <div className="navigator-action-steps" aria-hidden="true">
     <span className="active">Localização</span><span className={arrivalPhase==='saving'?'active':''}>Registro</span><span>Foto</span>
    </div>
   </div>
  </div>}
  <header className="navigator-top-panel">
   <div className="navigator-top-line"><span className="navigator-kicker"><RouteIcon size={16}/> ROTA EM CAMPO</span>
    <span className={'navigator-live-tag'+(gpsActive?' on':'')}><span/>{gpsLabel}</span></div>
   <strong className="navigator-top-title">{current?.trade_name||current?.legal_name||data?.route.campaign_name||'Sua jornada'}</strong>
   <span className="navigator-address">{current?[current.street,current.street_number,current.city].filter(Boolean).join(', '):stage==='done'?'Todas as visitas registradas':'Preparando o percurso'}</span>
   <div className="navigator-progress-line">
    <span><Flag size={16}/> {complete} de {ordered.length||'–'} concluídas</span>
    {current&&<span>Parada {activeIndex} de {ordered.length}</span>}
   </div>
   <div className="navigator-progress-bar"><span style={{width:ordered.length?complete/ordered.length*100+'%':'0%'}}/></div>
   {started&&current&&stage==='travel'&&<div className="navigator-directions-summary" role="status">
    {legBusy?<><span className="navigator-mini-spinner"/><span>Calculando caminho até a empresa...</span></>:
    leg?<><RouteIcon size={17}/><strong>{fmtDistance(leg.distance_m)}</strong><span>·</span><strong>{Math.max(1,Math.round(leg.duration_s/60))} min</strong><small>estimados, sem trânsito</small></>:
    <><MapPin size={17}/><span>GPS ativo · orientação viária indisponível</span></>}
   </div>}
  </header>
  {started&&current&&leg&&navigationStatus&&showGuide&&(stage==='travel')&&<div className="navigator-turn-banner" role="status" aria-live="polite">
   <span className="navigator-turn-icon">{turnIcon}</span>
   <div><strong>{navigationStatus.offRoute?'Fora do trajeto sugerido':nextTurn?.instruction||'Siga até o destino'}</strong>
   <small>{navigationStatus.offRoute?'Use Recalcular para traçar um novo caminho.':navigationStatus.distanceToTurn!==null?'Próxima orientação a '+fmtDistance(navigationStatus.distanceToTurn):'Acompanhe o GPS no mapa'}</small></div>
   <button type="button" aria-label="Ocultar orientação" title="Ocultar orientação" onClick={()=>setShowGuide(false)}><X size={18}/></button>
  </div>}
  {plan&&(stage==='ready'||stage==='travel')&&<nav className="navigator-mobile-map-actions" aria-label="Controles rápidos do mapa">
    <button type="button" className={follow?'following':''} disabled={!position}
     title="Centralizar no GPS" aria-label="Centralizar no GPS"
     onClick={()=>{setFollow(true);setRecenterToken(n=>n+1)}}><LocateFixed size={24}/></button>
    <button type="button" aria-label="Mais ferramentas do mapa" aria-expanded={mapToolsOpen} title="Mais opções"
     onClick={()=>setMapToolsOpen(open=>!open)}><MoreHorizontal size={26}/></button>
   </nav>}
   {plan&&(stage==='ready'||stage==='travel')&&mapToolsOpen&&<>
    <button type="button" className="navigator-mobile-tools-scrim" aria-label="Fechar ferramentas" onClick={()=>setMapToolsOpen(false)}/>
    <section className="navigator-mobile-tools" role="dialog" aria-modal="true" aria-labelledby="navigator-tools-title">
     <div className="navigator-mobile-tools-heading"><strong id="navigator-tools-title">Opções do mapa</strong>
      <button type="button" aria-label="Fechar opções" onClick={()=>setMapToolsOpen(false)}><X size={22}/></button></div>
     <div className="navigator-mobile-tools-grid">
      <button type="button" onClick={()=>{setFollow(false);setFitToken(n=>n+1);setMapToolsOpen(false)}}><Maximize2 size={21}/> Ver todo o percurso</button>
      <button type="button" onClick={()=>{setShowStops(true);setMapToolsOpen(false)}}><RouteIcon size={21}/> Lista de empresas</button>
      <button type="button" onClick={()=>setZoomCommand(x=>({id:(x?.id||0)+1,delta:1}))}><ZoomIn size={21}/> Aproximar mapa</button>
      <button type="button" onClick={()=>setZoomCommand(x=>({id:(x?.id||0)+1,delta:-1}))}><ZoomOut size={21}/> Afastar mapa</button>
      {started&&current&&target&&<button type="button" disabled={legBusy}
       onClick={()=>{setShowGuide(true);setRerouteToken(n=>n+1);setMapToolsOpen(false)}}><RefreshCw size={21}/> Recalcular trajeto</button>}
      {!showGuide&&leg&&<button type="button" onClick={()=>{setShowGuide(true);setMapToolsOpen(false)}}><Navigation size={21}/> Mostrar orientações</button>}
      
     </div>
    </section>
   </>}
   {plan&&(stage==='ready'||stage==='travel')&&<nav className={'navigator-map-actions'+(mapToolsOpen?' expanded':'')} aria-label="Controles do mapa">
   <button type="button" onClick={()=>{setFollow(true);setRecenterToken(n=>n+1)}} title="Acompanhar minha posição" disabled={!position} className={follow?'navigator-following':''}>
    <LocateFixed size={24}/><span>{follow?'Seguindo':'Seguir GPS'}</span></button>
   <button type="button" className="navigator-more-tools" onClick={()=>setMapToolsOpen(x=>!x)} aria-expanded={mapToolsOpen} title={mapToolsOpen?'Fechar ferramentas':'Abrir ferramentas do mapa'}>
    <RouteIcon size={23}/><span>{mapToolsOpen?'Fechar':'Ferramentas'}</span></button>
   <button type="button" onClick={()=>{setFollow(false);setFitToken(n=>n+1);setMapToolsOpen(false)}} title="Ver o percurso completo">
    <Maximize2 size={23}/><span>Ver rota</span></button>
   <button type="button" onClick={()=>{setShowStops(x=>!x);setMapToolsOpen(false)}} aria-pressed={showStops} title="Visualizar paradas">
    <RouteIcon size={23}/><span>Paradas</span></button>
   <button type="button" onClick={()=>setZoomCommand(old=>({id:(old?.id||0)+1,delta:1}))} title="Ampliar mapa">
    <ZoomIn size={22}/><span>Mais zoom</span></button>
   <button type="button" onClick={()=>setZoomCommand(old=>({id:(old?.id||0)+1,delta:-1}))} title="Reduzir mapa">
    <ZoomOut size={22}/><span>Menos zoom</span></button>
   {started&&current&&target&&<button type="button" disabled={legBusy} onClick={()=>{setShowGuide(true);setRerouteToken(n=>n+1)}} title="Recalcular o caminho a partir da posição atual">
    <RefreshCw size={23}/><span>Recalcular</span></button>}
   {!showGuide&&leg&&<button type="button" onClick={()=>setShowGuide(true)} title="Mostrar orientação"><Navigation size={22}/><span>Orientações</span></button>}
  </nav>}
  {showStops&&plan&&(stage==='ready'||stage==='travel')&&<>
   <button type="button" className="navigator-mobile-stops-scrim" aria-label="Fechar lista de empresas" onClick={()=>setShowStops(false)}/>
   <aside className="navigator-stops-panel" aria-label="Lista de paradas">
   <div className="navigator-stops-heading"><strong>Empresas da jornada</strong><button aria-label="Fechar lista de paradas" onClick={()=>setShowStops(false)}><X size={22}/></button></div>
   <ol>{ordered.map((s,i)=><li key={s.id} className={s.checkout_at?'done':s.id===current?.id?'active':''}>
    <span>{s.checkout_at?<Check size={18}/>:i+1}</span><div><strong>{s.trade_name||s.legal_name}</strong><small>{[s.street,s.street_number,s.city].filter(Boolean).join(', ')}</small></div>
   </li>)}</ol>
  </aside></>}
  {(stage==='prepare'||stage==='loading'||stage==='ready'||stage==='travel'||stage==='done')&&
  <section key={current?.id+'-'+stage} className={'navigator-sheet navigator-sheet-enter'+(stage==='travel'?' navigator-travel-sheet':'')} aria-label="Próxima ação da jornada">
   <div className="navigator-sheet-grip" aria-hidden="true"/>
   {error&&stage!=='travel'&&<p className="navigator-error" role="alert">{error}</p>}
   {notice&&<p className="navigator-notice" role="status">{notice}</p>}
   {stage==='loading'&&<><h2>{error?'Não foi possível abrir a jornada':'Preparando sua jornada...'}</h2>
    <p>{error?'A conexão com o servidor falhou. Você pode tentar carregar novamente sem perder sua rota.':'Consultando suas empresas e a rota atribuída.'}</p>
    {error&&<button type="button" className="navigator-primary" onClick={()=>setRetryCount(n=>n+1)}>
     Tentar novamente<ChevronRight size={24}/></button>}</>}
   {stage==='prepare'&&<><span className="navigator-sheet-eyebrow">PASSO 1 · ORGANIZAR</span>
    <h2>Vamos encontrar o melhor caminho?</h2>
    <p>{remaining} {remaining===1?'empresa para visitar':'empresas para visitar'}. O mapa mostrará a ordem sugerida.</p>
    <button type="button" className="navigator-primary" disabled={busy} onClick={()=>void calculate()}>
     <Navigation size={25}/>{busy?'Calculando...':'Calcular percurso'}<ChevronRight size={24}/></button>
    {progress&&<p className="navigator-small" role="status">{progress}</p>}
    <p className="navigator-small">O cálculo não inclui trânsito em tempo real.</p></>}
   {stage==='ready'&&<><span className="navigator-sheet-eyebrow">PASSO 2 · COMEÇAR</span>
    <h2>Sua próxima parada está no mapa</h2><p>A localização será usada durante a rota. Se o sinal demorar, tente novamente sem recarregar a página.</p>
    {plan?.route_warning&&<p className="navigator-warning">Alguns trechos podem não ter rota desenhada. Confira os endereços.</p>}
    <div className="navigator-consent"><ShieldCheck size={22}/><span>Sua localização será enviada à central apenas durante a jornada. O envio termina ao encerrar a rota ou sair da tela; você também controla a permissão pelo navegador.</span></div>
    <button type="button" className="navigator-primary" disabled={busy} onClick={()=>void begin()}>
     <Play size={25}/>{busy?'Buscando localização...':error?'Tentar GPS novamente':'Iniciar navegação'}<ChevronRight size={24}/></button>
    <button type="button" className="navigator-secondary-link" disabled={busy} onClick={()=>void calculate()}>Recalcular percurso</button></>}
   {stage==='travel'&&<div className="navigator-driving-card">
    <div className="navigator-driving-copy">
     <span>PRÓXIMA PARADA · {activeIndex}/{ordered.length}</span>
     <strong>{current?.trade_name||current?.legal_name||'Empresa'}</strong>
     <small>{leg?fmtDistance(leg.distance_m)+' pela rota':distance!==null?fmtDistance(distance)+' em linha reta':'Aguardando localização'}</small>
    </div>
    {gpsLowAccuracy?<button type="button" className="navigator-arrived-button" disabled={busy}
     onClick={()=>void improveGps()} aria-label="Melhorar o sinal de GPS com o veículo parado">
     <LocateFixed size={20}/>{busy?'Localizando...':'Ajustar GPS'}
    </button>:<button type="button" className="navigator-arrived-button" disabled={busy} onClick={()=>setArrivalDialog(true)}>
     <MapPin size={20}/> Cheguei
    </button>}
    {gpsLowAccuracy&&<p className="navigator-driving-alert" role="status">
     {gpsAccuracyText||'Aguardando sinal GPS'}. Para registrar a chegada, obtenha uma localização precisa. Ajuste o GPS somente com o veículo parado.
    </p>}
    {!target&&<p className="navigator-driving-alert">Local sem coordenadas precisas. Confirme o endereço antes de registrar a chegada.</p>}
    {gpsNeedsRecovery&&<div className="navigator-gps-recovery" role="alert"><p>{error||'O GPS parou de atualizar a posição. Você pode recuperar o sinal sem recarregar a página.'}</p><button type="button" disabled={busy} onClick={()=>void begin(true)}><LocateFixed size={16}/>{busy?'Localizando...':'Reativar GPS'}</button><small>Faça isso somente com o veículo parado.</small></div>}
    {error&&!gpsNeedsRecovery&&<p className="navigator-driving-alert" role="alert">{error}</p>}
    {legError&&<p className="navigator-driving-alert" role="status">Percurso viário indisponível. Confira o endereço.</p>}
   </div>}
   {stage==='done'&&<div className="navigator-finished"><CheckCircle2 size={54}/>
    <span className="navigator-sheet-eyebrow">JORNADA FINALIZADA</span><h2>Visitas enviadas!</h2>
    <p>As informações seguiram para análise da central. Se houver alguma correção necessária, a equipe será avisada.</p>
    
    <Link className="navigator-secondary-link" href="/agente">Voltar ao Meu dia</Link></div>}
  </section>}
  {(stage==='photo'||stage==='questions')&&<section key={current?.id+'-'+stage} className="navigator-form-sheet navigator-sheet-enter" aria-label="Registro da visita">
   <div className="navigator-sheet-grip" aria-hidden="true"/>
   <div className="navigator-mobile-form-back"><Link href="/agente"><ArrowLeft size={19}/> Meu dia</Link><span>Visita {activeIndex}/{ordered.length}</span></div>
    <div className="navigator-form-header">
    <span><ClipboardCheck size={18}/> VISITA À EMPRESA · {activeIndex}/{ordered.length}</span>
    <strong>{current?.trade_name||current?.legal_name}</strong>
   </div>
   {error&&<p className="navigator-error" role="alert">{error}</p>}
   {notice&&<p className="navigator-notice" role="status">{notice}</p>}
   {stage==='photo'&&<div className="navigator-photo-step navigator-step-enter">
    <div className="navigator-photo-emblem"><Camera size={39}/></div>
    <span className="navigator-sheet-eyebrow">ETAPA 1 · COMPROVAÇÃO</span><h2>Fotografe a fachada</h2>
    <p>Inclua a entrada e o nome do estabelecimento, quando visível. Evite fotografar pessoas ou documentos.</p>
    <label className={'navigator-camera-button'+(photoBusy?' uploading':'')}>
     <Camera size={25}/>{photoBusy?'Enviando foto...':'Tirar foto ou escolher imagem'}
     <input type="file" accept="image/*" capture="environment" disabled={photoBusy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void uploadPhoto(file)}}/>
    </label>
    {photoBusy&&<p className="navigator-upload-progress" role="status"><span className="navigator-mini-spinner"/> Preparando e enviando a foto...</p>}
    <p className="navigator-small">A foto será mantida em armazenamento privado temporário e removida após a análise.</p>
   </div>}
   {stage==='questions'&&<div key={questionIndex} className="navigator-question-step navigator-step-enter">
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
    <p>Confirme somente com o veículo parado, em frente à empresa. Sua localização e o horário serão registrados.</p>
    {distance!==null&&distance>500&&<p className="navigator-warning">Seu GPS está a aproximadamente {fmtDistance(distance)} da coordenada cadastrada, que pode estar imprecisa. Confira o endereço antes de continuar.</p>}
    <button className="navigator-primary" disabled={busy} onClick={()=>void arrive()}><CheckCircle2 size={24}/> Sim, cheguei ao local</button>
    <button className="navigator-back navigator-modal-cancel" disabled={busy} onClick={()=>setArrivalDialog(false)}>Cancelar e continuar a rota</button>
   </section>
  </div>}
 </div>
 </Portal>;
}
