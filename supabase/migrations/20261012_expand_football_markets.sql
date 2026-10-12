alter table public.events
  add column if not exists total_cards integer check (total_cards is null or total_cards >= 0);

create table if not exists public.builder_selection_parts (
  builder_selection_id uuid not null references public.selections (id) on delete cascade,
  source_selection_id uuid not null references public.selections (id) on delete restrict,
  primary key (builder_selection_id, source_selection_id),
  check (builder_selection_id <> source_selection_id)
);

create index if not exists builder_selection_parts_source_idx
  on public.builder_selection_parts (source_selection_id);

alter table public.builder_selection_parts enable row level security;
revoke all on public.builder_selection_parts from public, anon, authenticated;

create or replace function public.remove_builder_combinations_for_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.markets where id = old.market_id and key = 'builder') then
    return old;
  end if;

  delete from public.selections builder
   using public.builder_selection_parts parts
   where builder.id = parts.builder_selection_id
     and parts.source_selection_id = old.id;
  return old;
end $$;

revoke execute on function public.remove_builder_combinations_for_source() from public, anon, authenticated;

drop trigger if exists selections_remove_build_combinations on public.selections;
create trigger selections_remove_build_combinations
  before delete on public.selections
  for each row execute function public.remove_builder_combinations_for_source();

