import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

type GenQuestion = {
  type: "closed" | "open" | "truefalse";
  prompt: string;
  choices?: string[];
  answer_index?: number;
  answer_text?: string;
  answer_bool?: boolean;
  points: number;
};

const SYSTEM = `You are a quiz-question generator for a pub quiz. Return ONLY valid JSON of the form:
{"questions": [{"type":"closed"|"open"|"truefalse", "prompt": string, "choices"?: string[4], "answer_index"?: number, "answer_text"?: string, "answer_bool"?: boolean, "points": 1|2|3}]}

Rules:
- "closed" questions MUST have exactly 4 choices and answer_index (0-3)
- "truefalse" questions MUST have answer_bool (true/false), no choices
- "open" questions MUST have answer_text
- Every question MUST have points (1 easy, 2 medium, 3 hard)
- The questions should be factually correct, unambiguous, pub-friendly.
- Do not wrap the JSON in markdown or prose.`;

function userPrompt(
  topic: string,
  count: number,
  qType: string,
  difficulty: string
): string {
  const typeHint =
    qType === "mixed"
      ? 'Mix question types — roughly half "closed", some "open", some "truefalse".'
      : `All questions should be type "${qType}".`;
  return `Generate ${count} quiz questions about "${topic}" at ${difficulty} difficulty. ${typeHint}`;
}

function safeParseJSON(text: string): { questions?: GenQuestion[] } {
  // strip markdown code fences if present
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // try to extract first JSON object
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Model did not return JSON");
  }
}

function validate(qs: GenQuestion[]): GenQuestion[] {
  const out: GenQuestion[] = [];
  for (const q of qs) {
    if (q.type === "closed") {
      if (!Array.isArray(q.choices) || q.choices.length !== 4) continue;
      if (typeof q.answer_index !== "number" || q.answer_index < 0 || q.answer_index > 3)
        continue;
      out.push({
        type: "closed",
        prompt: String(q.prompt),
        choices: q.choices.map(String),
        answer_index: q.answer_index,
        points: q.points ?? 1,
      });
    } else if (q.type === "truefalse") {
      if (typeof q.answer_bool !== "boolean") continue;
      out.push({
        type: "truefalse",
        prompt: String(q.prompt),
        answer_bool: q.answer_bool,
        points: q.points ?? 1,
      });
    } else if (q.type === "open") {
      if (typeof q.answer_text !== "string") continue;
      out.push({
        type: "open",
        prompt: String(q.prompt),
        answer_text: q.answer_text,
        points: q.points ?? 1,
      });
    }
  }
  return out;
}

async function callAnthropic(
  apiKey: string,
  topic: string,
  count: number,
  qType: string,
  diff: string
): Promise<GenQuestion[]> {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt(topic, count, qType, diff) }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const parsed = safeParseJSON(text);
  return validate(parsed.questions ?? []);
}

async function callOpenAI(
  apiKey: string,
  topic: string,
  count: number,
  qType: string,
  diff: string
): Promise<GenQuestion[]> {
  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt(topic, count, qType, diff) },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "";
  const parsed = safeParseJSON(text);
  return validate(parsed.questions ?? []);
}

async function callGemini(
  apiKey: string,
  topic: string,
  count: number,
  qType: string,
  diff: string
): Promise<GenQuestion[]> {
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM,
    generationConfig: { responseMimeType: "application/json" },
  });
  const res = await model.generateContent(userPrompt(topic, count, qType, diff));
  const text = res.response.text();
  const parsed = safeParseJSON(text);
  return validate(parsed.questions ?? []);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const topic = String(body.topic || "").trim();
  const count = Math.min(15, Math.max(1, Number(body.count) || 5));
  const qType = ["mixed", "closed", "open", "truefalse"].includes(body.qType)
    ? body.qType
    : "mixed";
  const difficulty = String(body.difficulty || "medium");

  if (!topic) return NextResponse.json({ error: "Topic required" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("api_provider, api_key")
    .eq("id", user.id)
    .single();

  if (!profile?.api_key) {
    return NextResponse.json(
      { error: "No API key in Settings" },
      { status: 400 }
    );
  }

  try {
    let questions: GenQuestion[];
    if (profile.api_provider === "openai") {
      questions = await callOpenAI(profile.api_key, topic, count, qType, difficulty);
    } else if (profile.api_provider === "gemini") {
      questions = await callGemini(profile.api_key, topic, count, qType, difficulty);
    } else {
      questions = await callAnthropic(profile.api_key, topic, count, qType, difficulty);
    }
    return NextResponse.json({ questions });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Generation failed" },
      { status: 500 }
    );
  }
}
