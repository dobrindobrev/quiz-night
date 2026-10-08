-- Quiz Night schema
-- Run in Supabase SQL editor, or via supabase db push.

create extension if not exists pgcrypto;

-- =============================================================
-- profiles: one row per auth.users; stores API key + revolut handle
-- =============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  api_provider text default 'anthropic' check (api_provider in ('anthropic','openai','gemini')),
  api_key text,
  revolut_handle text,
  created_at timestamptz default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- quizzes
-- =============================================================
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  code text not null unique,
  status text not null default 'draft' check (status in ('draft','open','running','paused','finished')),
  paid boolean not null default false,
  price text,
  revolut_handle text,
  current_round int not null default 0,
  current_question int not null default 0,
  reveal_answer boolean not null default false,
  question_started_at timestamptz,
  question_duration_secs int not null default 30,
  round_break_ends_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_quizzes_host on public.quizzes(host_id);
create index if not exists idx_quizzes_code on public.quizzes(code);

-- =============================================================
-- rounds
-- =============================================================
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  title text not null,
  position int not null,
  created_at timestamptz default now()
);
create index if not exists idx_rounds_quiz on public.rounds(quiz_id, position);

-- =============================================================
-- questions
-- =============================================================
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  type text not null check (type in ('closed','open','truefalse','music','picture','video')),
  prompt text not null,
  choices jsonb,
  answer_text text,
  answer_index int,
  answer_bool boolean,
  media_url text,
  points int not null default 1,
  position int not null,
  created_at timestamptz default now()
);
create index if not exists idx_questions_round on public.questions(round_id, position);

-- =============================================================
-- teams
-- =============================================================
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  name text not null,
  emoji text not null default '🎉',
  join_code text not null,
  paid boolean not null default false,
  approved boolean not null default false,
  score int not null default 0,
  created_at timestamptz default now(),
  unique(quiz_id, name)
);
create index if not exists idx_teams_quiz on public.teams(quiz_id);
create index if not exists idx_teams_join on public.teams(join_code);

-- =============================================================
-- team_members
-- =============================================================
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_captain boolean not null default false,
  joined_at timestamptz default now(),
  unique(team_id, user_id)
);
create index if not exists idx_members_team on public.team_members(team_id);
create index if not exists idx_members_user on public.team_members(user_id);

-- =============================================================
-- proposals: a team member's suggested answer for a question
-- =============================================================
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  value_text text,
  value_index int,
  value_bool boolean,
  created_at timestamptz default now(),
  unique(team_id, question_id, author_id)
);
create index if not exists idx_proposals_team_q on public.proposals(team_id, question_id);

-- =============================================================
-- votes: a team member's vote on a proposal
-- =============================================================
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz default now(),
  unique(voter_id, question_id)
);
create index if not exists idx_votes_team_q on public.votes(team_id, question_id);

-- =============================================================
-- submissions: finalized team answer for a question
-- =============================================================
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  value_text text,
  value_index int,
  value_bool boolean,
  auto_correct boolean,
  host_correct boolean,
  awarded_points int not null default 0,
  locked_at timestamptz default now(),
  unique(team_id, question_id)
);
create index if not exists idx_submissions_team_q on public.submissions(team_id, question_id);

-- =============================================================
-- Helper functions (SECURITY DEFINER to bypass RLS during checks)
-- =============================================================
create or replace function public.is_quiz_host(p_quiz_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.quizzes q where q.id = p_quiz_id and q.host_id = auth.uid()
  );
$$;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.team_members tm where tm.team_id = p_team_id and tm.user_id = auth.uid()
  );
$$;