create or replace function public.create_extra_football_markets(
  p_event uuid,
  p_home_team text,
  p_away_team text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m uuid;
  v_line numeric;
  v_handicap int;
  v_key text;
begin
  foreach v_line in array array[0.5, 4.5]::numeric[] loop
    v_key := 'ou' || replace(v_line::text, '.', '');
    m := null;
    insert into public.markets(event_id, key, name, line, sort)
    values (p_event, v_key, 'Mais/Menos ' || replace(v_line::text, '.', ',') || ' golos', v_line, case when v_line < 1 then 8 else 9 end)
    on conflict (event_id, key) do nothing returning id into m;
    if m is not null then
      insert into public.selections(market_id, key, label, sort) values
        (m, 'mais', 'Mais de ' || replace(v_line::text, '.', ','), 1),
        (m, 'menos', 'Menos de ' || replace(v_line::text, '.', ','), 2);
    end if;
  end loop;

  m := null;
  insert into public.markets(event_id, key, name, sort)
  values (p_event, 'goals_exact', 'Golos Exatos', 10)
  on conflict (event_id, key) do nothing returning id into m;
  if m is not null then
    insert into public.selections(market_id, key, label, sort) values
      (m, '0', '0 golos', 1),
      (m, '1', '1 golo', 2),
      (m, '2', '2 golos', 3),
      (m, '3', '3 golos', 4),
      (m, '4+', '4 ou mais golos', 5);
  end if;

  foreach v_line in array array[3.5, 4.5, 5.5]::numeric[] loop
    v_key := 'cards_total_' || replace(v_line::text, '.', '');
    m := null;
    insert into public.markets(event_id, key, name, line, sort)
    values (p_event, v_key, 'Total de Cartões — ' || replace(v_line::text, '.', ','), v_line,
      case v_line when 3.5 then 12 when 4.5 then 13 else 14 end)
    on conflict (event_id, key) do nothing returning id into m;
    if m is not null then
      insert into public.selections(market_id, key, label, sort) values
        (m, 'mais', 'Mais de ' || replace(v_line::text, '.', ','), 1),
        (m, 'menos', 'Menos de ' || replace(v_line::text, '.', ','), 2);
    end if;
  end loop;

  m := null;
  insert into public.markets(event_id, key, name, sort)
  values (p_event, 'dnb', 'Empate Anula Aposta', 11)
  on conflict (event_id, key) do nothing returning id into m;
  if m is not null then
    insert into public.selections(market_id, key, label, sort) values
      (m, '1', p_home_team, 1),
      (m, '2', p_away_team, 2);
  end if;

  foreach v_handicap in array array[1, -1, 2, -2] loop
    v_key := 'hcp_' || case when v_handicap > 0 then 'plus_' else 'minus_' end || abs(v_handicap)::text;
    m := null;
    insert into public.markets(event_id, key, name, line, sort)
    values (
      p_event,
      v_key,
      'Handicap Casa ' || case when v_handicap > 0 then '+' else '' end || v_handicap::text,
      v_handicap,
      case v_handicap when 1 then 15 when -1 then 16 when 2 then 17 else 18 end
    )
    on conflict (event_id, key) do nothing returning id into m;
    if m is not null then
      insert into public.selections(market_id, key, label, sort) values
        (m, '1', p_home_team, 1),
        (m, 'X', 'Empate', 2),
        (m, '2', p_away_team, 3);
    end if;
  end loop;
end $$;

revoke execute on function public.create_extra_football_markets(uuid, text, text) from public, anon, authenticated;

create or replace function public.request_build_bet(
  p_event uuid,
  p_selections uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  e public.events%rowtype;
  v_sorted_ids uuid[];
  v_market uuid;
  v_selection uuid;
  v_market_status public.market_status;
  v_key text;
  v_label text := '';
  v_count int;
  r record;
begin
  if v_uid is null then raise exception 'Precisas de iniciar sessão'; end if;
  perform public._require_approved_account(v_uid);
  if p_selections is null or cardinality(p_selections) < 2 or cardinality(p_selections) > 6 then
    raise exception 'O Build-a-Bet precisa de 2 a 6 seleções';
  end if;
  if exists (select 1 from unnest(p_selections) as x(selection_id) where selection_id is null) then
    raise exception 'Seleção inválida';
  end if;
  if (select count(distinct x.selection_id) from unnest(p_selections) as x(selection_id)) <> cardinality(p_selections) then
    raise exception 'Seleções repetidas';
  end if;

  select * into e from public.events where id = p_event for share;
  if not found or e.kind <> 'futebol' then raise exception 'Jogo de futebol não encontrado'; end if;
  if e.status not in ('agendado', 'ao_vivo')
     or (e.starts_at is not null and e.starts_at <= now())
     or (e.closes_at is not null and e.closes_at <= now()) then
    raise exception 'As apostas para esta partida estão encerradas';
  end if;

  select array_agg(x.selection_id order by x.selection_id)
    into v_sorted_ids
    from unnest(p_selections) as x(selection_id);

  select count(distinct m.id) into v_count
    from unnest(v_sorted_ids) as x(selection_id)
    join public.selections s on s.id = x.selection_id
    join public.markets m on m.id = s.market_id
   where m.event_id = p_event and m.key <> 'builder';
  if v_count <> cardinality(v_sorted_ids) then
    raise exception 'Escolhe no máximo uma opção por mercado desta partida';
  end if;

  for r in
    select s.id, s.label, s.odds, s.result, m.name market_name, m.status market_status, m.pool_type
      from unnest(v_sorted_ids) with ordinality as x(selection_id, ord)
      join public.selections s on s.id = x.selection_id
      join public.markets m on m.id = s.market_id
     where m.event_id = p_event
     order by x.ord
       for update of s
  loop
    if r.pool_type <> 'fixa' then raise exception 'O Build-a-Bet só aceita odds fixas'; end if;
    if r.market_status <> 'aberto' or r.result <> 'pendente' then
      raise exception 'Uma das seleções já não está disponível';
    end if;
    if r.odds is null or r.odds < 1.01 then
      raise exception 'Todas as seleções precisam de ter uma odd definida';
    end if;
    v_label := concat_ws(' + ', nullif(v_label, ''), r.market_name || ': ' || r.label);
  end loop;

  insert into public.markets(event_id, key, name, sort)
  values (p_event, 'builder', 'Build-a-Bet — cotação manual', 19)
  on conflict (event_id, key) do nothing;
  select id, status into v_market, v_market_status
    from public.markets where event_id = p_event and key = 'builder';
  if v_market_status <> 'aberto' then raise exception 'O Build-a-Bet está suspenso para esta partida'; end if;

  v_key := 'build_' || md5(array_to_string(v_sorted_ids, ','));
  if not exists (
    select 1 from public.selections where market_id = v_market and key = v_key
  ) and (select count(*) from public.selections where market_id = v_market) >= 100 then
    raise exception 'Este jogo atingiu o limite de combinações Build-a-Bet';
  end if;

  insert into public.selections(market_id, key, label, odds, sort)
  values (
    v_market,
    v_key,
    v_label,
    null,
    coalesce((select max(sort) + 1 from public.selections where market_id = v_market), 1)
  )
  on conflict (market_id, key) do nothing
  returning id into v_selection;

  if v_selection is null then
    select id into v_selection from public.selections where market_id = v_market and key = v_key;
  else
    insert into public.builder_selection_parts(builder_selection_id, source_selection_id)
    select v_selection, x.selection_id from unnest(v_sorted_ids) as x(selection_id);
  end if;

  return v_selection;
end $$;

revoke execute on function public.request_build_bet(uuid, uuid[]) from public, anon;
grant execute on function public.request_build_bet(uuid, uuid[]) to authenticated;

create or replace function public.generate_football_markets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare m uuid; v_line numeric; v_key text; i int := 0;
begin
  if new.kind <> 'futebol' then return new; end if;

  insert into public.markets(event_id, key, name, sort) values (new.id, '1x2', 'Resultado Final (1X2)', 1) returning id into m;
  insert into public.selections(market_id, key, label, sort) values
    (m, '1', new.home_team, 1), (m, 'X', 'Empate', 2), (m, '2', new.away_team, 3);

  insert into public.markets(event_id, key, name, sort) values (new.id, 'dc', 'Dupla Hipótese', 2) returning id into m;
  insert into public.selections(market_id, key, label, sort) values
    (m, '1X', new.home_team || ' ou Empate', 1), (m, 'X2', 'Empate ou ' || new.away_team, 2), (m, '12', new.home_team || ' ou ' || new.away_team, 3);

  foreach v_line in array array[1.5, 2.5, 3.5]::numeric[] loop
    i := i + 1;
    v_key := 'ou' || replace(v_line::text, '.', '');
    insert into public.markets(event_id, key, name, line, sort)
      values (new.id, v_key, 'Mais/Menos ' || replace(v_line::text, '.', ',') || ' golos', v_line, 2 + i) returning id into m;
    insert into public.selections(market_id, key, label, sort) values
      (m, 'mais', 'Mais de ' || replace(v_line::text, '.', ','), 1), (m, 'menos', 'Menos de ' || replace(v_line::text, '.', ','), 2);
  end loop;

  insert into public.markets(event_id, key, name, sort) values (new.id, 'btts', 'Ambas Marcam', 6) returning id into m;
  insert into public.selections(market_id, key, label, sort) values (m, 'sim', 'Sim', 1), (m, 'nao', 'Não', 2);

  insert into public.markets(event_id, key, name, sort) values (new.id, 'ht1x2', 'Resultado ao Intervalo (1X2)', 7) returning id into m;
  insert into public.selections(market_id, key, label, sort) values
    (m, '1', new.home_team, 1), (m, 'X', 'Empate', 2), (m, '2', new.away_team, 3);

  perform public.create_extra_football_markets(new.id, new.home_team, new.away_team);
  return new;
end $$;

do $$
declare e record;
begin
  for e in
    select id, home_team, away_team
    from public.events
    where kind = 'futebol' and status in ('agendado', 'ao_vivo', 'fechado')
  loop
    perform public.create_extra_football_markets(e.id, e.home_team, e.away_team);
  end loop;
end $$;

drop function if exists public.settle_football(uuid, integer, integer, integer, integer);

create or replace function public.settle_football(
  p_event uuid,
  p_home int,
  p_away int,
  p_ht_home int default null,
  p_ht_away int default null,
  p_total_cards int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.events%rowtype;
  m record;
  v_win text[];
  v_ids uuid[];
  v_tot int;
  v_handicap_home numeric;
  v_builder record;
  v_part_count int;
  v_won_parts int;
  v_void_parts int;
  v_bet uuid;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  select * into e from public.events where id = p_event for update;
  if not found or e.kind <> 'futebol' then raise exception 'Jogo não encontrado'; end if;
  if e.status in ('terminado', 'cancelado') then raise exception 'Este jogo já foi resolvido'; end if;
  if p_home is null or p_away is null or p_home < 0 or p_away < 0 then raise exception 'Resultado inválido'; end if;
  if (p_ht_home is null) <> (p_ht_away is null) then raise exception 'Indica os dois golos do intervalo ou nenhum'; end if;
  if p_ht_home is not null and (p_ht_home > p_home or p_ht_away > p_away or p_ht_home < 0 or p_ht_away < 0) then
    raise exception 'O resultado ao intervalo não pode ser maior que o final';
  end if;
  if p_total_cards is not null and p_total_cards < 0 then raise exception 'Total de cartões inválido'; end if;

  update public.events
  set status = 'terminado', home_score = p_home, away_score = p_away,
      ht_home_score = p_ht_home, ht_away_score = p_ht_away, total_cards = p_total_cards
  where id = p_event;
  v_tot := p_home + p_away;

  for m in
    select * from public.markets
     where event_id = p_event and status not in ('resolvido', 'anulado')
     order by case when key = 'builder' then 1 else 0 end, sort
  loop
    v_win := null;
    case
      when m.key = 'builder' then
        v_ids := array[]::uuid[];
        for v_builder in
          select id from public.selections
           where market_id = m.id and result = 'pendente'
        loop
          select count(*),
                 count(*) filter (where component.result = 'ganha'),
                 count(*) filter (where component.result = 'anulada')
            into v_part_count, v_won_parts, v_void_parts
            from public.builder_selection_parts parts
            join public.selections component on component.id = parts.source_selection_id
           where parts.builder_selection_id = v_builder.id;

          if v_part_count < 2 or v_void_parts > 0 then
            update public.selections set result = 'anulada'
             where id = v_builder.id and result = 'pendente';
            update public.bet_legs set result = 'anulada'
             where selection_id = v_builder.id and result = 'pendente';
            for v_bet in
              select distinct bet_id from public.bet_legs where selection_id = v_builder.id
            loop
              perform public._try_settle_bet(v_bet);
            end loop;
          elsif v_won_parts = v_part_count then
            v_ids := array_append(v_ids, v_builder.id);
          end if;
        end loop;
        perform public._settle_market(m.id, v_ids);
      when m.key = '1x2' then
        v_win := array[case when p_home > p_away then '1' when p_home = p_away then 'X' else '2' end];
      when m.key = 'dc' then
        v_win := array[]::text[];
        if p_home >= p_away then v_win := array_append(v_win, '1X'); end if;
        if p_away >= p_home then v_win := array_append(v_win, 'X2'); end if;
        if p_home <> p_away then v_win := array_append(v_win, '12'); end if;
      when m.key = 'btts' then
        v_win := array[case when p_home > 0 and p_away > 0 then 'sim' else 'nao' end];
      when m.key = 'ht1x2' then
        if p_ht_home is not null then
          v_win := array[case when p_ht_home > p_ht_away then '1' when p_ht_home = p_ht_away then 'X' else '2' end];
        end if;
      when m.key = 'goals_exact' then
        v_win := array[case when v_tot >= 4 then '4+' else v_tot::text end];
      when m.key = 'dnb' then
        if p_home > p_away then v_win := array['1'];
        elsif p_away > p_home then v_win := array['2'];
        end if;
      when m.key like 'cards_total_%' then
        if p_total_cards is not null then
          v_win := array[case when p_total_cards > m.line then 'mais' else 'menos' end];
        end if;
      when m.key like 'hcp_%' then
        v_handicap_home := p_home + m.line;
        v_win := array[case when v_handicap_home > p_away then '1' when v_handicap_home = p_away then 'X' else '2' end];
      else
        if m.line is not null then
          v_win := array[case when v_tot > m.line then 'mais' else 'menos' end];
        end if;
    end case;

    if m.key <> 'builder' then
      if v_win is null then
        perform public._void_market(m.id);
      else
        select coalesce(array_agg(id), array[]::uuid[]) into v_ids
        from public.selections where market_id = m.id and key = any(v_win);
        perform public._settle_market(m.id, v_ids);
      end if;
    end if;
  end loop;
end $$;

revoke execute on function public.settle_football(uuid, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.settle_football(uuid, integer, integer, integer, integer, integer) to authenticated;
