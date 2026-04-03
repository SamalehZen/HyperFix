// app/actions.ts
'use server';

import { geolocation } from '@vercel/functions';
import { serverEnv } from '@/env/server';
import { SearchGroupId } from '@/lib/utils';
import { generateObject, UIMessage, generateText } from 'ai';
import type { ModelMessage } from 'ai';
import { z } from 'zod';
import { getUser } from '@/lib/auth-utils';
import { hyper } from '@/ai/providers';
import { CYRUS_PROMPT, CYRUS_OUTPUT_RULES } from '@/ai/prompts/classification-cyrus';
import { NOMENCLATURE_DOUANIERE_PROMPT } from '@/ai/prompts/nomenclature-douaniere';
import { LIBELLER_PROMPT } from '@/ai/prompts/correction-libeller';
import { SMART_PDF_TO_EXCEL_PROMPT } from '@/ai/prompts/pdf-to-excel';
import { CHAT_PROMPT } from '@/ai/prompts/chat';
import { EANEXPERT_PROMPT } from '@/ai/prompts/ean-expert';
import { COMMON_PREAMBLE_LIBRE, COMMON_PREAMBLE_CRITIQUE } from '@/ai/prompts/common-preamble';
import {
  getChatsByUserId,
  deleteChatById,
  updateChatVisibilityById,
  getChatById,
  getMessageById,
  deleteMessagesByChatIdAfterTimestamp,
  updateChatTitleById,
  getExtremeSearchCount,
  incrementMessageUsage,
  getMessageCount,
  getHistoricalUsageData,
  getCustomInstructionsByUserId,
  createCustomInstructions,
  updateCustomInstructions,
  deleteCustomInstructions,
  getPaymentsByUserId,
  createLookout,
  getLookoutsByUserId,
  getLookoutById,
  updateLookout,
  updateLookoutStatus,
  deleteLookout,
} from '@/lib/db/queries';
import { isAnonymousUser } from '@/lib/utils';
import { db, maindb } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { get } from '@vercel/edge-config';

import { usageCountCache, createMessageCountKey, createExtremeCountKey } from '@/lib/performance-cache';
import { getComprehensiveUserData, getLightweightUserAuth } from '@/lib/user-data-server';
type ConnectorProvider = 'google_drive' | 'notion' | 'slack' | 'github';

// Server action to get the current user with Pro status - UNIFIED VERSION
export async function getCurrentUser() {
  'use server';

  return await getComprehensiveUserData();
}

// Lightweight auth check for fast authentication validation
export async function getLightweightUser() {
  'use server';

  return await getLightweightUserAuth();
}

// Question suggestions disabled - returns empty array to save tokens
export async function suggestQuestions(_history: any[], _groupId: LegacyGroupId = 'chat') {
  'use server';
  return { questions: [] };
}

export async function checkImageModeration(images: string[]) {
  'use server';
  // Disabled: moderation is not performed server-side in Arka
  return 'disabled';
}

