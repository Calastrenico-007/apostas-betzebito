-- =====================================================================
--  Betzebi — Esquema base (Supabase / Postgres 15)
--  ATENÇÃO: script destrutivo. Só executar uma vez num projeto Supabase
--  vazio; a secção de limpeza abaixo elimina as tabelas e dados existentes.
--  Não inclui partidas, odds, saldos ou outros dados de demonstração.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. LIMPEZA (permite re-executar o script)
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.activity cascade;

drop table if exists public.notifications cascade;

drop table if exists public.outbox_emails cascade;

drop table if exists public.wallet_requests cascade;

drop table if exists public.transactions cascade;

drop table if exists public.bet_legs cascade;

drop table if exists public.builder_selection_parts cascade;

drop table if exists public.bets cascade;

drop table if exists public.selections cascade;

drop table if exists public.markets cascade;

drop table if exists public.events cascade;

drop table if exists public.profiles cascade;

drop table if exists public.operator_credit_pool cascade;

drop table if exists public.bet_settings cascade;

drop function if exists public.get_bet_rules () cascade;

drop function if exists public.admin_set_bet_rules (numeric, int, numeric) cascade;

drop function if exists public.handle_new_user () cascade;

drop function if exists public.is_admin () cascade;

drop function if exists public.generate_football_markets () cascade;

drop function if exists public.request_build_bet(uuid, uuid[]) cascade;

drop function if exists public.remove_builder_combinations_for_source() cascade;

drop function if exists public.place_bet(uuid[], numeric, numeric[]) cascade;

drop function if exists public.place_bet(uuid[], numeric, numeric[], numeric, int, numeric) cascade;

drop function if exists public.place_bet(uuid[], numeric) cascade;

drop function if exists public._try_settle_bet (uuid) cascade;

drop function if exists public._settle_market(uuid, uuid[]) cascade;

drop function if exists public._void_market (uuid) cascade;

drop function if exists public._credit (
    uuid,
    numeric,
    text,
    text,
    uuid
) cascade;

drop function if exists public.settle_football (uuid, int, int, int, int) cascade;

drop function if exists public.settle_football (uuid, int, int, int, int, int) cascade;

drop function if exists public.settle_special (uuid, uuid) cascade;

drop function if exists public.void_event (uuid) cascade;

drop function if exists public.cashout_bet (uuid) cascade;

drop function if exists public.process_wallet_request (
    uuid,
    public.wallet_request_status
) cascade;

drop function if exists public.admin_adjust_balance (uuid, numeric, text) cascade;

drop function if exists public.admin_set_operator_credit_pool (numeric) cascade;

drop function if exists public.create_special_event(text, text, text, timestamptz, text[], numeric[], text) cascade;

drop function if exists public.approve_event (uuid) cascade;

drop function if exists public.reject_event (uuid) cascade;

drop function if exists public.get_leaderboard (text, int) cascade;

drop function if exists public.set_odds (uuid, text, text, numeric) cascade;

drop type if exists public.user_role cascade;

drop type if exists public.event_kind cascade;

drop type if exists public.event_status cascade;

drop type if exists public.market_status cascade;

drop type if exists public.pool_type cascade;

drop type if exists public.selection_result cascade;

drop type if exists public.bet_status cascade;

drop type if exists public.bet_type cascade;

drop type if exists public.wallet_request_type cascade;

drop type if exists public.wallet_request_status cascade;

-- ---------------------------------------------------------------------
-- 1. TIPOS
-- ---------------------------------------------------------------------
create type public.user_role as enum ('user', 'admin');

create type public.event_kind as enum ('futebol', 'especial');
-- futebol: agendado -> ao_vivo -> terminado | cancelado
-- especial: pendente -> ao_vivo (Aberto) -> fechado -> terminado (Resolvido) | cancelado (Anulado) | rejeitado
create type public.event_status as enum ('pendente', 'agendado', 'ao_vivo', 'fechado', 'terminado', 'cancelado', 'rejeitado');

create type public.market_status as enum ('aberto', 'suspenso', 'resolvido', 'anulado');

create type public.pool_type as enum ('fixa', 'mutua');

create type public.selection_result as enum ('pendente', 'ganha', 'perdida', 'anulada');

create type public.bet_status as enum ('aberta', 'ganha', 'perdida', 'anulada', 'cashout');

