-- SindPetshop-SP: fundação da plataforma.
-- Execute no SQL Editor de um projeto Supabase novo, após revisar políticas.
create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'agent' check (role in ('admin','supervisor','agent')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Função interna de autorização; não publicada na Data API.
create or replace function private.is_staff(required_role text default 'supervisor') returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.active=true
    and (p.role='admin' or (required_role='supervisor' and p.role='supervisor'))
  );
$$;
revoke all on function private.is_staff(text) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_staff(text) to authenticated;

create table if not exists public.municipalities (
  ibge_code varchar(7) primary key, name text not null, state char(2) not null default 'SP',
  geom jsonb, created_at timestamptz not null default now()
);
create table if not exists public.company_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null, source text not null default 'upload_csv',
  total_rows integer not null default 0, valid_rows integer not null default 0,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.establishments (
  id uuid primary key default gen_random_uuid(),
  cnpj char(14) not null unique check (cnpj ~ '^[0-9]{14}$'),
  legal_name text not null,
  trade_name text, main_cnae varchar(7), street text, number text, district text,
  city text, state varchar(2), postal_code varchar(8), municipality_ibge varchar(7) references public.municipalities(ibge_code),
  latitude numeric(10,7), longitude numeric(10,7),
  status text not null default 'pending' check(status in ('pending','assigned','visited','verified','invalid','needs_review')),
  source_import_id uuid references public.company_imports(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists establishments_city_idx on public.establishments(city);
create index if not exists establishments_status_idx on public.establishments(status);
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(), name text not null,
  start_date date not null, end_date date not null, budget numeric(12,2) not null default 0 check(budget>=0),
  status text not null default 'draft' check (status in ('draft','published','active','closed','cancelled')),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check(end_date>=start_date)
);
create table if not exists public.campaign_assignments (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns(id),
  agent_id uuid not null references public.profiles(id),
  region_name text, unique(campaign_id,agent_id)
);
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns(id),
  agent_id uuid not null references public.profiles(id), visit_date date,
  status text not null default 'draft' check (status in ('draft','published','active','completed','cancelled')),
  created_at timestamptz not null default now()
);
create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(), route_id uuid not null references public.routes(id),
  establishment_id uuid not null references public.establishments(id), position int not null check(position>0),
  estimated_minutes integer default 20 check(estimated_minutes>0), unique(route_id,establishment_id),unique(route_id,position)
);
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(), stop_id uuid references public.route_stops(id),
  establishment_id uuid not null references public.establishments(id), agent_id uuid not null references public.profiles(id),
  started_at timestamptz, finished_at timestamptz,
  latitude numeric(10,7), longitude numeric(10,7), accuracy_meters numeric(10,2),
  outcome text not null default 'pending' check(outcome in ('pending','found','closed','moved','not_found','ceased','out_of_scope','not_completed')),
  notes text, created_at timestamptz not null default now()
);
create table if not exists public.visit_evidence (
  id uuid primary key default gen_random_uuid(), visit_id uuid not null references public.visits(id),
  storage_path text not null, uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.visit_reviews (
  id uuid primary key default gen_random_uuid(), visit_id uuid not null references public.visits(id),
  reviewer_id uuid not null references public.profiles(id),
  decision text not null check(decision in ('approved','rejected','revisit','more_info')),
  notes text, created_at timestamptz not null default now()
);
create table if not exists public.registration_records (
  id uuid primary key default gen_random_uuid(), establishment_id uuid not null unique references public.establishments(id),
  confirmed_at timestamptz not null, registered_by uuid not null references public.profiles(id),
  external_reference text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns(id),
  agent_id uuid not null references public.profiles(id), category text not null,
  amount numeric(12,2) not null check(amount>0), spent_on date not null,
  notes text, receipt_path text,
  status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','paid')),
  created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid,
  table_name text not null, entity_id text not null, action text not null,
  details jsonb, created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.municipalities enable row level security;
alter table public.company_imports enable row level security;
alter table public.establishments enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_assignments enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.visits enable row level security;
alter table public.visit_evidence enable row level security;
alter table public.visit_reviews enable row level security;
alter table public.registration_records enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles self or staff read" on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.is_staff('supervisor')));
create policy "profiles admin insert" on public.profiles for insert to authenticated with check((select private.is_staff('admin')));
create policy "profiles admin update" on public.profiles for update to authenticated using((select private.is_staff('admin'))) with check((select private.is_staff('admin')));
create policy "municipalities authenticated read" on public.municipalities for select to authenticated using(true);
create policy "imports staff read" on public.company_imports for select to authenticated using((select private.is_staff('supervisor')));
create policy "imports staff insert" on public.company_imports for insert to authenticated with check((select private.is_staff('supervisor')) and created_by=(select auth.uid()));
create policy "establishments staff read" on public.establishments for select to authenticated using((select private.is_staff('supervisor')));
create policy "establishments staff insert" on public.establishments for insert to authenticated with check((select private.is_staff('supervisor')));
create policy "establishments staff update" on public.establishments for update to authenticated using((select private.is_staff('supervisor'))) with check((select private.is_staff('supervisor')));
create policy "campaigns staff read" on public.campaigns for select to authenticated using((select private.is_staff('supervisor')));
create policy "campaigns agent assigned read" on public.campaigns for select to authenticated using(exists(select 1 from public.campaign_assignments ca where ca.campaign_id=id and ca.agent_id=(select auth.uid())));
create policy "campaigns staff insert" on public.campaigns for insert to authenticated with check((select private.is_staff('supervisor')) and created_by=(select auth.uid()));
create policy "campaigns staff update" on public.campaigns for update to authenticated using((select private.is_staff('supervisor'))) with check((select private.is_staff('supervisor')));
create policy "assignments staff all" on public.campaign_assignments for all to authenticated using((select private.is_staff('supervisor'))) with check((select private.is_staff('supervisor')));
create policy "assignments agent select" on public.campaign_assignments for select to authenticated using(agent_id=(select auth.uid()));
create policy "routes staff all" on public.routes for all to authenticated using((select private.is_staff('supervisor'))) with check((select private.is_staff('supervisor')));
create policy "routes assigned select" on public.routes for select to authenticated using(agent_id=(select auth.uid()));
create policy "stops staff all" on public.route_stops for all to authenticated using((select private.is_staff('supervisor'))) with check((select private.is_staff('supervisor')));
create policy "stops assigned select" on public.route_stops for select to authenticated using(exists(select 1 from public.routes r where r.id=route_id and r.agent_id=(select auth.uid())));
create policy "visits staff select" on public.visits for select to authenticated using((select private.is_staff('supervisor')));
create policy "visits own select" on public.visits for select to authenticated using(agent_id=(select auth.uid()));
create policy "visits own insert" on public.visits for insert to authenticated with check(agent_id=(select auth.uid()) and exists(select 1 from public.route_stops s join public.routes r on r.id=s.route_id where s.id=stop_id and s.establishment_id=establishment_id and r.agent_id=(select auth.uid())));
create policy "visits own update" on public.visits for update to authenticated using(agent_id=(select auth.uid())) with check(agent_id=(select auth.uid()));
create policy "evidence staff read" on public.visit_evidence for select to authenticated using((select private.is_staff('supervisor')));
create policy "evidence own read" on public.visit_evidence for select to authenticated using(exists(select 1 from public.visits v where v.id=visit_id and v.agent_id=(select auth.uid())));
create policy "evidence own insert" on public.visit_evidence for insert to authenticated with check(uploaded_by=(select auth.uid()) and exists(select 1 from public.visits v where v.id=visit_id and v.agent_id=(select auth.uid())));
create policy "reviews staff read" on public.visit_reviews for select to authenticated using((select private.is_staff('supervisor')));
create policy "reviews staff insert" on public.visit_reviews for insert to authenticated with check((select private.is_staff('supervisor')) and reviewer_id=(select auth.uid()));
create policy "registrations staff read" on public.registration_records for select to authenticated using((select private.is_staff('supervisor')));
create policy "registrations admin insert" on public.registration_records for insert to authenticated with check((select private.is_staff('admin')) and registered_by=(select auth.uid()));
create policy "registrations admin update" on public.registration_records for update to authenticated using((select private.is_staff('admin'))) with check((select private.is_staff('admin')));
create policy "expenses staff read" on public.expenses for select to authenticated using((select private.is_staff('supervisor')));
create policy "expenses agent read" on public.expenses for select to authenticated using(agent_id=(select auth.uid()));
create policy "expenses agent insert" on public.expenses for insert to authenticated with check(agent_id=(select auth.uid()) and status='draft');
create policy "expenses admin update" on public.expenses for update to authenticated using((select private.is_staff('admin'))) with check((select private.is_staff('admin')));
create policy "audit admin read" on public.audit_logs for select to authenticated using((select private.is_staff('admin')));

-- IMPORTANTE: tabelas recém-criadas podem não estar expostas à Data API por padrão.
-- No Supabase, habilite exposição para o schema/tabelas e revise GRANTs, mantendo RLS ativo.
-- Primeira conta: crie usuário em Authentication > Users e, no SQL Editor privilegiado:
-- insert into public.profiles(id,full_name,role) values ('UUID-DO-USUARIO','Administrador','admin');
-- Nunca conceda função admin por user_metadata editável pelo próprio usuário.
