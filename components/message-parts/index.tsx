import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import isEqual from 'fast-deep-equal';
import { ReasoningUIPart, DataUIPart, isToolUIPart } from 'ai';
import { ReasoningPartView } from '@/components/reasoning-part';
import { MarkdownRenderer } from '@/components/markdown';
import { ChatTextHighlighter } from '@/components/chat-text-highlighter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deleteTrailingMessages } from '@/app/actions';
import { sileo } from 'sileo';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ShareButton } from '@/components/share';
import { HugeiconsIcon } from '@hugeicons/react';
import { RepeatIcon, Copy01Icon, CpuIcon } from '@hugeicons/core-free-icons';
import { ChatMessage, CustomUIDataTypes, DataQueryCompletionPart, DataExtremeSearchPart, ChatTools } from '@/lib/types';
import { UseChatHelpers } from '@ai-sdk/react';
import { HyperLogoHeader } from '@/components/hyper-logo-header';
import Image from 'next/image';

import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
  XCircle,
  Clock,
  Info,
  Download,
  FileDown,
  ClipboardCheck,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ClockIcon as PhosphorClockIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  SigmaIcon,
} from '@phosphor-icons/react';
import { getModelConfig } from '@/ai/providers';
import { ComprehensiveUserData } from '@/lib/user-data-server';
import { Spinner } from '../ui/spinner';
import { markdownTablesToXlsx } from '@/lib/export-xlsx';
import { downloadResponseAsPdf } from '@/lib/export-pdf';
import { EANSearchResults } from '@/components/ean-search-results';
import { EANLoadingState } from '@/components/ean-loading-state';
import { NutritionScores } from '@/components/nutrition-scores';
import { NutritionTable } from '@/components/nutrition-table';

const ComponentLoader = () => (
  <div className="flex space-x-2 mt-2">
    <div
      className="w-2 h-2 rounded-full bg-muted-foreground dark:bg-muted-foreground animate-bounce"
      style={{ animationDelay: '0ms' }}
    ></div>
    <div
      className="w-2 h-2 rounded-full bg-muted-foreground dark:bg-muted-foreground animate-bounce"
      style={{ animationDelay: '150ms' }}
    ></div>
    <div
      className="w-2 h-2 rounded-full bg-muted-foreground dark:bg-muted-foreground animate-bounce"
      style={{ animationDelay: '300ms' }}
    ></div>
  </div>
);

const ToolErrorDisplay = ({ errorText, toolName }: { errorText: string; toolName: string }) => (
  <div className="w-full my-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-900 dark:text-red-100">{toolName} failed</h3>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1">{errorText}</p>
        </div>
      </div>
    </div>
  </div>
);

interface MessagePartRendererProps {
  part: ChatMessage['parts'][number];
  messageIndex: number;
  partIndex: number;
  parts: ChatMessage['parts'][number][];
  message: ChatMessage;
  status: string;
  hasActiveToolInvocations: boolean;
  reasoningVisibilityMap: Record<string, boolean>;
  reasoningFullscreenMap: Record<string, boolean>;
  setReasoningVisibilityMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setReasoningFullscreenMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  messages: ChatMessage[];
  user?: ComprehensiveUserData;
  isOwner?: boolean;
  selectedVisibilityType?: 'public' | 'private';
  chatId?: string;
  onVisibilityChange?: (visibility: 'public' | 'private') => void;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  setSuggestedQuestions: (questions: string[]) => void;
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  onHighlight?: (text: string) => void;
  annotations?: DataUIPart<CustomUIDataTypes>[];
  selectedGroup?: import('@/lib/utils').SearchGroupId;
}