create type public.bet_type as enum ('simples', 'multipla');

-- ---------------------------------------------------------------------
-- 2. TABELAS
-- ---------------------------------------------------------------------
create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text,
    username text not null default 'jogador',
    balance numeric(14, 2) not null default 0 check (balance >= 0),
    role public.user_role not null default 'user',
    account_status text not null default 'pendente' check (
        account_status in ('pendente', 'aprovado', 'rejeitado')
    ),
    -- Legacy fields retained to avoid dropping user-submitted data; not used for authorization.
    kyc_status text not null default 'pending' check (
        kyc_status in (
            'pending',
            'approved',
            'rejected'
        )
    ),
    kyc_note text,
    created_at timestamptz not null default now()
);

-- reservar fundos para pedidos de levantamento
alter table public.profiles
add column if not exists reserved_balance numeric(14, 2) not null default 0 check (reserved_balance >= 0);

create table public.bet_settings (
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

create table public.events (
    id uuid primary key default gen_random_uuid (),
    kind public.event_kind not null,
    title text not null, -- futebol: "Casa vs Fora"; especial: a pergunta
    description text,
    category text not null default 'Futebol',
    league text,
    home_team text,
    away_team text,
    starts_at timestamptz, -- pontapé de saída (futebol)
    closes_at timestamptz, -- fecho das apostas (opcional)
    status public.event_status not null default 'agendado',
    home_score int,
    away_score int,
    ht_home_score int,
    ht_away_score int,
    total_cards int check (
        total_cards is null
        or total_cards >= 0
    ),
    minute text, -- ex.: "67'" (opcional, para jogos ao vivo)
    proposed_by uuid references public.profiles (id) on delete set null,
    winning_selection_id uuid,
    featured boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint football_teams check (
        kind <> 'futebol'
        or (
            home_team is not null
            and away_team is not null
        )
    )
);

create index events_status_idx on public.events (status);

create index events_kind_idx on public.events (kind);

create table public.markets (
    id uuid primary key default gen_random_uuid (),
    event_id uuid not null references public.events (id) on delete cascade,
    key text not null, -- 1x2, dc, ou15, ou25, ou35, btts, ht1x2, custom
    name text not null,
    line numeric(5, 1), -- 1.5 / 2.5 / 3.5 para mais/menos
    pool_type public.pool_type not null default 'fixa',
    commission numeric(4, 3) not null default 0.05 check (
        commission >= 0
        and commission < 1
    ), -- só apostas mútuas
    status public.market_status not null default 'aberto',
    sort int not null default 0,
    created_at timestamptz not null default now(),
    unique (event_id, key)
);

create index markets_event_idx on public.markets (event_id);

create table public.selections (
    id uuid primary key default gen_random_uuid (),
    market_id uuid not null references public.markets (id) on delete cascade,
    key text not null, -- 1, X, 2, 1X, X2, 12, mais, menos, sim, nao, opt1...
    label text not null,
    odds numeric(8, 2) check (
        odds is null
        or odds >= 1.01
    ),
    pool numeric(14, 2) not null default 0, -- total apostado (apostas mútuas)
    result public.selection_result not null default 'pendente',
    sort int not null default 0,
    updated_at timestamptz not null default now(),
    unique (market_id, key)
);

create index selections_market_idx on public.selections (market_id);

create table public.builder_selection_parts (
    builder_selection_id uuid not null references public.selections (id) on delete cascade,
    source_selection_id uuid not null references public.selections (id) on delete restrict,
    primary key (builder_selection_id, source_selection_id),
    check (builder_selection_id <> source_selection_id)
);

create index builder_selection_parts_source_idx on public.builder_selection_parts (source_selection_id);
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

create trigger selections_remove_build_combinations
  before delete on public.selections
  for each row execute function public.remove_builder_combinations_for_source();

create table public.bets (
    id uuid primary key default gen_random_uuid (),
    user_id uuid not null references public.profiles (id) on delete cascade,
    type public.bet_type not null,
    stake numeric(14, 2) not null check (stake > 0),
    total_odds numeric(14, 4), -- null para apostas mútuas
    potential_return numeric(14, 2), -- null para apostas mútuas (variável)
    tax_percent numeric(5, 2) not null default 0 check (tax_percent between 0 and 100),
    bonus_percent numeric(5, 2) not null default 0 check (bonus_percent between 0 and 100),
    tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0),
    status public.bet_status not null default 'aberta',
    payout numeric(14, 2) not null default 0,
    created_at timestamptz not null default now(),
    settled_at timestamptz
);

