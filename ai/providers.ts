import 'server-only';
import { customProvider } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';

// Reuse the LanguageModelV2 shape exported indirectly via `google` so we don't
// need to add `@ai-sdk/provider` as a direct dependency just for the type.
type HyperLanguageModel = ReturnType<typeof google>;

// Arka backend: single provider mapping to Google Gemini.
// Default model is Gemini 3.1 Pro Preview. Override via GOOGLE_VERTEX_MODEL.
const DEFAULT_GOOGLE_MODEL = 'gemini-3.1-pro-preview';
const FALLBACK_GOOGLE_MODEL = 'gemini-3.1-flash-lite-preview';
const DEFAULT_VERTEX_LOCATION = 'global';

function getResolvedModel(): string {
  return (process.env.GOOGLE_VERTEX_MODEL?.trim() || DEFAULT_GOOGLE_MODEL);
}

function getFallbackModel(): string {
  return (process.env.GOOGLE_VERTEX_FALLBACK_MODEL?.trim() || FALLBACK_GOOGLE_MODEL);
}

interface VertexServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  private_key_id?: string;
}

function parseServiceAccountJson(): VertexServiceAccount | null {
  const raw = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as VertexServiceAccount;
    return parsed;
  } catch (error) {
    throw new Error(
      `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON is set but is not valid JSON: ${(error as Error).message}`,
    );
  }
}

function normalizePrivateKey(key: string | undefined): string | undefined {
  if (!key) return key;
  return key.replace(/\\n/g, '\n');
}

interface VertexConfig {
  project: string;
  location: string;
  client_email: string;
  private_key: string;
  private_key_id?: string;
}

function readVertexConfig(): VertexConfig | null {
  const sa = parseServiceAccountJson();
  // Explicit env overrides take precedence over fields in the JSON blob, so a
  // single secret can be reused across projects/locations without re-encoding.
  const project = process.env.GOOGLE_VERTEX_PROJECT?.trim() || sa?.project_id;
  const client_email = process.env.GOOGLE_CLIENT_EMAIL?.trim() || sa?.client_email;
  const private_key = normalizePrivateKey(
    process.env.GOOGLE_PRIVATE_KEY?.trim() || sa?.private_key,
  );
  const private_key_id =
    process.env.GOOGLE_PRIVATE_KEY_ID?.trim() || sa?.private_key_id || undefined;
  const location = process.env.GOOGLE_VERTEX_LOCATION?.trim() || DEFAULT_VERTEX_LOCATION;

  if (!project || !client_email || !private_key) return null;

  return { project, location, client_email, private_key, private_key_id };
}

interface HyperLanguageModels {
  primary: HyperLanguageModel;
  fallback?: HyperLanguageModel;
}

let cachedModels: HyperLanguageModels | null = null;
let warnedLegacyFallback = false;
let warnedModelFallback = false;

function withFallback(
  primary: HyperLanguageModel,
  fallbackModelName: string,
  createModel: (model: string) => HyperLanguageModel,
): HyperLanguageModels {
  const primaryModelName = getResolvedModel();
  const fallback = fallbackModelName && fallbackModelName !== primaryModelName
    ? createModel(fallbackModelName)
    : undefined;
  return { primary, fallback };
}

function buildLanguageModels(): HyperLanguageModels {
  const cfg = readVertexConfig();
  const primaryModelName = getResolvedModel();
  const fallbackModelName = getFallbackModel();

  if (cfg) {
    const vertex = createVertex({
      project: cfg.project,
      location: cfg.location,
      googleAuthOptions: {
        credentials: {
          client_email: cfg.client_email,
          private_key: cfg.private_key,
          private_key_id: cfg.private_key_id,
        },
      },
    });
    return withFallback(vertex(primaryModelName), fallbackModelName, vertex);
  }

  // Legacy AI Studio fallback. Only active when intentionally configured;
  // emits a one-shot deprecation warning so production deployments notice.
  const legacyApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (legacyApiKey) {
    if (!warnedLegacyFallback) {
      console.warn(
        '[ai/providers] Falling back to GOOGLE_GENERATIVE_AI_API_KEY (AI Studio). ' +
          'This path is deprecated; configure Vertex AI service account credentials ' +
          '(GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON or split GOOGLE_VERTEX_* / GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY).',
      );
      warnedLegacyFallback = true;
    }
    const googleProvider = createGoogleGenerativeAI({ apiKey: legacyApiKey });
    return withFallback(googleProvider(primaryModelName), fallbackModelName, googleProvider);
  }

  throw new Error(
    'Google AI provider is not configured. Set GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON to the ' +
      'full service account JSON, or set GOOGLE_VERTEX_PROJECT, GOOGLE_CLIENT_EMAIL and ' +
      'GOOGLE_PRIVATE_KEY (optionally GOOGLE_VERTEX_LOCATION, GOOGLE_PRIVATE_KEY_ID, ' +
      'GOOGLE_VERTEX_MODEL). GOOGLE_GENERATIVE_AI_API_KEY is accepted as a deprecated fallback only.',
  );
}

