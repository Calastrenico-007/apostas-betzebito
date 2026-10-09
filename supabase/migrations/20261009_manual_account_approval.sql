begin;

alter table public.profiles
  add column account_status text not null default 'pendente'
  check (account_status in ('pendente', 'aprovado', 'rejeitado'));

update public.profiles
   set account_status = 'pendente'
 where role <> 'admin';

create or replace function public._require_approved_account(p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role public.user_role;
  v_status text;
begin
  select role, account_status into v_role, v_status
    from public.profiles
   where id = p_user;
  if not found then
    raise exception 'Perfil não encontrado';
  end if;
  if v_role <> 'admin' and v_status <> 'aprovado' then
    raise exception 'A conta aguarda aprovação manual do administrador';
  end if;
end $$;

revoke execute on function public._require_approved_account(uuid) from public, anon, authenticated;

create or replace function public.wallet_request_before_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_balance numeric;
  v_pending numeric;
begin
  perform public._require_approved_account(new.user_id);
  if new.type = 'levantamento' then
    select balance into v_balance from public.profiles where id = new.user_id for update;
    if v_balance is null then
      raise exception 'Utilizador não encontrado';
    end if;
    select coalesce(sum(amount),0) into v_pending
      from public.wallet_requests
     where user_id = new.user_id and status = 'pendente' and type = 'levantamento';
    if v_balance - v_pending < new.amount then
      raise exception 'Saldo insuficiente considerando pedidos pendentes';
    end if;
  end if;
  return new;
end $$;

create or replace function public.bets_require_approved_account()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is distinct from new.user_id then
    raise exception 'Aposta não autorizada para esta conta';
  end if;
  perform public._require_approved_account(new.user_id);
  return new;
end $$;

drop trigger if exists bets_require_approved_account on public.bets;
create trigger bets_require_approved_account
  before insert on public.bets
  for each row execute function public.bets_require_approved_account();

create or replace function public.events_require_approved_proposer()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.proposed_by is not null then
    perform public._require_approved_account(new.proposed_by);
  end if;
  return new;
end $$;

drop trigger if exists events_require_approved_proposer on public.events;
create trigger events_require_approved_proposer
  before insert on public.events
  for each row execute function public.events_require_approved_proposer();

revoke execute on function public.bets_require_approved_account() from public, anon, authenticated;
revoke execute on function public.events_require_approved_proposer() from public, anon, authenticated;

create or replace function public.admin_set_account_status(p_user uuid, p_status text)
returns text
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar o estado das contas';
  end if;
  if p_status is null or p_status not in ('pendente', 'aprovado', 'rejeitado') then
    raise exception 'Estado de conta inválido';
  end if;
  if p_user = auth.uid() then
    raise exception 'Não podes alterar o estado da tua própria conta de administrador';
  end if;

  update public.profiles
     set account_status = p_status
   where id = p_user
     and role <> 'admin';
  if not found then
    raise exception 'Conta não encontrada ou é administradora';
  end if;
  return p_status;
end $$;

revoke execute on function public.admin_set_account_status(uuid, text) from public, anon;
grant execute on function public.admin_set_account_status(uuid, text) to authenticated;

commit;
