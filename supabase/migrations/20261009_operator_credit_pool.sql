begin;

create table public.operator_credit_pool (
  id boolean primary key default true check (id),
  available_amount numeric(14, 2) not null default 0 check (available_amount >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.operator_credit_pool (id, available_amount)
values (true, 0)
on conflict (id) do nothing;

alter table public.operator_credit_pool enable row level security;

create policy operator_credit_pool_admin_select on public.operator_credit_pool
for select to authenticated
using (public.is_admin());

revoke all on public.operator_credit_pool from anon, authenticated;
grant select on public.operator_credit_pool to authenticated;

create or replace function public.admin_adjust_balance(p_user uuid, p_amount numeric, p_reason text default null)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  v_bal numeric;
  v_amount numeric;
  v_pool numeric;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Valor inválido'; end if;
  v_amount := round(p_amount, 2);
  if v_amount = 0 then raise exception 'Valor inválido'; end if;

  select balance into v_bal from public.profiles where id = p_user for update;
  if v_bal is null then raise exception 'Utilizador não encontrado'; end if;
  if v_bal + v_amount < 0 then raise exception 'O saldo não pode ficar negativo'; end if;

  select available_amount into v_pool
    from public.operator_credit_pool
   where id = true
   for update;
  if not found then raise exception 'Fundo de créditos do operador não está configurado'; end if;
  if v_amount > 0 and v_pool < v_amount then
    raise exception 'Fundo insuficiente: disponível % MT, pedido % MT', v_pool, v_amount;
  end if;

  update public.operator_credit_pool
     set available_amount = available_amount - v_amount,
         updated_at = now(),
         updated_by = auth.uid()
   where id = true;

  return public._credit(
    p_user,
    v_amount,
    'ajuste_admin',
    coalesce(nullif(trim(p_reason), ''), 'Ajuste do administrador'),
    null
  );
end $$;

create or replace function public.admin_set_operator_credit_pool(p_available numeric)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare v_amount numeric;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem configurar o fundo de créditos';
  end if;
  if p_available is null or p_available < 0 then
    raise exception 'O fundo disponível não pode ser negativo';
  end if;
  v_amount := round(p_available, 2);

  insert into public.operator_credit_pool (id, available_amount, updated_at, updated_by)
  values (true, v_amount, now(), auth.uid())
  on conflict (id) do update
    set available_amount = excluded.available_amount,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  return v_amount;
end $$;

revoke execute on function public.admin_adjust_balance(uuid, numeric, text) from public, anon;
grant execute on function public.admin_adjust_balance(uuid, numeric, text) to authenticated;
revoke execute on function public.admin_set_operator_credit_pool(numeric) from public, anon;
grant execute on function public.admin_set_operator_credit_pool(numeric) to authenticated;

commit;
