import 'server-only';
import { customProvider } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

type HyperLanguageModel = ReturnType<ReturnType<typeof createOpenAICompatible>>;

// OpenCode Zen (https://opencode.ai/zen/v1): DeepSeek V4 Flash Free.
// All hyper-* model ids are routed through this single provider. See model-config.ts
// for the UI labels/metadata.
const OPENCODE_ZEN_BASE_URL = 'https://opencode.ai/zen/v1';
const OPENCODE_ZEN_MODEL = 'deepseek-v4-flash-free';

let cachedZenModel: HyperLanguageModel | null = null;

function getZenLanguageModel(): HyperLanguageModel {
  const apiKey = process.env.OPENCODE_ZEN_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'OPENCODE_ZEN_API_KEY is not set. All hyper-* models route through OpenCode Zen ' +
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

// Lazy wrapper. Defers credential resolution until first use so importing this
// module during the Next.js build step never throws when the key is absent.
const lazyZenModel: HyperLanguageModel = {
  specificationVersion: 'v2',
  get provider() {
    return getZenLanguageModel().provider;
  },
  get modelId() {
    return getZenLanguageModel().modelId;
  },
  get supportedUrls() {
    return getZenLanguageModel().supportedUrls;
  },
  doGenerate: (options: Parameters<HyperLanguageModel['doGenerate']>[0]) =>
    getZenLanguageModel().doGenerate(options),
  doStream: (options: Parameters<HyperLanguageModel['doStream']>[0]) =>
    getZenLanguageModel().doStream(options),
};

// Single OpenCode Zen provider for all hyper-* model ids expected by the UI.
// We keep all original model ids/labels for UI parity, but route everything to
// DeepSeek V4 Flash Free via OpenCode Zen.
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
    'hyper-gpt5': lazyZenModel,
    'hyper-gpt5-mini': lazyZenModel,
    'hyper-gpt5-nano': lazyZenModel,
    'hyper-o3': lazyZenModel,
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
    'hyper-mistral-medium': lazyZenModel,
    'hyper-magistral-small': lazyZenModel,
    'hyper-magistral-medium': lazyZenModel,
    'hyper-google-lite': lazyZenModel,
    'hyper-google': lazyZenModel,
    'hyper-google-think': lazyZenModel,
    'hyper-google-think-v2': lazyZenModel,
    'hyper-google-think-v3': lazyZenModel,
    'hyper-anthropic': lazyZenModel,
  },
});

export * from './model-config';
