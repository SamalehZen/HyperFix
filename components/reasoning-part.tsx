import React, { useRef, useEffect } from 'react';
import { ReasoningUIPart } from 'ai';

import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from '@/components/ai-elements/reasoning';
import { Streamdown } from '@/components/ai-elements/streamdown';
import { cn } from '@/lib/utils';

interface ReasoningPartViewProps {
  part: ReasoningUIPart;
  sectionKey: string;
  parallelTool: string | null;
  isExpanded: boolean;
  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;
  setIsExpanded: (v: boolean) => void;
}

const isEmptyContent = (content: string): boolean => {
  return !content || content.trim() === '' || /^\n+$/.test(content);
};

export const ReasoningPartView: React.FC<ReasoningPartViewProps> = React.memo(
  ({ part, sectionKey, isExpanded, isFullscreen, setIsExpanded }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isComplete = part.state === 'done';

    useEffect(() => {
      if (!isComplete && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [isComplete, part.text]);

    useEffect(() => {
      if (!isComplete && scrollRef.current && part.text && part.text.length > 0) {
        const timeout = setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 10);

        return () => clearTimeout(timeout);
      }
      return undefined;
    }, [part.text, isComplete]);

    const hasNonEmptyReasoning = part.text && !isEmptyContent(part.text);

    if (!hasNonEmptyReasoning) {
      return null;
    }

    return (
      <div className="my-2" key={sectionKey}>
        <Reasoning
          isStreaming={!isComplete}
          open={isExpanded}
          onOpenChange={setIsExpanded}
          className="w-full"
        >
          <div className="rounded-lg border border-border/80 bg-card shadow-sm">
            <ReasoningTrigger className="w-full rounded-t-lg px-3 py-2" />
            <ReasoningContent className="border-t border-border/80 px-3 py-3">
              <div
                ref={scrollRef}
                className={cn(
                  'overflow-y-auto rounded-lg bg-muted/20 px-3 py-2 text-xs leading-relaxed',
                  'scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-border scrollbar-track-transparent',
                  isFullscreen ? 'max-h-[60vh]' : 'max-h-[180px]',
                )}
              >
                <Streamdown>{part.text}</Streamdown>
              </div>
            </ReasoningContent>
          </div>
        </Reasoning>
      </div>
    );
  },
);

ReasoningPartView.displayName = 'ReasoningPartView';
