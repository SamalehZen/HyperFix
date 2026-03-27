'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useLocalStorage } from '@/hooks/use-local-storage';
import {
  getUserMessageCount,
  getSubDetails,
  getExtremeSearchUsageCount,
  getHistoricalUsage,
} from '@/app/actions';
import {
  MagnifyingGlassIcon,
  LightningIcon,
} from '@phosphor-icons/react';
import { useState, useEffect, useMemo } from 'react';
import { sileo } from 'sileo';
import { useQuery } from '@tanstack/react-query';
import { cn, getSearchGroups, SearchGroupId } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useSelectedProfileIcon } from '@/hooks/use-selected-profile-icon';
import { useIsProUser } from '@/contexts/user-context';
import { HyperLogo } from './logos/hyper-logo';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserAccountIcon,
  Analytics01Icon,
  Settings02Icon,
  HierarchyIcon,
  MagicWandIcon,
  File02Icon,
  ChattingIcon,
  AppleStocksIcon,
  GlobalSearchIcon,
} from '@hugeicons/core-free-icons';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLocalSession } from '@/hooks/use-local-session';
import { GripIcon } from '@/components/ui/grip';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  subscriptionData?: any;
  isProUser?: boolean;
  isProStatusLoading?: boolean;
  initialTab?: string;
}

