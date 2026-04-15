alter table public.profiles add column if not exists username text;

update public.profiles
set username = lower(regexp_replace(split_part(coalesce(email, id::text), '@', 1), '[^a-zA-Z0-9._-]+', '-', 'g'))
where username is null;

create unique index if not exists profiles_username_unique_idx on public.profiles (username) where username is not null;

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
