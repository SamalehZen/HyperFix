import { headroomMiddleware } from 'headroom-ai/vercel-ai';
import { wrapLanguageModel } from 'ai';

/**
 * Wraps a Vercel AI SDK language model with Headroom context compression.
 *
 * When HEADROOM_BASE_URL is set, the model will automatically compress
 * system prompts and context before sending to the LLM, reducing token
 * usage by 60-95% with the same quality output.
 *
 * @see https://headroom-docs.vercel.app/docs/vercel-ai-sdk
 */
export function withHeadroomCompression(model: any): any {
  const baseUrl = process.env.HEADROOM_BASE_URL;

  if (!baseUrl) {
    return model;
  }

  return wrapLanguageModel({
    model,
    middleware: headroomMiddleware({
      baseUrl,
      apiKey: process.env.HEADROOM_API_KEY,
      fallback: true, // Fall back to uncompressed if proxy is down
      timeout: 30000,
    }),
  });
}
