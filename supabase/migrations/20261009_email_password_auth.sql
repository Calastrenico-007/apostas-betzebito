-- Disable legacy KYC gates for an email/password-authenticated account.
-- Existing KYC columns and notes are deliberately retained; this migration
-- does not delete previously submitted personal data.
begin;

create or replace function public.wallet_request_before_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_balance numeric;
  v_pending numeric;
begin
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

create or replace function public.process_wallet_request(p_request uuid, p_status public.wallet_request_status)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  r public.wallet_requests%rowtype;
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem processar pedidos de carteira';
  end if;

  select * into r from public.wallet_requests where id = p_request for update;
  if not found then
    raise exception 'Pedido de carteira não encontrado';
  end if;

  if r.status <> 'pendente' then
    raise exception 'Este pedido já foi processado';
  end if;

  select * into v_profile from public.profiles where id = r.user_id for update;
  if not found then
    raise exception 'Utilizador do pedido não encontrado';
  end if;

  if p_status = 'aprovado' then
    if r.type = 'deposito' then
      perform public._credit(r.user_id, r.amount, 'deposito', 'Depósito aprovado', null);
      insert into public.activity(message, amount)
      values ('Depósito aprovado: ' || v_profile.username, r.amount);
    elsif r.type = 'levantamento' then
      if v_profile.balance < r.amount then
        raise exception 'Saldo insuficiente para este levantamento';
      end if;
      perform public._credit(r.user_id, -r.amount, 'levantamento', 'Levantamento aprovado', null);
      update public.profiles set reserved_balance = greatest(reserved_balance - r.amount, 0) where id = r.user_id;
      insert into public.activity(message, amount)
      values ('Levantamento aprovado: ' || v_profile.username, r.amount);
    end if;
  elsif p_status in ('rejeitado', 'cancelado') then
    if r.type = 'levantamento' then
      update public.profiles set reserved_balance = greatest(reserved_balance - r.amount, 0) where id = r.user_id;
    end if;
  else
    raise exception 'Status inválido para processamento';
  end if;

  update public.wallet_requests
     set status = p_status,
         processed_by = auth.uid(),
         processed_at = now()
   where id = p_request;

  perform pg_notify('wallet_request_events', json_build_object('request_id', r.id, 'user_id', r.user_id, 'status', p_status)::text);

  insert into public.notifications(user_id, kind, payload)
    values (r.user_id, 'wallet_request_update', json_build_object('request_id', r.id, 'status', p_status, 'type', r.type, 'amount', r.amount));

  insert into public.outbox_emails(to_email, subject, body)
    select p.email,
           'Atualização do seu pedido de carteira',
           ('O seu pedido de ' || r.type || ' de ' || r.amount::text || ' foi ' || p_status || '.')
      from public.profiles p
     where p.id = r.user_id and p.email is not null;

  return p_status::text;
end $$;

create or replace function public.place_bet(selections uuid[], stake numeric, expected_odds numeric[] default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bal numeric;
  v_n int;
  v_total numeric := 1;
  v_bet uuid;
  v_type public.bet_type;
  v_has_mutual boolean := false;
  v_first uuid := selections[1];
  r record;
  i int := 0;
begin
  if v_uid is null then raise exception 'Precisas de iniciar sessão'; end if;
  if stake is null or stake < 1 then raise exception 'Valor mínimo da aposta: 1 moeda'; end if;
  if stake > 100000 then raise exception 'Valor máximo da aposta: 100 000 moedas'; end if;
  stake := round(stake, 2);
  v_n := coalesce(array_length(selections, 1), 0);
  if v_n = 0 then raise exception 'Boletim vazio'; end if;
  if v_n > 15 then raise exception 'Máximo de 15 seleções numa múltipla'; end if;
  if (select count(distinct x) from unnest(selections) x) <> v_n then raise exception 'Seleções repetidas'; end if;

  select balance into v_bal from public.profiles where id = v_uid for update;
  if v_bal is null then raise exception 'Perfil não encontrado'; end if;
  if v_bal < stake then raise exception 'Saldo insuficiente'; end if;

  for r in
    select s.id sel_id, s.odds, s.result, s.label, m.id market_id, m.status m_status, m.pool_type,
           e.id event_id, e.status e_status, e.closes_at, e.starts_at, e.title, x.ord
      from unnest(selections) with ordinality as x(sel, ord)
      join public.selections s on s.id = x.sel
      join public.markets m on m.id = s.market_id
      join public.events e on e.id = m.event_id
     order by x.ord
       for update of s
  loop
    i := i + 1;
    if r.e_status not in ('agendado', 'ao_vivo') then raise exception 'O evento "%" não está aberto a apostas', r.title; end if;
    if r.starts_at is not null and r.starts_at <= now() then raise exception 'As apostas para "%" já fecharam porque o jogo começou', r.title; end if;
    if r.closes_at is not null and r.closes_at <= now() then raise exception 'As apostas para "%" já fecharam', r.title; end if;
    if r.m_status <> 'aberto' then raise exception 'Mercado suspenso: %', r.label; end if;
    if r.result <> 'pendente' then raise exception 'Seleção já resolvida: %', r.label; end if;
    if r.pool_type = 'mutua' then
      v_has_mutual := true;
    else
      if r.odds is null or r.odds < 1.01 then raise exception 'Odd indisponível para %', r.label; end if;
      if expected_odds is not null and array_length(expected_odds, 1) >= r.ord
         and expected_odds[r.ord] is not null and expected_odds[r.ord] <> r.odds then
        raise exception 'ODDS_CHANGED: a odd de % mudou para %', r.label, r.odds;
      end if;
      v_total := v_total * r.odds;
    end if;
  end loop;

  if i <> v_n then raise exception 'Seleção inválida no boletim'; end if;

  if v_n > 1 then
    if v_has_mutual then raise exception 'Apostas mútuas só podem ser feitas como simples'; end if;
    if (select count(distinct m.event_id)
          from public.selections s join public.markets m on m.id = s.market_id
         where s.id = any(selections)) <> v_n then
      raise exception 'Uma múltipla não pode ter duas seleções do mesmo evento';
    end if;
    v_type := 'multipla';
  else
    v_type := 'simples';
  end if;

  insert into public.bets(user_id, type, stake, total_odds, potential_return)
  values (v_uid, v_type, stake,
          case when v_has_mutual then null else round(v_total, 4) end,
          case when v_has_mutual then null else round(stake * v_total, 2) end)
  returning id into v_bet;

  insert into public.bet_legs(bet_id, selection_id, market_id, event_id, odds_at_placement)
  select v_bet, s.id, m.id, m.event_id, case when m.pool_type = 'mutua' then null else s.odds end
    from unnest(selections) with ordinality as x(sel, ord)
    join public.selections s on s.id = x.sel
    join public.markets m on m.id = s.market_id
   order by x.ord;

  if v_has_mutual then
    update public.selections set pool = pool + stake where id = v_first;
  end if;

  perform public._credit(v_uid, -stake, 'aposta',
    case when v_type = 'simples' then 'Aposta simples' else 'Aposta múltipla (' || v_n || ' seleções)' end, v_bet);

  return v_bet;
end $$;

revoke update (kyc_status, kyc_note) on public.profiles from anon, authenticated;

commit;
