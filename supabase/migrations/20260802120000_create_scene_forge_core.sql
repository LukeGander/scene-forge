create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  premise text not null,
  tone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scene_cards (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null unique references public.scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'needs_work', 'ready')),
  player_goal text not null,
  obstacle text not null,
  characters jsonb not null default '[]'::jsonb,
  interactive_element text not null,
  required_assets jsonb not null default '[]'::jsonb,
  design_risks jsonb not null default '[]'::jsonb,
  generation_source text not null check (generation_source in ('mock', 'anthropic')),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.scenes enable row level security;
alter table public.scene_cards enable row level security;

create policy "projects_owner_all" on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "scenes_owner_all" on public.scenes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "scene_cards_owner_all" on public.scene_cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
