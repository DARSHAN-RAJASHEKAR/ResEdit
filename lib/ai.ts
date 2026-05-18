export interface ProposedEdit {
  id: string;
  section: string;
  original: string;
  replacement: string;
  reason: string;
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";

export async function proposeEdits(
  documentText: string,
  command: string
): Promise<ProposedEdit[]> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "AI Resume Editor",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `You are a professional resume editor. Given a resume and an editing command, propose specific targeted edits.

RULES:
- Return ONLY a valid JSON array, no markdown, no explanation outside the array
- The "original" field must be a verbatim substring copied character-for-character from the resume — do NOT paraphrase, summarize, or alter spacing/punctuation
- If a line needs changing, copy the ENTIRE line as "original", not just part of it
- Propose the minimum number of changes needed to fulfill the command
- Do not change text that doesn't need changing

JSON schema:
[
  {
    "section": "e.g. Summary, Work Experience, Skills",
    "original": "verbatim text from the resume, copied exactly",
    "replacement": "the improved text",
    "reason": "one sentence explaining the improvement"
  }
]

Return [] if no changes are needed.`,
        },
        {
          role: "user",
          content: `RESUME:\n\n${documentText}\n\n---\n\nCOMMAND: ${command}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const edits = JSON.parse(jsonMatch[0]) as Omit<ProposedEdit, "id">[];
  return edits.map((e, i) => ({ ...e, id: `edit-${Date.now()}-${i}` }));
}
