-- Área de sessão clínica: campos estruturados por consulta.
-- Execute no Supabase > SQL Editor. Faça backup antes de aplicar.
-- A tabela anotacoes_consultas e suas políticas RLS são criadas em supabase-melhorias.sql.
alter table public.anotacoes_consultas
  add column if not exists humor text,
  add column if not exists temas text,
  add column if not exists intervencoes text,
  add column if not exists tarefas text,
  add column if not exists plano text;

-- Reforça a proteção: somente a profissional autenticada pode consultar e alterar registros.
alter table public.anotacoes_consultas enable row level security;
drop policy if exists "dona le anotacoes" on public.anotacoes_consultas;
drop policy if exists "dona cria anotacoes" on public.anotacoes_consultas;
drop policy if exists "dona edita anotacoes" on public.anotacoes_consultas;
create policy "dona le anotacoes" on public.anotacoes_consultas
  for select to authenticated using (public.eh_dona());
create policy "dona cria anotacoes" on public.anotacoes_consultas
  for insert to authenticated with check (public.eh_dona());
create policy "dona edita anotacoes" on public.anotacoes_consultas
  for update to authenticated using (public.eh_dona()) with check (public.eh_dona());
grant select,insert,update on public.anotacoes_consultas to authenticated;
revoke all on public.anotacoes_consultas from anon;

-- Evolução longitudinal: avaliação subjetiva registrada pela profissional (escala 1–5).
alter table public.anotacoes_consultas
  add column if not exists evolucao_nota smallint;
alter table public.anotacoes_consultas
  drop constraint if exists anotacoes_consultas_evolucao_nota_check;
alter table public.anotacoes_consultas
  add constraint anotacoes_consultas_evolucao_nota_check
  check (evolucao_nota is null or evolucao_nota between 1 and 5);
