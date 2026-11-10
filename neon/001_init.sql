-- SINDPETSHOP-SP | Banco inicial Neon PostgreSQL
-- Rodar no SQL Editor Neon uma única vez, na branch desejada.
-- Não inclui dados fictícios; a estrutura suporta campanhas e operações futuras.
create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists postgis;
create table if not exists app_profiles (
 auth_user_id text primary key,
 full_name text not null,
 role text not null check (role in ('admin','supervisor','agent')),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists municipalities (
 ibge_code char(7) primary key,
 name text not null,
 uf char(2) not null default 'SP',
 geom geometry(MultiPolygon,4326)
);
create table if not exists establishments (
 id uuid primary key default gen_random_uuid(),
 cnpj char(14) unique not null,
 legal_name text not null,
 trade_name text,
 street text,
 street_number text,
 district text,
 city text,
 state char(2),
 postal_code text,
 main_cnae text,
 municipality_ibge char(7) references municipalities(ibge_code),
 position geography(Point,4326),
 field_status text not null default 'pending' check(field_status in ('pending','validated','review','invalid')),
 source text not null default 'manual',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists ix_establishments_city on establishments(city);
create index if not exists ix_establishments_position on establishments using gist(position);
create table if not exists campaigns (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 start_date date not null,
 end_date date not null,
 budget numeric(12,2) not null default 0 check(budget>=0),
 status text not null default 'draft' check(status in ('draft','published','in_progress','closed','cancelled')),
 created_by text not null references app_profiles(auth_user_id),
 created_at timestamptz not null default now(),
 check(end_date>=start_date)
);
create table if not exists routes (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references campaigns(id),
 agent_id text not null references app_profiles(auth_user_id),
 route_date date not null,
 status text not null default 'draft',
 created_at timestamptz not null default now()
);
create table if not exists route_stops (
 id uuid primary key default gen_random_uuid(),
 route_id uuid not null references routes(id) on delete cascade,
 establishment_id uuid not null references establishments(id),
 position_order int not null check(position_order>0),
 status text not null default 'pending',
 unique(route_id,establishment_id),
 unique(route_id,position_order)
);
create table if not exists visits (
 id uuid primary key default gen_random_uuid(),
 stop_id uuid not null references route_stops(id),
 agent_id text not null references app_profiles(auth_user_id),
 checkin_at timestamptz,
 checkout_at timestamptz,
 checkin_position geography(Point,4326),
 accuracy_m numeric(8,2),
 result text not null default 'pending',
 notes text,
 review_status text not null default 'pending',
 reviewed_by text references app_profiles(auth_user_id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists visit_evidence (
 id uuid primary key default gen_random_uuid(),
 visit_id uuid not null references visits(id),
 storage_key text not null,
 mime_type text not null,
 uploaded_at timestamptz not null default now()
);
create table if not exists registration_records (
 id uuid primary key default gen_random_uuid(),
 establishment_id uuid not null unique references establishments(id),
 state text not null default 'pending' check(state in ('pending','confirmed','rejected')),
 confirmed_at timestamptz,
 confirmed_by text references app_profiles(auth_user_id),
 reference text,
 updated_at timestamptz not null default now()
);
create table if not exists expenses (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references campaigns(id),
 agent_id text not null references app_profiles(auth_user_id),
 category text not null,
 amount numeric(12,2) not null check(amount>=0),
 expense_date date not null,
 receipt_storage_key text,
 approval_status text not null default 'draft' check(approval_status in ('draft','submitted','approved','rejected','returned','paid')),
 approved_by text references app_profiles(auth_user_id),
 created_at timestamptz not null default now()
);
create table if not exists audit_logs (
 id bigserial primary key,
 actor_id text,
 action text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
-- NÃO atribuir admin automaticamente a qualquer novo usuário.
-- Depois de criar o primeiro usuário via Neon Auth, executar manualmente:
-- insert into app_profiles(auth_user_id,full_name,role)
-- values ('ID_REAL_DO_USUARIO_NO_NEON_AUTH','Administrador SindPetshop','admin');
-- A conexão DATABASE_URL deve permanecer apenas no servidor; não expor ao navegador.
