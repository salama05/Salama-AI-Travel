/**
 * lib/gemini.ts
 *
 * WHY THIS FILE:
 * Two separate Gemini objects — one for chat (text generation) and one for
 * embeddings. We instantiate them once and export; the actual API calls happen
 * in vector-search.ts and agent/route.ts.
 *
 * MODEL RULES (non-negotiable per project spec):
 *   chat       → "gemini-2.5-flash"
 *   embeddings → "gemini-embedding-001", outputDimensionality: 768
 *
 * The 768 dimension MUST match the DIM in every Redis FT.CREATE index, or
 * vectors will silently fail to be stored.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error(
    '[gemini.ts] GEMINI_API_KEY is not set in .env.local. ' +
      'Get it from https://aistudio.google.com/app/apikey'
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/** Chat model — used in /api/agent for conversational responses */
export const chatModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
});

/** Embedding model — used in vector-search.ts to index and query flights */
export const embeddingModel = genAI.getGenerativeModel({
  model: 'gemini-embedding-001',
});

/** The output dimension. Must equal the DIM in every FT.CREATE call. */
export const EMBEDDING_DIM = 768;

/**
 * Embed a single string. Returns a Float32Array of length EMBEDDING_DIM (768).
 * Throws on any API error — no fallbacks, no silent failures.
 */
export async function embedText(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent({
    content: { role: 'user', parts: [{ text }] },
    taskType: 'RETRIEVAL_DOCUMENT',
    outputDimensionality: EMBEDDING_DIM,
  } as any);

  const values = result.embedding.values;
  if (!values || values.length !== EMBEDDING_DIM) {
    throw new Error(
      `[gemini.ts] Expected ${EMBEDDING_DIM}-dim embedding, got ${values?.length ?? 0}. ` +
        'Ensure the model is "gemini-embedding-001" and outputDimensionality is 768.'
    );
  }
  return values;
}
