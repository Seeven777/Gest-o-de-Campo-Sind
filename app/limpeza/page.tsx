'use client';
import {useCallback,useEffect,useState} from 'react';
import {Portal} from '@/components/portal';
import {AlertTriangle,Trash2,Search,ShieldAlert} from 'lucide-react';
type Kind='route'|'visit'|'expense'|'campaign'|'company';
type Item={id:string;label:string;linked:number;visits:number};
const groups:{id:Kind;name:string;description:string}[]=[
 {id:'route',name:'Rotas de teste',description:'Apaga a rota e seus registros de visita e evidências vinculados. Empresas são preservadas.'},
 {id:'visit',name:'Visitas de teste',description:'Remove uma visita e suas evidências. Não altera a existência da empresa.'},
 {id:'expense',name:'Despesas de teste',description:'Somente despesas não pagas vinculadas a campanhas de teste.'},
 {id:'campaign',name:'Campanhas de teste',description:'Somente campanhas sem rotas ou despesas vinculadas.'},
 {id:'company',name:'Empresas',description:'Somente empresas sem rotas e sem cadastro sindical confirmado.'},
];
export default function Limpeza(){
 const [kind,setKind]=useState<Kind>('route'),[q,setQ]=useState(''),[term,setTerm]=useState(''),[items,setItems]=useState<Item[]>([]),[selected,setSelected]=useState<Item|null>(null),[confirmation,setConfirmation]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
   setBusy(true);setError('');
   try{const r=await fetch('/api/admin/limpeza?'+new URLSearchParams({kind,q:term}),{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'Erro na busca');setItems(d.items||[])}
   catch(e){setItems([]);setError(e instanceof Error?e.message:'Erro ao consultar registros')}
   finally{setBusy(false)}
 },[kind,term]);
 useEffect(()=>{void load()},[load]);
 async function remove(){
  if(!selected||confirmation!=='EXCLUIR '+selected.label)return;
  setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/admin/limpeza',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id:selected.id,confirmation})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Exclusão não permitida');
   setMessage('Registro excluído. Operação registrada no histórico de auditoria.');
   setSelected(null);setConfirmation('');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Erro ao excluir')}
  finally{setBusy(false)}
 }
 return <Portal title="Limpeza de testes" subtitle="Exclusão individual e auditada, reservada à administração.">
 <section className="panel" style={{marginBottom:18}}>
 <div className="panel-title"><div><small>ATENÇÃO · OPERAÇÃO IRREVERSÍVEL</small><h2>Excluir registros de teste com segurança</h2></div><ShieldAlert size={22} color="#b54b24"/></div>
 <p style={{lineHeight:1.65}}>Esta página <strong>não executa limpeza automática</strong>. Selecione um registro e confirme seu nome completo. Antes de remover dados reais ou importações grandes, realize um backup do Neon. Não existe opção de apagar todos os registros de uma vez.</p>
 <p className="muted">Rotas, visitas e despesas somente podem ser eliminadas se estiverem vinculadas a campanhas com a palavra <strong>teste</strong> no nome. Empresas com cadastro sindical confirmado não podem ser excluídas.</p>
 </section>
 <section className="panel">
 <div className="panel-title"><div><small>SELEÇÃO CONTROLADA</small><h2>Encontrar registro</h2></div><Search size={20}/></div>
 <div className="form-grid"><label>Tipo<select className="field" value={kind} onChange={e=>{setKind(e.target.value as Kind);setSelected(null);setQ('');setTerm('')}}>{groups.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 <form onSubmit={e=>{e.preventDefault();setSelected(null);setTerm(q)}}><label>Nome, CNPJ ou identificação<input className="field" style={{width:'100%'}} placeholder="Pesquisar registro" value={q} onChange={e=>setQ(e.target.value)}/></label><button className="button secondary" style={{marginTop:10}} disabled={busy}>Buscar</button></form></div>
 <p className="muted" style={{marginTop:10}}>{groups.find(x=>x.id===kind)?.description}</p>
 {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}
 <div style={{display:'grid',gap:9,marginTop:20}}>{items.map(item=><div key={item.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,border:'1px solid var(--line)',padding:13,borderRadius:10,flexWrap:'wrap'}}>
 <div><strong>{item.label}</strong><p className="muted" style={{fontSize:11,margin:'5px 0 0'}}>{item.linked} vínculo(s) · {item.visits} registro(s) relacionados</p></div>
 <button className="button secondary" type="button" onClick={()=>{setSelected(item);setConfirmation('');setMessage('')}}><Trash2 size={14}/> Analisar exclusão</button></div>)}
 {!items.length&&!busy&&<div className="empty">Nenhum registro elegível encontrado.</div>}</div>
 </section>
 {selected&&<section className="panel" style={{marginTop:18,border:'1px solid #e2a28b'}}>
 <div className="panel-title"><div><small>CONFIRMAÇÃO ADMINISTRATIVA</small><h2>Excluir {selected.label}?</h2></div><AlertTriangle size={22} color="#c24928"/></div>
 <p>Esta operação não poderá ser desfeita pela plataforma. Digite exatamente a frase abaixo para confirmar:</p>
 <div style={{padding:12,borderRadius:8,background:'#fff2e9',margin:'12px 0',overflowWrap:'anywhere'}}><strong>{'EXCLUIR '+selected.label}</strong></div>
 <input className="field" style={{width:'100%'}} autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} aria-label="Digite a confirmação da exclusão"/>
 <div style={{display:'flex',gap:10,marginTop:15}}><button className="button secondary" onClick={()=>{setSelected(null);setConfirmation('')}} disabled={busy}>Cancelar</button><button className="button" style={{background:'#b54026'}} disabled={busy||confirmation!=='EXCLUIR '+selected.label} onClick={()=>void remove()}><Trash2 size={15}/> Excluir registro definitivamente</button></div>
 </section>}
 </Portal>
}
