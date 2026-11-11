import {db} from '@/lib/db';

/** Verificação somente de leitura: nunca aplica SQL ou modifica dados. */
export type SchemaReadiness={
 cadastro:boolean;
 rh:boolean;
 rolesCadastro:boolean;
 rolesRh:boolean;
};
export async function getSchemaReadiness():Promise<SchemaReadiness>{
 const [row]=await db().query(`select
  exists(select 1 from information_schema.columns
   where table_schema='public' and table_name='registration_records'
   and column_name='official_verified_at') as cadastro,
  (to_regclass('public.expense_events') is not null
   and (select count(*)::int from information_schema.columns
    where table_schema='public' and table_name='expenses'
     and column_name in (
       'route_id','client_request_id','invoice_access_key','receipt_received_at',
       'invoice_recipient_cnpj','invoice_issuer_cnpj','approved_amount',
       'paid_at','paid_amount','payment_reference','receipt_acknowledged_at',
       'receipt_disputed_at','dispute_resolved_at','physical_archive_reference'
     ))=14) as rh,
  coalesce((select position('cadastro' in pg_get_constraintdef(c.oid))>0
    from pg_constraint c where c.conrelid='public.app_profiles'::regclass
    and c.conname='app_profiles_role_check'),false) as roles_cadastro,
  coalesce((select position('rh' in pg_get_constraintdef(c.oid))>0
    from pg_constraint c where c.conrelid='public.app_profiles'::regclass
    and c.conname='app_profiles_role_check'),false) as roles_rh`);
 return {cadastro:row?.cadastro===true,rh:row?.rh===true,
  rolesCadastro:row?.roles_cadastro===true,rolesRh:row?.roles_rh===true};
}
export async function isSchemaReady(feature:'cadastro'|'rh'){
 const ready=await getSchemaReadiness();
 return feature==='cadastro'?ready.cadastro&&ready.rolesCadastro:
  ready.cadastro&&ready.rh&&ready.rolesRh;
}
export const schemaPendingMessage=(feature:'cadastro'|'rh')=>feature==='cadastro'
 ?'Cadastro sindical temporariamente indisponível: migração 008 do Neon ainda não foi concluída.'
 :'Reembolsos temporariamente indisponíveis: migrações 008 e 009 do Neon precisam ser homologadas.';
