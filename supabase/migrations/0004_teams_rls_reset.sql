-- Clean-slate rebuild of teams RLS. Earlier migrations left multiple
-- overlapping policies in place; some Supabase projects didn't pick up the
-- auth.uid() fix. This drops them all and recreates a minimal, verified set.

alter table public.teams enable row level security;

drop policy if exists teams_host_all       on public.teams;
drop policy if exists teams_public_read    on public.teams;
drop policy if exists teams_member_read    on public.teams;
drop policy if exists teams_create         on public.teams;
drop policy if exists teams_auth_read      on public.teams;
drop policy if exists teams_member_update_paid on public.teams;

-- Any signed-in user can INSERT a team (the RLS on team_members then
-- restricts *who* can be a member). No quiz-ownership check here — the
-- player creates teams for a quiz they're joining.
create policy teams_insert_authed on public.teams
  for insert
  with check (auth.uid() is not null);

-- Any signed-in user can SELECT teams. This is needed so the player can
-- see the list of teams to join, read back the row they just inserted,
-- and so the host sees their own quiz's teams.
create policy teams_select_authed on public.teams
  for select
  using (auth.uid() is not null);

-- Only the quiz host can UPDATE or DELETE a team (approve, mark paid,
-- reject, etc.).
create policy teams_update_host on public.teams
  for update
  using (public.is_quiz_host(quiz_id))
  with check (public.is_quiz_host(quiz_id));

create policy teams_delete_host on public.teams
  for delete
  using (public.is_quiz_host(quiz_id));
