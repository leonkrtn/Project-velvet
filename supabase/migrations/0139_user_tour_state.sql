-- Server-seitig gespeicherter Tour-Fortschritt (ersetzt reines localStorage,
-- das pro Browser/Gerät zurückgesetzt wird und die Onboarding-Tour bei jeder
-- neuen Anmeldung erneut startete). tour_key ist generisch gehalten, damit
-- künftige Touren (z.B. Brautpaar-Solo) dieselbe Tabelle nutzen können.
create table if not exists user_tour_state (
  user_id      uuid not null references auth.users(id) on delete cascade,
  tour_key     text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, tour_key)
);

alter table user_tour_state enable row level security;

create policy "user_tour_state_select_own"
  on user_tour_state for select
  using (auth.uid() = user_id);

create policy "user_tour_state_insert_own"
  on user_tour_state for insert
  with check (auth.uid() = user_id);

create policy "user_tour_state_update_own"
  on user_tour_state for update
  using (auth.uid() = user_id);
