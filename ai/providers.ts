import 'server-only';
import { customProvider } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

type HyperLanguageModel = ReturnType<ReturnType<typeof createOpenAICompatible>>;

// ---------------------------------------------------------------------------
// Provider 1: OpenCode Zen (https://opencode.ai/zen/v1) — DeepSeek V4 Flash Free.
// Used for all text-only hyper-* model ids. See model-config.ts for UI labels.
// ---------------------------------------------------------------------------
const OPENCODE_ZEN_BASE_URL = 'https://opencode.ai/zen/v1';
const OPENCODE_ZEN_MODEL = 'deepseek-v4-flash-free';

let cachedZenModel: HyperLanguageModel | null = null;

function getZenLanguageModel(): HyperLanguageModel {
  const apiKey = process.env.OPENCODE_ZEN_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'OPENCODE_ZEN_API_KEY is not set. Text hyper-* models route through OpenCode Zen ' +
        'and require this variable. Add it to your environment (e.g. Vercel Settings > Environment Variables).',
    );
  }
  if (!cachedZenModel) {
    const zen = createOpenAICompatible({
      name: 'opencode-zen',
      baseURL: OPENCODE_ZEN_BASE_URL,
      apiKey,
    });
    cachedZenModel = zen(OPENCODE_ZEN_MODEL);
  }
  return cachedZenModel;
}

// ---------------------------------------------------------------------------
// Provider 2: Google Vertex AI — Gemini 3.5 Flash Lite.
// Used for all hyper-* model ids with pdf/vision support (PDF → Excel agent).
// Gemini handles application/pdf inline natively.
// ---------------------------------------------------------------------------
const DEFAULT_VERTEX_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_VERTEX_LOCATION = 'global';

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
    return JSON.parse(raw) as VertexServiceAccount;
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

let cachedVertexModel: HyperLanguageModel | null = null;

function getVertexLanguageModel(): HyperLanguageModel {
  const cfg = readVertexConfig();
  if (!cfg) {
    throw new Error(
      'Vertex AI is not configured. Vision/pdf models (hyper-google-lite, hyper-google, etc.) ' +
        'require GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON or GOOGLE_VERTEX_PROJECT + GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY.',
    );
  }
  if (!cachedVertexModel) {
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
    const modelId = process.env.GOOGLE_VERTEX_MODEL?.trim() || DEFAULT_VERTEX_MODEL;
    cachedVertexModel = vertex(modelId) as unknown as HyperLanguageModel;
  }
  return cachedVertexModel;
}

// ---------------------------------------------------------------------------
// Lazy wrappers. Defer credential resolution until first use so importing this
// module during the Next.js build step never throws when keys are absent.
// ---------------------------------------------------------------------------
function makeLazyModel(resolve: () => HyperLanguageModel): HyperLanguageModel {
  return {
    specificationVersion: 'v2',
    get provider() {
      return resolve().provider;
    },
    get modelId() {
      return resolve().modelId;
    },
    get supportedUrls() {
      return resolve().supportedUrls;
    },
    doGenerate: (options: Parameters<HyperLanguageModel['doGenerate']>[0]) =>
      resolve().doGenerate(options),
    doStream: (options: Parameters<HyperLanguageModel['doStream']>[0]) =>
      resolve().doStream(options),
  };
}

const lazyZenModel = makeLazyModel(getZenLanguageModel);
const lazyVertexModel = makeLazyModel(getVertexLanguageModel);

// ---------------------------------------------------------------------------
// Provider registry. Text-only ids route to OpenCode Zen (DeepSeek V4 Flash
// Free); pdf/vision ids route to Gemini via Vertex (PDF → Excel agent).
// ---------------------------------------------------------------------------
export const hyper = customProvider({
  languageModels: {
    'hyper-default': lazyZenModel,
    'hyper-nano': lazyZenModel,
    'hyper-name': lazyZenModel,
    'hyper-grok-3': lazyZenModel,
    'hyper-grok-4': lazyZenModel,
    'hyper-grok-4-fast-think': lazyZenModel,
    'hyper-code': lazyZenModel,
    'hyper-enhance': lazyZenModel,
    'hyper-qwen-4b': lazyZenModel,
    'hyper-qwen-4b-thinking': lazyZenModel,
    'hyper-gpt5': lazyVertexModel,
    'hyper-gpt5-mini': lazyVertexModel,
    'hyper-gpt5-nano': lazyVertexModel,
    'hyper-o3': lazyVertexModel,
    'hyper-qwen-32b': lazyZenModel,
    'hyper-gpt-oss-20': lazyZenModel,
    'hyper-gpt-oss-120': lazyZenModel,
    'hyper-deepseek-chat': lazyZenModel,
    'hyper-deepseek-chat-think': lazyZenModel,
    'hyper-deepseek-r1': lazyZenModel,
    'hyper-deepseek-v4-flash-free': lazyZenModel,
    'hyper-qwen-coder': lazyZenModel,
    'hyper-qwen-3-next': lazyZenModel,
    'hyper-qwen-3-next-think': lazyZenModel,
    'hyper-qwen-3-max': lazyZenModel,
    'hyper-qwen-3-max-preview': lazyZenModel,
    'hyper-qwen-235': lazyZenModel,
    'hyper-qwen-235-think': lazyZenModel,
    'hyper-glm-air': lazyZenModel,
    'hyper-glm': lazyZenModel,
    'hyper-glm-4.6': lazyZenModel,
    'hyper-kimi-k2-v2': lazyZenModel,
    'hyper-mistral-medium': lazyVertexModel,
    'hyper-magistral-small': lazyVertexModel,
    'hyper-magistral-medium': lazyVertexModel,
    'hyper-google-lite': lazyVertexModel,
    'hyper-google': lazyVertexModel,
    'hyper-google-think': lazyVertexModel,
    'hyper-google-think-v2': lazyVertexModel,
    'hyper-google-think-v3': lazyVertexModel,
    'hyper-anthropic': lazyVertexModel,
  },
});

export * from './model-config';
