// Hand-written Database types matching our SQL schema.
// Uses `type` (not `interface`) for Row types so they pass supabase-js's
// `Record<string, unknown>` constraint without index-signature friction.

export type QuestionType =
  | "closed"
  | "open"
  | "truefalse"
  | "music"
  | "picture"
  | "video";

export type QuizStatus = "draft" | "open" | "running" | "paused" | "finished";

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  api_provider: "anthropic" | "openai" | "gemini";
  api_key: string | null;
  revolut_handle: string | null;
  created_at: string;
};

export type Quiz = {
  id: string;
  host_id: string;
  title: string;
  code: string;
  status: QuizStatus;
  paid: boolean;
  price: string | null;
  revolut_handle: string | null;
  current_round: number;
  current_question: number;
  reveal_answer: boolean;
  question_started_at: string | null;
  question_duration_secs: number;
  round_break_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Round = {
  id: string;
  quiz_id: string;
  title: string;
  position: number;
  created_at: string;
};

export type Question = {
  id: string;
  round_id: string;
  type: QuestionType;
  prompt: string;
  choices: string[] | null;
  answer_text: string | null;
  answer_index: number | null;
  answer_bool: boolean | null;
  media_url: string | null;
  points: number;
  position: number;
  created_at: string;
};

export type Team = {
  id: string;
  quiz_id: string;
  name: string;
  emoji: string;
  join_code: string;
  paid: boolean;
  approved: boolean;
  score: number;
  created_at: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  is_captain: boolean;
  joined_at: string;
};

export type Proposal = {
  id: string;
  team_id: string;
  question_id: string;
  author_id: string;
  value_text: string | null;
  value_index: number | null;
  value_bool: boolean | null;
  created_at: string;
};

export type Vote = {
  id: string;
  proposal_id: string;
  voter_id: string;
  team_id: string;
  question_id: string;
  created_at: string;
};

export type Submission = {
  id: string;
  team_id: string;
  question_id: string;
  value_text: string | null;
  value_index: number | null;
  value_bool: boolean | null;
  auto_correct: boolean | null;
  host_correct: boolean | null;
  awarded_points: number;
  locked_at: string;
};

type TableEntry<T> = {
  Row: T;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12.2.3" };
  public: {
    Tables: {
      profiles: TableEntry<Profile>;
      quizzes: TableEntry<Quiz>;
      rounds: TableEntry<Round>;
      questions: TableEntry<Question>;
      teams: TableEntry<Team>;
      team_members: TableEntry<TeamMember>;
      proposals: TableEntry<Proposal>;
      votes: TableEntry<Vote>;
      submissions: TableEntry<Submission>;
    };
    Views: Record<string, never>;
    Functions: {
      lock_team_answer: {
        Args: { p_team_id: string; p_question_id: string };
        Returns: string;
      };
      score_question: {
        Args: { p_question_id: string };
        Returns: undefined;
      };
      mark_submission: {
        Args: { p_submission_id: string; p_correct: boolean };
        Returns: undefined;
      };
      recalc_team_scores: {
        Args: { p_quiz_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