// Component for Profile Information
function ProfileSection({ user, subscriptionData, isProUser, isProStatusLoading }: any) {
  const { isProUser: fastProStatus, isLoading: fastProLoading } = useIsProUser();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const selectedProfileIcon = useSelectedProfileIcon();

  // Use comprehensive Pro status from user data (includes both Polar + DodoPayments)
  const isProUserActive: boolean = user?.isProUser || fastProStatus || false;
  const showProLoading: boolean = Boolean(fastProLoading || isProStatusLoading);

  return (
    <div>
      <div className={cn('flex flex-col items-center text-center space-y-3', isMobile ? 'pb-2' : 'pb-4')}>
        <Avatar className={isMobile ? 'h-16 w-16' : 'h-20 w-20'}>
          <AvatarImage src={user?.image || selectedProfileIcon || ''} />
          <AvatarFallback className={isMobile ? 'text-base' : 'text-lg'}>
            {user?.name
              ? user.name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
              : 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <h3 className={cn('font-semibold', isMobile ? 'text-base' : 'text-lg')}>{user?.name}</h3>
          <p className={cn('text-muted-foreground', isMobile ? 'text-xs' : 'text-sm')}>{user?.email}</p>
          {showProLoading ? (
            <Skeleton className="h-5 w-16 mx-auto" />
          ) : (
            isProUserActive && (
              <span
                className={cn(
                  'font-baumans! px-2 pt-1 pb-2 inline-flex leading-5 mt-2 items-center rounded-lg shadow-sm border-transparent ring-1 ring-ring/35 ring-offset-1 ring-offset-background',
                  'bg-gradient-to-br from-secondary/25 via-primary/20 to-accent/25 text-foreground',
                  'dark:bg-gradient-to-br dark:from-primary dark:via-secondary dark:to-primary dark:text-foreground',
                )}
              >
                utilisateur Pro
              </span>
            )
          )}
        </div>
      </div>

      <div className={isMobile ? 'space-y-2' : 'space-y-3'}>
        <div className={cn('bg-muted/50 rounded-lg space-y-3', isMobile ? 'p-3' : 'p-4')}>
          <div>
            <Label className="text-xs text-muted-foreground">Nom complet</Label>
            <p className="text-sm font-medium mt-1">{user?.name || 'Non renseigné'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Adresse e-mail</Label>
            <p className="text-sm font-medium mt-1 break-all">{user?.email || 'Non renseigné'}</p>
          </div>
        </div>

        <div className={cn('bg-muted/30 rounded-lg border border-border', isMobile ? 'p-2.5' : 'p-3')}>
          <p className={cn('text-muted-foreground', isMobile ? 'text-[11px]' : 'text-xs')}>
            Les informations de profil sont gérées par votre fournisseur d'authentification. Contactez le support pour mettre à jour vos informations.
          </p>
        </div>
      </div>
    </div>
  );
}

// Component for Agent Preferences
export function PreferencesSection({ user }: { user: any }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [searchProvider] = useLocalStorage<'exa' | 'parallel' | 'tavily' | 'firecrawl'>(
    'hyper-search-provider',
    'parallel',
  );

  // Agents reordering (drag-and-drop)
  const { data: session } = useLocalSession();
  const [hiddenAgents, setHiddenAgents] = useLocalStorage<string[]>('hyper-hidden-agents', []);
  const dynamicGroups = useMemo(() => getSearchGroups(searchProvider, hiddenAgents), [searchProvider, hiddenAgents]);
  const reorderVisibleGroups = useMemo(
    () =>
      dynamicGroups.filter((group) => {
        if (!group.show) return false;
        if ('requireAuth' in group && group.requireAuth && !session) return false;
        if (group.id === 'extreme' || group.id === 'pdfExcel') return false;
        return true;
      }),
    [dynamicGroups, session],
  );
  const reorderVisibleIds = useMemo(() => reorderVisibleGroups.map((g) => g.id), [reorderVisibleGroups]);

  const defaultAgentOrder = useMemo(() => {
    const preferred: SearchGroupId[] = ['cyrus', 'libeller', 'nomenclature'].filter((id) =>
      reorderVisibleIds.includes(id as SearchGroupId),
    ) as SearchGroupId[];
    const rest = reorderVisibleIds.filter((id) => !preferred.includes(id as SearchGroupId)) as SearchGroupId[];
    return [...preferred, ...rest] as SearchGroupId[];
  }, [reorderVisibleIds]);

  const [agentOrder, setAgentOrder] = useLocalStorage<SearchGroupId[]>('hyper-agent-order', defaultAgentOrder);

  const normalizedAgentOrder = useMemo(() => {
    const filtered = agentOrder.filter((id) => reorderVisibleIds.includes(id));
    const missing = reorderVisibleIds.filter((id) => !filtered.includes(id));
    return [...filtered, ...missing] as SearchGroupId[];
  }, [agentOrder, reorderVisibleIds]);

  useEffect(() => {
    if (normalizedAgentOrder.length !== agentOrder.length || normalizedAgentOrder.some((id, i) => id !== agentOrder[i])) {
      setAgentOrder(normalizedAgentOrder);
    }
  }, [normalizedAgentOrder, agentOrder, setAgentOrder]);

  const [items, setItems] = useState<SearchGroupId[]>(normalizedAgentOrder);

  useEffect(() => setItems(normalizedAgentOrder), [normalizedAgentOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleAgentDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(active.id as SearchGroupId);
    const newIndex = items.indexOf(over.id as SearchGroupId);
    if (oldIndex === -1 || newIndex === -1) return;
    const previous = items;
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);
    try {
      setAgentOrder(newItems);
      sileo.success({ title: 'Ordre des agents mis à jour' });
    } catch (e) {
      setItems(previous);
      sileo.error({ title: "Impossible d'enregistrer l'ordre" });
    }
  };

  const handleToggleAgentVisibility = (agentId: string) => {
    setHiddenAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    );
  };

  function SortableAgentCard({ id }: { id: SearchGroupId }) {
    const group = reorderVisibleGroups.find((g) => g.id === id);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;
    if (!group) return null;
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'rounded-lg border bg-card p-3 sm:p-4 flex items-start gap-2.5 select-none',
          'cursor-grab active:cursor-grabbing',
          isDragging ? 'shadow-lg ring-1 ring-primary/30' : 'hover:shadow-sm',
        )}
        aria-grabbed={isDragging}
      >
        <div className="flex items-center justify-center rounded-md bg-muted/50 p-1.5">
          <HugeiconsIcon icon={group.icon} size={20} color="currentColor" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{group.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{group.description}</div>
            </div>
            <button
              className="ml-2 p-1 text-muted-foreground/80 hover:text-foreground rounded focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Déplacer"
              {...attributes}
              {...listeners}
            >
              <GripIcon size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', isMobile ? 'space-y-4' : 'space-y-6')}>
      <div>
        <h3 className={cn('font-semibold mb-1.5', isMobile ? 'text-sm' : 'text-base')}>Préférences</h3>
        <p className={cn('text-muted-foreground', isMobile ? 'text-xs leading-relaxed' : 'text-xs')}>
          Réorganisez et gérez la visibilité de vos agents.
        </p>
      </div>

      {/* Agents Reorder Section */}
      <div className="space-y-3">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <HugeiconsIcon icon={Settings02Icon} className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Réorganiser les Agents</h4>
              <p className="text-xs text-muted-foreground">Faites glisser pour définir votre ordre préféré</p>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAgentDragEnd}>
            <SortableContext items={items} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {items.map((id) => (
                  <SortableAgentCard key={id} id={id} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <p className="text-xs text-muted-foreground">L'ordre sera sauvegardé automatiquement.</p>
        </div>
      </div>

      {/* Agent Visibility Section */}
      <div className="space-y-3">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <HugeiconsIcon icon={Settings02Icon} className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Masquer les Agents</h4>
                <p className="text-xs text-muted-foreground">Contrôlez les agents qui apparaissent dans le menu</p>
              </div>
            </div>
            {hiddenAgents.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setHiddenAgents([])}>
                Réactiver tout
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {reorderVisibleGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-lg border bg-card p-3 sm:p-4 flex items-start gap-2.5 select-none"
              >
                <div className="flex items-center justify-center rounded-md bg-muted/50 p-1.5">
                  <HugeiconsIcon icon={group.icon} size={20} color="currentColor" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{group.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{group.description}</div>
                    </div>
                    <Switch
                      checked={!hiddenAgents.includes(group.id)}
                      onCheckedChange={() => handleToggleAgentVisibility(group.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Les modifications sont sauvegardées automatiquement.</p>
        </div>
      </div>
    </div>
  );
}

// Component for Usage Information
export function UsageSection({ user }: any) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isMobile = useMediaQuery('(max-width: 768px)');
  const isProUser = user?.isProUser;

  const {
    data: usageData,
    isLoading: usageLoading,
    error: usageError,
    refetch: refetchUsageData,
  } = useQuery({
    queryKey: ['usageData'],
    queryFn: async () => {
      const [searchCount, extremeSearchCount, subscriptionDetails] = await Promise.all([
        getUserMessageCount(),
        getExtremeSearchUsageCount(),
        getSubDetails(),
      ]);

      return {
        searchCount,
        extremeSearchCount,
        subscriptionDetails,
      };
    },
    staleTime: 1000 * 60 * 3,
    enabled: !!user,
  });

  const {
    data: historicalUsageData,
    isLoading: historicalLoading,
    refetch: refetchHistoricalData,
  } = useQuery({
    queryKey: ['historicalUsage', user?.id, 12],
    queryFn: () => getHistoricalUsage(user, 12),
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  const searchCount = usageData?.searchCount;
  const extremeSearchCount = usageData?.extremeSearchCount;

  // Generate loading stars data that matches real data structure
  const loadingStars = useMemo(() => {
    if (!historicalLoading) return [];

    const months = 12;
    const totalDays = months * 30;
    const futureDays = Math.min(15, Math.floor(totalDays * 0.08));
    const pastDays = totalDays - futureDays - 1;

    return Array.from({ length: months }, (_, monthIndex) => {
      const daysInMonth = 30;
      const monthOffset = (months - 1 - monthIndex) * 30;
      const isCurrentMonth = monthIndex === 0;
      const actualFutureDays = isCurrentMonth ? futureDays : 0;
      const actualPastDays = daysInMonth - actualFutureDays;

      return {
        month: new Date(2024, monthIndex, 1).toLocaleString('default', { month: 'short' }),
        days: Array.from({ length: daysInMonth }, (_, dayIndex) => ({
          level: 0,
          date: new Date(Date.now() - (monthOffset + actualPastDays - 1 - dayIndex) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        })),
      };
    }).reverse();
  }, [historicalLoading]);

  const processedHistoricalData = useMemo(() => {
    const raw = Array.isArray(historicalUsageData) ? historicalUsageData : null;
    if (historicalLoading || !raw || raw.length === 0) {
      return loadingStars;
    }

    const historyMap = new Map<string, { count: number; level: number }>();
    raw.forEach((item: { date: string; count: number; level: number }) => {
      historyMap.set(item.date, { count: item.count, level: item.level });
    });

    const today = new Date();
    const months: { month: string; days: { level: number; date: string }[] }[] = [];

    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.unshift({
        month: date.toLocaleString('default', { month: 'short' }),
        days: [],
      });
    }

    months.forEach((month, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - (11 - index), 1);
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(date.getFullYear(), date.getMonth(), day);
        if (currentDate > today) continue;
        const dateStr = currentDate.toISOString().split('T')[0];
        const entry = historyMap.get(dateStr);

        month.days.push({
          level: entry?.level ?? 0,
          date: dateStr,
        });
      }
    });

    return months;
  }, [historicalUsageData, historicalLoading, loadingStars]);

  const historicalTotalCount = useMemo(() => {
    const raw = Array.isArray(historicalUsageData) ? historicalUsageData : null;
    if (!raw) return 0;
    return raw.reduce((sum: number, item: { count: number }) => sum + item.count, 0);
  }, [historicalUsageData]);

  const { monthMeta, totalCols, allCells } = useMemo(() => {
    if (!processedHistoricalData?.length) return { monthMeta: [], totalCols: 0, allCells: [] as Array<{ level: number; date: string; empty?: boolean }> };

    let col = 0;
    const monthMeta = processedHistoricalData.map(month => {
      const weeks = Math.ceil(month.days.length / 7);
      const startCol = col;
      col += weeks;
      return { label: month.month, startCol, weeks };
    });

    const allCells: Array<{ level: number; date: string; empty?: boolean }> = [];
    processedHistoricalData.forEach(month => {
      const weeks = Math.ceil(month.days.length / 7);
      const totalSlots = weeks * 7;
      month.days.forEach(d => allCells.push({ level: d.level, date: d.date }));
      for (let i = month.days.length; i < totalSlots; i++) {
        allCells.push({ level: 0, date: '', empty: true });
      }
    });

    return { monthMeta, totalCols: col, allCells };
  }, [processedHistoricalData]);

  const AGENTS = [
    { id: 'libeller', name: 'Correction Libellé', icon: MagicWandIcon, premium: false },
    { id: 'nomenclature', name: 'Nomenclature', icon: AppleStocksIcon, premium: false },
    { id: 'chat', name: 'Chat', icon: ChattingIcon, premium: false },
    { id: 'eanexpert', name: 'EAN Expert', icon: GlobalSearchIcon, premium: false },
    { id: 'cyrus', name: 'Cyrus Structure', icon: HierarchyIcon, premium: true },
    { id: 'pdfExcel', name: 'PDF → Excel', icon: File02Icon, premium: true },
  ];
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchUsageData(), refetchHistoricalData()]);
    setIsRefreshing(false);
  };

  return (
    <div className={cn('space-y-3', isMobile ? 'space-y-2.5' : 'space-y-3')}>
      {/* Agents */}
      <div className="space-y-2">
        <h3 className={cn('font-semibold', isMobile ? 'text-sm' : 'text-sm')}>Vos Agents</h3>
        <div className={cn('grid', isMobile ? 'grid-cols-3 gap-2' : 'grid-cols-3 gap-2')}>
          {AGENTS.map((agent) => (
            <div
              key={agent.id}
              className={cn(
                'relative bg-muted/50 dark:bg-card rounded-lg flex items-center gap-2.5',
                'border border-border/50 hover:border-border transition-colors',
                isMobile ? 'p-2' : 'px-3 py-2.5',
              )}
            >
              {agent.premium && (
                <span className="absolute -top-1.5 -right-1.5 text-[10px] drop-shadow-sm">👑</span>
              )}
              <div
                className={cn(
                  'rounded-full flex items-center justify-center shrink-0',
                  agent.premium ? 'bg-amber-500/10 dark:bg-amber-400/10' : 'bg-primary/10',
                  'size-7',
                )}
              >
                <HugeiconsIcon
                  icon={agent.icon}
                  size={14}
                  strokeWidth={1.5}
                  className={agent.premium ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}
                />
              </div>
              <div className="min-w-0">
                <span className={cn('font-medium leading-tight block truncate', isMobile ? 'text-[10px]' : 'text-xs')}>
                  {agent.name}
                </span>
                <span className={cn('font-bold tabular-nums text-muted-foreground', isMobile ? 'text-xs' : 'text-sm')}>
                  —
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Graph Section */}
      {(historicalUsageData || historicalLoading) && (
        <div className={cn('bg-card rounded-xl border shadow-sm', isMobile ? 'p-3 pt-4' : 'p-5 pt-5')}>
          <div>
            {processedHistoricalData && processedHistoricalData.length > 0 && totalCols > 0 ? (
              <TooltipProvider delayDuration={0}>
                <div className="w-full">
                  <div
                    className="grid mb-1.5"
                    style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)`, gap: '2px' }}
                  >
                    {monthMeta.map(m => (
                      <div
                        key={m.label}
                        className={cn('text-muted-foreground font-medium truncate', isMobile ? 'text-[8px]' : 'text-[11px]')}
                        style={{ gridColumn: `${m.startCol + 1} / span ${m.weeks}` }}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>
                  <div
                    className="grid w-full"
                    style={{
                      gridTemplateColumns: `repeat(${totalCols}, 1fr)`,
                      gridTemplateRows: 'repeat(7, auto)',
                      gridAutoFlow: 'column',
                      gap: '2px',
                    }}
                  >
                    {allCells.map((cell, i) =>
                      cell.empty ? (
                        <div key={i} />
                      ) : (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'aspect-square rounded-[3px] cursor-default',
                                cell.level === 0 && 'bg-muted',
                                cell.level === 1 && 'bg-primary/30',
                                cell.level === 2 && 'bg-primary/50',
                                cell.level === 3 && 'bg-primary/70',
                                cell.level === 4 && 'bg-primary',
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-medium">
                              {new Date(cell.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <p className="text-muted-foreground">
                              {(Array.isArray(historicalUsageData) ? historicalUsageData.find((h: any) => h.date === cell.date)?.count : 0) ?? 0} recherches
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-2">
                  <p className={cn('text-muted-foreground', isMobile ? 'text-[10px]' : 'text-xs')}>
                    {historicalTotalCount.toLocaleString('fr-FR')} messages (12 derniers mois)
                  </p>
                  <div className="flex items-center gap-[3px]">
                    <span className={cn('text-muted-foreground mr-1', isMobile ? 'text-[9px]' : 'text-[11px]')}>Moins</span>
                    <div className={cn('rounded-[3px] bg-muted', isMobile ? 'size-[8px]' : 'size-3')} />
                    <div className={cn('rounded-[3px] bg-primary/30', isMobile ? 'size-[8px]' : 'size-3')} />
                    <div className={cn('rounded-[3px] bg-primary/50', isMobile ? 'size-[8px]' : 'size-3')} />
                    <div className={cn('rounded-[3px] bg-primary/70', isMobile ? 'size-[8px]' : 'size-3')} />
                    <div className={cn('rounded-[3px] bg-primary', isMobile ? 'size-[8px]' : 'size-3')} />
                    <span className={cn('text-muted-foreground ml-1', isMobile ? 'text-[9px]' : 'text-[11px]')}>Plus</span>
                  </div>
                </div>
              </TooltipProvider>
            ) : (
              <div className="h-24 flex items-center justify-center">
                <p className={cn('text-muted-foreground', isMobile ? 'text-[11px]' : 'text-xs')}>Aucune donnée d'activité</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



export function SettingsDialog({
  open,
  onOpenChange,
  user,
  subscriptionData,
  isProUser,
  isProStatusLoading,
  initialTab = 'profile',
}: SettingsDialogProps) {
  const [currentTab, setCurrentTab] = useState(initialTab);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Reset tab when initialTab changes or when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentTab(initialTab);
    }
  }, [open, initialTab]);
  // Dynamically stabilize drawer height on mobile when the virtual keyboard opens (PWA/iOS)
  const [mobileDrawerPxHeight, setMobileDrawerPxHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!isMobile || !open) {
      setMobileDrawerPxHeight(null);
      return;
    }

    const updateHeight = () => {
      try {
        // Prefer VisualViewport for accurate height when keyboard is open
        const visualHeight = (window as any).visualViewport?.height ?? window.innerHeight;
        const computed = Math.min(600, Math.round(visualHeight * 0.85));
        setMobileDrawerPxHeight(computed);
      } catch {
        setMobileDrawerPxHeight(null);
      }
    };

    updateHeight();
    const vv: VisualViewport | undefined = (window as any).visualViewport;
    vv?.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);

    return () => {
      vv?.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
    };
  }, [isMobile, open]);

  const tabItems = [
    {
      value: 'profile',
      label: 'Compte',
      icon: ({ className }: { className?: string }) => <HugeiconsIcon icon={UserAccountIcon} className={className} />,
    },
    {
      value: 'usage',
      label: 'Utilisation',
      icon: ({ className }: { className?: string }) => <HugeiconsIcon icon={Analytics01Icon} className={className} />,
    },
    {
      value: 'preferences',
      label: 'Préférences',
      icon: ({ className }: { className?: string }) => <HugeiconsIcon icon={Settings02Icon} className={className} />,
    },
  ];

  const contentSections = (
    <>
      <TabsContent value="profile" className="mt-0">
        <ProfileSection
          user={user}
          subscriptionData={subscriptionData}
          isProUser={isProUser}
          isProStatusLoading={isProStatusLoading}
        />
      </TabsContent>

      <TabsContent value="usage" className="mt-0">
        <UsageSection user={user} />
      </TabsContent>

      <TabsContent
        value="preferences"
        className="mt-0 !scrollbar-thin !scrollbar-track-transparent !scrollbar-thumb-muted-foreground/20 hover:!scrollbar-thumb-muted-foreground/30"
      >
        <PreferencesSection user={user} />
      </TabsContent>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className="h-[85vh] max-h-[600px] p-0 [&[data-vaul-drawer]]:transition-none overflow-hidden"
          style={{
            height: mobileDrawerPxHeight ?? undefined,
            maxHeight: mobileDrawerPxHeight ?? undefined,
          }}
        >
          <div className="flex flex-col h-full max-h-full">
            {/* Header - more compact */}
            <DrawerHeader className="pb-2 px-4 pt-3 shrink-0">
              <DrawerTitle className="text-base font-medium flex items-center gap-2">
                <HyperLogo className="size-6" />
                Paramètres
              </DrawerTitle>
            </DrawerHeader>

            {/* Content area with tabs */}
            <Tabs
              value={currentTab}
              onValueChange={setCurrentTab}
              className="flex-1 flex flex-col overflow-hidden gap-0"
            >
              {/* Tab content - takes up most space */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 !pb-4 overscroll-contain !scrollbar-w-1 !scrollbar-track-transparent !scrollbar-thumb-muted-foreground/20 hover:!scrollbar-thumb-muted-foreground/30">
                {contentSections}
              </div>

              {/* Bottom tab navigation - compact and accessible */}
              <div
                className={cn(
                  'border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0',
                  currentTab === 'preferences' || currentTab === 'connectors'
                    ? 'pb-[calc(env(safe-area-inset-bottom)+2.5rem)]'
                    : 'pb-[calc(env(safe-area-inset-bottom)+1rem)]',
                )}
              >
                <TabsList className="w-full py-1.5 h-24 bg-transparent rounded-none grid grid-cols-3 sm:grid-cols-6 gap-2 !mb-2 px-3 sm:px-4">
                  {tabItems.map((item) => (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      className="flex-col gap-0.5 h-full rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none relative px-2 min-w-0 transition-colors"
                    >
                      <item.icon
                        className={cn(
                          'h-5 w-5 transition-colors',
                          currentTab === item.value ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      />
                      <span
                        className={cn(
                          'text-[10px] mt-0.5 transition-colors',
                          currentTab === item.value ? 'text-foreground font-medium' : 'text-muted-foreground',
                        )}
                      >
                        {item.label}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-4xl !w-full max-h-[85vh] !p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 !m-0">
          <DialogTitle className="text-xl font-medium tracking-normal flex items-center gap-2">
            <HyperLogo className="size-6" color="currentColor" />
            Paramètres
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 !m-0">
            <div className="p-2 !gap-1 flex flex-col">
              {tabItems.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setCurrentTab(item.value)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    'hover:bg-muted',
                    currentTab === item.value
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-[calc(85vh-120px)] !scrollbar-w-1 !scrollbar-track-transparent !scrollbar-thumb-muted-foreground/20 hover:!scrollbar-thumb-muted-foreground/30">
              <div className="p-6 pb-8">
                <Tabs value={currentTab} onValueChange={setCurrentTab} orientation="vertical">
                  {contentSections}
                </Tabs>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
