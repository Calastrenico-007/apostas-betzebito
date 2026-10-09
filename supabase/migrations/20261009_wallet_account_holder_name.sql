begin;

alter table public.wallet_requests
  add column if not exists account_holder_name text;

alter table public.wallet_requests
  drop constraint if exists wallet_requests_account_holder_name_check;

alter table public.wallet_requests
  add constraint wallet_requests_account_holder_name_check
  check (
    account_holder_name is null
    or length(btrim(account_holder_name)) between 2 and 120
  );

create or replace function public.wallet_request_before_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_balance numeric;
  v_pending numeric;
begin
  perform public._require_approved_account(new.user_id);
  if new.account_holder_name is null or length(btrim(new.account_holder_name)) not between 2 and 120 then
    raise exception 'Indica o nome do titular da conta E-Mola (2 a 120 caracteres)';
  end if;
  if new.type = 'levantamento' then
    select balance into v_balance from public.profiles where id = new.user_id for update;
    if v_balance is null then
      raise exception 'Utilizador não encontrado';
    end if;
    select coalesce(sum(amount), 0)
      into v_pending
      from public.wallet_requests
     where user_id = new.user_id
       and status = 'pendente'
       and type = 'levantamento';
    if v_balance - v_pending < new.amount then
      raise exception 'Saldo insuficiente considerando pedidos pendentes';
    end if;
  end if;
  return new;
end $$;

commit;
