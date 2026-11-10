-- SindPetshop-SP: novo perfil Marketing, sem modificar usuários existentes.
-- Execute uma vez no Neon SQL Editor antes de aprovar qualquer conta como marketing.
BEGIN;
ALTER TABLE app_profiles DROP CONSTRAINT IF EXISTS app_profiles_role_check;
ALTER TABLE app_profiles ADD CONSTRAINT app_profiles_role_check CHECK (role IN ('admin','supervisor','agent','marketing'));
ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_assigned_role_check;
ALTER TABLE access_requests ADD CONSTRAINT access_requests_assigned_role_check CHECK (assigned_role IN ('admin','supervisor','agent','marketing'));
COMMIT;
