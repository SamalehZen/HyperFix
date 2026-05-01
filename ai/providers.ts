import { customProvider } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';

// Reuse the LanguageModelV2 shape exported indirectly via `google` so we don't
// need to add `@ai-sdk/provider` as a direct dependency just for the type.
type HyperLanguageModel = ReturnType<typeof google>;

// Arka backend: single provider mapping to Google Gemini Flash.
// Default model is gemini-3.1-flash-lite-preview. Override via GOOGLE_VERTEX_MODEL
// in production (e.g. set to gemini-2.5-flash if the preview alias is unavailable
// in your Vertex project).
const DEFAULT_GOOGLE_MODEL = 'gemini-3.1-flash-lite-preview';
// Fallbacks (documented only; selection is handled at call sites when needed):
const FALLBACK_GOOGLE_MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash'];
const DEFAULT_VERTEX_LOCATION = 'us-central1';

function getResolvedModel(): string {
  return (process.env.GOOGLE_VERTEX_MODEL?.trim() || DEFAULT_GOOGLE_MODEL);
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

let cachedModel: HyperLanguageModel | null = null;
let warnedLegacyFallback = false;

function buildLanguageModel(): HyperLanguageModel {
  const cfg = readVertexConfig();
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
    return vertex(getResolvedModel());
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
    return createGoogleGenerativeAI({ apiKey: legacyApiKey })(getResolvedModel());
  }

  throw new Error(
    'Google AI provider is not configured. Set GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON to the ' +
      'full service account JSON, or set GOOGLE_VERTEX_PROJECT, GOOGLE_CLIENT_EMAIL and ' +
      'GOOGLE_PRIVATE_KEY (optionally GOOGLE_VERTEX_LOCATION, GOOGLE_PRIVATE_KEY_ID, ' +
      'GOOGLE_VERTEX_MODEL). GOOGLE_GENERATIVE_AI_API_KEY is accepted as a deprecated fallback only.',
  );
}

function getLanguageModel(): HyperLanguageModel {
  if (cachedModel) return cachedModel;
  cachedModel = buildLanguageModel();
  return cachedModel;
}

