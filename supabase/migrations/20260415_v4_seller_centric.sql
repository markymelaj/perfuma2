create index if not exists idx_consignments_seller_status_opened_at
  on public.consignments (seller_id, status, opened_at desc);

create index if not exists idx_consignment_items_consignment_product
  on public.consignment_items (consignment_id, product_id);

create index if not exists idx_sales_seller_sold_at
  on public.sales (seller_id, sold_at desc);

create index if not exists idx_reconciliations_seller_created_at
  on public.reconciliations (seller_id, created_at desc);

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