export async function generateTitleFromUserMessage({ message }: { message: UIMessage }) {
  const { text: title } = await generateText({
    model: hyper.languageModel('hyper-name'),
    system: `You are an expert title generator. You are given a message and you need to generate a short title based on it.

    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - the title should creative and unique
    - do not write anything other than the title
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function enhancePrompt(raw: string) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit', weekday: 'short' });
  const fallbackSystem = `You are an expert prompt engineer. You are given a prompt and you need to enhance it.

Today's Date: ${today}.

Guidelines (MANDATORY):
- Preserve the user's original intent and constraints
- Make the prompt specific, unambiguous, and actionable
- Add missing context: entities, timeframe, location, format/constraints if implied
- Remove fluff, pronouns, and vague language; use proper nouns when possible
- Keep it concise (1-2 sentences extra max) but information-dense
- Do NOT ask follow-up questions
- Make sure it gives the best and comprehensive results for the user's query
- Make sure to maintain the Point of View of the User
- Your job is to enhance the prompt, not to answer the prompt!!
- Make sure the prompt is not an answer to the user's query!!
- Return ONLY the improved prompt text, with no quotes or commentary or answer to the user's query!!
- Just return the improved prompt text in plain text format, no other text or commentary or markdown or anything else!!`;
  const systemPrompt = `Tu es un expert en reformulation de requêtes de recherche.
Date du jour : ${today}.

Ta mission : transformer une requête utilisateur brute en une version structurée optimisée pour la recherche.

## Règles pour "enhanced" (requête principale améliorée)
- Préserve l'intention et la LANGUE de l'utilisateur
- Rends-la spécifique, non ambiguë, et actionnable
- Ajoute le contexte manquant : entités, période, lieu, format
- Supprime le flou, les pronoms, le langage vague — utilise des noms propres
- Concis mais dense en information (1-2 phrases max de plus que l'original)
- Ce n'est PAS une réponse — c'est une meilleure QUESTION
- INTERDIT de répondre à la question de l'utilisateur

## Règles pour "subQueries" (2-3 sous-requêtes parallèles)
- Chaque sous-requête couvre un ANGLE DIFFÉRENT
- Au moins 1 question en langage naturel ("comment", "quels", "pourquoi"...)
- Au moins 1 requête type mots-clés (pour moteur de recherche)
- Maximum 3 sous-requêtes, dans la MÊME LANGUE que l'input

## Règles pour "temporalQualifier"
- Si la requête est sensible au temps, retourne un qualificateur ("2026", "récent", "actuel")
- Sinon, retourne null

## Règles pour "language"
- Code ISO 639-1 de la langue de l'input ("fr", "en", "ar", etc.)`;

  try {
    const { object } = await generateObject({
      model: hyper.languageModel('hyper-enhance'),
      temperature: 0.6,
      topP: 0.95,
      maxOutputTokens: 1024,
      system: systemPrompt,
      prompt: raw,
      schema: z.object({
        enhanced: z.string().describe('Enhanced main prompt in the same language as input'),
        subQueries: z.array(z.string()).min(1).max(3).describe('2-3 focused sub-queries covering different angles'),
        temporalQualifier: z.string().nullable().describe('Time qualifier if time-sensitive, null otherwise'),
        language: z.string().describe('ISO 639-1 language code of the input'),
      }),
    });

    return {
      success: true,
      enhanced: object.enhanced.trim(),
      subQueries: object.subQueries.map((subQuery) => subQuery.trim()),
      temporalQualifier: object.temporalQualifier?.trim() ?? null,
      language: object.language.trim(),
    };
  } catch (structuredError) {
    try {
      const { text } = await generateText({
        model: hyper.languageModel('hyper-enhance'),
        temperature: 0.6,
        topP: 0.95,
        maxOutputTokens: 1024,
        system: fallbackSystem,
        prompt: raw,
      });

      return { success: true, enhanced: text.trim() };
    } catch (fallbackError) {
      return { success: false, error: 'Failed to enhance prompt' };
    }
  }
}

export async function generateSpeech(_text: string) {
  'use server';
  return { audio: '' };
}

type LegacyGroupId = 'chat' | 'cyrus' | 'libeller' | 'nomenclature' | 'pdfExcel' | 'eanexpert';

const groupTools = {
  chat: [] as const,
  cyrus: [] as const,
  libeller: [] as const,
  nomenclature: [] as const,
  pdfExcel: [] as const,
  eanexpert: ['ean_search', 'datetime'] as const,
} as const;

const rawGroupInstructions = {
  chat: CHAT_PROMPT,
  cyrus: COMMON_PREAMBLE_CRITIQUE + `${CYRUS_PROMPT}\n\n${CYRUS_OUTPUT_RULES}`,
  libeller: COMMON_PREAMBLE_LIBRE + LIBELLER_PROMPT,
  nomenclature: COMMON_PREAMBLE_CRITIQUE + NOMENCLATURE_DOUANIERE_PROMPT,
  pdfExcel: COMMON_PREAMBLE_LIBRE + SMART_PDF_TO_EXCEL_PROMPT,
  eanexpert: COMMON_PREAMBLE_LIBRE + EANEXPERT_PROMPT,
};

const groupInstructions = rawGroupInstructions;

export async function getGroupConfig(groupId: LegacyGroupId = 'chat') {
  'use server';

  const tools = groupTools[groupId as keyof typeof groupTools] || [];
  const instructions = groupInstructions[groupId as keyof typeof groupInstructions] || '';

  return {
    tools,
    instructions,
  };
}

// Add functions to fetch user chats
export async function getUserChats(
  userId: string,
  limit: number = 20,
  startingAfter?: string,
  endingBefore?: string,
): Promise<{ chats: any[]; hasMore: boolean }> {
  'use server';

  if (!userId) return { chats: [], hasMore: false };

  if (isAnonymousUser(userId)) {
    return { chats: [], hasMore: false };
  }

  try {
    return await getChatsByUserId({
      id: userId,
      limit,
      startingAfter: startingAfter || null,
      endingBefore: endingBefore || null,
    });
  } catch (error) {
    return { chats: [], hasMore: false };
  }
}

// Add function to load more chats for infinite scroll
export async function loadMoreChats(
  userId: string,
  lastChatId: string,
  limit: number = 20,
): Promise<{ chats: any[]; hasMore: boolean }> {
  'use server';

  if (!userId || !lastChatId) return { chats: [], hasMore: false };

  if (isAnonymousUser(userId)) {
    return { chats: [], hasMore: false };
  }

  try {
    return await getChatsByUserId({
      id: userId,
      limit,
      startingAfter: null,
      endingBefore: lastChatId,
    });
  } catch (error) {
    return { chats: [], hasMore: false };
  }
}

// Add function to delete a chat
export async function deleteChat(chatId: string) {
  'use server';

  if (!chatId) return null;

  try {
    return await deleteChatById({ id: chatId });
  } catch (error) {
    return null;
  }
}

// Add function to update chat visibility
export async function updateChatVisibility(chatId: string, visibility: 'private' | 'public') {
  'use server';

  if (!chatId) {
    throw new Error('Chat ID is required');
  }

  try {
    const result = await updateChatVisibilityById({ chatId, visibility });
    return {
      success: true,
      chatId,
      visibility,
      rowCount: result?.rowCount || 0,
    };
  } catch (error) {
    throw error;
  }
}

// Add function to get chat info
export async function getChatInfo(chatId: string) {
  'use server';

  if (!chatId) return null;

  try {
    return await getChatById({ id: chatId });
  } catch (error) {
    return null;
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  'use server';
  try {
    const [message] = await getMessageById({ id });

    if (!message) {
      return;
    }

    await deleteMessagesByChatIdAfterTimestamp({
      chatId: message.chatId,
      timestamp: message.createdAt,
    });
  } catch (error) {
    throw error;
  }
}

// Add function to update chat title
export async function updateChatTitle(chatId: string, title: string) {
  'use server';

  if (!chatId || !title.trim()) return null;

  try {
    return await updateChatTitleById({ chatId, title: title.trim() });
  } catch (error) {
    return null;
  }
}

export async function getSubDetails() {
  'use server';

  // Import here to avoid issues with SSR
  const { getComprehensiveUserData } = await import('@/lib/user-data-server');
  const userData = await getComprehensiveUserData();

  if (!userData) return { hasSubscription: false };

  return userData.polarSubscription
    ? {
        hasSubscription: true,
        subscription: userData.polarSubscription,
      }
    : { hasSubscription: false };
}

export async function getUserMessageCount(providedUser?: any) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return { count: 0, error: 'User not found' };
    }

    // Check cache first
    const cacheKey = createMessageCountKey(user.id);
    const cached = usageCountCache.get(cacheKey);
    if (cached !== null) {
      return { count: cached, error: null };
    }

    const count = await getMessageCount({
      userId: user.id,
    });

    // Cache the result
    usageCountCache.set(cacheKey, count);

    return { count, error: null };
  } catch (error) {
    return { count: 0, error: 'Failed to get message count' };
  }
}

export async function incrementUserMessageCount() {
  'use server';

  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    await incrementMessageUsage({
      userId: user.id,
    });

    // Invalidate cache
    const cacheKey = createMessageCountKey(user.id);
    usageCountCache.delete(cacheKey);

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Failed to increment message count' };
  }
}

