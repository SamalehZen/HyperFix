// https://env.t3.gg/docs/nextjs#create-your-schema
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const serverEnv = createEnv({
  server: {
    // Vertex AI Gemini (preferred). Combined validation lives in ai/providers.ts
    // because deployments may use either the full service account JSON or the
    // split env vars, but not necessarily both.
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: z.string().optional(),
    GOOGLE_VERTEX_PROJECT: z.string().optional(),
    GOOGLE_VERTEX_LOCATION: z.string().optional(),
    GOOGLE_VERTEX_MODEL: z.string().optional(),
    GOOGLE_CLIENT_EMAIL: z.string().optional(),
    GOOGLE_PRIVATE_KEY: z.string().optional(),
    GOOGLE_PRIVATE_KEY_ID: z.string().optional(),

    // Deprecated AI Studio key. Kept optional so local dev does not hard-fail
    // during the Vertex migration; remove once all environments are on Vertex.
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),

    LOCAL_AUTH_SECRET: z.string().optional(),

    // Deprecated / unused at runtime (kept for compile-time compatibility)
    XAI_API_KEY: z.string().optional().default('deprecated'),
    OPENAI_API_KEY: z.string().optional().default('deprecated'),
    ANTHROPIC_API_KEY: z.string().optional().default('deprecated'),
    GROQ_API_KEY: z.string().optional().default('deprecated'),
    DAYTONA_API_KEY: z.string().optional().default('deprecated'),
    BETTER_AUTH_SECRET: z.string().optional().default('deprecated'),
    GITHUB_CLIENT_ID: z.string().optional().default('deprecated'),
    GITHUB_CLIENT_SECRET: z.string().optional().default('deprecated'),
    GOOGLE_CLIENT_ID: z.string().optional().default('deprecated'),
    GOOGLE_CLIENT_SECRET: z.string().optional().default('deprecated'),
    TWITTER_CLIENT_ID: z.string().optional().default('deprecated'),
    TWITTER_CLIENT_SECRET: z.string().optional().default('deprecated'),
    UPSTASH_REDIS_REST_URL: z.string().optional().default('deprecated'),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional().default('deprecated'),
    ELEVENLABS_API_KEY: z.string().optional().default('deprecated'),
    TAVILY_API_KEY: z.string().optional().default('deprecated'),
    EXA_API_KEY: z.string().optional().default('deprecated'),
    SERPER_API_KEY: z.string().min(1, 'Serper API key is required for EAN search'),
    VALYU_API_KEY: z.string().optional().default('deprecated'),
    TMDB_API_KEY: z.string().optional().default('deprecated'),
    YT_ENDPOINT: z.string().optional().default('deprecated'),
    FIRECRAWL_API_KEY: z.string().optional().default('deprecated'),
    PARALLEL_API_KEY: z.string().optional().default('deprecated'),
    OPENWEATHER_API_KEY: z.string().optional().default('deprecated'),
    GOOGLE_MAPS_API_KEY: z.string().optional().default('deprecated'),
    AMADEUS_API_KEY: z.string().optional().default('deprecated'),
    AMADEUS_API_SECRET: z.string().optional().default('deprecated'),
    CRON_SECRET: z.string().optional().default('deprecated'),
    SMITHERY_API_KEY: z.string().optional().default('deprecated'),
    COINGECKO_API_KEY: z.string().optional().default('deprecated'),
    QSTASH_TOKEN: z.string().optional().default('deprecated'),
    RESEND_API_KEY: z.string().optional().default('deprecated'),
    SUPERMEMORY_API_KEY: z.string().optional().default('deprecated'),
    ALLOWED_ORIGINS: z.string().optional().default('http://localhost:3000'),

    PUSHER_APP_ID: z.string().optional(),
    PUSHER_KEY: z.string().optional(),
    PUSHER_SECRET: z.string().optional(),
    PUSHER_CLUSTER: z.string().optional(),
    PUSHER_USE_TLS: z.string().optional().default('true'),
  },
  experimental__runtimeEnv: process.env,
});
