'use client';
import {useEffect,useState} from 'react';import {useParams} from 'next/navigation';import {Portal} from '@/components/portal';import Link from 'next/link';
type Stop={id:string;position_order:number;legal_name:string;trade_name:string;street:string;street_number:string;city:string;state:string;postal_code:string;cnpj:string};
export default function DetalheRota(){const {id}=useParams<{id:string}>();const [stops,setStops]=useState<Stop[]>([]),[title,setTitle]=useState(''),[error,setError]=useState('');
useEffect(()=>{fetch('/api/rotas/'+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setStops(d.stops);setTitle(d.route.campaign_name)}).catch(e=>setError(e.message))},[id]);
return <Portal title="Percurso de campo" subtitle={title||'Empresas atribuídas à rota'}>
{error&&<p className="error">{error}</p>}<section className="panel"><div className="panel-title"><div><small>SEQUÊNCIA DE VISITAS</small><h2>{stops.length} paradas</h2></div><Link href="/visitas" className="button">Registrar visita</Link></div>
<div className="roadmap-list">{stops.map(s=><div key={s.id}><span>{String(s.position_order).padStart(2,'0')}</span><p><strong>{s.trade_name||s.legal_name}</strong><br/><small>{s.street} {s.street_number}, {s.city} / {s.state} · CNPJ {s.cnpj}</small><br/><a className="link-inline" target="_blank" rel="noopener noreferrer" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([s.street,s.street_number,s.city,s.state,s.postal_code].filter(Boolean).join(', '))}>Abrir endereço no mapa</a></p></div>)}</div>
{!stops.length&&!error&&<div className="empty">Carregando paradas...</div>}</section></Portal>}
