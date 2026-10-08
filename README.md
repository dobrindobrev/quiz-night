# Quiz Night

A live, multi-device pub-quiz runner. Host on a laptop, players join from phones, everything syncs live via Supabase Realtime. AI-generated rounds, team voting on answers, Revolut payments.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Supabase** — Postgres, Auth (magic link), Realtime, Storage
- **Anthropic / OpenAI / Gemini** — user-supplied API key for question generation
- **Tailwind** for utilities; hand-rolled design tokens in `globals.css`

## Features

- **Host** (desktop): build quizzes with multi-choice, true/false, open-text, picture, audio, and video questions; generate rounds with AI; run the live show with per-question timer, reveal, pause, and round breaks.
- **Players** (mobile): join by code + magic-link email, pay via Revolut QR, get approved by host, then answer with their team in real-time.
- **Team voting**: any member can propose an answer and vote on proposals. The captain locks in the team's final answer (or auto-lock on timer).
- **Auto + manual scoring**: multi-choice and true/false grade automatically on reveal. Open-text answers are marked correct/incorrect by the host.
- **Live leaderboard** updates for everyone as scores change.

## Setup

### 1. Supabase project

Create a project at [supabase.com](https://supabase.com).

Run the migrations in `supabase/migrations/` in order, in the Supabase SQL editor (or with `supabase db push` if you're using the CLI):

1. `0001_init.sql` — schema, RLS policies, RPC functions, realtime publication.
2. `0002_storage.sql` — `quiz-media` storage bucket.

In **Authentication → URL Configuration**, add your dev and prod URLs:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`, `https://your-domain.com/auth/callback`

### 2. Env vars

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL` — from your Supabase project's API settings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same page

### 3. Install + run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### 4. AI keys (optional)

To use AI question generation, any authenticated host can paste their own key in **Settings**:

- Anthropic: `sk-ant-…`
- OpenAI: `sk-…`
- Gemini: `AIza…`

Keys are stored in the `profiles` table (per-user) and only read server-side by `/api/generate`.

## Usage

1. Sign in with your email.
2. **Quizzes → New quiz.** Pick a title, set it paid/free, drop in your Revolut handle.
3. **Builder.** Add rounds, write questions, or use the AI Generator panel.
4. **Teams & Payments.** Approve teams that paid.
5. **Run Live.** Open lobby → start → reveal each question → mark open answers → advance → final leaderboard.

Players enter via `/join` with the code and go through pay → approval → live answering.

## Project layout

```
src/
  app/
    page.tsx                           landing
    login/                             magic-link login
    auth/                              callback + signout routes
    quizzes/                           list + new
    host/[quizId]/
      layout.tsx                       topbar + tab nav (host-only gate)
      builder/                         round + question editor, AI panel, media upload
      run/                             live control: timer, reveal, scoring, round break, final
      teams/                           approvals
      settings/                        per-quiz settings
    settings/                          profile + AI key
    join/                              enter code
    play/[quizId]/
      setup/                           pick/create team
      page.tsx                         live player shell (pay → wait → answer → final)
      _VotingPanel.tsx                 proposals + votes + lock-in
      _RevolutBlock.tsx                QR + handle + reference
    api/generate/                      server route → Anthropic/OpenAI/Gemini
  components/                          shared UI (Icon, QTypeBadge, Media, Toast, Confetti)
  lib/
    supabase/                          browser, server, middleware clients + types
    codes.ts                           quiz/team code generator
supabase/migrations/                   SQL
prototype/                             original HTML/JSX design handoff (reference only)
```

## How scoring works

- On reveal, the host's client calls `score_question(question_id)` which marks each submission as auto-correct (for multi-choice / true-false) and sets `awarded_points`.
- Open / media answers are left for the host to mark in the run panel; this calls `mark_submission(submission_id, correct)`.
- At the end of each round, `recalc_team_scores(quiz_id)` sums `awarded_points` into `teams.score`. Teams see their rank update live.

## Voting model

Each team member can post a proposal for a question (text / choice / bool). Every proposal costs one self-vote. Teammates see every proposal with its vote count, and can click another proposal to switch their vote. The leading proposal is the team's "current answer."

The team captain (first joiner) or a solo player can hit **Lock in** → calls `lock_team_answer(team_id, question_id)` which picks the top-voted proposal and writes a submission row. Ties are broken by earliest proposal.

## Known constraints

- Revolut has no public API for hobby accounts — paid-quiz flow is manual: player sends money, host sees it in Revolut, host approves the team in the app.
- AI keys are user-supplied and sent raw to the model provider; this app doesn't proxy or log them.
- Media uploads go to Supabase Storage's `quiz-media` bucket (public read). If you need private media, switch to signed URLs.
