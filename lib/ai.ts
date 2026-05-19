export interface ProposedEdit {
  id: string;
  section: string;
  original: string;
  replacement: string;
  reason: string;
}

export type AIResponse =
  | { type: "answer"; text: string }
  | { type: "edits"; edits: ProposedEdit[] };

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-6";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function processCommand(
  documentText: string,
  command: string,
  history: HistoryMessage[] = []
): Promise<AIResponse> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "AI Resume Editor",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are an AI assistant helping a user review and edit their resume.

First, decide if the user's message is a QUESTION or an EDIT COMMAND.

--- QUESTIONS ---
Questions ask about the resume content, formatting, or previous actions. Examples:
- "Does this line appear in bold?"
- "What changes did you make?"
- "Can you read the summary?"
- "What does my skills section say?"

For questions, respond with:
{"type":"answer","text":"your answer here"}

Note: Text wrapped in **double asterisks** is bold in the resume. You CAN answer questions about bold formatting using this.

--- EDIT COMMANDS ---
Edit commands ask you to change, improve, fix, rewrite, or review something. Examples:
- "Make my summary more impactful"
- "Fix the grammar in the second bullet"
- "Add stronger action verbs"
- "Review my resume and make it better"
- "Improve this"

IMPORTANT: When the user asks you to review, improve, or make something better — propose the edits immediately. Do NOT ask clarifying questions. Do NOT ask for permission. Just return the edits JSON directly.

For edit commands, respond with:
{"type":"edits","edits":[...]}

EDIT RULES:
- The "original" field must be verbatim text copied character-for-character from the resume
- Copy the ENTIRE line as "original", not just a fragment
- NEVER change dates, numbers, company names, or facts unless the user explicitly asks
- Propose the minimum changes needed — do not change things the user didn't ask about
- If no changes are needed, return {"type":"edits","edits":[]}

Edit schema:
{
  "type": "edits",
  "edits": [
    {
      "section": "e.g. Summary, Work Experience, Skills",
      "original": "verbatim line from the resume",
      "replacement": "improved version",
      "reason": "one sentence explanation"
    }
  ]
}

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`,
        },
        {
          role: "user",
          content: `RESUME:\n\n${documentText}`,
        },
        {
          role: "assistant",
          content: "Resume loaded. How can I help you?",
        },
        ...history,
        {
          role: "user",
          content: command,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { type: "answer", text: raw.trim() || "I couldn't understand that." };

  const parsed = JSON.parse(jsonMatch[0]);

  if (parsed.type === "answer") {
    return { type: "answer", text: parsed.text ?? "" };
  }

  const edits = (parsed.edits ?? []) as Omit<ProposedEdit, "id">[];
  return {
    type: "edits",
    edits: edits.map((e, i) => ({ ...e, id: `edit-${Date.now()}-${i}` })),
  };
}
