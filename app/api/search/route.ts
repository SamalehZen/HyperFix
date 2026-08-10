// /app/api/chat/route.ts
import {
  getGroupConfig,
  getUserMessageCount,
  getExtremeSearchUsageCount,
  getCurrentUser,
  getLightweightUser,
} from '@/app/actions';
import {
  convertToModelMessages,
  streamText,
  NoSuchToolError,
  createUIMessageStream,
  generateObject,
  stepCountIs,
  JsonToSseTransformStream,
} from 'ai';
import { hyper } from '@/ai/providers';
import {
  requiresAuthentication,
  requiresProSubscription,
  shouldBypassRateLimits,
  getModelParameters,
  hasReasoningSupport,
  getModelConfig,
  hasPdfSupport,
  hasVisionSupport,
} from '@/ai/model-config';
import {
  createStreamId,
  getChatById,
  saveChat,
  saveMessages,
  incrementExtremeSearchUsage,
  incrementMessageUsage,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { createResumableStreamContext, type ResumableStreamContext } from 'resumable-stream';
import { after } from 'next/server';
import { CustomInstructions } from '@/lib/db/schema';
import { v7 as uuidv7 } from 'uuid';
import { geolocation } from '@vercel/functions';
import { createStreamResponse } from '@/lib/streaming-heartbeat';


import { GroqProviderOptions } from '@ai-sdk/groq';
import { markdownJoinerTransform } from '@/lib/parser';
import { ChatMessage } from '@/lib/types';
import { OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { getCachedCustomInstructionsByUserId } from '@/lib/user-data-server';
import { type GoogleLanguageModelOptions } from '@ai-sdk/google';

import { CohereChatModelOptions } from '@ai-sdk/cohere';

let globalStreamContext: ResumableStreamContext | null = null;

let configPromise: Promise<any>;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
        keyPrefix: 'hyper-ai',
      });
    } catch (error: any) {
      // Silently handle resumable stream initialization errors
    }
  }

  return globalStreamContext;
}