export async function getExtremeSearchUsageCount(providedUser?: any) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return { count: 0, error: 'User not found' };
    }

    // Check cache first
    const cacheKey = createExtremeCountKey(user.id);
    const cached = usageCountCache.get(cacheKey);
    if (cached !== null) {
      return { count: cached, error: null };
    }

    const count = await getExtremeSearchCount({
      userId: user.id,
    });

    // Cache the result
    usageCountCache.set(cacheKey, count);

    return { count, error: null };
  } catch (error) {
    return { count: 0, error: 'Failed to get extreme search count' };
  }
}

export async function getDiscountConfigAction() {
  'use server';
  return { enabled: false };
}

export async function getHistoricalUsage(providedUser?: any, months: number = 9) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return [];
    }

    const historicalData = await getHistoricalUsageData({ userId: user.id, months });

    // Calculate days based on months (approximately 30 days per month)
    const totalDays = months * 30;
    const futureDays = Math.min(15, Math.floor(totalDays * 0.08)); // ~8% future days, max 15
    const pastDays = totalDays - futureDays - 1; // -1 for today

    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + futureDays);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - pastDays);

    // Create a map of existing data for quick lookup
    const dataMap = new Map<string, number>();
    historicalData.forEach((record) => {
      const dateKey = record.date.toISOString().split('T')[0];
      dataMap.set(dateKey, record.messageCount || 0);
    });

    // Generate complete dataset for all days
    const completeData = [];
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateKey = currentDate.toISOString().split('T')[0];

      const count = dataMap.get(dateKey) || 0;
      let level: 0 | 1 | 2 | 3 | 4;

      // Define usage levels based on message count
      if (count === 0) level = 0;
      else if (count <= 3) level = 1;
      else if (count <= 7) level = 2;
      else if (count <= 12) level = 3;
      else level = 4;

      completeData.push({
        date: dateKey,
        count,
        level,
      });
    }

    return completeData;
  } catch (error) {
    return [];
  }
}

