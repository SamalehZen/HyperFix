"use client";
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BorderTrail } from "@/components/core/border-trail";
import { TextShimmer } from "@/components/core/text-shimmer";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { HierarchyIcon as CyrusIcon } from "@hugeicons/core-free-icons";

const CYRUS_V2_LOADING_STEPS = [
  { step: 'extract', message: '📥 Lecture des articles...' },
  { step: 'normalize', message: '🔄 Normalisation et déduplication...' },
  { step: 'cache', message: '💾 Vérification du cache...' },
  { step: 'retrieve', message: '🔍 Recherche de candidats...' },
  { step: 'route', message: '🗺️ Routage vers les secteurs...' },
  { step: 'expert', message: '🧠 Classification par secteur...' },
  { step: 'validate', message: '✅ Validation hiérarchique...' },
  { step: 'format', message: '📊 Mise en forme du tableau...' },
];

const STEP_DURATIONS_MS = [800, 600, 500, 1500, 2500, 6000, 1200, 800];

export interface CyrusLoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  duration?: number;
  bulkMode?: boolean;
}

export function CyrusLoadingState({ size = 80, duration = 5, className, bulkMode = false, ...props }: CyrusLoadingStateProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!bulkMode) return;
    setStepIndex(0);

    let current = 0;
    let timeout: NodeJS.Timeout;

    const advance = () => {
      if (current < CYRUS_V2_LOADING_STEPS.length - 1) {
        current++;
        setStepIndex(current);
        timeout = setTimeout(advance, STEP_DURATIONS_MS[current] ?? 1000);
      }
    };

    timeout = setTimeout(advance, STEP_DURATIONS_MS[0] ?? 1000);
    return () => clearTimeout(timeout);
  }, [bulkMode]);

  const displayMessage = bulkMode
    ? CYRUS_V2_LOADING_STEPS[stepIndex]?.message ?? 'Structuration en cours…'
    : 'Structuration en cours…';

  const progress = bulkMode
    ? Math.round(((stepIndex + 1) / CYRUS_V2_LOADING_STEPS.length) * 100)
    : 0;

  return (
    <Card
      className={cn("relative w-full h-[100px] my-4 overflow-hidden shadow-none", className)}
      role="status"
      aria-live="polite"
      aria-label={displayMessage}
      {...props}
    >
      <BorderTrail
        className={cn(
          "bg-linear-to-l from-[#7D7064] via-[#70665D] to-[#3C3732]",
          "dark:from-[#C7C0B9] dark:via-[#A8998B] dark:to-[#8F877F]"
        )}
        size={size}
        transition={{ repeat: Infinity, duration, ease: "linear" }}
      />
      <CardContent className="px-6">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-full flex items-center justify-center bg-[#EDEAE7]/60 dark:bg-[#3C3732]/40">
              <BorderTrail
                className={cn(
                  "bg-linear-to-l from-[#7D7064] via-[#70665D] to-[#3C3732]",
                  "dark:from-[#C7C0B9] dark:via-[#A8998B] dark:to-[#8F877F]"
                )}
                size={40}
                transition={{ repeat: Infinity, duration, ease: "linear" }}
              />
              <HugeiconsIcon icon={CyrusIcon} size={20} color="currentColor" strokeWidth={2} className={cn("text-[#70665D] dark:text-[#C7C0B9]")} />
            </div>
            <div className="space-y-2">
              <TextShimmer className="text-base font-medium" duration={1.6}>
                {displayMessage}
              </TextShimmer>
              {bulkMode ? (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-32 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#70665D] dark:bg-[#A8998B] transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{stepIndex + 1}/{CYRUS_V2_LOADING_STEPS.length}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse"
                      style={{ width: `${Math.random() * 40 + 20}px`, animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