create index bets_user_idx on public.bets (user_id, created_at desc);

create index bets_status_idx on public.bets (status);

create table public.bet_legs (
    id uuid primary key default gen_random_uuid (),
    bet_id uuid not null references public.bets (id) on delete cascade,
    selection_id uuid not null references public.selections (id) on delete restrict,
    market_id uuid not null references public.markets (id) on delete restrict,
    event_id uuid not null references public.events (id) on delete restrict,
    odds_at_placement numeric(8, 2), -- odd bloqueada no momento da aposta (null = mútua)
    result public.selection_result not null default 'pendente'
);

create index bet_legs_bet_idx on public.bet_legs (bet_id);

create index bet_legs_sel_idx on public.bet_legs (selection_id);

create table public.transactions (
    id uuid primary key default gen_random_uuid (),
    user_id uuid not null references public.profiles (id) on delete cascade,
    amount numeric(14, 2) not null,
    balance_after numeric(14, 2) not null,
    type text not null, -- aposta, ganho, reembolso, cashout, ajuste_admin, depósito, levantamento
    description text,
    bet_id uuid references public.bets (id) on delete set null,
    created_at timestamptz not null default now()
);

create index transactions_user_idx on public.transactions (user_id, created_at desc);

create type public.wallet_request_type as enum ('deposito', 'levantamento');

create type public.wallet_request_status as enum ('pendente', 'aprovado', 'rejeitado', 'cancelado');

create table public.wallet_requests (
    id uuid primary key default gen_random_uuid (),
    user_id uuid not null references public.profiles (id) on delete cascade,
    type public.wallet_request_type not null,
    amount numeric(14, 2) not null check (amount > 0),
    payment_method text not null default 'manual',
    account_holder_name text not null check (
        length(btrim(account_holder_name)) between 2 and 120
    ),
    reference text,
    status public.wallet_request_status not null default 'pendente',
    notes text,
    processed_by uuid references public.profiles (id) on delete set null,
    processed_at timestamptz,
    created_at timestamptz not null default now()
);

create index wallet_requests_user_idx on public.wallet_requests (user_id, created_at desc);

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
    select coalesce(sum(amount),0) into v_pending from public.wallet_requests where user_id = new.user_id and status = 'pendente' and type = 'levantamento';
    if v_balance - v_pending < new.amount then
      raise exception 'Saldo insuficiente considerando pedidos pendentes';
    end if;
  end if;
  return new;
end $$;

create trigger wallet_requests_before_insert before insert on public.wallet_requests
  for each row execute function public.wallet_request_before_insert();

create or replace function public.wallet_request_after_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.type = 'levantamento' then
    update public.profiles set reserved_balance = reserved_balance + new.amount where id = new.user_id;
  end if;
  return new;
end $$;

create trigger wallet_requests_after_insert after insert on public.wallet_requests
  for each row execute function public.wallet_request_after_insert();

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
      -- como já reservámos no momento do pedido, apenas verificamos e cobrimos
      if v_profile.balance < r.amount then
        raise exception 'Saldo insuficiente para este levantamento';
      end if;
      perform public._credit(r.user_id, -r.amount, 'levantamento', 'Levantamento aprovado', null);
      update public.profiles set reserved_balance = greatest(reserved_balance - r.amount, 0) where id = r.user_id;
      insert into public.activity(message, amount)
      values ('Levantamento aprovado: ' || v_profile.username, r.amount);
    end if;
  elsif p_status in ('rejeitado', 'cancelado') then
    -- libertar reservas se for um levantamento rejeitado/cancelado
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
  -- notify user and enqueue email
  perform pg_notify('wallet_request_events', json_build_object('request_id', r.id, 'user_id', r.user_id, 'status', p_status)::text);

  insert into public.notifications(user_id, kind, payload)
    values (r.user_id, 'wallet_request_update', json_build_object('request_id', r.id, 'status', p_status, 'type', r.type, 'amount', r.amount));

  -- enqueue an email for processing by an external worker (if profile has email)
  insert into public.outbox_emails(to_email, subject, body)
    select p.email,
           'Atualização do seu pedido de carteira',
           ('O seu pedido de ' || r.type || ' de ' || r.amount::text || ' foi ' || p_status || '.')
    from public.profiles p where p.id = r.user_id and p.email is not null;

  return p_status::text;
