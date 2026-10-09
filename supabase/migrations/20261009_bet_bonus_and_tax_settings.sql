create table if not exists public.bet_settings (
    id boolean primary key default true check (id),
    tax_percent numeric(5, 2) not null default 0 check (tax_percent between 0 and 100),
    multiple_bonus_min_selections int not null default 5 check (multiple_bonus_min_selections between 2 and 15),
    multiple_bonus_percent numeric(5, 2) not null default 4 check (multiple_bonus_percent between 0 and 100),
    updated_at timestamptz not null default now(),
    updated_by uuid references public.profiles (id) on delete set null
);

insert into public.bet_settings (id, tax_percent, multiple_bonus_min_selections, multiple_bonus_percent)
values (true, 0, 5, 4)
on conflict (id) do nothing;

alter table public.bet_settings enable row level security;
revoke all on public.bet_settings from anon, authenticated;

alter table public.bets
  add column if not exists tax_percent numeric(5, 2) not null default 0 check (tax_percent between 0 and 100),
  add column if not exists bonus_percent numeric(5, 2) not null default 0 check (bonus_percent between 0 and 100),
  add column if not exists tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0);

create or replace function public.get_bet_rules()
returns table(tax_percent numeric, multiple_bonus_min_selections int, multiple_bonus_percent numeric)
language sql stable security definer set search_path = public
as $$
  select s.tax_percent, s.multiple_bonus_min_selections, s.multiple_bonus_percent
    from public.bet_settings s
   where s.id = true;
$$;

