/* eslint-disable @next/next/no-img-element */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import {
  models,
  requiresAuthentication,
  requiresProSubscription,
} from '@/ai/providers';
import { Check, ChevronsUpDown, Zap, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getDiscountConfigAction } from '@/app/actions';
import { PRICING } from '@/lib/constants';
import { LockIcon, Eye, Brain, FilePdf } from '@phosphor-icons/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CpuIcon, Crown02Icon } from '@hugeicons/core-free-icons';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useLocation } from '@/hooks/use-location';
import { useIsMobile } from '@/hooks/use-mobile';
import { ProBadge } from './ProBadge';
import { ModelSwitcherProps, DiscountConfig } from './types';
import { CheckIcon } from 'lucide-react';

export const ModelSwitcher: React.FC<ModelSwitcherProps> = React.memo(
  ({
    selectedModel,
    setSelectedModel,
    className,
    attachments,
    messages,
    status,
    onModelSelect,
    subscriptionData,
    user,
  }) => {
    const isProUser = useMemo(
      () =>
        user?.isProUser || (subscriptionData?.hasSubscription && subscriptionData?.subscription?.status === 'active'),
      [user?.isProUser, subscriptionData?.hasSubscription, subscriptionData?.subscription?.status],
    );

    const isSubscriptionLoading = useMemo(() => user && !subscriptionData, [user, subscriptionData]);

    const THINK_MODELS = ['hyper-google-think', 'hyper-google-think-v2', 'hyper-google-think-v3'];
    const COMING_SOON_MODELS = new Set(['hyper-google-think-v2', 'hyper-google-think-v3']);
    const availableModels = useMemo(() => models.filter(m => THINK_MODELS.includes(m.value)), []);

    const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
    const [showSignInDialog, setShowSignInDialog] = useState(false);
    const [selectedProModel, setSelectedProModel] = useState<(typeof models)[0] | null>(null);
    const [selectedAuthModel, setSelectedAuthModel] = useState<(typeof models)[0] | null>(null);
    const [open, setOpen] = useState(false);
    const [discountConfig, setDiscountConfig] = useState<DiscountConfig | null>(null);

    const location = useLocation();
    const isMobile = useIsMobile();

    const [searchQuery, setSearchQuery] = useState('');

    const normalizeText = useCallback((input: string): string => {
      return input
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    }, []);

    const tokenize = useCallback(
      (input: string): string[] => {
        const normalized = normalizeText(input);
        if (!normalized) return [];
        const tokens = normalized.split(/\s+/).filter(Boolean);
        return Array.from(new Set(tokens));
      },
      [normalizeText],
    );

    type SearchIndexEntry = {
      normalized: string;
      labelNorm: string;
      normalizedNoSpace: string;
      labelNoSpace: string;
    };

    const searchIndex = useMemo<Record<string, SearchIndexEntry>>(() => {
      const index: Record<string, SearchIndexEntry> = {};
      for (const m of availableModels) {
        const aggregate = [
          m.label,
          m.description,
          m.category,
          m.vision ? 'vision' : '',
          m.reasoning ? 'reasoning' : '',
          m.pdf ? 'pdf' : '',
          m.experimental ? 'experimental' : '',
          m.pro ? 'pro' : '',
          m.requiresAuth ? 'auth' : '',
        ].join(' ');
        const normalized = normalizeText(aggregate);
        const labelNorm = normalizeText(m.label);
        index[m.value] = {
          normalized,
          labelNorm,
          normalizedNoSpace: normalized.replace(/\s+/g, ''),
          labelNoSpace: labelNorm.replace(/\s+/g, ''),
        };
      }
      return index;
    }, [availableModels, normalizeText]);

    const computeScore = useCallback(
      (modelValue: string, query: string): number => {
        const entry = searchIndex[modelValue];
        if (!entry) return 0;
        const tokens = tokenize(query);
        if (tokens.length === 0) return 1;
        const filteredTokens = tokens.filter((t) => t.length >= 2 || /^\d$/.test(t));
        let matchedCount = 0;
        let score = 0;

        for (const token of filteredTokens) {
          if (!token) continue;

          const inLabel = entry.labelNorm.includes(token);
          const inAll = entry.normalized.includes(token);

          if (inAll) {
            matchedCount += 1;
            score += inLabel ? 3 : 1;

            if (new RegExp(`\\b${token}`).test(entry.labelNorm)) score += 2;
            else if (new RegExp(`\\b${token}`).test(entry.normalized)) score += 1;
          }
        }

        const phraseNoSpace = normalizeText(query).replace(/\s+/g, '');
        if (phraseNoSpace.length >= 2) {
          if (entry.normalizedNoSpace.includes(phraseNoSpace)) score += 2;
          if (entry.labelNoSpace.includes(phraseNoSpace)) score += 3;
          if (entry.labelNoSpace.startsWith(phraseNoSpace)) score += 2;
        }

        if (matchedCount === 0 && phraseNoSpace.length < 2) return 0;
        if (matchedCount === filteredTokens.length && filteredTokens.length > 0) score += 2;

        return score;
      },
      [searchIndex, tokenize, normalizeText],
    );

    const escapeHtml = useCallback((input: string): string => {
      return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }, []);

    const escapeRegExp = useCallback((input: string): string => {
      return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }, []);

    const buildHighlightHtml = useCallback(
      (text: string): string => {
        const q = searchQuery.trim();
        if (!q) return escapeHtml(text);
        const safeText = escapeHtml(text);
        const pattern = new RegExp(`(${escapeRegExp(q)})`, 'gi');
        return safeText.replace(pattern, '<mark class="bg-primary/80 text-primary-foreground rounded px-px">$1</mark>');
      },
      [searchQuery, escapeHtml, escapeRegExp],
    );

    const fetchDiscountConfig = useCallback(async () => {
      if (discountConfig) return;

      try {
        const config = await getDiscountConfigAction();
        setDiscountConfig(config);
      } catch (error) {
      }
    }, [discountConfig]);

    const calculatePricing = useCallback(() => {
      const defaultUSDPrice = PRICING.PRO_MONTHLY;
      const defaultINRPrice = PRICING.PRO_MONTHLY_INR;

      const isDevMode = discountConfig?.dev || process.env.NODE_ENV === 'development';
      const shouldApplyDiscount = isDevMode
        ? discountConfig?.code && discountConfig?.message
        : discountConfig?.enabled && discountConfig?.code && discountConfig?.message;

      if (!discountConfig || !shouldApplyDiscount) {
        return {
          usd: { originalPrice: defaultUSDPrice, finalPrice: defaultUSDPrice, hasDiscount: false },
          inr: location.isIndia
            ? { originalPrice: defaultINRPrice, finalPrice: defaultINRPrice, hasDiscount: false }
            : null,
        };
      }

      let usdPricing: { originalPrice: number; finalPrice: number; hasDiscount: boolean } = {
        originalPrice: defaultUSDPrice,
        finalPrice: defaultUSDPrice,
        hasDiscount: false,
      };
      if (typeof discountConfig.finalPrice === 'number') {
        const original =
          typeof discountConfig.originalPrice === 'number' ? discountConfig.originalPrice : defaultUSDPrice;
        usdPricing = {
          originalPrice: original,
          finalPrice: discountConfig.finalPrice,
          hasDiscount: true,
        };
      } else if (typeof discountConfig.percentage === 'number') {
        const base = typeof discountConfig.originalPrice === 'number' ? discountConfig.originalPrice : defaultUSDPrice;
        const usdSavings = (base * discountConfig.percentage) / 100;
        const usdFinalPrice = base - usdSavings;
        usdPricing = {
          originalPrice: base,
          finalPrice: usdFinalPrice,
          hasDiscount: true,
        };
      }

      let inrPricing: { originalPrice: number; finalPrice: number; hasDiscount: boolean } | null = null;
      if (location.isIndia) {
        if (typeof discountConfig.inrPrice === 'number') {
          inrPricing = {
            originalPrice: defaultINRPrice,
            finalPrice: discountConfig.inrPrice,
            hasDiscount: true,
          };
        } else if (typeof discountConfig.percentage === 'number') {
          const inrSavings = (defaultINRPrice * discountConfig.percentage) / 100;
          const inrFinalPrice = defaultINRPrice - inrSavings;
          inrPricing = {
            originalPrice: defaultINRPrice,
            finalPrice: inrFinalPrice,
            hasDiscount: true,
          };
        } else {
          inrPricing = {
            originalPrice: defaultINRPrice,
            finalPrice: defaultINRPrice,
            hasDiscount: false,
          };
        }
      }

      return {
        usd: usdPricing,
        inr: inrPricing,
      };
    }, [discountConfig, location.isIndia]);

    const pricing = calculatePricing();

    const isFilePart = useCallback((p: unknown): p is { type: 'file'; mediaType?: string } => {
      return (
        typeof p === 'object' &&
        p !== null &&
        'type' in (p as Record<string, unknown>) &&
        (p as { type: unknown }).type === 'file'
      );
    }, []);

    const hasImageAttachments = useMemo(() => {
      const attachmentHasImage = attachments.some((att) => {
        const ct = att.contentType || att.mediaType || '';
        return ct.startsWith('image/');
      });
      const messagesHaveImage = messages.some((msg) =>
        (msg.parts || []).some(
          (part) => isFilePart(part) && typeof part.mediaType === 'string' && part.mediaType.startsWith('image/'),
        ),
      );
      return attachmentHasImage || messagesHaveImage;
    }, [attachments, messages, isFilePart]);

    const hasPdfAttachments = useMemo(() => {
      const attachmentHasPdf = attachments.some((att) => {
        const ct = att.contentType || att.mediaType || '';
        return ct === 'application/pdf';
      });
      const messagesHavePdf = messages.some((msg) =>
        (msg.parts || []).some(
          (part) => isFilePart(part) && typeof part.mediaType === 'string' && part.mediaType === 'application/pdf',
        ),
      );
      return attachmentHasPdf || messagesHavePdf;
    }, [attachments, messages, isFilePart]);

    const filteredModels = useMemo(() => {
      if (!hasImageAttachments && !hasPdfAttachments) {
        return availableModels;
      }
      if (hasImageAttachments && hasPdfAttachments) {
        return availableModels.filter((model) => model.vision && model.pdf);
      }
      if (hasImageAttachments) {
        return availableModels.filter((model) => model.vision);
      }
      return availableModels.filter((model) => model.pdf);
    }, [availableModels, hasImageAttachments, hasPdfAttachments]);

    const rankedModels = useMemo(() => {
      const query = searchQuery.trim();
      if (!query) return null;
      const scored = filteredModels
        .map((m) => ({ model: m, score: computeScore(m.value, query) }))
        .filter((x) => x.score > 0);

      const normQuery = normalizeText(query);
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aLabel = normalizeText(a.model.label);
        const bLabel = normalizeText(b.model.label);
        const aExact = aLabel === normQuery ? 1 : 0;
        const bExact = bLabel === normQuery ? 1 : 0;
        if (bExact !== aExact) return bExact - aExact;
        const aStarts = aLabel.startsWith(normQuery) ? 1 : 0;
        const bStarts = bLabel.startsWith(normQuery) ? 1 : 0;
        if (bStarts !== aStarts) return bStarts - aStarts;
        return a.model.label.localeCompare(b.model.label);
      });

      return scored.map((s) => s.model);
    }, [filteredModels, searchQuery, computeScore, normalizeText]);

    const sortedModels = useMemo(() => filteredModels, [filteredModels]);

    const groupedModels = useMemo(
      () =>
        sortedModels.reduce(
          (acc, model) => {
            const category = model.category;
            if (!acc[category]) {
              acc[category] = [];
            }
            acc[category].push(model);
            return acc;
          },
          {} as Record<string, typeof availableModels>,
        ),
      [sortedModels],
    );

    const orderedGroupEntries = useMemo(() => {
      const groupOrder = isProUser ? ['Pro', 'Experimental', 'Free'] : ['Free', 'Experimental', 'Pro'];
      return groupOrder
        .filter((category) => groupedModels[category] && groupedModels[category].length > 0)
        .map((category) => [category, groupedModels[category]] as const);
    }, [groupedModels, isProUser]);

    const currentModel = useMemo(
      () => availableModels.find((m) => m.value === selectedModel),
      [availableModels, selectedModel],
    );

    useEffect(() => {
      if (!THINK_MODELS.includes(selectedModel) || COMING_SOON_MODELS.has(selectedModel)) {
        setSelectedModel('hyper-google-think');
      }
    }, []);

    useEffect(() => {
      if (isSubscriptionLoading) return;

      const currentModelRequiresPro = requiresProSubscription(selectedModel);
      const currentModelExists = availableModels.find((m) => m.value === selectedModel);

      if (currentModelExists && currentModelRequiresPro && !isProUser && selectedModel !== 'hyper-default') {
        setSelectedModel('hyper-default');

        sileo.info({ title: 'Switched to default model - Pro subscription required for premium models', description: 'Upgrade to Pro to access all models', icon: <Zap size={14} /> });
      }
    }, [selectedModel, isProUser, isSubscriptionLoading, setSelectedModel, availableModels]);

    const handleModelChange = useCallback(
      (value: string) => {
        const model = availableModels.find((m) => m.value === value);
        if (!model) return;

        const requiresAuth = requiresAuthentication(model.value) && !user;
        const requiresPro = requiresProSubscription(model.value) && !isProUser;

        if (isSubscriptionLoading) {
          return;
        }

        if (requiresAuth) {
          setSelectedAuthModel(model);
          setShowSignInDialog(true);
          return;
        }

        if (requiresPro && !isProUser) {
          setSelectedProModel(model);
          fetchDiscountConfig();
          setShowUpgradeDialog(true);
          return;
        }

        setSelectedModel(model.value.trim());

        if (onModelSelect) {
          onModelSelect(model);
        }
      },
      [availableModels, user, isProUser, isSubscriptionLoading, setSelectedModel, onModelSelect, fetchDiscountConfig],
    );

    const renderModelCommandContent = () => (
      <Command
        className={cn(isMobile ? 'flex-1 h-full border-0 bg-transparent rounded-lg' : 'rounded-lg')}
        filter={() => 1}
        shouldFilter={false}
      >
        {!isMobile && (
          <CommandInput
            placeholder="Search models..."
            className="h-9"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
        )}
        <CommandEmpty>No model found.</CommandEmpty>
        <CommandList className={isMobile ? 'flex-1 !max-h-full p-2' : 'max-h-[15em]'}>
          {rankedModels && searchQuery.trim() ? (
            rankedModels.length > 0 ? (
              <CommandGroup key="best-matches">
                <div
                  className={cn('font-medium text-muted-foreground px-2 py-1', isMobile ? 'text-xs' : 'text-[10px]')}
                >
                  Best matches
                </div>
                {rankedModels.map((model) => {
                  const requiresAuth = requiresAuthentication(model.value) && !user;
                  const requiresPro = requiresProSubscription(model.value) && !isProUser;
                  const isComingSoon = COMING_SOON_MODELS.has(model.value);
                  const isLocked = requiresAuth || requiresPro || isComingSoon;

                  if (isLocked) {
                    return (
                      <div
                        key={model.value}
                        className={cn(
                          'flex items-center justify-between px-2 py-1.5 mb-0.5 rounded-lg text-xs cursor-pointer',
                          'transition-all duration-200',
                          'opacity-50 hover:opacity-70 hover:bg-accent',
                        )}
                        onClick={() => {
                          if (isSubscriptionLoading) {
                            return;
                          }

                          if (requiresAuth) {
                            setSelectedAuthModel(model);
                            setShowSignInDialog(true);
                          } else if (requiresPro && !isProUser) {
                            setSelectedProModel(model);
                            fetchDiscountConfig();
                            setShowUpgradeDialog(true);
                          }
                          setOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <div
                            className={cn(
                              'font-medium truncate flex-1',
                              isMobile ? 'text-sm' : 'text-[11px]',
                            )}
                          >
                            {!isMobile && searchQuery ? (
                              <span
                                className="inline"
                                dangerouslySetInnerHTML={{ __html: buildHighlightHtml(model.label) }}
                              />
                            ) : (
                              <span className="inline">{model.label}</span>
                            )}
                          </div>
                          {requiresAuth ? (
                            <LockIcon className={cn('text-muted-foreground flex-shrink-0', isMobile ? 'size-3.5' : 'size-3')} />
                          ) : (
                            <HugeiconsIcon
                              icon={Crown02Icon}
                              size={isMobile ? 14 : 12}
                              color="currentColor"
                              strokeWidth={1.5}
                              className="text-muted-foreground flex-shrink-0"
                            />
                          )}
                          {model.vision && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50 flex-shrink-0',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Eye className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {model.reasoning && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50 flex-shrink-0',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Brain className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {model.pdf && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50 flex-shrink-0',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <FilePdf className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <CommandItem
                      key={model.value}
                      value={model.value}
                      onSelect={(currentValue) => {
                        handleModelChange(currentValue);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex items-center justify-between px-2 py-1.5 mb-0.5 rounded-lg text-xs',
                        'transition-all duration-200',
                        'hover:bg-accent',
                        'data-[selected=true]:bg-accent',
                      )}
                    >
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <div
                          className={cn(
                            'font-medium truncate',
                            isMobile ? 'text-sm' : 'text-[11px]',
                          )}
                        >
                          {!isMobile && searchQuery ? (
                            <span
                              className="inline"
                              dangerouslySetInnerHTML={{ __html: buildHighlightHtml(model.label) }}
                            />
                          ) : (
                            <span className="inline">{model.label}</span>
                          )}
                        </div>
                        <Check
                          className={cn('h-4 w-4 flex-shrink-0', selectedModel === model.value ? 'opacity-100' : 'opacity-0')}
                        />
                        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                          {model.isNew && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Sparkles className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {model.fast && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Zap className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {(() => {
                            const requiresAuth = requiresAuthentication(model.value) && !user;
                            const requiresPro = requiresProSubscription(model.value) && !isProUser;

                            if (requiresAuth) {
                              return (
                                <LockIcon className={cn('text-muted-foreground', isMobile ? 'size-4' : 'size-3')} />
                              );
                            } else if (requiresPro) {
                              return (
                                <HugeiconsIcon
                                  icon={Crown02Icon}
                                  size={isMobile ? 14 : 12}
                                  color="currentColor"
                                  strokeWidth={1.5}
                                  className="text-muted-foreground"
                                />
                              );
                            }
                            return null;
                          })()}
                          {model.vision && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Eye className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {model.reasoning && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Brain className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {model.pdf && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <FilePdf className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : (
              <div className="px-3 py-6 text-xs text-muted-foreground">No model found.</div>
            )
          ) : (
            orderedGroupEntries.map(([category, categoryModels], categoryIndex) => (
              <CommandGroup key={category}>
                {categoryIndex > 0 && <div className="my-1 border-t border-border" />}
                <div
                  className={cn('font-medium text-muted-foreground px-2 py-1', isMobile ? 'text-xs' : 'text-[10px]')}
                >
                  {category} Models
                </div>
                {categoryModels.map((model) => {
                  const requiresAuth = requiresAuthentication(model.value) && !user;
                  const requiresPro = requiresProSubscription(model.value) && !isProUser;
                  const isComingSoon = COMING_SOON_MODELS.has(model.value);
                  const isLocked = requiresAuth || requiresPro || isComingSoon;

                  if (isLocked) {
                    return (
                      <div
                        key={model.value}
                        className={cn(
                          'flex items-center justify-between px-2 py-1.5 mb-0.5 rounded-lg text-xs cursor-pointer',
                          'transition-all duration-200',
                          'opacity-50 hover:opacity-70 hover:bg-accent',
                        )}
                        onClick={() => {
                          if (isSubscriptionLoading) {
                            return;
                          }

                          if (requiresAuth) {
                            setSelectedAuthModel(model);
                            setShowSignInDialog(true);
                          } else if (requiresPro && !isProUser) {
                            setSelectedProModel(model);
                            fetchDiscountConfig();
                            setShowUpgradeDialog(true);
                          }
                          setOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <div
                            className={cn(
                              'font-medium truncate flex-1',
                              isMobile ? 'text-sm' : 'text-[11px]',
                            )}
                          >
                            {!isMobile && searchQuery ? (
                              <span
                                className="inline"
                                dangerouslySetInnerHTML={{ __html: buildHighlightHtml(model.label) }}
                              />
                            ) : (
                              <span className="inline">{model.label}</span>
                            )}
                          </div>
                          {requiresAuth ? (
                            <LockIcon className={cn('text-muted-foreground flex-shrink-0', isMobile ? 'size-3.5' : 'size-3')} />
                          ) : (
                            <HugeiconsIcon
                              icon={Crown02Icon}
                              size={isMobile ? 14 : 12}
                              color="currentColor"
                              strokeWidth={1.5}
                              className="text-muted-foreground flex-shrink-0"
                            />
                          )}
                          {model.vision && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50 flex-shrink-0',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Eye className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {model.reasoning && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50 flex-shrink-0',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Brain className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {model.pdf && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50 flex-shrink-0',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <FilePdf className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <CommandItem
                      key={model.value}
                      value={model.value}
                      onSelect={(currentValue) => {
                        handleModelChange(currentValue);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex items-center justify-between px-2 py-1.5 mb-0.5 rounded-lg text-xs',
                        'transition-all duration-200',
                        'hover:bg-accent',
                        'data-[selected=true]:bg-accent',
                      )}
                    >
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <div
                          className={cn(
                            'font-medium truncate',
                            isMobile ? 'text-sm' : 'text-[11px]',
                          )}
                        >
                          {!isMobile && searchQuery ? (
                            <span
                              className="inline"
                              dangerouslySetInnerHTML={{ __html: buildHighlightHtml(model.label) }}
                            />
                          ) : (
                            <span className="inline">{model.label}</span>
                          )}
                        </div>
                        <Check
                          className={cn('h-4 w-4 flex-shrink-0', selectedModel === model.value ? 'opacity-100' : 'opacity-0')}
                        />
                        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                          {model.isNew && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Sparkles className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {model.fast && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Zap className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {(() => {
                            const requiresAuth = requiresAuthentication(model.value) && !user;
                            const requiresPro = requiresProSubscription(model.value) && !isProUser;

                            if (requiresAuth) {
                              return (
                                <LockIcon className={cn('text-muted-foreground', isMobile ? 'size-4' : 'size-3')} />
                              );
                            } else if (requiresPro) {
                              return (
                                <HugeiconsIcon
                                  icon={Crown02Icon}
                                  size={isMobile ? 14 : 12}
                                  color="currentColor"
                                  strokeWidth={1.5}
                                  className="text-muted-foreground"
                                />
                              );
                            }
                            return null;
                          })()}
                          {model.vision && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Eye className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {model.reasoning && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <Brain className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                          {model.pdf && (
                            <div
                              className={cn(
                                'inline-flex items-center justify-center rounded bg-secondary/50',
                                isMobile ? 'p-1' : 'p-0.5',
                              )}
                            >
                              <FilePdf className={cn('text-muted-foreground', isMobile ? 'size-3' : 'size-2.5')} />
                            </div>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))
          )}
        </CommandList>
      </Command>
    );

    const TriggerButton = React.forwardRef<
      React.ElementRef<typeof Button>,
      React.ComponentPropsWithoutRef<typeof Button>
    >((props, ref) => (
      <Button
        ref={ref}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        size="sm"
        className={cn(
          'flex items-center gap-2 px-3 h-7.5 rounded-lg',
          'border border-border',
          'bg-background text-foreground',
          'hover:bg-accent transition-colors',
          'focus:!outline-none focus:!ring-0',
          'shadow-none',
          className,
        )}
        {...props}
      >
        <HugeiconsIcon icon={CpuIcon} size={24} color="currentColor" strokeWidth={2} />
        <span className="text-xs font-medium sm:block hidden">{currentModel?.label}</span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </Button>
    ));

    TriggerButton.displayName = 'TriggerButton';

    return (
      <>
        {isMobile ? (
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
              <TriggerButton />
            </DrawerTrigger>
            <DrawerContent className="min-h-[60vh] max-h-[80vh] flex flex-col">
              <DrawerHeader className="pb-4 flex-shrink-0">
                <DrawerTitle className="text-left flex items-center gap-2 font-medium font-be-vietnam-pro text-lg">
                  <HugeiconsIcon icon={CpuIcon} size={22} color="currentColor" strokeWidth={2} />
                  Select Model
                </DrawerTitle>
              </DrawerHeader>
              <div className="flex-1 flex flex-col min-h-0">{renderModelCommandContent()}</div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <TriggerButton />
            </PopoverTrigger>
            <PopoverContent
              className="w-[90vw] sm:w-[20em] max-w-[20em] p-0 font-sans rounded-lg bg-popover z-40 border !shadow-none"
              align="start"
              side="bottom"
              sideOffset={4}
              avoidCollisions={true}
              collisionPadding={8}
            >
              {renderModelCommandContent()}
            </PopoverContent>
          </Popover>
        )}

        <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
          <DialogContent className="p-0 overflow-hidden gap-0 bg-background sm:max-w-[450px]" showCloseButton={false}>
            <DialogHeader className="p-2">
              <div className="relative w-full p-6 rounded-md text-white overflow-hidden">
                <div className="absolute inset-0 bg-[url('/placeholder.png')] bg-cover bg-center rounded-sm">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10"></div>
                </div>
                <div className="relative z-10 flex flex-col gap-4">
                  <DialogTitle className="flex items-start gap-3 text-white">
                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                      {selectedProModel?.label ? (
                        <>
                          <div className="flex flex-col gap-1">
                            <span className="text-lg sm:text-xl font-bold truncate">{selectedProModel.label}</span>
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-white/80">requires</span>
                              <ProBadge className="!text-white !bg-white/20 !ring-white/30 font-extralight" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xl sm:text-2xl font-be-vietnam-pro">Hyper</span>
                          <ProBadge className="!text-white !bg-white/20 !ring-white/30 font-extralight" />
                        </div>
                      )}
                    </div>
                  </DialogTitle>
                  <DialogDescription className="text-white/90">
                    {discountConfig &&
                      (() => {
                        const isDevMode = discountConfig.dev || process.env.NODE_ENV === 'development';
                        const shouldShowDiscount = isDevMode
                          ? discountConfig.code && discountConfig.message && discountConfig.percentage
                          : discountConfig.enabled &&
                          discountConfig.code &&
                          discountConfig.message &&
                          discountConfig.percentage;

                        if (shouldShowDiscount && discountConfig.showPrice && discountConfig.finalPrice) {
                          return (
                            <div className="flex items-center gap-2 mb-2">
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 text-white text-sm font-medium">
                                {discountConfig.showPrice && discountConfig.finalPrice
                                  ? `$${PRICING.PRO_MONTHLY - discountConfig.finalPrice} OFF for a year`
                                  : discountConfig.percentage
                                    ? `${discountConfig.percentage}% OFF`
                                    : 'DISCOUNT'}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    <div className="flex items-center gap-2">
                      {pricing.usd.hasDiscount ? (
                        <>
                          <span className="text-lg text-white/60 line-through">${pricing.usd.originalPrice}</span>
                          <span className="text-2xl font-bold">${pricing.usd.finalPrice.toFixed(2)}</span>
                        </>
                      ) : (
                        <span className="text-2xl font-bold">${pricing.usd.finalPrice}</span>
                      )}
                      <span className="text-sm text-white/80">/month</span>
                    </div>
                    <p className="text-sm text-white/80 text-left mt-2">
                      {selectedProModel?.label
                        ? 'Upgrade to access premium AI models and features'
                        : 'Unlock advanced AI models, unlimited searches, and premium features'}
                    </p>
                  </DialogDescription>
                  <Button
                    onClick={() => {
                      window.location.href = '/pricing';
                    }}
                    className="backdrop-blur-md bg-white/90 border border-white/20 text-black hover:bg-white w-full font-medium"
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 py-6 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <CheckIcon className="size-4 text-primary flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Advanced AI Models</p>
                  <p className="text-xs text-muted-foreground">
                    Access to all AI models including Grok 4, Claude and GPT-5
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <CheckIcon className="size-4 text-primary flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Unlimited Searches</p>
                  <p className="text-xs text-muted-foreground">No daily limits on your research</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <CheckIcon className="size-4 text-primary flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Prompt Enhancement</p>
                  <p className="text-xs text-muted-foreground">AI-powered prompt optimization</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <CheckIcon className="size-4 text-primary flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Hyper Fix</p>
                  <p className="text-xs text-muted-foreground">Automated search monitoring on your schedule</p>
                </div>
              </div>

              <div className="flex gap-2 w-full items-center mt-4">
                <div className="flex-1 border-b border-foreground/10" />
                <p className="text-xs text-foreground/50">Cancel anytime • Secure payment</p>
                <div className="flex-1 border-b border-foreground/10" />
              </div>

              <Button
                variant="ghost"
                onClick={() => setShowUpgradeDialog(false)}
                className="w-full text-muted-foreground hover:text-foreground mt-2"
                size="sm"
              >
                Not now
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showSignInDialog} onOpenChange={setShowSignInDialog}>
          <DialogContent className="sm:max-w-[420px] p-0 gap-0 bg-background" showCloseButton={false}>
            <DialogHeader className="p-2">
              <div className="relative w-full p-6 rounded-md text-white overflow-hidden">
                <div className="absolute inset-0 bg-[url('/placeholder.png')] bg-cover bg-center rounded-sm">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10"></div>
                </div>
                <div className="relative z-10 flex flex-col gap-4">
                  <DialogTitle className="flex items-center gap-3 text-white">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4 text-white"
                      >
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <span className="text-lg sm:text-xl font-bold">Sign in required</span>
                      {selectedAuthModel?.label && (
                        <span className="text-sm text-white/70 truncate">for {selectedAuthModel.label}</span>
                      )}
                    </div>
                  </DialogTitle>
                  <DialogDescription className="text-white/90">
                    <p className="text-sm text-white/80 text-left">
                      {selectedAuthModel?.label
                        ? `${selectedAuthModel.label} requires an account to access`
                        : 'Create an account to access this AI model and unlock additional features'}
                    </p>
                  </DialogDescription>
                  <Button
                    onClick={() => {
                      window.location.href = '/sign-in';
                    }}
                    className="backdrop-blur-md bg-white/90 border border-white/20 text-black hover:bg-white w-full font-medium"
                  >
                    Sign in
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="px-6 py-6 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <CheckIcon className="size-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Access better models</p>
                  <p className="text-xs text-muted-foreground">GPT-5 Nano and more premium models</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <CheckIcon className="size-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Save search history</p>
                  <p className="text-xs text-muted-foreground">Keep track of your conversations</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <CheckIcon className="size-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Free to start</p>
                  <p className="text-xs text-muted-foreground">No payment required for basic features</p>
                </div>
              </div>

              <div className="flex gap-2 w-full items-center mt-4">
                <div className="flex-1 border-b border-foreground/10" />
                <Button
                  variant="ghost"
                  onClick={() => setShowSignInDialog(false)}
                  size="sm"
                  className="text-muted-foreground hover:text-foreground text-xs px-3"
                >
                  Maybe later
                </Button>
                <div className="flex-1 border-b border-foreground/10" />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

ModelSwitcher.displayName = 'ModelSwitcher';