end $$;

-- feed público (telão): ganhos e novidades, sem dados privados
create table public.activity (
    id bigint generated always as identity primary key,
    message text not null,
    amount numeric(14, 2),
    created_at timestamptz not null default now()
);

-- notifications table: toasts in-app
create table public.notifications (
    id uuid primary key default gen_random_uuid (),
    user_id uuid not null references public.profiles (id) on delete cascade,
    kind text not null,
    payload jsonb,
    seen boolean not null default false,
    created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- outbox for emails (worker will process)
create table public.outbox_emails (
    id uuid primary key default gen_random_uuid (),
    to_email text,
    subject text not null,
    body text not null,
    sent boolean not null default false,
    attempts int not null default 0,
    last_error text,
    created_at timestamptz not null default now(),
    sent_at timestamptz
);

create index outbox_pending_idx on public.outbox_emails (sent, created_at desc);

-- ---------------------------------------------------------------------
-- 3. FUNÇÕES AUXILIARES
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

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

-- crédito/débito atómico + registo de transação (uso interno)
create or replace function public._credit(p_user uuid, p_amount numeric, p_type text, p_desc text, p_bet uuid)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare v_bal numeric;
begin
  update public.profiles set balance = balance + p_amount
   where id = p_user
   returning balance into v_bal;
  if v_bal is null then raise exception 'Utilizador não encontrado'; end if;
  insert into public.transactions(user_id, amount, balance_after, type, description, bet_id)
  values (p_user, p_amount, v_bal, p_type, p_desc, p_bet);
  return v_bal;
end $$;

-- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

create trigger selections_touch before update on public.selections
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. NOVO UTILIZADOR -> PERFIL OPERACIONAL
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_name text;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1), 'jogador');
  insert into public.profiles(id, email, username, balance)
  values (new.id, new.email, left(v_name, 24), 0);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

create trigger events_require_approved_proposer
  before insert on public.events
  for each row execute function public.events_require_approved_proposer();

revoke execute on function public.bets_require_approved_account() from public, anon, authenticated;
revoke execute on function public.events_require_approved_proposer() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. MERCADOS DE FUTEBOL AUTOMÁTICOS
-- ---------------------------------------------------------------------
create or replace function public.create_extra_football_markets(
    p_event uuid,
    p_home_team text,
    p_away_team text
)
returns void
language plpgsql security definer set search_path = public
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
  select id, status into v_market, v_market_status from public.markets where event_id = p_event and key = 'builder';
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
language plpgsql security definer set search_path = public
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

create trigger events_generate_markets
  after insert on public.events
  for each row when (new.kind = 'futebol')
  execute function public.generate_football_markets();

-- ajuda: definir odd por chave (útil no SQL Editor e no seed)
create or replace function public.set_odds(p_event uuid, p_market_key text, p_sel_key text, p_odds numeric)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Apenas administradores'; end if;
  update public.selections s set odds = p_odds
    from public.markets m
   where s.market_id = m.id and m.event_id = p_event and m.key = p_market_key and s.key = p_sel_key;
end $$;