// Custom Instructions Server Actions
export async function getCustomInstructions(providedUser?: any) {
  'use server';

  try {
    const user = providedUser || (await getUser());
    if (!user) {
      return null;
    }

    const instructions = await getCustomInstructionsByUserId({ userId: user.id });
    return instructions;
  } catch (error) {
    return null;
  }
}

export async function saveCustomInstructions(content: string) {
  'use server';

  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!content.trim()) {
      return { success: false, error: 'Content cannot be empty' };
    }

    // Check if instructions already exist
    const existingInstructions = await getCustomInstructionsByUserId({ userId: user.id });

    let result;
    if (existingInstructions) {
      result = await updateCustomInstructions({ userId: user.id, content: content.trim() });
    } else {
      result = await createCustomInstructions({ userId: user.id, content: content.trim() });
    }

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: 'Failed to save custom instructions' };
  }
}

export async function deleteCustomInstructionsAction() {
  'use server';

  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const result = await deleteCustomInstructions({ userId: user.id });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: 'Failed to delete custom instructions' };
  }
}

// Minimal DB connectivity diagnostic (server-only)
export async function debugDbConnectivity() {
  'use server';
  const results: any = { replica: {}, primary: {} };

  try {
    const rows = await db.select({ id: userTable.id }).from(userTable).limit(1);
    results.replica.ok = true;
    results.replica.sample = rows?.[0]?.id ?? null;
  } catch (error) {
    results.replica.ok = false;
    results.replica.error = {
      name: (error as any)?.name,
      message: (error as any)?.message,
      code: (error as any)?.code,
    };
  }

  try {
    const rows = await maindb.select({ id: userTable.id }).from(userTable).limit(1);
    results.primary.ok = true;
    results.primary.sample = rows?.[0]?.id ?? null;
  } catch (error) {
    results.primary.ok = false;
    results.primary.error = {
      name: (error as any)?.name,
      message: (error as any)?.message,
      code: (error as any)?.code,
    };
  }

  return {
    ok: Boolean(results.replica.ok || results.primary.ok),
    replica: results.replica,
    primary: results.primary,
  };
}

// Fast pro user status check - UNIFIED VERSION
export async function getProUserStatusOnly(): Promise<boolean> {
  'use server';

  // Import here to avoid issues with SSR
  const { isUserPro } = await import('@/lib/user-data-server');
  return await isUserPro();
}

export async function getPaymentHistory() {
  try {
    const user = await getUser();
    if (!user) return null;

    const payments = await getPaymentsByUserId({ userId: user.id });
    return payments;
  } catch (error) {
    return null;
  }
}

