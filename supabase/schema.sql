-- Gary Vee Reader - Supabase schema
-- Execute this script once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.reader_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reader_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_chapter integer not null default 1,
  xp integer not null default 0,
  start_date date not null default current_date,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reader_state_selected_chapter_check check (selected_chapter between 1 and 30),
  constraint reader_state_xp_check check (xp >= 0)
);

create table if not exists public.reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id text not null,
  completed_at timestamptz not null default timezone('utc', now()),
  xp_awarded integer not null default 120,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, chapter_id),
  constraint reading_progress_chapter_check check (chapter_id ~ '^[0-9]{2}$'),
  constraint reading_progress_xp_check check (xp_awarded >= 0)
);

create table if not exists public.flashcard_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id text not null,
  seen jsonb not null default '[false,false,false]'::jsonb,
  all_done boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, chapter_id),
  constraint flashcard_progress_chapter_check check (chapter_id ~ '^[0-9]{2}$')
);

create table if not exists public.share_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id text not null,
  post_format text not null,
  post_variant text not null,
  headline text not null,
  body_a text,
  body_b text,
  footer text,
  caption text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint share_exports_chapter_check check (chapter_id ~ '^[0-9]{2}$'),
  constraint share_exports_format_check check (post_format in ('story', 'feed')),
  constraint share_exports_variant_check check (post_variant in ('insight', 'tool'))
);

create index if not exists idx_reading_progress_user_completed
  on public.reading_progress(user_id, completed_at desc);

create index if not exists idx_share_exports_user_created
  on public.share_exports(user_id, created_at desc);

create index if not exists idx_flashcard_progress_user
  on public.flashcard_progress(user_id);

create trigger trg_reader_profiles_updated_at
before update on public.reader_profiles
for each row
execute function public.touch_updated_at();

create trigger trg_reader_state_updated_at
before update on public.reader_state
for each row
execute function public.touch_updated_at();

create trigger trg_flashcard_progress_updated_at
before update on public.flashcard_progress
for each row
execute function public.touch_updated_at();

alter table public.reader_profiles enable row level security;
alter table public.reader_state enable row level security;
alter table public.reading_progress enable row level security;
alter table public.flashcard_progress enable row level security;
alter table public.share_exports enable row level security;

create policy "profiles own rows"
  on public.reader_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "state own rows"
  on public.reader_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "progress own rows"
  on public.reading_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "flash own rows"
  on public.flashcard_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "share own rows"
  on public.share_exports
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