create or replace function public.team_quiz_id(p_team_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select quiz_id from public.teams where id = p_team_id;
$$;

create or replace function public.question_quiz_id(p_question_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select r.quiz_id from public.questions q
  join public.rounds r on r.id = q.round_id
  where q.id = p_question_id;
$$;

create or replace function public.round_quiz_id(p_round_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select quiz_id from public.rounds where id = p_round_id;
$$;

create or replace function public.user_in_quiz(p_quiz_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where t.quiz_id = p_quiz_id and tm.user_id = auth.uid()
  );
$$;

-- =============================================================
-- Enable RLS
-- =============================================================
alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.rounds enable row level security;
alter table public.questions enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.proposals enable row level security;
alter table public.votes enable row level security;
alter table public.submissions enable row level security;

-- profiles: users read/update own
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- quizzes: host full control; anyone signed-in can read by code (join screen); members can read
drop policy if exists quizzes_host_all on public.quizzes;
drop policy if exists quizzes_public_read on public.quizzes;
create policy quizzes_host_all on public.quizzes
  for all using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy quizzes_public_read on public.quizzes
  for select using (auth.role() = 'authenticated');

-- rounds: host full; members read
drop policy if exists rounds_host_all on public.rounds;
drop policy if exists rounds_members_read on public.rounds;
create policy rounds_host_all on public.rounds
  for all using (public.is_quiz_host(quiz_id)) with check (public.is_quiz_host(quiz_id));
create policy rounds_members_read on public.rounds
  for select using (public.user_in_quiz(quiz_id));

-- questions: host full; members read
drop policy if exists questions_host_all on public.questions;
drop policy if exists questions_members_read on public.questions;
create policy questions_host_all on public.questions
  for all using (public.is_quiz_host(public.round_quiz_id(round_id)))
  with check (public.is_quiz_host(public.round_quiz_id(round_id)));
create policy questions_members_read on public.questions
  for select using (public.user_in_quiz(public.round_quiz_id(round_id)));

-- teams: host full; authenticated can create (join flow) + members read own team
drop policy if exists teams_host_all on public.teams;
drop policy if exists teams_member_read on public.teams;
drop policy if exists teams_create on public.teams;
drop policy if exists teams_member_update_paid on public.teams;
create policy teams_host_all on public.teams
  for all using (public.is_quiz_host(quiz_id)) with check (public.is_quiz_host(quiz_id));
create policy teams_member_read on public.teams
  for select using (public.user_in_quiz(quiz_id));
create policy teams_create on public.teams
  for insert with check (auth.role() = 'authenticated');

-- team_members: host read; user read own; user insert self
drop policy if exists members_host_read on public.team_members;
drop policy if exists members_self_read on public.team_members;
drop policy if exists members_self_insert on public.team_members;
drop policy if exists members_self_delete on public.team_members;
create policy members_host_read on public.team_members
  for select using (public.is_quiz_host(public.team_quiz_id(team_id)));
create policy members_self_read on public.team_members
  for select using (user_id = auth.uid() or public.is_team_member(team_id));
create policy members_self_insert on public.team_members
  for insert with check (user_id = auth.uid());
create policy members_self_delete on public.team_members
  for delete using (user_id = auth.uid());

-- proposals: team members CRUD within team; host read
drop policy if exists proposals_team_all on public.proposals;
drop policy if exists proposals_host_read on public.proposals;
create policy proposals_team_all on public.proposals
  for all using (public.is_team_member(team_id) and author_id = auth.uid())
  with check (public.is_team_member(team_id) and author_id = auth.uid());
create policy proposals_team_read on public.proposals
  for select using (public.is_team_member(team_id));
create policy proposals_host_read on public.proposals
  for select using (public.is_quiz_host(public.team_quiz_id(team_id)));

-- votes: team members CRUD own; team reads; host reads
drop policy if exists votes_team_all on public.votes;
drop policy if exists votes_team_read on public.votes;
drop policy if exists votes_host_read on public.votes;
create policy votes_team_all on public.votes
  for all using (voter_id = auth.uid() and public.is_team_member(team_id))
  with check (voter_id = auth.uid() and public.is_team_member(team_id));
create policy votes_team_read on public.votes
  for select using (public.is_team_member(team_id));
create policy votes_host_read on public.votes
  for select using (public.is_quiz_host(public.team_quiz_id(team_id)));

-- submissions: host full; team read own
drop policy if exists submissions_host_all on public.submissions;
drop policy if exists submissions_team_read on public.submissions;
drop policy if exists submissions_team_write on public.submissions;
create policy submissions_host_all on public.submissions
  for all using (public.is_quiz_host(public.team_quiz_id(team_id)))
  with check (public.is_quiz_host(public.team_quiz_id(team_id)));
create policy submissions_team_read on public.submissions
  for select using (public.is_team_member(team_id));
create policy submissions_team_write on public.submissions
  for insert with check (public.is_team_member(team_id));
create policy submissions_team_update on public.submissions
  for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

-- =============================================================
-- RPC: lock_team_answer — picks top-voted proposal and inserts submission
-- =============================================================
create or replace function public.lock_team_answer(p_team_id uuid, p_question_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_proposal public.proposals%rowtype;
  v_submission_id uuid;
begin
  if not public.is_team_member(p_team_id) and not public.is_quiz_host(public.team_quiz_id(p_team_id)) then
    raise exception 'not authorized';
  end if;

  -- top-voted proposal, ties broken by earliest
  select p.* into v_proposal
  from public.proposals p
  left join public.votes v on v.proposal_id = p.id
  where p.team_id = p_team_id and p.question_id = p_question_id
  group by p.id
  order by count(v.id) desc, p.created_at asc
  limit 1;

  if v_proposal.id is null then
    raise exception 'no proposal to lock';
  end if;

  insert into public.submissions (team_id, question_id, value_text, value_index, value_bool, locked_at)
  values (p_team_id, p_question_id, v_proposal.value_text, v_proposal.value_index, v_proposal.value_bool, now())
  on conflict (team_id, question_id) do update
    set value_text = excluded.value_text,
        value_index = excluded.value_index,
        value_bool = excluded.value_bool,
        locked_at = excluded.locked_at
  returning id into v_submission_id;

  return v_submission_id;
end $$;

grant execute on function public.lock_team_answer(uuid, uuid) to authenticated;

-- =============================================================
-- RPC: score_question — auto-score all teams for a question
-- =============================================================
create or replace function public.score_question(p_question_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_quiz_id uuid;
  v_q public.questions%rowtype;
  v_sub public.submissions%rowtype;
  v_correct boolean;
begin
  v_quiz_id := public.question_quiz_id(p_question_id);
  if not public.is_quiz_host(v_quiz_id) then raise exception 'not authorized'; end if;

  select * into v_q from public.questions where id = p_question_id;

  for v_sub in select * from public.submissions where question_id = p_question_id loop
    if v_q.type = 'closed' then
      v_correct := v_sub.value_index is not distinct from v_q.answer_index;
    elsif v_q.type = 'truefalse' then
      v_correct := v_sub.value_bool is not distinct from v_q.answer_bool;
    else
      -- open / media: leave auto_correct null, host decides via mark_submission_correct
      v_correct := null;
    end if;

    update public.submissions
    set auto_correct = v_correct,
        awarded_points = case when coalesce(v_correct, false) then v_q.points else 0 end
    where id = v_sub.id;
  end loop;
end $$;

grant execute on function public.score_question(uuid) to authenticated;

-- =============================================================
-- RPC: host override for open answers
-- =============================================================
create or replace function public.mark_submission(p_submission_id uuid, p_correct boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sub public.submissions%rowtype;
  v_q public.questions%rowtype;
begin
  select s.* into v_sub from public.submissions s where s.id = p_submission_id;
  select q.* into v_q from public.questions q where q.id = v_sub.question_id;
  if not public.is_quiz_host(public.question_quiz_id(v_sub.question_id)) then
    raise exception 'not authorized';
  end if;
  update public.submissions
  set host_correct = p_correct,
      awarded_points = case when p_correct then v_q.points else 0 end
  where id = p_submission_id;
end $$;

grant execute on function public.mark_submission(uuid, boolean) to authenticated;

-- =============================================================
-- RPC: recalc team scores from submissions
-- =============================================================
create or replace function public.recalc_team_scores(p_quiz_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_quiz_host(p_quiz_id) then raise exception 'not authorized'; end if;
  update public.teams t set score = coalesce((
    select sum(s.awarded_points)
    from public.submissions s
    where s.team_id = t.id
  ), 0)
  where t.quiz_id = p_quiz_id;
end $$;

grant execute on function public.recalc_team_scores(uuid) to authenticated;

-- =============================================================
-- Realtime replication
-- =============================================================
alter publication supabase_realtime add table public.quizzes;
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.questions;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.team_members;
alter publication supabase_realtime add table public.proposals;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.submissions;