// Lazy LanguageModelV2 wrapper. Defers credential resolution until first use
// so that importing this module from client components or during the Next.js
// build step does not throw when Vertex env vars are absent.
const lazyHyperModel: HyperLanguageModel = {
  specificationVersion: 'v2',
  get provider() {
    return getLanguageModel().provider;
  },
  get modelId() {
    return getLanguageModel().modelId;
  },
  get supportedUrls() {
    return getLanguageModel().supportedUrls;
  },
  doGenerate: (options: Parameters<HyperLanguageModel['doGenerate']>[0]) =>
    getLanguageModel().doGenerate(options),
  doStream: (options: Parameters<HyperLanguageModel['doStream']>[0]) =>
    getLanguageModel().doStream(options),
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

interface ModelParameters {
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  frequencyPenalty?: number;
}

interface Model {
  value: string;
  label: string;
  description: string;
  vision: boolean;
  reasoning: boolean;
  experimental: boolean;
  category: string;
  pdf: boolean;
  pro: boolean;
  requiresAuth: boolean;
  freeUnlimited: boolean;
  maxOutputTokens: number;
  // Tags
  fast?: boolean;
  isNew?: boolean;
  parameters?: ModelParameters;
}

export const models: Model[] = [
  // Models (xAI)
  {
    value: 'hyper-grok-3',
    label: 'Grok 3',
    description: "Le LLM le plus récent et le plus intelligent de xAI",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
  },
  {
    value: 'hyper-grok-4',
    label: 'Grok 4',
    description: "Le LLM le plus intelligent de xAI",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
  },
  {
    value: 'hyper-default',
    label: 'Grok 4 Fast',
    description: "LLM multimodèle le plus rapide de xAI",
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Free',
    pdf: false,
    pro: false,
    requiresAuth: false,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: true,
    isNew: true,
  },
  {
    value: 'hyper-grok-4-fast-think',
    label: 'Grok 4 Fast Thinking',
    description: "LLM multimodèle de raisonnement le plus rapide de xAI",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: true,
    isNew: true,
  },
  {
    value: 'hyper-qwen-32b',
    label: 'Qwen 3 32B',
    description: "LLM de raisonnement avancé d'Alibaba",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Free',
    pdf: false,
    pro: false,
    requiresAuth: false,
    freeUnlimited: false,
    maxOutputTokens: 40960,
    fast: true,
    parameters: {
      temperature: 0.7,
      topP: 0.8,
      topK: 20,
      minP: 0,
    },
  },
  {
    value: 'hyper-qwen-4b',
    label: 'Qwen 3 4B',
    description: "Petit LLM de base d'Alibaba",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Free',
    pdf: false,
    pro: false,
    requiresAuth: false,
    maxOutputTokens: 16000,
    freeUnlimited: false,
    parameters: {
      temperature: 0.7,
      topP: 0.8,
      topK: 20,
      minP: 0,
    },
  },
  {
    value: 'hyper-qwen-4b-thinking',
    label: 'Qwen 3 4B Thinking',
    description: "Petit LLM de base d'Alibaba",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Free',
    pdf: false,
    pro: false,
    requiresAuth: false,
    maxOutputTokens: 16000,
    freeUnlimited: true,
    parameters: {
      temperature: 0.6,
      topP: 0.95,
      topK: 20,
      minP: 0,
    },
  },
  {
    value: 'hyper-gpt-oss-20',
    label: 'GPT OSS 20B',
    description: "Petit LLM open source d'OpenAI",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Free',
    pdf: false,
    pro: false,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: true,
  },
  {
    value: 'hyper-gpt5-nano',
    label: 'GPT 5 Nano',
    description: "Plus petit LLM phare d'OpenAI",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Free',
    pdf: true,
    pro: false,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: true,
  },
  {
    value: 'hyper-google-lite',
    label: 'Gemini 2.5 Flash Lite',
    description: "Petit LLM avancé de Google",
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Free',
    pdf: true,
    pro: false,
    requiresAuth: false,
    freeUnlimited: true,
    maxOutputTokens: 10000,
    isNew: true,
  },
  {
    value: 'hyper-code',
    label: 'Grok Code',
    description: "LLM de codage avancé de xAI",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: true,
  },
  {
    value: 'hyper-mistral-medium',
    label: 'Mistral Medium',
    description: "LLM multimodal moyen de Mistral",
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    isNew: true,
  },
  {
    value: 'hyper-magistral-small',
    label: 'Magistral Small',
    description: "Petit LLM de raisonnement de Mistral",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    isNew: true,
  },
  {
    value: 'hyper-magistral-medium',
    label: 'Magistral Medium',
    description: "Mistral's medium reasoning LLM",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    isNew: true,
  },
  {
    value: 'hyper-gpt-oss-120',
    label: 'GPT OSS 120B',
    description: "LLM open source avancé d'OpenAI",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: true,
  },
  {
    value: 'hyper-gpt5-mini',
    label: 'GPT 5 Mini',
    description: "Petit LLM phare d'OpenAI",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: false,
    isNew: true,
  },
  {
    value: 'hyper-gpt5',
    label: 'GPT 5',
    description: "LLM phare d'OpenAI",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: false,
    isNew: true,
  },
  {
    value: 'hyper-o3',
    label: 'o3',
    description: "LLM avancé d'OpenAI",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    fast: false,
    isNew: true,
  },
  {
    value: 'hyper-deepseek-chat',
    label: 'DeepSeek 3.2 Exp',
    description: "LLM de conversation avancé de DeepSeek",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    isNew: true,
  },
  {
    value: 'hyper-deepseek-chat-think',
    label: 'DeepSeek 3.2 Exp Thinking',
    description: "LLM de conversation avancé avec raisonnement de DeepSeek",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    isNew: true,
  },
  {
    value: 'hyper-deepseek-r1',
    label: 'DeepSeek R1',
    description: "LLM de raisonnement avancé de DeepSeek",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 16000,
    isNew: true,
  },
  {
    value: 'hyper-qwen-coder',
    label: 'Qwen 3 Coder 480B-A35B',
    description: "Alibaba's advanced coding LLM",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 130000,
    fast: true,
  },
  {
    value: 'hyper-qwen-3-next',
    label: 'Qwen 3 Next 80B A3B Instruct',
    description: "LLM d'instruction avancé de Qwen",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 100000,
    fast: true,
    isNew: true,
    parameters: {
      temperature: 0.7,
      topP: 0.8,
      minP: 0,
    },
  },
  {
    value: 'hyper-qwen-3-next-think',
    label: 'Qwen 3 Next 80B A3B Thinking',
    description: "LLM de raisonnement avancé de Qwen",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 100000,
    isNew: true,
    parameters: {
      temperature: 0.6,
      topP: 0.95,
      minP: 0,
    },
  },
  {
    value: 'hyper-qwen-3-max',
    label: 'Qwen 3 Max',
    description: "LLM d'instruction avancé de Qwen",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 10000,
    isNew: true,
  },
  {
    value: 'hyper-qwen-3-max-preview',
    label: 'Qwen 3 Max Preview',
    description: "LLM d'instruction avancé de Qwen",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 10000,
    isNew: true,
  },
  {
    value: 'hyper-qwen-235',
    label: 'Qwen 3 235B A22B',
    description: "LLM d'instruction avancé de Qwen",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 100000,
    parameters: {
      temperature: 0.7,
      topP: 0.8,
      minP: 0,
    },
  },
  {
    value: 'hyper-qwen-235-think',
    label: 'Qwen 3 235B A22B Thinking',
    description: "LLM de raisonnement avancé de Qwen",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 100000,
    parameters: {
      temperature: 0.6,
      topP: 0.95,
      minP: 0,
    },
  },
  {
    value: 'hyper-kimi-k2-v2',
    label: 'Kimi K2 Latest',
    description: "LLM de base avancé de MoonShot AI",
    vision: false,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 10000,
    fast: true,
    parameters: {
      temperature: 0.6,
    },
  },
  {
    value: 'hyper-glm-4.6',
    label: 'GLM 4.6',
    description: "LLM de raisonnement avancé de Zhipu AI",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 130000,
    isNew: true,
  },
  {
    value: 'hyper-glm-air',
    label: 'GLM 4.5 Air',
    description: "LLM de base efficace de Zhipu AI",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 130000,
  },
  {
    value: 'hyper-glm',
    label: 'GLM 4.5',
    description: "Ancien LLM avancé de Zhipu AI",
    vision: false,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: false,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 13000,
  },
  {
    value: 'hyper-google',
    label: 'Gemini 2.5 Flash',
    description: "Petit LLM avancé de Google",
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 10000,
    isNew: true,
  },
  {
    value: 'hyper-google-think',
    label: 'Hypermarché L’Hyper',
    description: "Petit LLM avancé de Google avec raisonnement",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: false,
    requiresAuth: false,
    freeUnlimited: true,
    maxOutputTokens: 10000,
    isNew: true,
  },
  {
    value: 'hyper-google-think-v2',
    label: 'Plateforme — Bientôt disponible',
    description: "Petit LLM avancé de Google avec raisonnement",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: false,
    requiresAuth: false,
    freeUnlimited: true,
    maxOutputTokens: 10000,
    isNew: true,
  },
  {
    value: 'hyper-google-think-v3',
    label: 'Direction — Bientôt disponible',
    description: "Petit LLM avancé de Google avec raisonnement",
    vision: true,
    reasoning: true,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: false,
    requiresAuth: false,
    freeUnlimited: true,
    maxOutputTokens: 10000,
    isNew: true,
  },
  {
    value: 'hyper-anthropic',
    label: 'Claude 4.5 Sonnet',
    description: "Le LLM le plus avancé d'Anthropic",
    vision: true,
    reasoning: false,
    experimental: false,
    category: 'Pro',
    pdf: true,
    pro: true,
    requiresAuth: true,
    freeUnlimited: false,
    maxOutputTokens: 8000,
    isNew: false,
  },
];

// Helper functions for model access checks
export function getModelConfig(modelValue: string) {
  return models.find((model) => model.value === modelValue);
}

export function requiresAuthentication(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.requiresAuth || false;
}

export function requiresProSubscription(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.pro || false;
}

export function isFreeUnlimited(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.freeUnlimited || false;
}

export function hasVisionSupport(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.vision || false;
}

export function hasPdfSupport(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.pdf || false;
}

export function hasReasoningSupport(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.reasoning || false;
}

export function isExperimentalModel(modelValue: string): boolean {
  const model = getModelConfig(modelValue);
  return model?.experimental || false;
}

export function getMaxOutputTokens(modelValue: string): number {
  const model = getModelConfig(modelValue);
  return model?.maxOutputTokens || 8000;
}

export function getModelParameters(modelValue: string): ModelParameters {
  const model = getModelConfig(modelValue);
  return model?.parameters || {};
}

// Access control helper
export function canUseModel(modelValue: string, user: any, isProUser: boolean): { canUse: boolean; reason?: string } {
  const model = getModelConfig(modelValue);

  if (!model) {
    return { canUse: false, reason: 'Model not found' };
  }

  // Check if model requires authentication
  if (model.requiresAuth && !user) {
    return { canUse: false, reason: 'authentication_required' };
  }

  // Check if model requires Pro subscription
  if (model.pro && !isProUser) {
    return { canUse: false, reason: 'pro_subscription_required' };
  }

  return { canUse: true };
}

// Helper to check if user should bypass rate limits
export function shouldBypassRateLimits(modelValue: string, user: any): boolean {
  const model = getModelConfig(modelValue);
  return Boolean(user && model?.freeUnlimited);
}

// Get acceptable file types for a model
export function getAcceptedFileTypes(modelValue: string, isProUser: boolean): string {
  const model = getModelConfig(modelValue);
  if (model?.pdf && isProUser) {
    return 'image/*,.pdf';
  }
  return 'image/*';
}

// Legacy arrays for backward compatibility (deprecated - use helper functions instead)
export const authRequiredModels = models.filter((m) => m.requiresAuth).map((m) => m.value);
export const proRequiredModels = models.filter((m) => m.pro).map((m) => m.value);
export const freeUnlimitedModels = models.filter((m) => m.freeUnlimited).map((m) => m.value);
