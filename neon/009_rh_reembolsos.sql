-- MODO ROTEIRIZADOR — 009: RH e trilha auditável de reembolsos.
-- APLICAR DEPOIS de neon/008_perfil_cadastro.sql, inicialmente APENAS no Neon Preview.
-- Requer backup, revisão do RH/Contabilidade e aprovação explícita antes de produção.
-- Não altera valores de despesas anteriores nem marca pagamentos existentes como quitados.
BEGIN;
ALTER TABLE public.app_profiles DROP CONSTRAINT IF EXISTS app_profiles_role_check;
ALTER TABLE public.app_profiles ADD CONSTRAINT app_profiles_role_check
 CHECK(role IN ('admin','supervisor','agent','cadastro','rh'));
ALTER TABLE public.access_requests DROP CONSTRAINT IF EXISTS access_requests_assigned_role_check;
ALTER TABLE public.access_requests ADD CONSTRAINT access_requests_assigned_role_check
 CHECK(assigned_role IN ('admin','supervisor','agent','cadastro','rh'));
ALTER TABLE public.access_invitations DROP CONSTRAINT IF EXISTS access_invitations_role_check;
ALTER TABLE public.access_invitations ADD CONSTRAINT access_invitations_role_check
 CHECK(role IN ('admin','supervisor','agent','cadastro','rh'));

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_approval_status_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_approval_status_check
 CHECK(approval_status IN ('draft','submitted','receipt_received','accounting_review','approved','returned','rejected','paid'));

ALTER TABLE public.expenses
 ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES public.routes(id),
 ADD COLUMN IF NOT EXISTS client_request_id uuid,
 ADD COLUMN IF NOT EXISTS description text,
 ADD COLUMN IF NOT EXISTS invoice_reference text,
 ADD COLUMN IF NOT EXISTS invoice_recipient_cnpj varchar(14),
 ADD COLUMN IF NOT EXISTS invoice_issuer_cnpj varchar(14),
 ADD COLUMN IF NOT EXISTS invoice_access_key varchar(44),
 ADD COLUMN IF NOT EXISTS receipt_received_at timestamptz,
 ADD COLUMN IF NOT EXISTS receipt_received_by text REFERENCES public.app_profiles(auth_user_id),
 ADD COLUMN IF NOT EXISTS physical_archive_reference text,
 ADD COLUMN IF NOT EXISTS accounting_contact text,
 ADD COLUMN IF NOT EXISTS accounting_reference text,
 ADD COLUMN IF NOT EXISTS accounting_reviewed_at timestamptz,
 ADD COLUMN IF NOT EXISTS accounting_recorded_by text REFERENCES public.app_profiles(auth_user_id),
 ADD COLUMN IF NOT EXISTS approved_amount numeric(12,2),
 ADD COLUMN IF NOT EXISTS payment_reference text,
 ADD COLUMN IF NOT EXISTS payment_method text,
 ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2),
 ADD COLUMN IF NOT EXISTS paid_at timestamptz,
 ADD COLUMN IF NOT EXISTS payment_date date,
 ADD COLUMN IF NOT EXISTS paid_by text REFERENCES public.app_profiles(auth_user_id),
 ADD COLUMN IF NOT EXISTS receipt_acknowledged_at timestamptz,
 ADD COLUMN IF NOT EXISTS receipt_disputed_at timestamptz,
 ADD COLUMN IF NOT EXISTS receipt_dispute_reason text,
 ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamptz,
 ADD COLUMN IF NOT EXISTS dispute_resolution_reference text,
 ADD COLUMN IF NOT EXISTS dispute_resolved_by text REFERENCES public.app_profiles(auth_user_id),
 ADD COLUMN IF NOT EXISTS last_review_note text;

ALTER TABLE public.expenses ADD CONSTRAINT expenses_payment_amount_positive
 CHECK(paid_amount IS NULL OR paid_amount>0);
-- Quando houver chave da nota, uma mesma nota não pode sustentar dois reembolsos em andamento.
CREATE UNIQUE INDEX IF NOT EXISTS ix_expenses_invoice_access_key ON public.expenses(invoice_access_key)
 WHERE invoice_access_key IS NOT NULL AND approval_status NOT IN ('returned','rejected');
-- Uma solicitação reenviada devido à oscilação da rede não pode criar outra despesa.
CREATE UNIQUE INDEX IF NOT EXISTS ix_expenses_client_request ON public.expenses(client_request_id)
 WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_expenses_route_id ON public.expenses(route_id);
CREATE INDEX IF NOT EXISTS ix_expenses_workflow ON public.expenses(approval_status,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_expenses_agent_created ON public.expenses(agent_id,created_at DESC);

-- Registro append-only de todos os atos relevantes. Não inclui comprovantes bancários ou dados bancários completos.
CREATE TABLE IF NOT EXISTS public.expense_events(
 id bigserial PRIMARY KEY,
 expense_id uuid NOT NULL REFERENCES public.expenses(id),
 actor_id text NOT NULL REFERENCES public.app_profiles(auth_user_id),
 action text NOT NULL,
 before_status text,
 after_status text NOT NULL,
 note text,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_expense_events_history ON public.expense_events(expense_id,created_at,id);
COMMIT;

-- Confirmar as restrições após migrar:
-- select conrelid::regclass,conname,pg_get_constraintdef(oid)
-- from pg_constraint where conrelid in
-- ('app_profiles'::regclass,'access_requests'::regclass,'access_invitations'::regclass,
-- 'expenses'::regclass);
-- NÃO aplicar um backfill que marque "paid" como recebido pelo colaborador.
