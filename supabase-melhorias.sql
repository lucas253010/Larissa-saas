-- Atualiza o e-mail autorizado para entrar no painel administrativo.
create or replace function public.eh_dona() returns boolean
language sql stable as $$
  select (auth.jwt() ->> 'email') = 'larissa@painel.com.br'
$$;

-- Migração para prontuários, cadastro de pacientes e configurações administrativas.
-- Execute no Supabase > SQL Editor. Faça backup antes de aplicar em produção.
-- A função eh_dona() existente deve estar configurada com o e-mail real do usuário autorizado.

alter table public.consultas
  add column if not exists paciente_id uuid;

create table if not exists public.pacientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text,
  email text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.pacientes enable row level security;
drop policy if exists "dona le pacientes" on public.pacientes;
drop policy if exists "dona cria pacientes" on public.pacientes;
drop policy if exists "dona edita pacientes" on public.pacientes;
drop policy if exists "dona apaga pacientes" on public.pacientes;
create policy "dona le pacientes" on public.pacientes for select to authenticated using (public.eh_dona());
create policy "dona cria pacientes" on public.pacientes for insert to authenticated with check (public.eh_dona());
create policy "dona edita pacientes" on public.pacientes for update to authenticated using (public.eh_dona()) with check (public.eh_dona());
create policy "dona apaga pacientes" on public.pacientes for delete to authenticated using (public.eh_dona());
grant select,insert,update,delete on public.pacientes to authenticated;
revoke all on public.pacientes from anon;

do $$ begin
  alter table public.consultas add constraint consultas_paciente_fk
    foreign key (paciente_id) references public.pacientes(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.anotacoes_consultas (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null unique references public.consultas(id) on delete cascade,
  conteudo text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.anotacoes_consultas enable row level security;
drop policy if exists "dona le anotacoes" on public.anotacoes_consultas;
drop policy if exists "dona cria anotacoes" on public.anotacoes_consultas;
drop policy if exists "dona edita anotacoes" on public.anotacoes_consultas;
create policy "dona le anotacoes" on public.anotacoes_consultas for select to authenticated using (public.eh_dona());
create policy "dona cria anotacoes" on public.anotacoes_consultas for insert to authenticated with check (public.eh_dona());
create policy "dona edita anotacoes" on public.anotacoes_consultas for update to authenticated using (public.eh_dona()) with check (public.eh_dona());
grant select,insert,update on public.anotacoes_consultas to authenticated;
revoke all on public.anotacoes_consultas from anon;

create table if not exists public.historico_anotacoes (
  id uuid primary key default gen_random_uuid(),
  anotacao_id uuid not null references public.anotacoes_consultas(id) on delete cascade,
  conteudo text not null,
  criado_em timestamptz not null default now()
);
alter table public.historico_anotacoes enable row level security;
drop policy if exists "dona le historico anotacoes" on public.historico_anotacoes;
create policy "dona le historico anotacoes" on public.historico_anotacoes for select to authenticated using (public.eh_dona());
grant select on public.historico_anotacoes to authenticated;
revoke all on public.historico_anotacoes from anon;

create or replace function public.registrar_versao_anotacao()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.historico_anotacoes(anotacao_id,conteudo)
  values(old.id,old.conteudo);
  new.atualizado_em=now();
  return new;
end $$;
drop trigger if exists trg_historico_anotacoes on public.anotacoes_consultas;
create trigger trg_historico_anotacoes before update on public.anotacoes_consultas
for each row execute function public.registrar_versao_anotacao();

create table if not exists public.configuracoes_painel (
  id smallint primary key check (id=1),
  nome text not null default '',
  crp text not null default '',
  valor numeric(10,2) not null default 180,
  duracao_minutos integer not null default 50,
  horas jsonb not null default '[]'::jsonb,
  dias_atendimento jsonb not null default '[1,2,3,4,5]'::jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.configuracoes_painel enable row level security;
drop policy if exists "dona le configuracoes" on public.configuracoes_painel;
drop policy if exists "dona cria configuracoes" on public.configuracoes_painel;
drop policy if exists "dona edita configuracoes" on public.configuracoes_painel;
create policy "dona le configuracoes" on public.configuracoes_painel for select to authenticated using (public.eh_dona());
create policy "dona cria configuracoes" on public.configuracoes_painel for insert to authenticated with check (public.eh_dona());
create policy "dona edita configuracoes" on public.configuracoes_painel for update to authenticated using (public.eh_dona()) with check (public.eh_dona());
grant select,insert,update on public.configuracoes_painel to authenticated;
revoke all on public.configuracoes_painel from anon;