function getLanguageModels(): HyperLanguageModels {
  if (cachedModels) return cachedModels;
  cachedModels = buildLanguageModels();
  return cachedModels;
}

async function runWithModelFallback<T>(operation: (model: HyperLanguageModel) => Promise<T>): Promise<T> {
  const { primary, fallback } = getLanguageModels();
  try {
    return await operation(primary);
  } catch (error) {
    if (!fallback) throw error;
    if (!warnedModelFallback) {
      console.warn(
        `[ai/providers] ${primary.modelId} failed; retrying with fallback model ${fallback.modelId}.`,
      );
      warnedModelFallback = true;
    }
    return operation(fallback);
  }
}

// Lazy LanguageModelV2 wrapper. Defers credential resolution until first use
// so that importing this module from client components or during the Next.js
// build step does not throw when Vertex env vars are absent.
const lazyHyperModel: HyperLanguageModel = {
  specificationVersion: 'v2',
  get provider() {
    return getLanguageModels().primary.provider;
  },
  get modelId() {
    return getLanguageModels().primary.modelId;
  },
  get supportedUrls() {
    return getLanguageModels().primary.supportedUrls;
  },
  doGenerate: (options: Parameters<HyperLanguageModel['doGenerate']>[0]) =>
    runWithModelFallback((model) => model.doGenerate(options)),
  doStream: (options: Parameters<HyperLanguageModel['doStream']>[0]) =>
    runWithModelFallback((model) => model.doStream(options)),
};

// Single Google provider for all hyper-* model ids expected by the UI.
// We keep all original model ids/labels for UI parity, but route everything to Gemini Flash.
export const hyper = customProvider({
  languageModels: {
    'hyper-default': lazyHyperModel,
    'hyper-nano': lazyHyperModel,
    'hyper-name': lazyHyperModel,
    'hyper-grok-3': lazyHyperModel,
    'hyper-grok-4': lazyHyperModel,
    'hyper-grok-4-fast-think': lazyHyperModel,
    'hyper-code': lazyHyperModel,
    'hyper-enhance': lazyHyperModel,
    'hyper-qwen-4b': lazyHyperModel,
    'hyper-qwen-4b-thinking': lazyHyperModel,
    'hyper-gpt5': lazyHyperModel,
    'hyper-gpt5-mini': lazyHyperModel,
    'hyper-gpt5-nano': lazyHyperModel,
    'hyper-o3': lazyHyperModel,
    'hyper-qwen-32b': lazyHyperModel,
    'hyper-gpt-oss-20': lazyHyperModel,
    'hyper-gpt-oss-120': lazyHyperModel,
    'hyper-deepseek-chat': lazyHyperModel,
    'hyper-deepseek-chat-think': lazyHyperModel,
    'hyper-deepseek-r1': lazyHyperModel,
    'hyper-qwen-coder': lazyHyperModel,
    'hyper-qwen-3-next': lazyHyperModel,
    'hyper-qwen-3-next-think': lazyHyperModel,
    'hyper-qwen-3-max': lazyHyperModel,
    'hyper-qwen-3-max-preview': lazyHyperModel,
    'hyper-qwen-235': lazyHyperModel,
    'hyper-qwen-235-think': lazyHyperModel,
    'hyper-glm-air': lazyHyperModel,
    'hyper-glm': lazyHyperModel,
    'hyper-glm-4.6': lazyHyperModel,
    'hyper-kimi-k2-v2': lazyHyperModel,
    'hyper-mistral-medium': lazyHyperModel,
    'hyper-magistral-small': lazyHyperModel,
    'hyper-magistral-medium': lazyHyperModel,
    'hyper-google-lite': lazyHyperModel,
    'hyper-google': lazyHyperModel,
    'hyper-google-think': lazyHyperModel,
    'hyper-google-think-v2': lazyHyperModel,
    'hyper-google-think-v3': lazyHyperModel,
    'hyper-anthropic': lazyHyperModel,
  },
});


export * from './model-config';
