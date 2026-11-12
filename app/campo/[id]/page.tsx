'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useParams,useRouter} from 'next/navigation';
import {Portal} from '@/components/portal';
import {FieldNavigationMap,type ActiveLeg,type CurrentPosition,type FieldPlan} from '@/components/field-navigation-map';
import {ArrowLeft,ArrowRight,Camera,CheckCircle2,LocateFixed,MapPin,Navigation,Route as RouteIcon,X,ExternalLink,RotateCcw,CornerUpLeft,CornerUpRight,MoveUp} from 'lucide-react';
import {CrewTravelPanel} from '@/components/crew-travel-panel';
import '../jornada.css';
import '../equipe.css';
import '../equipe-motion.css';
import '../equipe-finish.css';

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
const shownQuestions=questions.slice(0,-1);
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
 const router=useRouter();
 const [data,setData]=useState<RouteData|null>(null),[plan,setPlan]=useState<FieldPlan|null>(null);
 const [started,setStarted]=useState(false),[position,setPosition]=useState<CurrentPosition|null>(null),[follow,setFollow]=useState(true),[gpsRestart,setGpsRestart]=useState(0),[gpsIssue,setGpsIssue]=useState(false),[signalTick,setSignalTick]=useState(0),[lastGpsAt,setLastGpsAt]=useState(0);
 const [busy,setBusy]=useState(false),[photoBusy,setPhotoBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[progress,setProgress]=useState(''),[retryCount,setRetryCount]=useState(0);
 const [arrivalDialog,setArrivalDialog]=useState(false),[recenterToken,setRecenterToken]=useState(0),[sentScreen,setSentScreen]=useState(false),[sentName,setSentName]=useState('');
 const [reportOpen,setReportOpen]=useState(false),[breakOpen,setBreakOpen]=useState(false),[breakReason,setBreakReason]=useState('meal'),[breakNotes,setBreakNotes]=useState(''),[breakBusy,setBreakBusy]=useState(false),[breakError,setBreakError]=useState(''),[breakExpenseHint,setBreakExpenseHint]=useState(false);
 const [breakRequest,setBreakRequest]=useState<{id:string;status:string;reason_label:string;note:string|null;created_at:string;expense_hint:boolean}|null>(null);
 const [recentBreaks,setRecentBreaks]=useState<{id:string;reason_label:string;created_at:string}[]>([]);
 const breakRequestIdRef=useRef<string|null>(null);
 const [questionIndex,setQuestionIndex]=useState(0),[answers,setAnswers]=useState<Answers>(blankAnswers),[notes,setNotes]=useState('');
 const [arrivalPhase,setArrivalPhase]=useState<ArrivalPhase>(null);
 const [leg,setLeg]=useState<ActiveLeg|null>(null),[legBusy,setLegBusy]=useState(false),[legError,setLegError]=useState('');
 const [rerouteToken,setRerouteToken]=useState(0);
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
   const d=await apiResponse<RouteData & {error?:string;completed?:boolean}>(r);
   if(r.status===410&&d.completed===true){
    if(alive)router.replace('/agente?finalizada=1');
    return;
   }
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
 },[id,retryCount,router]);
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
 // Destino é sempre a PRÓXIMA empresa, nunca o ponto GPS do motorista.
 const destination=current?.lat!=null&&current.lon!=null&&
  Number.isFinite(current.lat)&&Math.abs(current.lat)<=90&&Number.isFinite(current.lon)&&Math.abs(current.lon)<=180
  ?current.lat+','+current.lon:null;
 const address=[current?.street,current?.street_number,current?.city,current?.state].filter(Boolean).join(', ');
 const wazeLink=current?(destination
  ?'https://waze.com/ul?ll='+encodeURIComponent(destination)+'&navigate=yes&utm_source=sindpetshop-sp'
  :address.length>8?'https://waze.com/ul?q='+encodeURIComponent(address)+'&navigate=yes&utm_source=sindpetshop-sp':null):null;
 // A leitura do GPS pode indicar movimento; nunca incentivamos interação nesse estado.
 const driving=!!position&&position.speed!=null&&position.speed>1.8&&position.accuracy<=100&&
  signalTick>0&&signalTick-(position.timestamp||0)<20000;
 const nextQuestion=shownQuestions[Math.min(questionIndex,shownQuestions.length-1)];
 const finalQuestion=questionIndex>=shownQuestions.length-1;
 const gpsStale=started&&!!position&&signalTick>0&&signalTick-lastGpsAt>90000;
 const gpsNeedsRecovery=started&&(gpsIssue||gpsStale);
 const gpsLowAccuracy=started&&(!position||position.accuracy>500||gpsNeedsRecovery);
 const gpsAccuracyText=position&&Number.isFinite(position.accuracy)?'Precisão estimada: ±'+Math.round(position.accuracy).toLocaleString('pt-BR')+' m':'';
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
 // Estima a distância restante na geometria já calculada, sem novas chamadas.
 const routeDistanceFromIndex=useMemo(()=>{
  const points=leg?.geometry.coordinates;
  if(!points?.length)return null;
  const remain=new Array<number>(points.length).fill(0);
  for(let i=points.length-2;i>=0;i--){
   const [lon1,lat1]=points[i],[lon2,lat2]=points[i+1];
   const dLat=(lat2-lat1)*111195;
   const dLon=(lon2-lon1)*111195*Math.cos((lat1+lat2)*Math.PI/360);
   remain[i]=remain[i+1]+Math.hypot(dLat,dLon);
  }
  return remain;
 },[leg]);
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
  const remainingRoadM=routeDistanceFromIndex&&offset<=120&&position.accuracy<=150
   ?Math.max(0,routeDistanceFromIndex[nearest]+offset):null;
  return {offRoute:offset>200,step:next,remainingRoadM,
   distanceToTurn:next?straightDistance(position,{lat:next.at[1],lon:next.at[0]}):null};
 },[leg,position,routeDistanceFromIndex]);
 const nextTurn=navigationStatus?.step;
 const turnIcon=nextTurn?.type===0||nextTurn?.type===2||nextTurn?.type===4||nextTurn?.type===12?
  <CornerUpLeft size={26}/>:nextTurn?.type===1||nextTurn?.type===3||nextTurn?.type===5||nextTurn?.type===13?
  <CornerUpRight size={26}/>:nextTurn?.type===9?<RotateCcw size={26}/>:<MoveUp size={26}/>;
 async function calculate():Promise<boolean>{
  if(!data)return false;
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
   return true;
  }catch(e){setError(e instanceof Error?e.message:'Falha no cálculo.');return false;}
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
  setArrivalDialog(false);setBusy(true);setArrivalPhase('locating');setError('');setNotice('');
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
  if(!current?.visit_id||shownQuestions.some(q=>!answers[q.key]))return;
  const stopId=current.id,visitId=current.visit_id;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await send<{ok?:boolean;route_completed?:boolean;already_registered?:boolean}>('/api/campo/visita',{action:'finish',stop_id:stopId,visit_id:visitId,...answers,regularity_note:answers.regularity_note||'not_evaluated',notes});
   // Resposta confirmada: avança diretamente, sem esperar outra consulta de toda a rota.
   setData(previous=>previous?{...previous,stops:previous.stops.map(stop=>
    stop.id===stopId?{...stop,checkout_at:new Date().toISOString(),review_status:'pending'}:stop
   )}:previous);
   setQuestionIndex(0);setAnswers(blankAnswers());setNotes('');
   setSentName(current.trade_name||current.legal_name);setSentScreen(true);
   setFollow(true);setRecenterToken(n=>n+1);
   if(result.route_completed===true){
    // A própria API encerra o GPS na mesma transação que conclui a última visita.
    setStarted(false);positionRef.current=null;setPosition(null);
    setNotice('Jornada concluída. A central confirmou o fim da rota e encerrou o GPS.');
   }else {setNotice('Visita enviada. A central fará a análise; você já pode seguir para a próxima empresa.');setLeg(null);setLegError('');setRerouteToken(n=>n+1);}
  }catch(e){setError(e instanceof Error?e.message:'Falha ao enviar visita. Suas respostas continuam na tela.')}
  finally{setBusy(false)}
 }
 const answer=(key:AnswerKey,value:string)=>setAnswers(old=>({...old,[key]:value}));
 async function startJourney(){
  if(busy)return;
  if(!plan){const planned=await calculate();if(!planned)return;}
  await begin();
 }
 async function openBreak(){
  if(driving){setError('Pare o veículo em local seguro antes de registrar uma parada.');return;}
  setBreakOpen(true);setBreakError('');setBreakRequest(null);setRecentBreaks([]);
  setBreakExpenseHint(false);breakRequestIdRef.current=null;
  // O histórico é acessório: falha na consulta não impede o novo registro.
  try{
   const r=await fetch('/api/campo/parada?route_id='+encodeURIComponent(id),{cache:'no-store'});
   const d=await apiResponse<{error?:string;items?:{id:string;reason_label:string;created_at:string}[]}>(r);
   if(r.ok)setRecentBreaks((d.items||[]).slice(0,3));
  }catch{}
 }
 async function registerBreak(){
  if(breakBusy||!started||driving)return;
  setBreakBusy(true);setBreakError('');
  try{
   if(!breakRequestIdRef.current)breakRequestIdRef.current=crypto.randomUUID();
   const p=positionRef.current;
   const fresh=p?.timestamp&&Date.now()-p.timestamp<30000?p:null;
   const r=await send<{error?:string;id:string;status:string;created_at:string;already_registered?:boolean}>('/api/campo/parada',
    {route_id:id,client_request_id:breakRequestIdRef.current,reason:breakReason,
     note:breakNotes,expense_hint:breakExpenseHint,
     ...(fresh?{lat:fresh.lat,lon:fresh.lon,accuracy:fresh.accuracy,gps_timestamp:fresh.timestamp}:{})});
   setBreakRequest({id:r.id,status:'recorded',created_at:r.created_at,expense_hint:breakExpenseHint,
    reason_label:breakReason==='meal'?'Alimentação':breakReason==='fuel'?'Abastecimento':
     breakReason==='restroom'?'Necessidade pessoal':'Outra necessidade',note:breakNotes});
   breakRequestIdRef.current=null;setBreakNotes('');
  }catch(e){setBreakError(e instanceof Error?e.message:'Falha ao registrar parada. Tente novamente.')}
  finally{setBreakBusy(false)}
 }

 return <Portal title="Minha jornada" subtitle="Percurso de trabalho" immersive>
  <main className={'crew-root crew-journey crew-motion-ui'+(driving?' crew-is-moving':'')+((stage==='photo'||stage==='questions')?' crew-form-screen':'')}
    aria-label="Jornada do agente em campo">
   <div className="crew-route-map">
    {plan?<FieldNavigationMap plan={plan} targetId={current?.id} current={position}
      follow={follow} immersive completedIds={ordered.filter(s=>!!s.checkout_at).map(s=>s.id)}
      recenterToken={recenterToken} activeLeg={leg} onManualPan={()=>setFollow(false)}/>:
      <div className="crew-map-placeholder" aria-hidden="true"><RouteIcon size={68}/></div>}
   </div>
   <div className="crew-map-wash" aria-hidden="true"/>
   {stage!=='travel'&&<Link className="crew-session-button" href="/agente" aria-label="Voltar para minhas rotas" title="Minhas rotas"><ArrowLeft size={20}/></Link>}
   <div className="crew-top-badge">
    {stage==='photo'?'CHEGADA REGISTRADA':stage==='questions'?'VISITA EM ANDAMENTO':
      sentScreen?'VISITA ENVIADA':complete+' / '+ordered.length+' concluídas'}
   </div>
   {stage==='travel'&&!sentScreen&&<div className="crew-instructions" aria-live="off">
    <span className="crew-turn-arrow">{turnIcon}</span>
    <div key={nextTurn?.instruction||'waiting'} className="crew-turn-details"><strong>{legBusy?'CALCULANDO CAMINHO...':navigationStatus?.offRoute?'CONFIRA SEU TRAJETO':nextTurn?.instruction||'SIGA ATÉ A EMPRESA'}</strong>
     <small>{navigationStatus?.offRoute?'Pare em local seguro para conferir o caminho.':
      navigationStatus?.distanceToTurn!=null?'Em '+fmtDistance(navigationStatus.distanceToTurn)+', siga a orientação.':
      [current?.street,current?.street_number,current?.city].filter(Boolean).join(', ')||'Acompanhe o mapa até a empresa.'}</small></div>
   </div>}
   {(stage==='prepare'||stage==='ready'||stage==='travel'||stage==='done'||stage==='loading'||sentScreen)&&
    <div className="crew-main-layer">
     {stage==='loading'&&!sentScreen&&<div className="crew-center-message">
      <strong>{error?'NÃO FOI POSSÍVEL ABRIR SUA ROTA':'CARREGANDO SEU PERCURSO...'}</strong>
      <p>{error||'Consultando as empresas e endereços atribuídos.'}</p>
      {error&&<button className="crew-subtle" onClick={()=>setRetryCount(v=>v+1)}>Tentar novamente</button>}
     </div>}
     {sentScreen&&<div className="crew-center-message crew-success-card" role="status">
      <span className="crew-success-emblem"><CheckCircle2 size={38}/></span><strong>VISITA ENVIADA!</strong>
      <p>{sentName} registrada. Você pode seguir; a análise será realizada pela supervisão.</p>
     </div>}
     {!sentScreen&&stage==='done'&&<div className="crew-center-message" role="status">
      <CheckCircle2 size={35}/><strong>TODAS AS VISITAS FORAM ENVIADAS.</strong>
      <p>As respostas seguem para conferência. Aguarde novas rotas da central.</p>
     </div>}
     {!sentScreen&&(stage==='prepare'||stage==='ready')&&<div className="crew-center-message crew-start-card">
      <RouteIcon size={32}/><strong>{remaining} {remaining===1?'EMPRESA DISPONÍVEL':'EMPRESAS NO PERCURSO'}</strong>
      <p>{data?.route.campaign_name||'Rota atribuída'} · Siga as orientações do mapa quando iniciar.</p><small className="crew-gps-consent">Ao iniciar, sua localização será compartilhada com a central durante a rota e encerrada ao concluir ou sair.</small>
     </div>}
     {stage==='travel'&&!sentScreen&&<CrewTravelPanel key={current?.id||id}
      stopId={current?.id||''} index={activeIndex} total={ordered.length} completed={complete}
      name={current?.trade_name||current?.legal_name||'Empresa'}
      distanceLabel={navigationStatus?.remainingRoadM!=null
       ?fmtDistance(navigationStatus.remainingRoadM):distance!==null?fmtDistance(distance):'—'}
      distanceKind={navigationStatus?.remainingRoadM!=null?'pela rota':'em linha reta'} wazeUrl={wazeLink}
      driving={driving} busy={busy} gpsUnavailable={gpsNeedsRecovery||gpsLowAccuracy}
      gpsMessage={gpsAccuracyText} navigationError={!!legError} error={error}
      onArrive={()=>setArrivalDialog(true)}
      onGpsFix={()=>void (gpsNeedsRecovery?begin(true):improveGps())}
      onReport={()=>setReportOpen(true)} onBreak={()=>void openBreak()}
      onBlockedWaze={()=>setError('Abra o Waze somente com o veículo parado.')}
     />}
     {(stage==='prepare'||stage==='ready'||stage==='done'||sentScreen)&&
      <footer className="crew-fixed-footer">
       {error&&<p className="crew-inline-error" role="alert">{error}</p>}
       {notice&&stage==='ready'&&<p className="crew-inline-info" role="status">{notice}</p>}
       {progress&&<p className="crew-inline-info" role="status">{progress}</p>}
       {sentScreen?(remaining>0?<button type="button" className="crew-primary"
          onClick={()=>{setSentScreen(false);setFollow(true);setRecenterToken(v=>v+1);setRerouteToken(v=>v+1)}}>
          PRÓXIMO PERCURSO <ArrowRight size={20}/></button>
         :<Link className="crew-primary" href="/agente?finalizada=1">VER PRÓXIMAS ROTAS <ArrowRight size={20}/></Link>):
        stage==='done'?<Link href="/agente?finalizada=1" className="crew-primary">VOLTAR À MINHA JORNADA <ArrowRight size={20}/></Link>:
        <button type="button" className="crew-primary" disabled={busy}
         onClick={()=>void startJourney()}>
         {busy?'PREPARANDO PERCURSO...':'INICIAR PERCURSO'} <Navigation size={22}/>
        </button>}
      </footer>}
    </div>}
   {(stage==='photo'||stage==='questions')&&!sentScreen&&<section key={'form-'+stage+'-'+current?.id} className="crew-form-panel crew-animated-form" aria-label="Informações da visita">
    <div className="crew-form-inner" key={stage==='questions'?'question-'+questionIndex:'photo'}>
     {stage==='photo'&&<>
      <div className="crew-photo-preview"><Camera size={65}/><strong>FOTO DA FACHADA</strong>
       <p>Mostre o local e a identificação da empresa, quando visível.</p></div>
      <div className="crew-company-card"><strong>{current?.trade_name||current?.legal_name}</strong>
       <span>A fachada está visível?</span>
       <small>{[current?.street,current?.street_number,current?.city].filter(Boolean).join(', ')}</small>
      </div>
      <p className="crew-photo-note">Mesmo que a empresa não seja localizada, fotografe o endereço visitado. Evite pessoas e documentos na imagem.</p>
      {error&&<p className="crew-inline-error" role="alert">{error}</p>}
      {notice&&<p className="crew-inline-info">{notice}</p>}
     </>}
     {stage==='questions'&&<>
      <div className="crew-question-progress"><span>PERGUNTA {questionIndex+1} DE {shownQuestions.length}</span><span><CheckCircle2 size={16}/> FOTO RECEBIDA</span></div>
      <div className="crew-question-meter" role="progressbar" aria-valuemin={0}
       aria-valuemax={shownQuestions.length} aria-valuenow={questionIndex+1} aria-label="Progresso das perguntas">
       <span style={{width:((questionIndex+1)/shownQuestions.length*100)+'%'}}/>
      </div>
      {current?.review_status==='needs_more'&&current.review_notes&&
       <p className="crew-inline-error">A central solicitou revisão: {current.review_notes}</p>}
      <QuestionView question={nextQuestion} value={answers[nextQuestion.key]} onChange={v=>answer(nextQuestion.key,v)}/>
      <label className="crew-observation-label" htmlFor="crew-notes">OBSERVAÇÕES</label>
      <textarea id="crew-notes" rows={3} maxLength={2000} value={notes}
       onChange={e=>setNotes(e.target.value)} placeholder="O que a central precisa saber sobre a visita?"/>
      {finalQuestion&&<div className="crew-last-check">
       <label htmlFor="crew-conditions">Condições observadas (opcional)</label>
       <select id="crew-conditions" value={answers.regularity_note||'not_evaluated'}
        onChange={e=>answer('regularity_note',e.target.value)}>
        <option value="not_evaluated">Não foi possível avaliar</option>
        <option value="none_observed">Nada preocupante observado</option>
        <option value="attention">Há situação que exige atenção</option>
       </select>
      </div>}
      {error&&<p className="crew-inline-error" role="alert">{error}</p>}
      {notice&&<p className="crew-inline-info">{notice}</p>}
     </>}
    </div>
    <footer className="crew-form-footer">
     {stage==='photo'?<label className={'crew-primary crew-file-action'+(photoBusy?' crew-disabled':'')}>
       <Camera size={21}/>{photoBusy?'ENVIANDO FOTO...':'ENVIAR FOTO'}
       <input type="file" accept="image/*" capture="environment" disabled={photoBusy}
        onChange={e=>{const file=e.target.files?.[0];e.target.value='';void uploadPhoto(file)}}/>
      </label>:
      <div className="crew-form-navigation">
       <button type="button" className="crew-back" disabled={busy||questionIndex===0}
        onClick={()=>setQuestionIndex(i=>Math.max(0,i-1))}><ArrowLeft size={18}/> VOLTAR</button>
       {finalQuestion?<button type="button" className="crew-primary" disabled={busy||shownQuestions.some(q=>!answers[q.key])}
        onClick={()=>void finish()}>
        {busy?'ENVIANDO...':'ENVIAR VISITA'} <ArrowRight size={18}/></button>:
        <button type="button" className="crew-primary" disabled={!answers[nextQuestion.key]}
         onClick={()=>setQuestionIndex(i=>i+1)}>CONTINUAR <ArrowRight size={18}/></button>}
      </div>}
    </footer>
   </section>}
   {arrivalPhase&&<div className="crew-dialog-backdrop crew-animated-backdrop" role="status" aria-live="polite">
    <div className="crew-dialog"><LocateFixed size={34}/><strong>{arrivalPhase==='locating'?'VERIFICANDO LOCALIZAÇÃO...':'REGISTRANDO CHEGADA...'}</strong>
     <p>Aguarde a confirmação da central; não feche a tela.</p></div>
   </div>}
   {arrivalDialog&&<div className="crew-dialog-backdrop crew-animated-backdrop">
    <section className="crew-dialog" role="dialog" aria-modal="true" aria-labelledby="crew-arrive-title">
     <button type="button" className="crew-dialog-x" onClick={()=>setArrivalDialog(false)} aria-label="Fechar"><X size={22}/></button>
     <MapPin size={32} color="#fe7900"/>
     <h2 id="crew-arrive-title">Você chegou à empresa?</h2>
     <p>Confirme apenas em frente ao estabelecimento e com o veículo parado. A localização e o horário serão registrados.</p>
     {distance!==null&&distance>500&&<p className="crew-inline-error">O GPS indica {fmtDistance(distance)} em linha reta até a coordenada cadastrada. Confirme o endereço antes de continuar.</p>}
     <button type="button" className="crew-primary" disabled={busy} onClick={()=>void arrive()}>SIM, CHEGUEI <CheckCircle2 size={19}/></button>
     <button type="button" className="crew-subtle" onClick={()=>setArrivalDialog(false)}>VOLTAR AO MAPA</button>
    </section>
   </div>}
   {reportOpen&&<div className="crew-dialog-backdrop crew-animated-backdrop">
    <section className="crew-dialog crew-report" role="dialog" aria-modal="true" aria-labelledby="crew-report-title">
     <button type="button" className="crew-dialog-x" onClick={()=>setReportOpen(false)} aria-label="Fechar"><X size={22}/></button>
     <span className="crew-eyebrow">RELATÓRIO PESSOAL</span><h2 id="crew-report-title">Minhas visitas</h2>
     <div className="crew-report-count"><strong>{complete}</strong><span>de {ordered.length} paradas realizadas</span></div>
     <ol>{ordered.filter(s=>!!s.checkout_at).map(s=><li key={s.id}><CheckCircle2 size={17}/>{s.trade_name||s.legal_name}</li>)}</ol>
     <p>As visitas enviadas ainda podem estar aguardando análise da central.</p>
     <button type="button" className="crew-primary" onClick={()=>setReportOpen(false)}>VOLTAR AO PERCURSO</button>
    </section>
   </div>}
   {breakOpen&&<div className="crew-dialog-backdrop crew-animated-backdrop">
    <section className="crew-dialog crew-break-modal" role="dialog" aria-modal="true" aria-labelledby="crew-break-title">
     <button type="button" className="crew-dialog-x" onClick={()=>setBreakOpen(false)} aria-label="Fechar"><X size={22}/></button>
     <span className="crew-eyebrow">REGISTRO DA EQUIPE</span>
     <h2 id="crew-break-title">{breakRequest?'Parada registrada!':'Registrar parada'}</h2>
     {breakRequest?<div className="crew-break-status" role="status">
       <CheckCircle2 size={36} aria-hidden="true"/>
       <strong>{breakRequest.reason_label}</strong>
       <p>Registrada em {new Date(breakRequest.created_at).toLocaleString('pt-BR')}.
        O percurso permanece ativo. Nenhuma aprovação é necessária.</p>
       {breakRequest.expense_hint&&<>
        <p>Guarde a nota fiscal. O reembolso precisa de um lançamento próprio e da conferência do RH.</p>
        <Link className="crew-expense-link" href={'/reembolsos?rota='+encodeURIComponent(id)+'&categoria='+(breakReason==='meal'?'food':breakReason==='fuel'?'fuel':'other')}>
         Registrar gasto para reembolso <ExternalLink size={16}/>
        </Link>
       </>}
      </div>:<>
      <p className="crew-break-intro">Pare em local seguro e registre sua pausa. Você não precisa de autorização no aplicativo.</p>
      <div className="crew-break-choices">
       {([['meal','Alimentação'],['restroom','Necessidade pessoal'],['fuel','Abastecimento'],['other','Outro motivo']] as const).map(([value,label])=>
        <label key={value} className={breakReason===value?'chosen':''}>
         <input type="radio" name="crew-break" checked={breakReason===value} onChange={()=>setBreakReason(value)}/>{label}
        </label>)}
      </div>
      <label className="crew-observation-label" htmlFor="crew-break-note">Observações (opcional)</label>
      <textarea id="crew-break-note" maxLength={500} rows={3} value={breakNotes}
        onChange={e=>setBreakNotes(e.target.value)} placeholder="Algo importante sobre a parada?"/>
      <label className="crew-break-expense">
       <input type="checkbox" checked={breakExpenseHint} onChange={e=>setBreakExpenseHint(e.target.checked)}/>
       <span>Houve gasto que poderá precisar de reembolso</span>
      </label>
      <p className="crew-break-caption">Hora registrada pelo servidor. O GPS é anexado quando disponível; sem sinal, a parada ainda pode ser registrada.</p>
      <button type="button" className="crew-primary" disabled={breakBusy||driving||(breakReason==='other'&&breakNotes.trim().length<5)}
       onClick={()=>void registerBreak()}>{breakBusy?'REGISTRANDO...':'REGISTRAR PARADA'} <CheckCircle2 size={19}/></button>
     </>}
     {breakError&&<p className="crew-inline-error" role="alert">{breakError}</p>}
     {breakRequest&&<button type="button" className="crew-primary" onClick={()=>setBreakOpen(false)}>
       VOLTAR AO PERCURSO <ArrowRight size={19}/></button>}
     {breakRequest&&<button type="button" className="crew-subtle" onClick={()=>{
       setBreakRequest(null);setBreakExpenseHint(false);setBreakReason('meal');setBreakNotes('');
      }}>REGISTRAR OUTRA PARADA</button>}
     {!breakRequest&&recentBreaks.length>0&&<div className="crew-break-history">
      <strong>Últimos registros nesta rota</strong>
      {recentBreaks.map(record=><span key={record.id}>{record.reason_label} · {new Date(record.created_at).toLocaleString('pt-BR')}</span>)}
     </div>}
     {!breakRequest&&<button type="button" className="crew-subtle" onClick={()=>setBreakOpen(false)}>VOLTAR AO MAPA</button>}
    </section>
   </div>}
  </main>
 </Portal>;
}