export const MessagePartRenderer = memo<MessagePartRendererProps>(
  ({
    part,
    messageIndex,
    partIndex,
    parts,
    message,
    status,
    hasActiveToolInvocations,
    reasoningVisibilityMap,
    reasoningFullscreenMap,
    setReasoningVisibilityMap,
    setReasoningFullscreenMap,
    messages,
    user,
    isOwner,
    selectedVisibilityType,
    chatId,
    onVisibilityChange,
    setMessages,
    setSuggestedQuestions,
    regenerate,
    onHighlight,
    annotations,
    selectedGroup,
  }) => {
    if (part.type === 'text') {
      const hasReasoningParts = parts.some((p) => p.type === 'reasoning');
      
      if ((!part.text || part.text.trim() === '') && status === 'streaming' && !hasActiveToolInvocations && !hasReasoningParts) {
        return (
          <div
            key={`${messageIndex}-${partIndex}-loading`}
            className="flex flex-col min-h-[calc(100vh-18rem)] !m-0 !p-0"
          >
            <div className="flex space-x-2 ml-8 mt-2">
              <div className="w-2 h-2 rounded-full bg-muted-foreground dark:bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-muted-foreground dark:bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-muted-foreground dark:bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        );
      }

      if (!part.text || part.text.trim() === '') {
        if (status !== 'streaming' || !hasActiveToolInvocations) {
          return null;
        }
        return <div key={`${messageIndex}-${partIndex}-empty`}></div>;
      }

      const meta = message?.metadata;
      const modelConfig = meta?.model ? getModelConfig(meta.model) : null;
      const modelLabel = modelConfig?.label ?? meta?.model ?? null;
      const tokenTotal = (meta?.totalTokens ?? (meta?.inputTokens ?? 0) + (meta?.outputTokens ?? 0)) || null;
      const inputCount = meta?.inputTokens ?? null;
      const outputCount = meta?.outputTokens ?? null;

      const hasMarkdownTable = /\n\s*\|[^\n]+\|\s*\n\s*\|\s*[-:]+[^\n]*\|/.test(part.text || '');

      return (
        <div key={`${messageIndex}-${partIndex}-text`} className="mt-2">
          <div>
            <ChatTextHighlighter onHighlight={onHighlight} removeHighlightOnClick={true}>
              <MarkdownRenderer content={part.text} />
            </ChatTextHighlighter>
          </div>

          {status === 'ready' && (
            <div className="flex flex-row items-center justify-between gap-2 mt-2.5 mb-5 !-ml-1 flex-wrap">
              <div className="flex flex-wrap items-center gap-1">
                {((user && isOwner) || (!user && selectedVisibilityType === 'private')) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            try {
                              const lastUserMessage = messages.findLast((m) => m.role === 'user');
                              if (!lastUserMessage) return;

                              if (user && lastUserMessage.id) {
                                await deleteTrailingMessages({
                                  id: lastUserMessage.id,
                                });
                              }

                              const newMessages = [];
                              for (let i = 0; i < messages.length; i++) {
                                newMessages.push(messages[i]);
                                if (messages[i].id === lastUserMessage.id) {
                                  break;
                                }
                              }

                              setMessages(newMessages);
                              setSuggestedQuestions([]);
                              await regenerate();
                            } catch (error) {
                              console.error('Error in reload:', error);
                            }
                          }}
                          className="size-8 p-0 rounded-full"
                        >
                          <HugeiconsIcon icon={RepeatIcon} size={32} color="currentColor" strokeWidth={2} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Réécrire</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {selectedGroup === 'pdfExcel' && hasMarkdownTable && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            try {
                              const blob = markdownTablesToXlsx(part.text || '', 'pdf-to-excel');
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              const ts = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
                              a.href = url;
                              a.download = `pdf-to-excel-${ts}.xlsx`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            } catch (e) {
                              console.error(e);
                              sileo.error({ title: "Échec du téléchargement Excel", description: "Veuillez réessayer", icon: <FileSpreadsheet size={14} /> });
                            }
                          }}
                          className="size-8 p-0 rounded-full"
                          aria-label="Télécharger en Excel (.xlsx)"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Télécharger en Excel (.xlsx)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {onVisibilityChange && (
                  <ShareButton
                    chatId={chatId || null}
                    selectedVisibilityType={selectedVisibilityType || 'private'}
                    onVisibilityChange={async (visibility) => {
                      await Promise.resolve(onVisibilityChange(visibility));
                    }}
                    isOwner={isOwner}
                    user={user}
                    variant="icon"
                    size="sm"
                    className="rounded-full"
                  />
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(part.text);
                          sileo.success({ title: 'Copied to clipboard', description: 'You can now paste it anywhere', icon: <ClipboardCheck size={14} /> });
                        }}
                        className="size-8 p-0 rounded-full"
                      >
                        <HugeiconsIcon icon={Copy01Icon} size={32} color="currentColor" strokeWidth={2} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copier</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          const toastId = sileo.show({ title: 'Génération du PDF...', description: 'Veuillez patienter', icon: <FileText size={14} /> });
                          try {
                            await downloadResponseAsPdf(
                              part.text,
                              modelLabel || undefined,
                            );
                            sileo.dismiss(toastId);
                            sileo.success({ title: 'PDF téléchargé avec succès', description: 'Le fichier est prêt', icon: <FileText size={14} /> });
                          } catch (error: any) {
                            console.error('PDF export error:', error);
                            const errorMsg = error?.message || String(error) || 'Erreur inconnue';
                            sileo.dismiss(toastId);
                            sileo.error({ title: `Échec PDF: ${errorMsg.slice(0, 100)}`, description: 'Veuillez réessayer', icon: <FileText size={14} />, duration: 8000 });
                          }
                        }}
                        className="size-8 p-0 rounded-full"
                        aria-label="Télécharger en PDF"
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Télécharger en PDF</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {meta && (
                <div className="flex items-center">
                  <HoverCard openDelay={100} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 p-0 rounded-full touch-manipulation"
                        onTouchStart={() => {}}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent
                      className="w-72 max-w-[calc(100vw-2rem)]"
                      side="top"
                      align="end"
                      sideOffset={8}
                      alignOffset={-8}
                      avoidCollisions={true}
                      collisionPadding={16}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          <h4 className="font-semibold text-sm">Info Réponse</h4>
                        </div>

                        {modelLabel && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Modèle</span>
                            <div className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-lg px-2 py-1">
                              <HugeiconsIcon icon={CpuIcon} size={12} />
                              {modelLabel}
                            </div>
                          </div>
                        )}

                        {typeof meta.completionTime === 'number' && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Temps de génération</span>
                            <div className="flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3" />
                              {meta.completionTime.toFixed(1)}s
                            </div>
                          </div>
                        )}

                        {(inputCount != null || outputCount != null) && (
                          <div className="space-y-2">
                            <span className="text-sm text-muted-foreground">Utilisation des jetons</span>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {inputCount != null && (
                                <div className="flex items-center justify-between bg-muted rounded-lg px-2 py-1">
                                  <span className="flex items-center gap-1">
                                    <ArrowLeftIcon weight="regular" className="h-3 w-3" />
                                    Entrée
                                  </span>
                                  <span className="font-medium">{inputCount.toLocaleString()}</span>
                                </div>
                              )}
                              {outputCount != null && (
                                <div className="flex items-center justify-between bg-muted rounded-lg px-2 py-1">
                                  <span className="flex items-center gap-1">
                                    <ArrowRightIcon weight="regular" className="h-3 w-3" />
                                    Sortie
                                  </span>
                                  <span className="font-medium">{outputCount.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                            {tokenTotal != null && (
                              <div className="flex items-center justify-between bg-accent rounded-lg px-2 py-1 text-xs">
                                <span className="flex items-center gap-1 font-medium">
                                  <SigmaIcon className="h-3 w-3" weight="regular" />
                                  Total
                                </span>
                                <span className="font-semibold">{tokenTotal.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (part.type === 'reasoning') {
      const prevPart = parts[partIndex - 1];
      if (prevPart && prevPart.type === 'reasoning') {
        return null;
      }

      let nextIndex = partIndex;
      const mergedTexts: string[] = [];
      while (nextIndex < parts.length && parts[nextIndex]?.type === 'reasoning') {
        const r = parts[nextIndex] as unknown as ReasoningUIPart;
        if (typeof r.text === 'string' && r.text.length > 0) {
          mergedTexts.push(r.text);
        }
        nextIndex += 1;
      }

      const mergedPart: ReasoningUIPart = { ...(part as ReasoningUIPart), text: mergedTexts.join('\n\n') };

      const sectionKey = `${messageIndex}-${partIndex}`;
      const hasParallelToolInvocation = parts.some((p: ChatMessage['parts'][number]) => p.type.startsWith('tool-'));
      const isComplete = parts.some(
        (p: ChatMessage['parts'][number], i: number) =>
          i > partIndex && (p.type === 'text' || p.type.startsWith('tool-')),
      );
      const parallelTool = hasParallelToolInvocation
        ? (parts.find((p: ChatMessage['parts'][number]) => p.type.includes('tool-'))?.type.split('-')[1] ?? null)
        : null;

      const isExpanded = reasoningVisibilityMap[sectionKey] ?? !isComplete;
      const isFullscreen = reasoningFullscreenMap[sectionKey] ?? false;

      const setIsExpanded = (v: boolean) => setReasoningVisibilityMap((prev) => ({ ...prev, [sectionKey]: v }));
      const setIsFullscreen = (v: boolean) => setReasoningFullscreenMap((prev) => ({ ...prev, [sectionKey]: v }));

      return (
        <ReasoningPartView
          key={sectionKey}
          part={mergedPart}
          sectionKey={sectionKey}
          parallelTool={parallelTool}
          isExpanded={isExpanded}
          isFullscreen={isFullscreen}
          setIsExpanded={setIsExpanded}
          setIsFullscreen={setIsFullscreen}
        />
      );
    }

    if (part.type === 'step-start') {
      const firstStepStartIndex = parts.findIndex((p) => p.type === 'step-start');
      if (partIndex === firstStepStartIndex) {
        return (
          <div key={`${messageIndex}-${partIndex}-step-start-logo`} className="!m-0 !p-0">
            <HyperLogoHeader />
          </div>
        );
      }
      return <div key={`${messageIndex}-${partIndex}-step-start`}></div>;
    }

    if (isToolUIPart(part)) {
      if ('state' in part && part.state) {
        switch (part.type) {
          case 'tool-ean_search':
            switch (part.state) {
              case 'input-streaming': {
                const query = (part as any).input?.query || (part as any).args?.query || (part as any).input?.barcode || (part as any).args?.barcode;
                return <EANLoadingState key={`${messageIndex}-${partIndex}-tool`} barcode={query} />;
              }
              case 'input-available': {
                const query = (part as any).input?.query || (part as any).args?.query || (part as any).input?.barcode || (part as any).args?.barcode;
                return <EANLoadingState key={`${messageIndex}-${partIndex}-tool`} barcode={query} />;
              }
              case 'output-available': {
                const { barcode, results, images, totalResults, description, nutritionScores, nutrients } = (part as any).output || {};
                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="space-y-4">
                    <EANSearchResults
                      barcode={barcode}
                      results={results || []}
                      images={images || []}
                      totalResults={totalResults ?? (results?.length || 0)}
                    />

                    {nutritionScores && (
                      <NutritionScores
                        nutriScore={nutritionScores.nutriScore}
                        novaGroup={nutritionScores.novaGroup}
                        greenScore={nutritionScores.greenScore}
                      />
                    )}

                    {nutrients && (
                      <NutritionTable nutrients={nutrients} />
                    )}

                    {description && (
                      <div className="prose prose-sm max-w-none p-4 bg-muted/50 rounded-lg border">
                        <div className="whitespace-pre-line text-foreground">{description}</div>
                      </div>
                    )}
                  </div>
                );
              }
              case 'output-error':
                return (
                  <ToolErrorDisplay
                    key={`${messageIndex}-${partIndex}-tool`}
                    errorText={(part as any).errorText}
                    toolName="EAN Search"
                  />
                );
            }
            break;

          case 'tool-datetime':
            switch (part.state) {
              case 'input-streaming':
                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="text-sm text-neutral-500">
                    Preparing time request...
                  </div>
                );
              case 'input-available':
                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="flex items-center gap-3 py-4 px-2">
                    <div className="h-5 w-5 relative">
                      <div className="absolute inset-0 rounded-full border-2 border-neutral-300 dark:border-neutral-700 border-t-blue-500 dark:border-t-blue-400 animate-spin" />
                    </div>
                    <span className="text-neutral-700 dark:text-neutral-300 text-sm font-medium">
                      Fetching current time...
                    </span>
                  </div>
                );
              case 'output-available':
                const LiveClock = memo(() => {
                  const [time, setTime] = useState(() => new Date());
                  const timerRef = useRef<NodeJS.Timeout | null>(null);

                  useEffect(() => {
                    const now = new Date();
                    const delay = 1000 - now.getMilliseconds();

                    const timeout = setTimeout(() => {
                      setTime(new Date());
                      timerRef.current = setInterval(() => {
                        setTime(new Date());
                      }, 1000);
                    }, delay);

                    return () => {
                      clearTimeout(timeout);
                      if (timerRef.current) {
                        clearInterval(timerRef.current);
                      }
                    };
                  }, []);

                  const timezone = (part as any).output.timezone || new Intl.DateTimeFormat().resolvedOptions().timeZone;
                  const formatter = new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    hour12: true,
                    timeZone: timezone,
                  });

                  const formattedParts = formatter.formatToParts(time);
                  const timeParts = {
                    hour: formattedParts.find((part) => part.type === 'hour')?.value || '12',
                    minute: formattedParts.find((part) => part.type === 'minute')?.value || '00',
                    second: formattedParts.find((part) => part.type === 'second')?.value || '00',
                    dayPeriod: formattedParts.find((part) => part.type === 'dayPeriod')?.value || 'AM',
                  };

                  return (
                    <div className="mt-3">
                      <div className="flex items-baseline">
                        <div className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter tabular-nums text-neutral-900 dark:text-white">
                          {timeParts.hour.padStart(2, '0')}
                        </div>
                        <div className="mx-1 sm:mx-2 text-4xl sm:text-5xl md:text-6xl font-light text-neutral-400 dark:text-neutral-500">
                          :
                        </div>
                        <div className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter tabular-nums text-neutral-900 dark:text-white">
                          {timeParts.minute.padStart(2, '0')}
                        </div>
                        <div className="mx-1 sm:mx-2 text-4xl sm:text-5xl md:text-6xl font-light text-neutral-400 dark:text-neutral-500">
                          :
                        </div>
                        <div className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter tabular-nums text-neutral-900 dark:text-white">
                          {timeParts.second.padStart(2, '0')}
                        </div>
                        <div className="ml-2 sm:ml-4 text-xl sm:text-2xl font-light self-center text-neutral-400 dark:text-neutral-500">
                          {timeParts.dayPeriod}
                        </div>
                      </div>
                    </div>
                  );
                });

                LiveClock.displayName = 'LiveClock';

                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="w-full my-6">
                    <div className="bg-white dark:bg-neutral-950 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
                      <div className="p-4 sm:p-6">
                        <div className="flex flex-col gap-4 sm:gap-6">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 tracking-wider uppercase">
                                Current Time
                              </h3>
                              <div className="bg-neutral-100 dark:bg-neutral-800 rounded px-2 py-1 text-xs text-neutral-600 dark:text-neutral-300 font-medium flex items-center gap-1.5">
                                <PhosphorClockIcon weight="regular" className="h-3 w-3 text-blue-500" />
                                {(part as any).output.timezone || new Intl.DateTimeFormat().resolvedOptions().timeZone}
                              </div>
                            </div>
                            <LiveClock />
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                              {(part as any).output.formatted?.date}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {(part as any).output.formatted?.iso_local && (
                              <div className="bg-neutral-50 dark:bg-neutral-900 rounded p-3">
                                <div className="text-neutral-500 dark:text-neutral-400 mb-1">Local</div>
                                <div className="font-mono text-neutral-700 dark:text-neutral-300 text-[11px]">
                                  {(part as any).output.formatted.iso_local}
                                </div>
                              </div>
                            )}

                            {(part as any).output.timestamp && (
                              <div className="bg-neutral-50 dark:bg-neutral-900 rounded p-3">
                                <div className="text-neutral-500 dark:text-neutral-400 mb-1">Timestamp</div>
                                <div className="font-mono text-neutral-700 dark:text-neutral-300 text-[11px]">
                                  {(part as any).output.timestamp}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              case 'output-error':
                return (
                  <ToolErrorDisplay
                    key={`${messageIndex}-${partIndex}-tool`}
                    errorText={(part as any).errorText}
                    toolName="DateTime"
                  />
                );
            }
            break;

          case 'tool-greeting':
            switch (part.state) {
              case 'input-streaming':
              case 'input-available':
                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="text-sm text-neutral-500">
                    Loading greeting...
                  </div>
                );
              case 'output-available':
                return (
                  <div key={`${messageIndex}-${partIndex}-tool`} className="p-4 bg-muted/50 rounded-lg border">
                    <p className="text-foreground">{(part as any).output?.greeting || 'Hello!'}</p>
                  </div>
                );
              case 'output-error':
                return (
                  <ToolErrorDisplay
                    key={`${messageIndex}-${partIndex}-tool`}
                    errorText={(part as any).errorText}
                    toolName="Greeting"
                  />
                );
            }
            break;
        }
      }
    }

    return null;
  },
  (prevProps, nextProps) => {
    return (
      prevProps.part === nextProps.part &&
      prevProps.messageIndex === nextProps.messageIndex &&
      prevProps.partIndex === nextProps.partIndex &&
      prevProps.status === nextProps.status &&
      prevProps.hasActiveToolInvocations === nextProps.hasActiveToolInvocations &&
      isEqual(prevProps.reasoningVisibilityMap, nextProps.reasoningVisibilityMap) &&
      isEqual(prevProps.reasoningFullscreenMap, nextProps.reasoningFullscreenMap) &&
      prevProps.selectedGroup === nextProps.selectedGroup &&
      isEqual(prevProps.annotations, nextProps.annotations)
    );
  },
);

MessagePartRenderer.displayName = 'MessagePartRenderer';