-- ---------------------------------------------------------------------
-- 6. COLOCAR APOSTA (atómico)
--    selections: 1 elemento = simples; >1 = múltipla
--    expected_odds (opcional): rejeita se as odds mudaram entretanto
-- ---------------------------------------------------------------------
create or replace function public.place_bet(
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

  -- validar cada seleção (com bloqueio para snapshot consistente)
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

-- ---------------------------------------------------------------------
-- 7. LIQUIDAÇÃO
-- ---------------------------------------------------------------------
-- tenta resolver uma aposta (odd fixa) quando todas as pernas estão resolvidas
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

-- anula um mercado (todas as seleções anuladas, apostas reembolsadas / pernas a odd 1)
create or replace function public._void_market(p_market uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  update public.markets set status = 'anulado' where id = p_market and status <> 'resolvido';
  update public.selections set result = 'anulada' where market_id = p_market and result = 'pendente';
  update public.bet_legs set result = 'anulada' where market_id = p_market and result = 'pendente';
  for r in select distinct bet_id from public.bet_legs where market_id = p_market loop
    perform public._try_settle_bet(r.bet_id);
  end loop;
end $$;

-- resolve um mercado com a(s) seleção(ões) vencedora(s)
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
    -- apostas mútuas: o bolo total (menos comissão) é dividido pelos vencedores
    select coalesce(sum(pool), 0) into v_total_pool from public.selections where market_id = p_market;
    select coalesce(sum(pool), 0) into v_win_pool from public.selections where market_id = p_market and id = any(p_winners);
    if v_win_pool = 0 then
      -- ninguém acertou: reembolsar todos
      update public.selections set result = 'anulada' where market_id = p_market;
      update public.markets set status = 'anulado' where id = p_market;
      update public.bet_legs set result = 'anulada' where market_id = p_market and result = 'pendente';
      for r in select distinct bet_id from public.bet_legs where market_id = p_market loop
        perform public._try_settle_bet(r.bet_id);
      end loop;
      return;
    end if;
    v_factor := v_total_pool * (1 - m.commission) / v_win_pool;
    if v_factor < 1 then v_factor := 1; end if;  -- nunca pagar menos que a aposta a um vencedor
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

-- resultado de futebol -> liquida todos os mercados padrão
create or replace function public.settle_football(
  p_event uuid,
  p_home int,
  p_away int,
  p_ht_home int default null,
  p_ht_away int default null,
  p_total_cards int default null
)
returns void
language plpgsql security definer set search_path = public
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

  update public.events set status = 'terminado', home_score = p_home, away_score = p_away,
         ht_home_score = p_ht_home, ht_away_score = p_ht_away, total_cards = p_total_cards where id = p_event;
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
        perform public._void_market(m.id);   -- sem dados (ex.: intervalo não indicado) ou mercado personalizado
      else
        select coalesce(array_agg(id), array[]::uuid[]) into v_ids from public.selections where market_id = m.id and key = any(v_win);
        perform public._settle_market(m.id, v_ids);
      end if;
    end if;
  end loop;
end $$;

-- evento especial: escolher opção vencedora
create or replace function public.settle_special(p_event uuid, p_winner uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare e public.events%rowtype; v_market uuid;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  select * into e from public.events where id = p_event for update;
  if not found then raise exception 'Evento não encontrado'; end if;
  if e.status in ('terminado', 'cancelado', 'rejeitado', 'pendente') then raise exception 'Este evento não pode ser resolvido no estado atual'; end if;
  select s.market_id into v_market from public.selections s join public.markets m on m.id = s.market_id
   where s.id = p_winner and m.event_id = p_event;
  if v_market is null then raise exception 'Opção inválida para este evento'; end if;

  update public.events set status = 'terminado', winning_selection_id = p_winner where id = p_event;
  perform public._settle_market(v_market, array[p_winner]);
  -- outros mercados do evento (se existirem) são anulados
  perform public._void_market(id) from public.markets where event_id = p_event and id <> v_market and status not in ('resolvido', 'anulado');
end $$;

-- anular evento (jogo ou especial): reembolsa simples; em múltiplas a perna conta como odd 1
create or replace function public.void_event(p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if not exists (select 1 from public.events where id = p_event) then raise exception 'Evento não encontrado'; end if;
  update public.events set status = 'cancelado' where id = p_event;
  for r in select id from public.markets where event_id = p_event and status not in ('resolvido', 'anulado') loop
    perform public._void_market(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. CASH-OUT (simples, odd fixa, mercado aberto)
--    valor = stake * odd_colocação / odd_atual * 0.9, limitado a 95% do retorno potencial
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 9. AJUSTE OPERACIONAL DE SALDO
-- ---------------------------------------------------------------------
create or replace function public.admin_adjust_balance(p_user uuid, p_amount numeric, p_reason text default null)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  v_bal numeric;
  v_amount numeric;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Valor inválido'; end if;
  v_amount := round(p_amount, 2);
  if v_amount = 0 then raise exception 'Valor inválido'; end if;
  select balance into v_bal from public.profiles where id = p_user for update;
  if v_bal is null then raise exception 'Utilizador não encontrado'; end if;
  if v_bal + v_amount < 0 then raise exception 'O saldo não pode ficar negativo'; end if;

  return public._credit(p_user, v_amount, 'ajuste_admin', coalesce(nullif(trim(p_reason), ''), 'Ajuste do administrador'), null);
end $$;

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

-- ---------------------------------------------------------------------
-- 10. EVENTOS ESPECIAIS / PROPOSTAS
-- ---------------------------------------------------------------------
-- admin: cria já aberto. utilizador: fica 'pendente' até aprovação.
create or replace function public.create_special_event(
  p_title text, p_description text, p_category text, p_closes_at timestamptz,
  p_options text[], p_odds numeric[] default null, p_pool_type text default 'fixa')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); v_admin boolean := public.is_admin();
  v_event uuid; v_market uuid; v_n int; v_pool public.pool_type; v_opt text; i int := 0; v_odd numeric;
begin
  if v_uid is null then raise exception 'Precisas de iniciar sessão'; end if;
  if p_title is null or length(trim(p_title)) < 5 then raise exception 'A pergunta é demasiado curta'; end if;
  if length(p_title) > 140 then raise exception 'A pergunta é demasiado longa (máx. 140)'; end if;
  v_n := coalesce(array_length(p_options, 1), 0);
  if v_n < 2 or v_n > 10 then raise exception 'Indica entre 2 e 10 opções'; end if;
  if p_closes_at is not null and p_closes_at <= now() then raise exception 'A hora de fecho tem de ser no futuro'; end if;
  v_pool := case when p_pool_type = 'mutua' then 'mutua'::public.pool_type else 'fixa'::public.pool_type end;
  if not v_admin and (select count(*) from public.events where proposed_by = v_uid and status = 'pendente') >= 5 then
    raise exception 'Já tens 5 propostas à espera de aprovação';
  end if;

  insert into public.events(kind, title, description, category, closes_at, status, proposed_by)
  values ('especial', trim(p_title), nullif(trim(coalesce(p_description, '')), ''),
          coalesce(nullif(trim(p_category), ''), 'Geral'), p_closes_at,
          case when v_admin then 'ao_vivo'::public.event_status else 'pendente'::public.event_status end,
          case when v_admin then null else v_uid end)
  returning id into v_event;

  insert into public.markets(event_id, key, name, pool_type, sort)
  values (v_event, 'custom', trim(p_title), v_pool, 1) returning id into v_market;

  foreach v_opt in array p_options loop
    i := i + 1;
    if v_opt is null or length(trim(v_opt)) = 0 then raise exception 'Opção % vazia', i; end if;
    v_odd := null;
    if v_pool = 'fixa' and p_odds is not null and array_length(p_odds, 1) >= i then v_odd := p_odds[i]; end if;
    if v_odd is not null and v_odd < 1.01 then raise exception 'Odd inválida na opção %', i; end if;
    insert into public.selections(market_id, key, label, odds, sort)
    values (v_market, 'opt' || i, left(trim(v_opt), 60), v_odd, i);
  end loop;

  if v_admin and v_pool = 'fixa' and exists (select 1 from public.selections where market_id = v_market and odds is null) then
    raise exception 'Define a odd de todas as opções (ou usa apostas mútuas)';
  end if;
  return v_event;
end $$;

create or replace function public.approve_event(p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if not exists (select 1 from public.events where id = p_event and status = 'pendente') then
    raise exception 'O evento não está pendente';
  end if;
  if exists (select 1 from public.selections s join public.markets m on m.id = s.market_id
              where m.event_id = p_event and m.pool_type = 'fixa' and s.odds is null) then
    raise exception 'Define as odds de todas as opções antes de aprovar (ou muda para apostas mútuas)';
  end if;
  if (select count(*) from public.selections s join public.markets m on m.id = s.market_id where m.event_id = p_event) < 2 then
    raise exception 'O evento precisa de pelo menos 2 opções';
  end if;
  update public.events set status = 'ao_vivo' where id = p_event;
  insert into public.activity(message) select 'Novo evento: ' || title from public.events where id = p_event;
end $$;

create or replace function public.reject_event(p_event uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  update public.events set status = 'rejeitado' where id = p_event and status = 'pendente';
  if not found then raise exception 'O evento não está pendente'; end if;
end $$;

-- ---------------------------------------------------------------------
-- 11. RANKING
-- ---------------------------------------------------------------------
create or replace function public.get_leaderboard(p_order text default 'balance', p_limit int default 50)
returns table(user_id uuid, username text, balance numeric, profit numeric, bets_count bigint, won_count bigint)
language sql stable security definer set search_path = public
as $$
  select p.id, p.username, p.balance,
         coalesce(sum(b.payout - b.stake) filter (where b.status <> 'aberta'), 0)::numeric as profit,
         count(b.id) as bets_count,
         count(b.id) filter (where b.status in ('ganha', 'cashout')) as won_count
    from public.profiles p
    left join public.bets b on b.user_id = p.id
   where p.role = 'user'
   group by p.id
   order by case when p_order = 'profit' then coalesce(sum(b.payout - b.stake) filter (where b.status <> 'aberta'), 0) else p.balance end desc,
            p.created_at asc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- ---------------------------------------------------------------------
-- 12. PERMISSÕES DE FUNÇÕES
-- ---------------------------------------------------------------------
revoke
execute on function public._credit (
    uuid,
    numeric,
    text,
    text,
    uuid
)
from public, anon, authenticated;

revoke
execute on function public._try_settle_bet (uuid)
from public, anon, authenticated;

revoke execute on function public._settle_market(uuid, uuid[]) from public, anon, authenticated;

revoke
execute on function public._void_market (uuid)
from public, anon, authenticated;

revoke
execute on function public.handle_new_user ()
from public, anon, authenticated;

revoke
execute on function public.generate_football_markets ()
from public, anon, authenticated;

revoke execute on function public.place_bet(uuid[], numeric, numeric[], numeric, int, numeric) from public, anon;

grant execute on function public.place_bet(uuid[], numeric, numeric[], numeric, int, numeric) to authenticated;

revoke execute on function public.get_bet_rules() from public;

grant execute on function public.get_bet_rules() to anon, authenticated;

revoke execute on function public.admin_set_bet_rules(numeric, int, numeric) from public, anon;

grant execute on function public.admin_set_bet_rules(numeric, int, numeric) to authenticated;

revoke
execute on function public.cashout_bet (uuid)
from public, anon;

grant execute on function public.cashout_bet (uuid) to authenticated;

revoke
execute on function public.process_wallet_request (
    uuid,
    public.wallet_request_status
)
from public, anon;

grant
execute on function public.process_wallet_request (
    uuid,
    public.wallet_request_status
) to authenticated;

revoke execute on function public.create_special_event(text, text, text, timestamptz, text[], numeric[], text) from public, anon;

grant execute on function public.create_special_event(text, text, text, timestamptz, text[], numeric[], text) to authenticated;

grant
execute on function public.get_leaderboard (text, int) to anon,
authenticated;

grant execute on function public.is_admin () to anon, authenticated;

-- grants explícitos (não depender dos grants por defeito do projeto)
grant usage on schema public to anon, authenticated;

grant
select on public.events, public.markets, public.selections, public.activity to anon, authenticated;

grant
select on public.profiles, public.bets, public.bet_legs, public.transactions to authenticated;

grant
insert
,
update,
delete on public.events,
public.markets,
public.selections to authenticated;

grant
execute on function public.settle_football (uuid, int, int, int, int, int) to authenticated;

grant
execute on function public.settle_special (uuid, uuid) to authenticated;

grant execute on function public.void_event (uuid) to authenticated;

grant
execute on function public.approve_event (uuid) to authenticated;

grant
execute on function public.reject_event (uuid) to authenticated;

grant
execute on function public.admin_adjust_balance (uuid, numeric, text) to authenticated;

revoke execute on function public.admin_adjust_balance (uuid, numeric, text) from public, anon;

revoke execute on function public.admin_set_account_status(uuid, text) from public, anon;

grant execute on function public.admin_set_account_status(uuid, text) to authenticated;

grant
execute on function public.set_odds (uuid, text, text, numeric) to authenticated;

revoke execute on function public.set_odds (uuid, text, text, numeric) from public, anon;

-- ---------------------------------------------------------------------
-- 13. RLS
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

alter table public.bet_settings enable row level security;

alter table public.events enable row level security;

alter table public.markets enable row level security;

alter table public.selections enable row level security;

alter table public.bets enable row level security;

alter table public.bet_legs enable row level security;

alter table public.transactions enable row level security;

alter table public.wallet_requests enable row level security;

alter table public.activity enable row level security;

-- perfis: cada um vê o seu; admin vê todos. Saldo/role só mudam por funções.
create policy profiles_select on public.profiles for
select using (
        id = auth.uid ()
        or public.is_admin ()
    );

revoke all on public.bet_settings from anon, authenticated;

create policy profiles_update_own on public.profiles for
update using (id = auth.uid ())
with
    check (id = auth.uid ());

create policy profiles_admin_update on public.profiles for
update using (public.is_admin ())
with
    check (public.is_admin ());

revoke update on public.profiles from anon, authenticated;

grant
update (
    username
) on public.profiles to authenticated;

revoke insert , delete on public.profiles from anon, authenticated;

create policy wallet_requests_select on public.wallet_requests for
select using (
        user_id = auth.uid ()
        or public.is_admin ()
    );

create policy wallet_requests_insert on public.wallet_requests for
insert
with
    check (
        user_id = auth.uid ()
        and status = 'pendente'
        and amount > 0
    );

create policy wallet_requests_update_own on public.wallet_requests for
update using (
    user_id = auth.uid ()
    and status = 'pendente'
)
with
    check (
        user_id = auth.uid ()
        and status = 'pendente'
    );

create policy wallet_requests_admin_update on public.wallet_requests for
update using (public.is_admin ())
with
    check (public.is_admin ());

revoke
insert
,
update,
delete on public.wallet_requests
from anon, authenticated;

grant select on public.wallet_requests to authenticated;

grant insert on public.wallet_requests to authenticated;

grant update on public.wallet_requests to authenticated;

-- eventos: públicos (exceto pendentes/rejeitados, visíveis ao autor e admin)
create policy events_select on public.events for
select using (
        status not in('pendente', 'rejeitado')
        or proposed_by = auth.uid ()
        or public.is_admin ()
    );

create policy events_admin_insert on public.events for
insert
with
    check (public.is_admin ());

create policy events_admin_update on public.events for
update using (public.is_admin ())
with
    check (public.is_admin ());

create policy events_admin_delete on public.events for delete using (public.is_admin ());

create policy markets_select on public.markets for
select using (true);

create policy markets_admin_insert on public.markets for
insert
with
    check (public.is_admin ());

create policy markets_admin_update on public.markets for
update using (public.is_admin ())
with
    check (public.is_admin ());

create policy markets_admin_delete on public.markets for delete using (public.is_admin ());

create policy selections_select on public.selections for
select using (true);

create policy selections_admin_insert on public.selections for
insert
with
    check (public.is_admin ());

create policy selections_admin_update on public.selections for
update using (public.is_admin ())
with
    check (public.is_admin ());

create policy selections_admin_delete on public.selections for delete using (public.is_admin ());

-- apostas: só o próprio (e admin). Escrita apenas via funções.
create policy bets_select on public.bets for
select using (
        user_id = auth.uid ()
        or public.is_admin ()
    );

create policy bet_legs_select on public.bet_legs for
select using (
        exists (
            select 1
            from public.bets b
            where
                b.id = bet_id
                and (
                    b.user_id = auth.uid ()
                    or public.is_admin ()
                )
        )
    );

create policy transactions_select on public.transactions for
select using (
        user_id = auth.uid ()
        or public.is_admin ()
    );

create policy activity_select on public.activity for
select using (true);

revoke
insert
,
update,
delete on public.bets,
public.bet_legs,
public.transactions,
public.activity
from anon, authenticated;

-- ---------------------------------------------------------------------
-- 14. REALTIME
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['events', 'markets', 'selections', 'profiles', 'bets', 'activity'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- perfis para contas que já existiam antes de (re)executar este script
insert into public.profiles(id, email, username, balance)
select u.id, u.email, left(coalesce(nullif(trim(u.raw_user_meta_data->>'username'), ''), split_part(u.email, '@', 1), 'jogador'), 24), 0
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

-- =====================================================================
-- PRIMEIRO ADMINISTRADOR (depois de criares a tua conta na app):
--   update public.profiles set role = 'admin' where email = 'o-teu-email@exemplo.com';
-- =====================================================================