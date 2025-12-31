"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Brain as BrainIcon, ChevronDown as ChevronDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Streamdown } from "./streamdown";
import { Shimmer } from "./shimmer";

type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

type ControllableStateProps<T> = {
  prop: T | undefined;
  defaultProp: T | undefined;
  onChange?: (value: T) => void;
};

function useControllableState<T>({ prop, defaultProp, onChange }: ControllableStateProps<T>) {
  const isControlled = prop !== undefined;
  const [uncontrolledState, setUncontrolledState] = useState<T | undefined>(defaultProp);
  const value = isControlled ? (prop as T) : uncontrolledState;

  const setValue = useCallback(
    (nextValue: T | ((prev: T | undefined) => T)) => {
      const resolved = typeof nextValue === "function" ? (nextValue as (prev: T | undefined) => T)(value) : nextValue;
      if (!isControlled) {
        setUncontrolledState(resolved);
      }
      onChange?.(resolved);
    },
    [isControlled, onChange, value],
  );

  return [value, setValue] as const;
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState<boolean>({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });
    const [duration, setDuration] = useControllableState<number | undefined>({
      prop: durationProp,
      defaultProp: undefined,
    });

    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S));
        setStartTime(null);
      }
    }, [isStreaming, startTime, setDuration]);

    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed]);

    const contextValue = useMemo<ReasoningContextValue>(
      () => ({ isStreaming, isOpen: Boolean(isOpen), setIsOpen: (value) => setIsOpen(value), duration }),
      [isStreaming, isOpen, setIsOpen, duration],
    );

    return (
      <ReasoningContext.Provider value={contextValue}>
        <Collapsible
          className={cn("not-prose mb-4", className)}
          onOpenChange={(nextOpen) => setIsOpen(nextOpen)}
          open={Boolean(isOpen)}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  }
);

Reasoning.displayName = "Reasoning";

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  children?: ReactNode;
};

const getThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return <Shimmer duration={1}>Thinking...</Shimmer>;
  }
  if (duration === undefined) {
    return <p>Thought for a few seconds</p>;
  }
  return <p>Thought for {duration} seconds</p>;
};

export const ReasoningTrigger = memo(
  ({ className, children, ...props }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning();

    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-4" />
            {getThinkingMessage(isStreaming, duration)}
            <ChevronDownIcon
              className={cn("size-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);

ReasoningTrigger.displayName = "ReasoningTrigger";

export type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: ReactNode;
};

export const ReasoningContent = memo(({ className, children, ...props }: ReasoningContentProps) => {
  const content = typeof children === "string" ? <Streamdown>{children}</Streamdown> : children;

  return (
    <CollapsibleContent
      className={cn(
        "mt-4 text-sm",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      {...props}
    >
      {content}
    </CollapsibleContent>
  );
});

ReasoningContent.displayName = "ReasoningContent";