export async function getDodoPaymentsProStatus() {
  'use server';

  // Import here to avoid issues with SSR
  const { getComprehensiveUserData } = await import('@/lib/user-data-server');
  const userData = await getComprehensiveUserData();

  if (!userData) return { isProUser: false, hasPayments: false };

  const isDodoProUser = userData.proSource === 'dodo' && userData.isProUser;

  return {
    isProUser: isDodoProUser,
    hasPayments: Boolean(userData.dodoPayments?.hasPayments),
    expiresAt: userData.dodoPayments?.expiresAt,
    source: userData.proSource,
    daysUntilExpiration: userData.dodoPayments?.daysUntilExpiration,
    isExpired: userData.dodoPayments?.isExpired,
    isExpiringSoon: userData.dodoPayments?.isExpiringSoon,
  };
}

export async function getDodoExpirationDate() {
  'use server';

  // Import here to avoid issues with SSR
  const { getComprehensiveUserData } = await import('@/lib/user-data-server');
  const userData = await getComprehensiveUserData();

  return userData?.dodoPayments?.expiresAt || null;
}

// QStash client disabled for lite version

// Helper function to convert frequency to cron schedule with timezone
function frequencyToCron(frequency: string, time: string, timezone: string, dayOfWeek?: string): string {
  const [hours, minutes] = time.split(':').map(Number);

  let cronExpression = '';
  switch (frequency) {
    case 'once':
      // For 'once', we'll handle it differently - no cron schedule needed
      return '';
    case 'daily':
      cronExpression = `${minutes} ${hours} * * *`;
      break;
    case 'weekly':
      // Use the day of week if provided, otherwise default to Sunday (0)
      const day = dayOfWeek || '0';
      cronExpression = `${minutes} ${hours} * * ${day}`;
      break;
    case 'monthly':
      // Run on the 1st of each month
      cronExpression = `${minutes} ${hours} 1 * *`;
      break;
    case 'yearly':
      // Run on January 1st
      cronExpression = `${minutes} ${hours} 1 1 *`;
      break;
    default:
      cronExpression = `${minutes} ${hours} * * *`; // Default to daily
  }

  // Prepend timezone to cron expression for QStash
  return `CRON_TZ=${timezone} ${cronExpression}`;
}

// Helper function to calculate next run time using cron-parser
function calculateNextRun(cronSchedule: string, timezone: string): Date {
  try {
    // Extract the actual cron expression from the timezone-prefixed format
    // Format: "CRON_TZ=timezone 0 9 * * *" -> "0 9 * * *"
    const actualCronExpression = cronSchedule.startsWith('CRON_TZ=')
      ? cronSchedule.split(' ').slice(1).join(' ')
      : cronSchedule;

    const options = {
      currentDate: new Date(),
      tz: timezone,
    };

    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  } catch (error) {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setDate(nextRun.getDate() + 1);
    return nextRun;
  }
}

// Helper function to calculate next run for 'once' frequency
function calculateOnceNextRun(time: string, timezone: string, date?: string): Date {
  const [hours, minutes] = time.split(':').map(Number);

  if (date) {
    // If a specific date is provided, use it
    const targetDate = new Date(date);
    targetDate.setHours(hours, minutes, 0, 0);
    return targetDate;
  }

  // Otherwise, use today or tomorrow
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (targetDate <= now) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate;
}

