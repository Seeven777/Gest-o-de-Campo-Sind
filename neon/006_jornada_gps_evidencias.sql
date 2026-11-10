-- Operação assistida: localização ao vivo consentida e evidências temporárias.
-- EXECUTAR no Neon SQL Editor após backup, preferencialmente em branch de teste.
-- Não altera os 1.848 estabelecimentos nem exclui registros existentes.
create table if not exists agent_live_presence (
 agent_id text primary key references app_profiles(auth_user_id),
 route_id uuid references routes(id),
 active boolean not null default false,
 consent_at timestamptz,
 started_at timestamptz,
 stopped_at timestamptz,
 last_seen_at timestamptz,
 last_position geography(Point,4326),
 accuracy_m numeric(8,2),
 updated_at timestamptz not null default now()
);
create index if not exists ix_agent_live_presence_active on agent_live_presence(last_seen_at desc) where active=true;
alter table visits add column if not exists operating_status text;
alter table visits add column if not exists signage_status text;
alter table visits add column if not exists regularity_note text;
alter table visits add column if not exists form_submitted_at timestamptz;
alter table visit_evidence add column if not exists expires_at timestamptz not null default (now() + interval '14 days');
alter table visit_evidence add column if not exists deleted_at timestamptz;
create index if not exists ix_visit_evidence_cleanup on visit_evidence(expires_at) where deleted_at is null;
create index if not exists ix_visit_evidence_visit on visit_evidence(visit_id) where deleted_at is null;
-- Observações de campo não representam decisão formal de regularidade jurídica.
