insert into public.suppliers (name, contact_name, contact_phone)
values
  ('Distribuidor Base', 'Andrea Pérez', '+56 9 1111 2222')
on conflict do nothing;

insert into public.products (name, sku, default_sale_price)
values
  ('Perfume Aura 100 ml', 'AURA-100', 24990),
  ('Perfume Noche 50 ml', 'NOCHE-50', 18990)
on conflict do nothing;