export async function POST(req: Request) {
  const requestStartTime = Date.now();
  const {
    messages,
    model,
    group,
    timezone,
    id,
    selectedVisibilityType,
    isCustomInstructionsEnabled,
    searchProvider,
    selectedConnectors,
  } = await req.json();
  const { latitude, longitude } = geolocation(req);
  const streamId = 'stream-' + uuidv7();

  const rawModel = typeof model === 'string' ? model.trim() : '';
  let resolvedModel = getModelConfig(rawModel) ? rawModel : 'hyper-default';

  // Text agents (libeller, cyrus, nomenclature, eanexpert, chat) must not route
  // through Vertex. If the user picked a pdf/vision model in the ModelSwitcher,
  // fall back to the OpenCode Zen text model unless we are in the PDF→Excel group
  // or the current message actually contains image/pdf attachments (which need a
  // vision-capable model).
  const hasFileMessage = Array.isArray(messages) && messages.some((msg: any) =>
    Array.isArray(msg?.parts) &&
    msg.parts.some((part: any) =>
      part?.type === 'file' &&
      (part.mediaType === 'application/pdf' || String(part.mediaType || '').startsWith('image/')),
    ),
  );
  if (group !== 'pdfExcel' && !hasFileMessage && (hasPdfSupport(resolvedModel) || hasVisionSupport(resolvedModel))) {
    resolvedModel = 'hyper-default';
  }



  const lightweightUser = await getLightweightUser();


  if (!lightweightUser) {
    if (requiresAuthentication(resolvedModel)) {
      return new ChatSDKError('unauthorized:model', `${resolvedModel} requires authentication`).toResponse();
    }
  } else {
    if (requiresProSubscription(resolvedModel) && !lightweightUser.isProUser) {
      return new ChatSDKError('upgrade_required:model', `${resolvedModel} requires a Pro subscription`).toResponse();
    }
  }

  const isProUser = lightweightUser?.isProUser ?? false;

  configPromise = getGroupConfig(group);

  const fullUserPromise = lightweightUser ? getCurrentUser() : Promise.resolve(null);

  const customInstructionsPromise = lightweightUser && (isCustomInstructionsEnabled ?? true)
    ? fullUserPromise.then(user => user ? getCachedCustomInstructionsByUserId(user.id) : null)
    : Promise.resolve(null);

  let criticalChecksPromise: Promise<{
    canProceed: boolean;
    error?: any;
    isProUser: boolean;
    messageCount?: number;
    extremeSearchUsage?: number;
    subscriptionData?: any;
    shouldBypassLimits?: boolean;
  }>;

  if (lightweightUser) {
    const chatValidationPromise = getChatById({ id }).then(async (existingChat) => {
      if (existingChat && existingChat.userId !== lightweightUser.userId) {
        throw new ChatSDKError('forbidden:chat', 'This chat belongs to another user');
      }

      if (!existingChat) {
        await saveChat({
          id,
          userId: lightweightUser.userId,
          title: 'New Chat',
          visibility: selectedVisibilityType,
        });


      }

      await createStreamId({ streamId, chatId: id });

      return existingChat;
    });

    if (!isProUser) {
      criticalChecksPromise = Promise.all([
        fullUserPromise,
        chatValidationPromise,
      ]).then(async ([user]) => {
        if (!user) {
          throw new ChatSDKError('unauthorized:auth', 'User authentication failed');
        }

        const [messageCountResult, extremeSearchUsage] = await Promise.all([
          getUserMessageCount(user),
          getExtremeSearchUsageCount(user),
        ]);

        if (messageCountResult.error) {
          throw new ChatSDKError('bad_request:api', 'Failed to verify usage limits');
        }

        const shouldBypassLimits = shouldBypassRateLimits(resolvedModel, user);
        if (!shouldBypassLimits && messageCountResult.count !== undefined && messageCountResult.count >= 100) {
          throw new ChatSDKError('rate_limit:chat', 'Daily search limit reached');
        }

        return {
          canProceed: true,
          isProUser: false,
          messageCount: messageCountResult.count,
          extremeSearchUsage: extremeSearchUsage.count,
          subscriptionData: user.polarSubscription
            ? { hasSubscription: true, subscription: { ...user.polarSubscription, organizationId: null } }
            : { hasSubscription: false },
          shouldBypassLimits,
        };
      }).catch(error => {
        if (error instanceof ChatSDKError) throw error;
        throw new ChatSDKError('bad_request:api', 'Failed to verify user access');
      });
    } else {
      criticalChecksPromise = Promise.all([
        fullUserPromise,
        chatValidationPromise,
      ]).then(([user]) => ({
        canProceed: true,
        isProUser: true,
        messageCount: 0,
        extremeSearchUsage: 0,
        subscriptionData: user?.polarSubscription
          ? { hasSubscription: true, subscription: { ...user.polarSubscription, organizationId: null } }
          : { hasSubscription: false },
        shouldBypassLimits: true,
      }));
    }
  } else {
    criticalChecksPromise = Promise.resolve({
      canProceed: true,
      isProUser: false,
      messageCount: 0,
      extremeSearchUsage: 0,
      subscriptionData: null,
      shouldBypassLimits: false,
    });
  }

  let customInstructions: CustomInstructions | null = null;

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer: dataStream }) => {
      const [criticalResult, { tools: activeTools, instructions }, customInstructionsResult, user] = await Promise.all([
        criticalChecksPromise,
        configPromise,
        customInstructionsPromise,
        fullUserPromise,
      ]);

      if (!criticalResult.canProceed) {
        throw criticalResult.error;
      }

      customInstructions = customInstructionsResult;

      if (user) {
        await saveMessages({
          messages: [{
            chatId: id,
            id: messages[messages.length - 1].id,
            role: 'user',
            parts: messages[messages.length - 1].parts,
            attachments: messages[messages.length - 1].experimental_attachments ?? [],
            createdAt: new Date(),
            model: resolvedModel,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            completionTime: 0,
          }],
        });
      }

      const setupTime = (Date.now() - requestStartTime) / 1000;

      const streamStartTime = Date.now();
      const shouldIncludeThinking = resolvedModel === 'hyper-default' || hasReasoningSupport(resolvedModel);

      const result = streamText({
        model: hyper.languageModel(resolvedModel),
        messages: convertToModelMessages(messages),
        ...getModelParameters(resolvedModel),
        stopWhen: stepCountIs(5),
        onAbort: ({ steps }) => {
        },
        maxRetries: 10,
        activeTools: [...activeTools],
        experimental_transform: markdownJoinerTransform(),
        system:
          instructions +
          (customInstructions && (isCustomInstructionsEnabled ?? true)
            ? `\n\nThe user's custom instructions are as follows and YOU MUST FOLLOW THEM AT ALL COSTS: ${customInstructions?.content}`
            : '\n') +
          (latitude && longitude ? `\n\nThe user's location is ${latitude}, ${longitude}.` : ''),
        toolChoice: 'auto',
        providerOptions: {
          google: {
            ...(shouldIncludeThinking
              ? {
                thinkingConfig: {
                  thinkingLevel: 'high',
                  includeThoughts: true,
                },
              }
              : {}),
            threshold: "OFF",
          } satisfies GoogleLanguageModelOptions,
        },
        prepareStep: async ({ steps, messages }) => {
          const totalTokens = steps.reduce((sum, step) => sum + (step.usage?.totalTokens ?? 0), 0);

          const shouldPrune = messages.length > 10 || totalTokens > 100000;
          
          const modelHasReasoning = hasReasoningSupport(resolvedModel);

          const totalToolCalls = steps.reduce(
            (count, step) => count + step.toolCalls.length,
            0,
          );

          const MAX_TOOL_CALLS_PER_RESPONSE = 10;

          if (totalToolCalls >= MAX_TOOL_CALLS_PER_RESPONSE) {
            return {
              toolChoice: 'none',
              activeTools: [],
            };
          }

          return undefined;
        },
        tools: {},
        experimental_repairToolCall: async ({ toolCall, tools, inputSchema, error }) => {
          if (NoSuchToolError.isInstance(error)) {
            return null;
          }

          const tool = tools[toolCall.toolName as keyof typeof tools];

          if (!tool) {
            return null;
          }

          const { object: repairedArgs } = await generateObject({
            model: hyper.languageModel('hyper-grok-4-fast'),
            schema: tool.inputSchema,
            prompt: [
              `The model tried to call the tool "${toolCall.toolName}"` + ` with the following arguments:`,
              JSON.stringify(toolCall.input),
              `The tool accepts the following schema:`,
              JSON.stringify(inputSchema(toolCall)),
              'Please fix the arguments.',
              `Today's date is ${new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}`,
            ].join('\n'),
          });

          return { ...toolCall, args: JSON.stringify(repairedArgs) };
        },
        onChunk(event) {
        },
        onStepFinish(event) {
        },
        onFinish: async (event) => {

          if (user?.id && event.finishReason === 'stop') {
            after(async () => {
              try {
                if (!shouldBypassRateLimits(resolvedModel, user)) {
                  await incrementMessageUsage({ userId: user.id });
                }
              } catch (error) {
              }
            });
          }
        },
        onError(event) {
        },
      });

      result.consumeStream();

      dataStream.merge(
        result.toUIMessageStream({
          sendReasoning: true,
          messageMetadata: ({ part }) => {
            if (part.type === 'finish') {
              const processingTime = (Date.now() - streamStartTime) / 1000;
              return {
                model: resolvedModel as string,
                completionTime: processingTime,
                createdAt: new Date().toISOString(),
                totalTokens: part.totalUsage?.totalTokens ?? null,
                inputTokens: part.totalUsage?.inputTokens ?? null,
                outputTokens: part.totalUsage?.outputTokens ?? null,
              };
            }
          },
        }),
      );
    },
    onError(error) {
      if (error instanceof Error && error.message.includes('Rate Limit')) {
        return 'Oops, you have reached the rate limit! Please try again later.';
      }
      return 'Oops, an error occurred!';
    },
    onFinish: async ({ messages }) => {
      if (lightweightUser) {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
            model: resolvedModel,
            completionTime: message.metadata?.completionTime ?? 0,
            inputTokens: message.metadata?.inputTokens ?? 0,
            outputTokens: message.metadata?.outputTokens ?? 0,
            totalTokens: message.metadata?.totalTokens ?? 0,
          })),
        });
      }
    },
  });
  
  return createStreamResponse(
    stream.pipeThrough(new JsonToSseTransformStream())
  );
}
