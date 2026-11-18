-- Rode no Supabase da Larissa: SQL Editor > New query > Run
-- TROQUE o e-mail abaixo pelo e-mail que vai logar no painel (o mesmo criado em Authentication > Users)
create function eh_dona() returns boolean language sql stable as $$
  select (auth.jwt() ->> 'email') = 'TROQUE_PELO_EMAIL_DELA@exemplo.com'
$$;

create table consultas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  hora time not null,
  nome text not null,
  whatsapp text,
  modalidade text not null default 'Presencial',
  link_sessao text,
  status text not null default 'Nova',
  presenca text,
  pago boolean not null default false,
  valor numeric(10,2) not null default 180,
  criado_em timestamptz not null default now()
);
create unique index consultas_horario on consultas (data, hora) where status <> 'Cancelada';
alter table consultas enable row level security;

create policy "paciente agenda" on consultas for insert to anon
  with check (status = 'Nova' and pago = false and presenca is null);
create policy "dona cria" on consultas for insert to authenticated with check (eh_dona());
create policy "dona le" on consultas for select to authenticated using (eh_dona());
create policy "dona edita" on consultas for update to authenticated using (eh_dona()) with check (eh_dona());
create policy "dona apaga" on consultas for delete to authenticated using (eh_dona());

create table bloqueios (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  hora time,
  motivo text,
  criado_em timestamptz not null default now()
);
alter table bloqueios enable row level security;
create policy "dona le bloqueios" on bloqueios for select to authenticated using (eh_dona());
create policy "dona cria bloqueios" on bloqueios for insert to authenticated with check (eh_dona());
create policy "dona apaga bloqueios" on bloqueios for delete to authenticated using (eh_dona());

-- O site público só descobre QUAIS horários estão ocupados ou bloqueados, nunca quem marcou
create function horarios_ocupados(dia date) returns table(hora time)
language sql security definer set search_path = public as $$
  select hora from consultas where data = dia and status <> 'Cancelada'
$$;
create function bloqueios_publicos(ini date, fim date) returns table(data date, hora time)
language sql security definer set search_path = public as $$
  select data, hora from bloqueios where data between ini and fim
$$;
grant execute on function horarios_ocupados(date) to anon, authenticated;
grant execute on function bloqueios_publicos(date, date) to anon, authenticated;
