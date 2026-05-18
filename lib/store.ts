export interface DocSession {
  currentBuffer: Buffer;
  htmlPreview: string;
  paragraphs: string[];
}

// Attach to global so Next.js hot-reloads don't wipe sessions in dev mode
const g = global as typeof global & { __resumeSessions?: Map<string, DocSession> };
if (!g.__resumeSessions) g.__resumeSessions = new Map();
const store = g.__resumeSessions;

export function setSession(id: string, session: DocSession): void {
  store.set(id, session);
}

export function getSession(id: string): DocSession | undefined {
  return store.get(id);
}

export function updateSession(id: string, updates: Partial<DocSession>): void {
  const existing = store.get(id);
  if (existing) store.set(id, { ...existing, ...updates });
}
