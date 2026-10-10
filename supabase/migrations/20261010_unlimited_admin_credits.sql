begin;

create or replace function public.admin_adjust_balance(p_user uuid, p_amount numeric, p_reason text default null)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  v_bal numeric;
  v_amount numeric;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'Valor inválido';
  end if;

  v_amount := round(p_amount, 2);
  if v_amount = 0 then
    raise exception 'Valor inválido';
  end if;

  select balance into v_bal
    from public.profiles
   where id = p_user
   for update;

  if v_bal is null then
    raise exception 'Utilizador não encontrado';
  end if;
  if v_bal + v_amount < 0 then
    raise exception 'O saldo não pode ficar negativo';
  end if;

  return public._credit(
    p_user,
    v_amount,
    'ajuste_admin',
    coalesce(nullif(trim(p_reason), ''), 'Ajuste do administrador'),
    null
  );
end $$;

revoke execute on function public.admin_adjust_balance(uuid, numeric, text) from public, anon;
grant execute on function public.admin_adjust_balance(uuid, numeric, text) to authenticated;

drop function if exists public.admin_set_operator_credit_pool(numeric);

commit;
