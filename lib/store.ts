import { Redis } from "@upstash/redis";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DocSession {
  currentBufferB64: string; // Buffer stored as base64
  htmlPreview: string;
  paragraphs: string[];
  annotatedParagraphs: string[];
  history: ChatMessage[];
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SESSION_TTL = 60 * 60 * 2; // 2 hours

function sessionKey(id: string) {
  return `resume:session:${id}`;
}

export async function setSession(id: string, session: DocSession): Promise<void> {
  await redis.set(sessionKey(id), JSON.stringify(session), { ex: SESSION_TTL });
}

export async function getSession(id: string): Promise<DocSession | null> {
  const raw = await redis.get<string>(sessionKey(id));
  if (!raw) return null;
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  return data as DocSession;
}

export async function updateSession(id: string, updates: Partial<DocSession>): Promise<void> {
  const existing = await getSession(id);
  if (!existing) return;
  await setSession(id, { ...existing, ...updates });
}

// Helpers to convert between Buffer and base64
export function bufferToB64(buf: Buffer): string {
  return buf.toString("base64");
}

export function b64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}
