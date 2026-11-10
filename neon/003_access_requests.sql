-- SindPetshop-SP: cadastro mediante aprovação administrativa.
-- Execute depois de neon/001_init.sql na branch principal do banco.
CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id text NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  assigned_role text CHECK (assigned_role IN ('admin','supervisor','agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text REFERENCES app_profiles(auth_user_id),
  CONSTRAINT access_requests_email_normalized CHECK (email = lower(email))
);
CREATE INDEX IF NOT EXISTS ix_access_requests_status_created ON access_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_access_requests_email ON access_requests(email);
-- A tabela é acessada exclusivamente pelo servidor via DATABASE_URL.
-- NÃO crie perfis automaticamente por trigger em neon_auth."user".
-- Mantenha o primeiro administrador já existente em app_profiles.
