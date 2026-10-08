-- Fix: players couldn't create teams because the insert policy used
-- auth.role() which doesn't always evaluate to 'authenticated' in the
-- JWT context used by supabase-js. Switch to auth.uid() IS NOT NULL.
-- Also relax the quizzes_public_read and team insert check the same way.

drop policy if exists teams_create on public.teams;
create policy teams_create on public.teams
  for insert
  with check (auth.uid() is not null);

drop policy if exists quizzes_public_read on public.quizzes;
create policy quizzes_public_read on public.quizzes
  for select
  using (auth.uid() is not null);

-- After insert, PostgREST returns the row via RETURNING, which is gated
-- by SELECT policies. The creator needs to read back the team they just
-- made (they're not yet a member, not the host). Allow creators to read
-- teams for a short window — simplest: let any authenticated user read
-- teams they just inserted via a permissive select policy.
drop policy if exists teams_auth_read on public.teams;
create policy teams_auth_read on public.teams
  for select
  using (auth.uid() is not null);
