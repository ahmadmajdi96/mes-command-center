-- Pausing and resuming must persist before the station can show success.
-- The normal operation trigger records the attributed status transition.
create or replace function private.transition_station_operation(
  _operation_id uuid,
  _action text,
  _reason text,
  _category text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_label text;
  parent_id text;
  po public.production_orders%rowtype;
  op public.order_operations%rowtype;
  next_state text;
  reason text;
begin
  if actor is null then raise exception 'Sign in before changing an operation' using errcode = '42501'; end if;
  select production_order_id into parent_id from public.order_operations where id = _operation_id;
  select * into po from public.production_orders where id = parent_id for update;
  select * into op from public.order_operations where id = _operation_id and production_order_id = po.id for update;

  if po.id is null or op.id is null or po.organization_id is distinct from op.organization_id
    or (op.station_id is not null and not exists (
      select 1 from public.stations s where s.id = op.station_id and s.line_id = po.line_id
        and s.organization_id = po.organization_id
    ))
    or not private.has_permission(actor, 'execution.record',
      case when op.station_id is null then 'line' else 'station' end, coalesce(op.station_id, po.line_id))
  then
    raise exception 'Operation is unavailable in your station scope' using errcode = '42501';
  end if;

  if _action = 'hold' and op.status in ('running','partially_completed') then
    reason := nullif(btrim(_reason), '');
    if reason is null then raise exception 'Enter a reason to pause the operation'; end if;
    next_state := 'on_hold';
  elsif _action = 'resume' and op.status = 'on_hold' then
    reason := 'Resumed';
    next_state := 'running';
  else
    raise exception 'This operation cannot % from %', _action, op.status;
  end if;

  update public.order_operations
  set status = next_state,
      status_reason = reason,
      hold_category = case when _action = 'hold' then coalesce(nullif(_category, ''), 'waiting') else null end,
      setup_completed_at = case when _action = 'hold' and op.setup_started_at is not null
        then coalesce(op.setup_completed_at, statement_timestamp()) else op.setup_completed_at end
  where id = op.id;

  select coalesce(full_name, email) into actor_label from public.profiles where id = actor;
  insert into public.audit_entries (id, organization_id, actor_id, actor_name, actor_user_id, entity, entity_id, action, summary, reason, before_data, after_data)
  values ('AE-' || gen_random_uuid(), po.organization_id, actor::text, coalesce(actor_label, 'Operator'), actor,
    'order_operation', op.id::text, 'operation:' || _action, 'Station operation ' || next_state, reason,
    jsonb_build_object('status', op.status), jsonb_build_object('status', next_state));
  return next_state;
end;
$$;

create or replace function public.transition_station_operation(
  _operation_id uuid,
  _action text,
  _reason text default null,
  _category text default null
) returns text
language sql security invoker set search_path = ''
as $$
  select private.transition_station_operation(_operation_id, _action, _reason, _category);
$$;

revoke all on function private.transition_station_operation(uuid, text, text, text) from public, anon;
revoke all on function public.transition_station_operation(uuid, text, text, text) from public, anon;
grant execute on function private.transition_station_operation(uuid, text, text, text) to authenticated;
grant execute on function public.transition_station_operation(uuid, text, text, text) to authenticated;
notify pgrst, 'reload schema';
