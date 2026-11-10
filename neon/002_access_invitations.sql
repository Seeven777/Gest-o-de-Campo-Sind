-- Executar uma vez no Neon SQL Editor, na MESMA branch do app.
-- Convites são emitidos exclusivamente por administradores autenticados.
CREATE TABLE IF NOT EXISTS access_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','supervisor','agent')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by text NOT NULL REFERENCES app_profiles(auth_user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by text,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_invites_email ON access_invitations (lower(email));
CREATE INDEX IF NOT EXISTS ix_invites_pending ON access_invitations (expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;
-- Uma pessoa só precisa de um convite pendente ativo por e-mail. Registros revogados/aceitos continuam no histórico.
