create table public.hojas_usuario (
  user_id uuid primary key,
  spreadsheet_id text not null,
  updated_at timestamptz not null default now()
);
alter table public.hojas_usuario enable row level security;
grant select, insert, update, delete on public.hojas_usuario to authenticated;
create policy "ver propia" on public.hojas_usuario for select to authenticated using (auth.uid() = user_id);
create policy "crear propia" on public.hojas_usuario for insert to authenticated with check (auth.uid() = user_id);
create policy "editar propia" on public.hojas_usuario for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "borrar propia" on public.hojas_usuario for delete to authenticated using (auth.uid() = user_id);