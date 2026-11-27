-- Mobile start must update the order, operation and audit together. Access to
-- this transition does not give operators generic order or operation writes.
create or replace function private.start_station_operation(
  _operation_id uuid,
  _input_qty numeric,
  _station_id text,
  _machine_id text,
  _batch_id text,
  _parameters jsonb,
  _with_setup boolean
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_label text;
  parent_id text;
  po public.production_orders%rowtype;
  op public.order_operations%rowtype;
  previous public.order_operations%rowtype;
  station_ref text;
  machine_ref text;
  batch_ref text;
  available numeric;
  blocker text;
  started timestamptz := statement_timestamp();
begin
  if actor is null then raise exception 'Sign in before starting an operation' using errcode = '42501'; end if;
  select production_order_id into parent_id from public.order_operations where id = _operation_id;
  select * into po from public.production_orders where id = parent_id for update;
  select * into op from public.order_operations where id = _operation_id and production_order_id = po.id for update;

  station_ref := coalesce(_station_id, op.station_id);
  if po.id is null or op.id is null or po.organization_id is distinct from op.organization_id
    or (op.station_id is not null and op.station_id is distinct from station_ref)
    or (station_ref is not null and not exists (
      select 1 from public.stations s where s.id = station_ref
        and s.organization_id = po.organization_id and s.line_id = po.line_id
    ))
    or not private.has_permission(actor, 'execution.record',
      case when station_ref is null then 'line' else 'station' end, coalesce(station_ref, po.line_id))
  then
    raise exception 'Operation is unavailable in your station scope' using errcode = '42501';
  end if;

  if po.status not in ('released', 'running') then
    raise exception 'Release the work order before starting this operation';
  end if;
  if op.status not in ('pending', 'ready', 'rework_required') then
    raise exception 'This operation is no longer available to start';
  end if;
  if _input_qty is null or _input_qty::text in ('NaN','Infinity','-Infinity') or _input_qty <= 0 then
    raise exception 'Enter a positive input quantity';
  end if;
  if jsonb_typeof(coalesce(_parameters, '{}'::jsonb)) <> 'object' then
    raise exception 'Execution parameters must be an object';
  end if;

  blocker := public.operation_block_reason(op.id, true);
  if blocker is not null then raise exception '%', blocker; end if;
  if exists (select 1 from public.station_holds where station_id = station_ref and status = 'open') then
    raise exception 'The station has an open hold';
  end if;
  if cardinality(public.operation_missing_skills(op.id, actor)) > 0 then
    raise exception 'The operator lacks a current qualification for this operation';
  end if;

  select * into previous from public.order_operations
    where production_order_id = po.id and sequence < op.sequence and status not in ('skipped', 'cancelled')
    order by sequence desc limit 1;
  available := case
    when op.status = 'rework_required' then coalesce(nullif(op.qty_rejected, 0), nullif(op.qty_input, 0), po.qty)
    when previous.id is not null then coalesce(previous.qty_yield, 0) - coalesce(op.qty_input, 0)
    else po.qty - coalesce(op.qty_input, 0)
  end;
  if _input_qty > available then raise exception 'Only % % is available for this operation', greatest(available, 0), po.uom; end if;

  machine_ref := coalesce(_machine_id, op.machine_id);
  batch_ref := coalesce(_batch_id, op.batch_id);
  if machine_ref is not null and not exists (
    select 1 from public.machines m where m.id = machine_ref and m.organization_id = po.organization_id
      and (station_ref is null or m.station_id = station_ref)
      and m.status not in ('fault','down','maintenance','offline')
  ) then raise exception 'The machine is unavailable for this station'; end if;
  if batch_ref is not null and not exists (
    select 1 from public.production_batches b where b.id = batch_ref
      and b.production_order_id = po.id and b.organization_id = po.organization_id
  ) then raise exception 'Choose a batch belonging to this work order'; end if;
  if 'machine' = any(op.required_fields) and machine_ref is null then raise exception 'This operation requires a machine'; end if;
  if 'batch' = any(op.required_fields) and batch_ref is null then raise exception 'This operation requires a batch'; end if;
  if 'parameters' = any(op.required_fields) and not exists (
    select 1 from jsonb_each_text(coalesce(_parameters, '{}'::jsonb)) pair where btrim(pair.value) <> ''
  ) then raise exception 'This operation requires execution parameters'; end if;

  select coalesce(full_name, email) into actor_label from public.profiles where id = actor;
  actor_label := coalesce(actor_label, 'Operator');
  if po.status = 'released' then
    update public.production_orders set status = 'running' where id = po.id;
    insert into public.audit_entries (id, organization_id, actor_id, actor_name, actor_user_id, entity, entity_id, action, summary, before_data, after_data)
    values ('AE-' || gen_random_uuid(), po.organization_id, actor::text, actor_label, actor, 'production_order', po.id, 'status:running',
      'Work order started by first operation', '{"status":"released"}', '{"status":"running"}');
  end if;

  update public.order_operations
  set status = 'running',
      status_reason = case when op.status = 'rework_required' then 'Rework started' else 'Operation started' end,
      qty_input = coalesce(op.qty_input, 0) + _input_qty,
      machine_id = machine_ref,
      station_id = station_ref,
      batch_id = batch_ref,
      parameters = coalesce(op.parameters, '{}'::jsonb) || coalesce(_parameters, '{}'::jsonb),
      started_at = coalesce(op.started_at, started),
      started_by = coalesce(op.started_by, actor_label),
      started_by_user_id = coalesce(op.started_by_user_id, actor),
      hold_category = null,
      setup_started_at = case when _with_setup then started else op.setup_started_at end,
      setup_completed_at = case when _with_setup then null else op.setup_completed_at end
  where id = op.id;

  insert into public.operation_events (organization_id, production_order_id, operation_id, event_type, payload, actor_user_id, actor_name)
  values (po.organization_id, po.id, op.id, 'start',
    jsonb_build_object('input_qty', _input_qty, 'station_id', station_ref, 'machine_id', machine_ref,
      'batch_id', batch_ref, 'parameters', coalesce(_parameters, '{}'::jsonb), 'work_center_id', op.work_center_id, 'setup', _with_setup),
    actor, actor_label);
  if _with_setup then
    insert into public.operation_events (organization_id, production_order_id, operation_id, event_type, payload, actor_user_id, actor_name)
    values (po.organization_id, po.id, op.id, 'setup_start', '{}', actor, actor_label);
  end if;
end;
$$;

create or replace function public.start_station_operation(
  _operation_id uuid,
  _input_qty numeric,
  _station_id text default null,
  _machine_id text default null,
  _batch_id text default null,
  _parameters jsonb default '{}',
  _with_setup boolean default false
) returns void
language sql security invoker set search_path = ''
as $$
  select private.start_station_operation(_operation_id, _input_qty, _station_id, _machine_id, _batch_id, _parameters, _with_setup);
$$;

revoke all on function private.start_station_operation(uuid, numeric, text, text, text, jsonb, boolean) from public, anon;
revoke all on function public.start_station_operation(uuid, numeric, text, text, text, jsonb, boolean) from public, anon;
grant execute on function private.start_station_operation(uuid, numeric, text, text, text, jsonb, boolean) to authenticated;
grant execute on function public.start_station_operation(uuid, numeric, text, text, text, jsonb, boolean) to authenticated;
notify pgrst, 'reload schema';
