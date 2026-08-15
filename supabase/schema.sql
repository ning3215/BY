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

create table if not exists public.couple_notes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  body text not null check (char_length(body) between 1 and 280),
  tone text not null default 'rose' check (tone in ('rose', 'mint', 'sun', 'sky')),
  created_at timestamptz not null default now()
);

create table if not exists public.couple_photos (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  storage_path text not null unique,
  caption text check (char_length(caption) <= 80),
  created_at timestamptz not null default now()
);

create table if not exists public.couple_places (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  title text not null check (char_length(title) between 1 and 40),
  note text check (char_length(note) <= 100),
  visited_on date,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  x_percent numeric(5, 2) not null default 50 check (x_percent between 0 and 100),
  y_percent numeric(5, 2) not null default 50 check (y_percent between 0 and 100),
  is_lit boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.couple_places
add column if not exists is_lit boolean not null default true;

alter table public.couple_places
add column if not exists latitude numeric(9, 6);

alter table public.couple_places
add column if not exists longitude numeric(9, 6);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'couple-photos',
  'couple-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.allowed_couple_members enable row level security;
alter table public.couple_profiles enable row level security;
alter table public.couple_messages enable row level security;
alter table public.couple_notes enable row level security;
alter table public.couple_photos enable row level security;
alter table public.couple_places enable row level security;

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

drop policy if exists "Couple can read notes" on public.couple_notes;
create policy "Couple can read notes"
on public.couple_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_notes.couple_id
  )
);

drop policy if exists "Couple can create notes" on public.couple_notes;
create policy "Couple can create notes"
on public.couple_notes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_notes.couple_id
  )
);

drop policy if exists "Couple can read photos" on public.couple_photos;
create policy "Couple can read photos"
on public.couple_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_photos.couple_id
  )
);

drop policy if exists "Couple can create photos" on public.couple_photos;
create policy "Couple can create photos"
on public.couple_photos
for insert
to authenticated
with check (
  user_id = auth.uid()
  and storage_path like couple_id::text || '/%'
  and exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_photos.couple_id
  )
);

drop policy if exists "Couple can delete photos" on public.couple_photos;
create policy "Couple can delete photos"
on public.couple_photos
for delete
to authenticated
using (
  exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_photos.couple_id
  )
);

drop policy if exists "Couple can read places" on public.couple_places;
create policy "Couple can read places"
on public.couple_places
for select
to authenticated
using (
  exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_places.couple_id
  )
);

drop policy if exists "Couple can create places" on public.couple_places;
create policy "Couple can create places"
on public.couple_places
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_places.couple_id
  )
);

drop policy if exists "Couple can update places" on public.couple_places;
create policy "Couple can update places"
on public.couple_places
for update
to authenticated
using (
  exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_places.couple_id
  )
)
with check (
  exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_places.couple_id
  )
);

drop policy if exists "Couple can delete places" on public.couple_places;
create policy "Couple can delete places"
on public.couple_places
for delete
to authenticated
using (
  exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = couple_places.couple_id
  )
);

drop policy if exists "Couple can upload photos" on storage.objects;
create policy "Couple can upload photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'couple-photos'
  and name like '093f97bb-50be-4bab-9c06-b32d508e2410/%'
  and exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = '093f97bb-50be-4bab-9c06-b32d508e2410'
  )
);

drop policy if exists "Couple can view photos" on storage.objects;
create policy "Couple can view photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'couple-photos'
  and name like '093f97bb-50be-4bab-9c06-b32d508e2410/%'
  and exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = '093f97bb-50be-4bab-9c06-b32d508e2410'
  )
);

drop policy if exists "Couple can delete stored photos" on storage.objects;
create policy "Couple can delete stored photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'couple-photos'
  and name like '093f97bb-50be-4bab-9c06-b32d508e2410/%'
  and exists (
    select 1
    from public.couple_profiles profile
    where profile.user_id = auth.uid()
      and profile.couple_id = '093f97bb-50be-4bab-9c06-b32d508e2410'
  )
);

grant select on public.allowed_couple_members to authenticated;
grant select, insert, update on public.couple_profiles to authenticated;
grant select, insert on public.couple_messages to authenticated;
grant select, insert on public.couple_notes to authenticated;
grant select, insert, delete on public.couple_photos to authenticated;
grant select, insert, update, delete on public.couple_places to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['couple_messages', 'couple_notes', 'couple_photos', 'couple_places']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

insert into public.allowed_couple_members (email, display_name, couple_id)
values
  ('1784078493@qq.com', '我', '093f97bb-50be-4bab-9c06-b32d508e2410'),
  ('3212215136@qq.com', '爱人', '093f97bb-50be-4bab-9c06-b32d508e2410')
on conflict (email) do update
set display_name = excluded.display_name,
    couple_id = excluded.couple_id;
