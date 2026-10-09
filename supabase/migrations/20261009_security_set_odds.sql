begin;

create or replace function public.set_odds(p_event uuid, p_market_key text, p_sel_key text, p_odds numeric)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  update public.selections s
     set odds = p_odds
    from public.markets m
   where s.market_id = m.id
     and m.event_id = p_event
     and m.key = p_market_key
     and s.key = p_sel_key;
end $$;

revoke execute on function public.set_odds(uuid, text, text, numeric) from public, anon;
grant execute on function public.set_odds(uuid, text, text, numeric) to authenticated;

commit;
