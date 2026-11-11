-- MODO ROTEIRIZADOR — 008: perfil restrito para confirmação de cadastro sindical.
-- Necessário tanto na Neon Preview (homologação) quanto em produção (após aprovação).
-- Execute em uma transação APENAS depois do backup/verificação de constraints.
-- Não cria contas, não promove usuários e não modifica registros de empresas.
BEGIN;
ALTER TABLE public.app_profiles
 DROP CONSTRAINT IF EXISTS app_profiles_role_check;
ALTER TABLE public.app_profiles
 ADD CONSTRAINT app_profiles_role_check CHECK(role IN ('admin','supervisor','agent','cadastro'));
ALTER TABLE public.access_requests
 DROP CONSTRAINT IF EXISTS access_requests_assigned_role_check;
ALTER TABLE public.access_requests
 ADD CONSTRAINT access_requests_assigned_role_check CHECK(assigned_role IN ('admin','supervisor','agent','cadastro'));
ALTER TABLE public.access_invitations
 DROP CONSTRAINT IF EXISTS access_invitations_role_check;
ALTER TABLE public.access_invitations
 ADD CONSTRAINT access_invitations_role_check CHECK(role IN ('admin','supervisor','agent','cadastro'));
-- Marca separadamente a conferência no sistema OFICIAL do sindicato.
-- Cadastros marcados "confirmed" no processo anterior NÃO são validados
-- automaticamente; devem ser revisados pela equipe Cadastro.
ALTER TABLE public.registration_records
 ADD COLUMN IF NOT EXISTS official_verified_at timestamptz;
COMMIT;

-- Verifique após aplicar:
-- select conrelid::regclass,conname,pg_get_constraintdef(oid)
-- from pg_constraint where conname in
-- ('app_profiles_role_check','access_requests_assigned_role_check','access_invitations_role_check');
-- select role,count(*) from app_profiles group by role;
-- Não execute alteração de perfis existentes sem autorização administrativa.
