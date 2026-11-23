-- Complemento da reorganização do prontuário: informações gerais por paciente.
-- Execute uma única vez no Supabase SQL Editor, após a migração supabase-melhorias.sql.

create table if not exists public.anotacoes_pacientes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null unique references public.pacientes(id) on delete cascade,
  conteudo text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.anotacoes_pacientes enable row level security;
drop policy if exists "dona le anotacoes pacientes" on public.anotacoes_pacientes;
drop policy if exists "dona cria anotacoes pacientes" on public.anotacoes_pacientes;
drop policy if exists "dona edita anotacoes pacientes" on public.anotacoes_pacientes;
create policy "dona le anotacoes pacientes" on public.anotacoes_pacientes for select to authenticated using (public.eh_dona());
create policy "dona cria anotacoes pacientes" on public.anotacoes_pacientes for insert to authenticated with check (public.eh_dona());
create policy "dona edita anotacoes pacientes" on public.anotacoes_pacientes for update to authenticated using (public.eh_dona()) with check (public.eh_dona());
grant select,insert,update on public.anotacoes_pacientes to authenticated;
revoke all on public.anotacoes_pacientes from anon;

-- Cria cadastros para pacientes que só existiam nas consultas antigas.
insert into public.pacientes (nome, whatsapp)
select c.nome, nullif(c.whatsapp,'')
from public.consultas c
where nullif(trim(c.nome),'') is not null
  and not exists (
    select 1 from public.pacientes p
    where (
      nullif(regexp_replace(coalesce(c.whatsapp,''),'[^0-9]','','g'),'') is not null
      and regexp_replace(coalesce(p.whatsapp,''),'[^0-9]','','g')=regexp_replace(coalesce(c.whatsapp,''),'[^0-9]','','g')
    ) or (
      nullif(regexp_replace(coalesce(c.whatsapp,''),'[^0-9]','','g'),'') is null
      and lower(trim(p.nome))=lower(trim(c.nome))
    )
  );

-- Associa consultas antigas aos cadastros pelo telefone ou, sem telefone, pelo nome.
update public.consultas c
set paciente_id=p.id
from public.pacientes p
where c.paciente_id is null
  and (
    (nullif(regexp_replace(coalesce(c.whatsapp,''),'[^0-9]','','g'),'') is not null
      and regexp_replace(coalesce(c.whatsapp,''),'[^0-9]','','g')=regexp_replace(coalesce(p.whatsapp,''),'[^0-9]','','g'))
    or
    (nullif(regexp_replace(coalesce(c.whatsapp,''),'[^0-9]','','g'),'') is null
      and lower(trim(c.nome))=lower(trim(p.nome)))
  );
