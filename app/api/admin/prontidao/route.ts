import {NextResponse} from 'next/server';
import {currentIdentity} from '@/lib/access';
import {getSchemaReadiness} from '@/lib/schema-readiness';

export const dynamic='force-dynamic';
export async function GET(){
 const user=await currentIdentity();
 if(!user)return NextResponse.json({error:'Entre em sua conta.'},{status:401});
 if(user.role!=='admin')return NextResponse.json({error:'Diagnóstico reservado ao administrador.'},{status:403});
 try{
  const schema=await getSchemaReadiness();
  const ready=schema.cadastro&&schema.rh&&schema.rolesCadastro&&schema.rolesRh;
  return NextResponse.json({
   ready,
   environment:process.env.VERCEL_ENV==='production'?'production':process.env.VERCEL_ENV==='preview'?'preview':'development',
   checks:[
    {label:'Migração 008 — confirmação sindical',ready:schema.cadastro&&schema.rolesCadastro},
    {label:'Migração 009 — RH e reembolsos',ready:schema.rh&&schema.rolesRh},
   ],
   required_order:['008_perfil_cadastro.sql','009_rh_reembolsos.sql'],
   message:ready?'Estrutura do banco compatível. Ainda é necessário homologar os processos com usuários.':
    'Banco desatualizado para esta versão. Não publique até homologar as migrações.',
  },{headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({ready:false,error:'Não foi possível verificar a estrutura do Neon. Confirme a conexão antes da publicação.'},
   {status:503,headers:{'Cache-Control':'no-store'}});
 }
}