export async function createScheduledLookout({
  title,
  prompt,
  frequency,
  time,
  timezone = 'UTC',
  date,
}: {
  title: string;
  prompt: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  time: string; // Format: "HH:MM" or "HH:MM:dayOfWeek" for weekly
  timezone?: string;
  date?: string; // For 'once' frequency
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Check if user is Pro
    if (!user.isProUser) {
      throw new Error('Pro subscription required for scheduled searches');
    }

    // Check lookout limits
    const existingLookouts = await getLookoutsByUserId({ userId: user.id });
    if (existingLookouts.length >= 10) {
      throw new Error('You have reached the maximum limit of 10 lookouts');
    }

    // Check daily lookout limit specifically
    if (frequency === 'daily') {
      const activeDailyLookouts = existingLookouts.filter(
        (lookout) => lookout.frequency === 'daily' && lookout.status === 'active',
      );
      if (activeDailyLookouts.length >= 5) {
        throw new Error('You have reached the maximum limit of 5 active daily lookouts');
      }
    }

    let cronSchedule = '';
    let nextRunAt: Date;
    let actualTime = time;
    let dayOfWeek: string | undefined;

    // Extract day of week for weekly frequency
    if (frequency === 'weekly' && time.includes(':')) {
      const parts = time.split(':');
      if (parts.length === 3) {
        actualTime = `${parts[0]}:${parts[1]}`;
        dayOfWeek = parts[2];
      }
    }

    if (frequency === 'once') {
      // For 'once', calculate the next run time without cron
      nextRunAt = calculateOnceNextRun(actualTime, timezone, date);
    } else {
      // Generate cron schedule for recurring frequencies
      cronSchedule = frequencyToCron(frequency, actualTime, timezone, dayOfWeek);
      nextRunAt = calculateNextRun(cronSchedule, timezone);
    }

    // Create lookout in database first
    const lookout = await createLookout({
      userId: user.id,
      title,
      prompt,
      frequency,
      cronSchedule,
      timezone,
      nextRunAt,
      qstashScheduleId: undefined, // Will be updated if needed
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    return { success: true, lookout };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getUserLookouts() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    const lookouts = await getLookoutsByUserId({ userId: user.id });

    // Update next run times for active lookouts
    const updatedLookouts = lookouts.map((lookout) => {
      if (lookout.status === 'active' && lookout.cronSchedule && lookout.frequency !== 'once') {
        try {
          const nextRunAt = calculateNextRun(lookout.cronSchedule, lookout.timezone);
          return { ...lookout, nextRunAt };
        } catch (error) {
          return lookout;
        }
      }
      return lookout;
    });

    return { success: true, lookouts: updatedLookouts };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateLookoutStatusAction({
  id,
  status,
}: {
  id: string;
  status: 'active' | 'paused' | 'archived' | 'running';
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Get lookout to verify ownership
    const lookout = await getLookoutById({ id });
    if (!lookout || lookout.userId !== user.id) {
      throw new Error('Lookout not found or access denied');
    }

    // Update next run time when resuming an active lookout
    if (status === 'active' && lookout.cronSchedule) {
      try {
        const nextRunAt = calculateNextRun(lookout.cronSchedule, lookout.timezone);
        await updateLookout({ id, nextRunAt });
      } catch (error) {
      }
    }

    // Update database
    const updatedLookout = await updateLookoutStatus({ id, status });
    return { success: true, lookout: updatedLookout };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateLookoutAction({
  id,
  title,
  prompt,
  frequency,
  time,
  timezone,
  dayOfWeek,
}: {
  id: string;
  title: string;
  prompt: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  time: string;
  timezone: string;
  dayOfWeek?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Get lookout to verify ownership
    const lookout = await getLookoutById({ id });
    if (!lookout || lookout.userId !== user.id) {
      throw new Error('Lookout not found or access denied');
    }

    // Check daily lookout limit if changing to daily frequency
    if (frequency === 'daily' && lookout.frequency !== 'daily') {
      const existingLookouts = await getLookoutsByUserId({ userId: user.id });
      const activeDailyLookouts = existingLookouts.filter(
        (existingLookout) =>
          existingLookout.frequency === 'daily' && existingLookout.status === 'active' && existingLookout.id !== id,
      );
      if (activeDailyLookouts.length >= 5) {
        throw new Error('You have reached the maximum limit of 5 active daily lookouts');
      }
    }

    // Handle weekly day selection
    let adjustedTime = time;
    if (frequency === 'weekly' && dayOfWeek) {
      adjustedTime = `${time}:${dayOfWeek}`;
    }

    // Generate new cron schedule if frequency changed
    let cronSchedule = '';
    let nextRunAt: Date;

    if (frequency === 'once') {
      // For 'once', set next run to today/tomorrow at specified time
      const [hours, minutes] = time.split(':').map(Number);
      const now = new Date();
      nextRunAt = new Date(now);
      nextRunAt.setHours(hours, minutes, 0, 0);

      if (nextRunAt <= now) {
        nextRunAt.setDate(nextRunAt.getDate() + 1);
      }
    } else {
      cronSchedule = frequencyToCron(frequency, time, timezone, dayOfWeek);
      nextRunAt = calculateNextRun(cronSchedule, timezone);
    }

    const updatedLookout = await updateLookout({
      id,
      title: title.trim(),
      prompt: prompt.trim(),
      frequency,
      cronSchedule,
      timezone,
      nextRunAt,
    });

    return { success: true, lookout: updatedLookout };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteLookoutAction({ id }: { id: string }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Get lookout to verify ownership
    const lookout = await getLookoutById({ id });
    if (!lookout || lookout.userId !== user.id) {
      throw new Error('Lookout not found or access denied');
    }

    // Delete from database
    const deletedLookout = await deleteLookout({ id });
    return { success: true, lookout: deletedLookout };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function testLookoutAction({ id }: { id: string }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Authentication required');
    }

    // Get lookout to verify ownership
    const lookout = await getLookoutById({ id });
    if (!lookout || lookout.userId !== user.id) {
      throw new Error('Lookout not found or access denied');
    }

    // Only allow testing of active or paused lookouts
    if (lookout.status === 'archived' || lookout.status === 'running') {
      throw new Error(`Cannot test lookout with status: ${lookout.status}`);
    }

    // Make a POST request to the lookout API endpoint to trigger the run
    const response = await fetch(
      process.env.NODE_ENV === 'development' ? process.env.NGROK_URL + '/api/lookout' : `https://hypeer.vercel.app/api/lookout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lookoutId: lookout.id,
          prompt: lookout.prompt,
          userId: user.id,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to trigger lookout test: ${response.statusText}`);
    }

    return { success: true, message: 'Lookout test started successfully' };
  } catch (error) {
    console.error('Error testing lookout:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Server action to get user's geolocation using Vercel
export async function getUserLocation() {
  'use server';

  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();

    // Create a mock request object with headers for geolocation
    const request = {
      headers: headersList,
    } as any;

    const locationData = geolocation(request);

    return {
      country: locationData.country || '',
      countryCode: locationData.country || '',
      city: locationData.city || '',
      region: locationData.region || '',
      isIndia: locationData.country === 'IN',
      loading: false,
    };
  } catch (error) {
    console.error('Failed to get location from Vercel:', error);
    return {
      country: 'Unknown',
      countryCode: '',
      city: '',
      region: '',
      isIndia: false,
      loading: false,
    };
  }
}

// Connector management actions (disabled for lite version)
export async function createConnectorAction(_provider: ConnectorProvider) {
  'use server';
  return { success: false, error: 'Connectors disabled in lite version' };
}

export async function listUserConnectorsAction() {
  'use server';
  return { success: true, connections: [] };
}

export async function deleteConnectorAction(_connectionId: string) {
  'use server';
  return { success: false, error: 'Connectors disabled in lite version' };
}

export async function manualSyncConnectorAction(_provider: ConnectorProvider) {
  'use server';
  return { success: false, error: 'Connectors disabled in lite version' };
}

export async function getConnectorSyncStatusAction(_provider: ConnectorProvider) {
  'use server';
  return { success: true, status: null };
}

// Server action to get supported student domains from Edge Config
export async function getStudentDomainsAction() {
  'use server';

  try {
    const studentDomainsConfig = await get('student_domains');
    if (studentDomainsConfig && typeof studentDomainsConfig === 'string') {
      // Parse CSV string to array, trim whitespace, and sort alphabetically
      const domains = studentDomainsConfig
        .split(',')
        .map((domain) => domain.trim())
        .filter((domain) => domain.length > 0)
        .sort();

      return {
        success: true,
        domains,
        count: domains.length,
      };
    }

    // Fallback to hardcoded domains if Edge Config fails
    const fallbackDomains = ['.edu', '.ac.in'].sort();
    return {
      success: true,
      domains: fallbackDomains,
      count: fallbackDomains.length,
      fallback: true,
    };
  } catch (error) {
    console.error('Failed to fetch student domains from Edge Config:', error);

    // Return fallback domains on error
    const fallbackDomains = ['.edu', '.ac.in'].sort();
    return {
      success: false,
      domains: fallbackDomains,
      count: fallbackDomains.length,
      fallback: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
