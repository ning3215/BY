create extension if not exists pgcrypto;

create table if not exists public.allowed_couple_members (
  email text primary key,
  display_name text not null,
  couple_id uuid not null
);

create table if not exists public.couple_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  couple_id uuid not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.couple_messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  body text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now()
);

alter table public.allowed_couple_members enable row level security;
alter table public.couple_profiles enable row level security;
alter table public.couple_messages enable row level security;

drop policy if exists "Allowed members can read their own invitation" on public.allowed_couple_members;
create policy "Allowed members can read their own invitation"
on public.allowed_couple_members
for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "Couple can read profiles" on public.couple_profiles;
create policy "Couple can read profiles"
on public.couple_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.allowed_couple_members allowed
    where lower(allowed.email) = lower(auth.jwt() ->> 'email')
      and allowed.couple_id = couple_profiles.couple_id
  )
);

drop policy if exists "Allowed users can create profile" on public.couple_profiles;
create policy "Allowed users can create profile"
on public.couple_profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and lower(email) = lower(auth.jwt() ->> 'email')
  and exists (
    select 1
    from public.allowed_couple_members allowed
    where lower(allowed.email) = lower(auth.jwt() ->> 'email')
      and allowed.couple_id = couple_profiles.couple_id
  )
);

drop policy if exists "Users can update own profile" on public.couple_profiles;
create policy "Users can update own profile"
on public.couple_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and lower(email) = lower(auth.jwt() ->> 'email')
  and exists (
    select 1
    from public.allowed_couple_members allowed
    where lower(allowed.email) = lower(auth.jwt() ->> 'email')
      and allowed.couple_id = couple_profiles.couple_id
  )
);

drop policy if exists "Couple can read messages" on public.couple_messages;
create policy "Couple can read messages"
on public.couple_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_messages.couple_id
  )
);

drop policy if exists "Couple can send messages" on public.couple_messages;
create policy "Couple can send messages"
on public.couple_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_messages.couple_id
  )
);

grant select on public.allowed_couple_members to authenticated;
grant select, insert, update on public.couple_profiles to authenticated;
grant select, insert on public.couple_messages to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'couple_messages'
  ) then
    alter publication supabase_realtime add table public.couple_messages;
  end if;
end $$;

-- Replace the emails and names below, then run this block once in Supabase SQL Editor.
-- Use the same couple_id in config.js.
insert into public.allowed_couple_members (email, display_name, couple_id)
values
  ('your-email@example.com', '我', '00000000-0000-0000-0000-000000000000'),
  ('partner-email@example.com', '爱人', '00000000-0000-0000-0000-000000000000')
on conflict (email) do update
set display_name = excluded.display_name,
    couple_id = excluded.couple_id;