create or replace function public.admin_set_bet_rules(
  p_tax_percent numeric,
  p_multiple_bonus_min_selections int,
  p_multiple_bonus_percent numeric
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem alterar taxas e bónus'; end if;
  if p_tax_percent is null or p_tax_percent < 0 or p_tax_percent > 100 then
    raise exception 'A taxa deve estar entre 0 e 100 por cento';
  end if;
  if p_multiple_bonus_min_selections is null or p_multiple_bonus_min_selections < 2
     or p_multiple_bonus_min_selections > 15 then
    raise exception 'O mínimo de seleções para o bónus deve estar entre 2 e 15';
  end if;
  if p_multiple_bonus_percent is null or p_multiple_bonus_percent < 0 or p_multiple_bonus_percent > 100 then
    raise exception 'O bónus deve estar entre 0 e 100 por cento';
  end if;

  update public.bet_settings
     set tax_percent = round(p_tax_percent, 2),
         multiple_bonus_min_selections = p_multiple_bonus_min_selections,
         multiple_bonus_percent = round(p_multiple_bonus_percent, 2),
         updated_at = now(),
         updated_by = auth.uid()
   where id = true;
end $$;

revoke execute on function public.get_bet_rules() from public;
grant execute on function public.get_bet_rules() to anon, authenticated;
revoke execute on function public.admin_set_bet_rules(numeric, int, numeric) from public, anon;
grant execute on function public.admin_set_bet_rules(numeric, int, numeric) to authenticated;

drop function if exists public.place_bet(uuid[], numeric, numeric[]);
drop function if exists public.place_bet(uuid[], numeric);
drop function if exists public.place_bet(uuid[], numeric, numeric[], numeric, int, numeric);

create function public.place_bet(
  selections uuid[],
  stake numeric,
  expected_odds numeric[] default null,
  expected_tax_percent numeric default null,
  expected_bonus_min_selections int default null,
  expected_bonus_percent numeric default null
)
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
  v_tax_percent numeric;
  v_bonus_min_selections int;
  v_bonus_percent numeric;
  v_applied_bonus_percent numeric := 0;
  v_gross_return numeric;
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

  select tax_percent, multiple_bonus_min_selections, multiple_bonus_percent
    into v_tax_percent, v_bonus_min_selections, v_bonus_percent
    from public.bet_settings
   where id = true
   for share;
  if v_tax_percent is null then raise exception 'As regras de apostas não estão configuradas'; end if;
  if expected_tax_percent is not null and (
       expected_tax_percent <> v_tax_percent
       or expected_bonus_min_selections is distinct from v_bonus_min_selections
       or expected_bonus_percent is distinct from v_bonus_percent
     ) then
    raise exception 'BET_RULES_CHANGED: as regras de taxa ou bónus foram alteradas; revê o retorno antes de apostar';
  end if;

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

  if v_type = 'multipla' and v_n >= v_bonus_min_selections then
    v_applied_bonus_percent := v_bonus_percent;
    v_total := v_total * (1 + v_applied_bonus_percent / 100);
  end if;
  v_gross_return := round(stake * v_total, 2);

  insert into public.bets(
    user_id, type, stake, total_odds, potential_return, tax_percent, bonus_percent
  )
  values (v_uid, v_type, stake,
          case when v_has_mutual then null else round(v_total, 4) end,
          case when v_has_mutual then null else round(v_gross_return * (1 - v_tax_percent / 100), 2) end,
          v_tax_percent,
          v_applied_bonus_percent)
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

revoke execute on function public.place_bet(uuid[], numeric, numeric[], numeric, int, numeric) from public, anon;
grant execute on function public.place_bet(uuid[], numeric, numeric[], numeric, int, numeric) to authenticated;

create or replace function public._try_settle_bet(p_bet uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  b public.bets%rowtype;
  v_pending int; v_lost int; v_won int;
  v_odds numeric; v_gross_payout numeric; v_tax numeric; v_payout numeric;
  v_name text;
begin
  select * into b from public.bets where id = p_bet for update;
  if not found or b.status <> 'aberta' then return; end if;

  select count(*) filter (where result = 'pendente'),
         count(*) filter (where result = 'perdida'),
         count(*) filter (where result = 'ganha'),
         coalesce(exp(sum(ln(case when result = 'ganha' then odds_at_placement else 1 end))), 1)
    into v_pending, v_lost, v_won, v_odds
    from public.bet_legs where bet_id = p_bet;

  if v_pending > 0 then return; end if;

  if v_lost > 0 then
    update public.bets set status = 'perdida', payout = 0, tax_amount = 0, settled_at = now() where id = p_bet;
  elsif v_won = 0 then
    update public.bets set status = 'anulada', payout = b.stake, tax_amount = 0, settled_at = now() where id = p_bet;
    perform public._credit(b.user_id, b.stake, 'reembolso', 'Aposta anulada — reembolso', p_bet);
  else
    v_odds := v_odds * (1 + b.bonus_percent / 100);
    v_gross_payout := round(b.stake * v_odds, 2);
    v_tax := round(v_gross_payout * b.tax_percent / 100, 2);
    v_payout := v_gross_payout - v_tax;
    update public.bets
       set status = 'ganha', payout = v_payout, tax_amount = v_tax, settled_at = now()
     where id = p_bet;
    perform public._credit(
      b.user_id, v_payout, 'ganho',
      'Retorno bruto ' || to_char(v_gross_payout, 'FM9999999990D00')
        || ' — retenção ' || to_char(v_tax, 'FM9999999990D00'),
      p_bet
    );
    select username into v_name from public.profiles where id = b.user_id;
    insert into public.activity(message, amount)
      values (coalesce(v_name, 'Alguém') || ' recebeu ' || to_char(v_payout, 'FM999G999G990D00') || ' moedas!', v_payout);
  end if;
end $$;

create or replace function public._settle_market(p_market uuid, p_winners uuid[])
returns void
language plpgsql security definer set search_path = public
as $$
declare
  m public.markets%rowtype;
  v_total_pool numeric; v_win_pool numeric; v_factor numeric;
  r record; v_name text; v_gross numeric; v_tax numeric; v_net numeric;
begin
  select * into m from public.markets where id = p_market for update;
  if not found or m.status in ('resolvido', 'anulado') then return; end if;

  update public.selections
     set result = case when id = any(p_winners) then 'ganha'::public.selection_result else 'perdida'::public.selection_result end
   where market_id = p_market and result = 'pendente';
  update public.markets set status = 'resolvido' where id = p_market;

  if m.pool_type = 'fixa' then
    update public.bet_legs l set result = s.result
      from public.selections s
     where l.selection_id = s.id and l.market_id = p_market and l.result = 'pendente';
    for r in select distinct bet_id from public.bet_legs where market_id = p_market loop
      perform public._try_settle_bet(r.bet_id);
    end loop;
  else
    select coalesce(sum(pool), 0) into v_total_pool from public.selections where market_id = p_market;
    select coalesce(sum(pool), 0) into v_win_pool from public.selections where market_id = p_market and id = any(p_winners);
    if v_win_pool = 0 then
      update public.selections set result = 'anulada' where market_id = p_market;
      update public.markets set status = 'anulado' where id = p_market;
      update public.bet_legs set result = 'anulada' where market_id = p_market and result = 'pendente';
      for r in select distinct bet_id from public.bet_legs where market_id = p_market loop
        perform public._try_settle_bet(r.bet_id);
      end loop;
      return;
    end if;
    v_factor := v_total_pool * (1 - m.commission) / v_win_pool;
    if v_factor < 1 then v_factor := 1; end if;
    for r in
      select b.id, b.user_id, b.stake, b.tax_percent, l.selection_id
        from public.bet_legs l join public.bets b on b.id = l.bet_id
       where l.market_id = p_market and b.status = 'aberta'
         for update of b
    loop
      if r.selection_id = any(p_winners) then
        v_gross := round(r.stake * v_factor, 2);
        v_tax := round(v_gross * r.tax_percent / 100, 2);
        v_net := v_gross - v_tax;
        update public.bet_legs set result = 'ganha' where bet_id = r.id;
        update public.bets
           set status = 'ganha', payout = v_net, tax_amount = v_tax, total_odds = round(v_factor, 4), settled_at = now()
         where id = r.id;
        perform public._credit(
          r.user_id, v_net, 'ganho',
          'Retorno mútuo bruto ' || to_char(v_gross, 'FM9999999990D00')
            || ' — retenção ' || to_char(v_tax, 'FM9999999990D00'),
          r.id
        );
        select username into v_name from public.profiles where id = r.user_id;
        insert into public.activity(message, amount)
          values (coalesce(v_name, 'Alguém') || ' recebeu ' || to_char(v_net, 'FM999G999G990D00') || ' moedas!', v_net);
      else
        update public.bet_legs set result = 'perdida' where bet_id = r.id;
        update public.bets set status = 'perdida', payout = 0, tax_amount = 0, settled_at = now() where id = r.id;
      end if;
    end loop;
  end if;
end $$;

create or replace function public.cashout_bet(p_bet uuid)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  b public.bets%rowtype; l record; v_amount numeric; v_gross numeric; v_tax numeric;
begin
  select * into b from public.bets where id = p_bet and user_id = auth.uid() for update;
  if not found then raise exception 'Aposta não encontrada'; end if;
  if b.status <> 'aberta' then raise exception 'Esta aposta já não está aberta'; end if;
  if b.type <> 'simples' then raise exception 'Cash-out disponível apenas em apostas simples'; end if;

  select l2.odds_at_placement, s.odds cur_odds, s.result, m.status m_status, m.pool_type, e.status e_status, e.closes_at
    into l
    from public.bet_legs l2
    join public.selections s on s.id = l2.selection_id
    join public.markets m on m.id = l2.market_id
    join public.events e on e.id = l2.event_id
   where l2.bet_id = p_bet;

  if l.pool_type <> 'fixa' or l.odds_at_placement is null then raise exception 'Cash-out indisponível em apostas mútuas'; end if;
  if l.m_status <> 'aberto' or l.result <> 'pendente' or l.e_status not in ('agendado', 'ao_vivo')
     or (l.closes_at is not null and l.closes_at <= now()) then
    raise exception 'Cash-out indisponível: mercado suspenso ou fechado';
  end if;
  if l.cur_odds is null or l.cur_odds < 1.01 then raise exception 'Cash-out indisponível de momento'; end if;

  v_gross := round(least(b.stake * l.odds_at_placement / l.cur_odds * 0.9, b.stake * l.odds_at_placement * 0.95), 2);
  v_tax := round(v_gross * b.tax_percent / 100, 2);
  v_amount := v_gross - v_tax;
  if v_amount < 0.01 then raise exception 'Valor de cash-out demasiado baixo'; end if;

  update public.bets set status = 'cashout', payout = v_amount, tax_amount = v_tax, settled_at = now() where id = p_bet;
  update public.bet_legs set result = 'anulada' where bet_id = p_bet;
  perform public._credit(
    b.user_id, v_amount, 'cashout',
    'Cash-out bruto ' || to_char(v_gross, 'FM9999999990D00')
      || ' — retenção ' || to_char(v_tax, 'FM9999999990D00'),
    p_bet
  );
  return v_amount;
end $$;
