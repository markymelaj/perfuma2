create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('super_admin', 'owner', 'seller');
exception when duplicate_object then null;
end$$;

do $$
begin
  create type public.consignment_status as enum ('open', 'partially_reconciled', 'closed', 'cancelled');
exception when duplicate_object then null;
end$$;

do $$
begin
  create type public.reconciliation_type as enum ('partial', 'total');
exception when duplicate_object then null;
end$$;

do $$
begin
  create type public.payment_method as enum ('cash', 'transfer', 'mixed');
exception when duplicate_object then null;
end$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text unique,
  display_name text,
  phone text,
  role public.app_role not null default 'seller',
  is_active boolean not null default true,
  must_reenroll_security boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        username = coalesce(public.profiles.username, excluded.username),
        display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active = true
  limit 1
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('owner'::public.app_role, 'super_admin'::public.app_role), false)
$$;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  sku text unique,
  name text not null,
  description text,
  default_sale_price numeric(12,2) not null default 0 check (default_sale_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create table if not exists public.consignments (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  opened_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  status public.consignment_status not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_consignments_updated_at on public.consignments;
create trigger trg_consignments_updated_at
before update on public.consignments
for each row execute function public.set_updated_at();

create table if not exists public.consignment_items (
  id uuid primary key default gen_random_uuid(),
  consignment_id uuid not null references public.consignments(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_assigned integer not null check (quantity_assigned > 0),
  unit_sale_price numeric(12,2) not null check (unit_sale_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consignment_id, product_id)
);

drop trigger if exists trg_consignment_items_updated_at on public.consignment_items;
create trigger trg_consignment_items_updated_at
before update on public.consignment_items
for each row execute function public.set_updated_at();

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  consignment_id uuid not null references public.consignments(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  payment_method public.payment_method not null default 'cash',
  sold_at timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_sales_updated_at on public.sales;
create trigger trg_sales_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

create or replace function public.sync_sale_seller()
returns trigger
language plpgsql
as $$
begin
  select c.seller_id into new.seller_id
  from public.consignments c
  where c.id = new.consignment_id;

  if new.seller_id is null then
    raise exception 'Consignación no encontrada';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_sale_seller on public.sales;
create trigger trg_sync_sale_seller
before insert or update on public.sales
for each row execute function public.sync_sale_seller();

create table if not exists public.sales_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  consignment_item_id uuid not null references public.consignment_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_sale_price numeric(12,2) not null check (unit_sale_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_sales_items_updated_at on public.sales_items;
create trigger trg_sales_items_updated_at
before update on public.sales_items
for each row execute function public.set_updated_at();

create table if not exists public.reconciliations (
  id uuid primary key default gen_random_uuid(),
  consignment_id uuid not null references public.consignments(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  type public.reconciliation_type not null,
  cash_received numeric(12,2) not null default 0 check (cash_received >= 0),
  transfer_received numeric(12,2) not null default 0 check (transfer_received >= 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_reconciliations_updated_at on public.reconciliations;
create trigger trg_reconciliations_updated_at
before update on public.reconciliations
for each row execute function public.set_updated_at();

create or replace function public.sync_reconciliation_seller()
returns trigger
language plpgsql
as $$
begin
  select c.seller_id into new.seller_id
  from public.consignments c
  where c.id = new.consignment_id;

  if new.seller_id is null then
    raise exception 'Consignación no encontrada';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_reconciliation_seller on public.reconciliations;
create trigger trg_sync_reconciliation_seller
before insert or update on public.reconciliations
for each row execute function public.sync_reconciliation_seller();

create table if not exists public.reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references public.reconciliations(id) on delete cascade,
  consignment_item_id uuid not null references public.consignment_items(id) on delete restrict,
  quantity_returned integer not null default 0 check (quantity_returned >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reconciliation_id, consignment_item_id)
);

drop trigger if exists trg_reconciliation_items_updated_at on public.reconciliation_items;
create trigger trg_reconciliation_items_updated_at
before update on public.reconciliation_items
for each row execute function public.set_updated_at();

create table if not exists public.location_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.validate_sale_item()
returns trigger
language plpgsql
as $$
declare
  v_item_consignment_id uuid;
  v_sale_consignment_id uuid;
  v_assigned integer;
  v_sold integer;
  v_returned integer;
  v_available integer;
begin
  select ci.consignment_id, ci.quantity_assigned
    into v_item_consignment_id, v_assigned
  from public.consignment_items ci
  where ci.id = new.consignment_item_id;

  if v_item_consignment_id is null then
    raise exception 'Item de consignación no encontrado';
  end if;

  select s.consignment_id
    into v_sale_consignment_id
  from public.sales s
  where s.id = new.sale_id;

  if v_sale_consignment_id is null then
    raise exception 'Venta no encontrada';
  end if;

  if v_sale_consignment_id <> v_item_consignment_id then
    raise exception 'La venta y el item no pertenecen a la misma consignación';
  end if;

  select coalesce(sum(si.quantity), 0)
    into v_sold
  from public.sales_items si
  where si.consignment_item_id = new.consignment_item_id
    and (tg_op <> 'UPDATE' or si.id <> new.id);

  select coalesce(sum(ri.quantity_returned), 0)
    into v_returned
  from public.reconciliation_items ri
  where ri.consignment_item_id = new.consignment_item_id;

  v_available := v_assigned - v_sold - v_returned;

  if new.quantity > v_available then
    raise exception 'Stock insuficiente para vender. Disponible: %, solicitado: %', v_available, new.quantity;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_sale_item on public.sales_items;
create trigger trg_validate_sale_item
before insert or update on public.sales_items
for each row execute function public.validate_sale_item();

create or replace function public.validate_reconciliation_item()
returns trigger
language plpgsql
as $$
declare
  v_item_consignment_id uuid;
  v_reconciliation_consignment_id uuid;
  v_assigned integer;
  v_sold integer;
  v_returned integer;
  v_available integer;
begin
  select ci.consignment_id, ci.quantity_assigned
    into v_item_consignment_id, v_assigned
  from public.consignment_items ci
  where ci.id = new.consignment_item_id;

  if v_item_consignment_id is null then
    raise exception 'Item de consignación no encontrado';
  end if;

  select r.consignment_id
    into v_reconciliation_consignment_id
  from public.reconciliations r
  where r.id = new.reconciliation_id;

  if v_reconciliation_consignment_id is null then
    raise exception 'Rendición no encontrada';
  end if;

  if v_reconciliation_consignment_id <> v_item_consignment_id then
    raise exception 'La rendición y el item no pertenecen a la misma consignación';
  end if;

  select coalesce(sum(si.quantity), 0)
    into v_sold
  from public.sales_items si
  join public.sales s on s.id = si.sale_id
  where si.consignment_item_id = new.consignment_item_id
    and s.consignment_id = v_reconciliation_consignment_id;

  select coalesce(sum(ri.quantity_returned), 0)
    into v_returned
  from public.reconciliation_items ri
  where ri.consignment_item_id = new.consignment_item_id
    and (tg_op <> 'UPDATE' or ri.id <> new.id);

  v_available := v_assigned - v_sold - v_returned;

  if new.quantity_returned > v_available then
    raise exception 'No puedes devolver más unidades de las disponibles. Disponible: %, solicitado: %', v_available, new.quantity_returned;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_reconciliation_item on public.reconciliation_items;
create trigger trg_validate_reconciliation_item
before insert or update on public.reconciliation_items
for each row execute function public.validate_reconciliation_item();

create or replace function public.validate_internal_message()
returns trigger
language plpgsql
as $$
declare
  v_owner_role public.app_role;
  v_seller_role public.app_role;
begin
  select p.role into v_owner_role from public.profiles p where p.id = new.owner_id;
  select p.role into v_seller_role from public.profiles p where p.id = new.seller_id;

  if v_owner_role not in ('owner'::public.app_role, 'super_admin'::public.app_role) then
    raise exception 'owner_id debe pertenecer a un owner';
  end if;

  if v_seller_role is distinct from 'seller' then
    raise exception 'seller_id debe pertenecer a un seller';
  end if;

  if new.sender_id <> new.owner_id and new.sender_id <> new.seller_id then
    raise exception 'sender_id no pertenece a la conversación';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_internal_message on public.internal_messages;
create trigger trg_validate_internal_message
before insert on public.internal_messages
for each row execute function public.validate_internal_message();

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id uuid;
begin
  if tg_op = 'DELETE' then
    v_record_id := (to_jsonb(old) ->> 'id')::uuid;
    insert into public.audit_logs(actor_id, action, table_name, record_id, payload)
    values (auth.uid(), tg_op, tg_table_name, v_record_id, jsonb_build_object('old', to_jsonb(old)));
    return old;
  elsif tg_op = 'UPDATE' then
    v_record_id := (to_jsonb(new) ->> 'id')::uuid;
    insert into public.audit_logs(actor_id, action, table_name, record_id, payload)
    values (auth.uid(), tg_op, tg_table_name, v_record_id, jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)));
    return new;
  else
    v_record_id := (to_jsonb(new) ->> 'id')::uuid;
    insert into public.audit_logs(actor_id, action, table_name, record_id, payload)
    values (auth.uid(), tg_op, tg_table_name, v_record_id, jsonb_build_object('new', to_jsonb(new)));
    return new;
  end if;
end;
$$;

drop trigger if exists audit_suppliers on public.suppliers;
create trigger audit_suppliers after insert or update or delete on public.suppliers
for each row execute function public.audit_trigger();

drop trigger if exists audit_products on public.products;
create trigger audit_products after insert or update or delete on public.products
for each row execute function public.audit_trigger();

drop trigger if exists audit_consignments on public.consignments;
create trigger audit_consignments after insert or update or delete on public.consignments
for each row execute function public.audit_trigger();

drop trigger if exists audit_consignment_items on public.consignment_items;
create trigger audit_consignment_items after insert or update or delete on public.consignment_items
for each row execute function public.audit_trigger();

drop trigger if exists audit_sales on public.sales;
create trigger audit_sales after insert or update or delete on public.sales
for each row execute function public.audit_trigger();

drop trigger if exists audit_sales_items on public.sales_items;
create trigger audit_sales_items after insert or update or delete on public.sales_items
for each row execute function public.audit_trigger();

drop trigger if exists audit_reconciliations on public.reconciliations;
create trigger audit_reconciliations after insert or update or delete on public.reconciliations
for each row execute function public.audit_trigger();

drop trigger if exists audit_reconciliation_items on public.reconciliation_items;
create trigger audit_reconciliation_items after insert or update or delete on public.reconciliation_items
for each row execute function public.audit_trigger();

drop trigger if exists audit_location_pings on public.location_pings;
create trigger audit_location_pings after insert or update or delete on public.location_pings
for each row execute function public.audit_trigger();

drop trigger if exists audit_internal_messages on public.internal_messages;
create trigger audit_internal_messages after insert or delete on public.internal_messages
for each row execute function public.audit_trigger();

create index if not exists idx_profiles_role_active on public.profiles(role, is_active);
create index if not exists idx_products_supplier_active on public.products(supplier_id, is_active);
create index if not exists idx_consignments_seller_status on public.consignments(seller_id, status);
create index if not exists idx_consignment_items_consignment on public.consignment_items(consignment_id);
create index if not exists idx_sales_consignment on public.sales(consignment_id);
create index if not exists idx_sales_seller on public.sales(seller_id);
create index if not exists idx_sales_items_sale on public.sales_items(sale_id);
create index if not exists idx_sales_items_consignment_item on public.sales_items(consignment_item_id);
create index if not exists idx_reconciliations_consignment on public.reconciliations(consignment_id);
create index if not exists idx_reconciliations_seller on public.reconciliations(seller_id);
create index if not exists idx_reconciliation_items_reconciliation on public.reconciliation_items(reconciliation_id);
create index if not exists idx_reconciliation_items_consignment_item on public.reconciliation_items(consignment_item_id);
create index if not exists idx_location_pings_user_created on public.location_pings(user_id, created_at desc);
create index if not exists idx_internal_messages_seller_created on public.internal_messages(seller_id, created_at desc);
create index if not exists idx_internal_messages_owner_created on public.internal_messages(owner_id, created_at desc);
create index if not exists idx_audit_logs_table_record_created on public.audit_logs(table_name, record_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.consignments enable row level security;
alter table public.consignment_items enable row level security;
alter table public.sales enable row level security;
alter table public.sales_items enable row level security;
alter table public.reconciliations enable row level security;
alter table public.reconciliation_items enable row level security;
alter table public.location_pings enable row level security;
alter table public.internal_messages enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_owner());

drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists suppliers_select_owner on public.suppliers;
create policy suppliers_select_owner on public.suppliers for select to authenticated using (public.is_owner());

drop policy if exists suppliers_select_seller on public.suppliers;
create policy suppliers_select_seller on public.suppliers for select to authenticated using (is_active = true);

drop policy if exists suppliers_write_owner on public.suppliers;
create policy suppliers_write_owner on public.suppliers for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists products_select_owner on public.products;
create policy products_select_owner on public.products for select to authenticated using (public.is_owner());

drop policy if exists products_select_seller on public.products;
create policy products_select_seller on public.products for select to authenticated using (is_active = true);

drop policy if exists products_write_owner on public.products;
create policy products_write_owner on public.products for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists consignments_select on public.consignments;
create policy consignments_select on public.consignments for select to authenticated using (public.is_owner() or seller_id = auth.uid());

drop policy if exists consignments_write_owner on public.consignments;
create policy consignments_write_owner on public.consignments for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists consignment_items_select on public.consignment_items;
create policy consignment_items_select on public.consignment_items for select to authenticated using (
  public.is_owner() or exists (
    select 1 from public.consignments c where c.id = consignment_id and c.seller_id = auth.uid()
  )
);

drop policy if exists consignment_items_write_owner on public.consignment_items;
create policy consignment_items_write_owner on public.consignment_items for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select to authenticated using (public.is_owner() or seller_id = auth.uid());

drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales for insert to authenticated with check (
  public.is_owner() or exists (
    select 1 from public.consignments c where c.id = consignment_id and c.seller_id = auth.uid() and c.status in ('open', 'partially_reconciled')
  )
);

drop policy if exists sales_update_owner on public.sales;
create policy sales_update_owner on public.sales for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists sales_delete_owner on public.sales;
create policy sales_delete_owner on public.sales for delete to authenticated using (public.is_owner());

drop policy if exists sales_items_select on public.sales_items;
create policy sales_items_select on public.sales_items for select to authenticated using (
  public.is_owner() or exists (
    select 1 from public.sales s where s.id = sale_id and s.seller_id = auth.uid()
  )
);

drop policy if exists sales_items_insert on public.sales_items;
create policy sales_items_insert on public.sales_items for insert to authenticated with check (
  public.is_owner() or exists (
    select 1 from public.sales s join public.consignments c on c.id = s.consignment_id
    where s.id = sale_id and s.seller_id = auth.uid() and c.status in ('open', 'partially_reconciled')
  )
);

drop policy if exists sales_items_update_owner on public.sales_items;
create policy sales_items_update_owner on public.sales_items for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists sales_items_delete_owner on public.sales_items;
create policy sales_items_delete_owner on public.sales_items for delete to authenticated using (public.is_owner());

drop policy if exists reconciliations_select on public.reconciliations;
create policy reconciliations_select on public.reconciliations for select to authenticated using (public.is_owner() or seller_id = auth.uid());

drop policy if exists reconciliations_write_owner on public.reconciliations;
create policy reconciliations_write_owner on public.reconciliations for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists reconciliation_items_select on public.reconciliation_items;
create policy reconciliation_items_select on public.reconciliation_items for select to authenticated using (
  public.is_owner() or exists (
    select 1 from public.reconciliations r where r.id = reconciliation_id and r.seller_id = auth.uid()
  )
);

drop policy if exists reconciliation_items_write_owner on public.reconciliation_items;
create policy reconciliation_items_write_owner on public.reconciliation_items for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists location_pings_select on public.location_pings;
create policy location_pings_select on public.location_pings for select to authenticated using (public.is_owner() or user_id = auth.uid());

drop policy if exists location_pings_insert on public.location_pings;
create policy location_pings_insert on public.location_pings for insert to authenticated with check (public.is_owner() or user_id = auth.uid());

drop policy if exists location_pings_update_owner on public.location_pings;
create policy location_pings_update_owner on public.location_pings for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists location_pings_delete_owner on public.location_pings;
create policy location_pings_delete_owner on public.location_pings for delete to authenticated using (public.is_owner());

drop policy if exists internal_messages_select on public.internal_messages;
create policy internal_messages_select on public.internal_messages for select to authenticated using (public.is_owner() or seller_id = auth.uid());

drop policy if exists internal_messages_insert_owner on public.internal_messages;
create policy internal_messages_insert_owner on public.internal_messages for insert to authenticated with check (public.is_owner() and sender_id = auth.uid());

drop policy if exists internal_messages_insert_seller on public.internal_messages;
create policy internal_messages_insert_seller on public.internal_messages for insert to authenticated with check (seller_id = auth.uid() and sender_id = auth.uid());

drop policy if exists audit_logs_select_owner on public.audit_logs;
create policy audit_logs_select_owner on public.audit_logs for select to authenticated using (public.is_owner());

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.consignments to authenticated;
grant select, insert, update, delete on public.consignment_items to authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.sales_items to authenticated;
grant select, insert, update, delete on public.reconciliations to authenticated;
grant select, insert, update, delete on public.reconciliation_items to authenticated;
grant select, insert, update, delete on public.location_pings to authenticated;
grant select, insert on public.internal_messages to authenticated;
grant select on public.audit_logs to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_owner() to authenticated;
