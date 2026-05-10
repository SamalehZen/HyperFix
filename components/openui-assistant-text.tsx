'use client';

import { useState, useCallback } from 'react';
import type { ActionEvent, ParseResult } from '@openuidev/react-lang';
import { BuiltinActionType, Renderer } from '@openuidev/react-lang';
import { openuiChatLibrary } from '@openuidev/react-ui/genui-lib';
import { MarkdownRenderer } from '@/components/markdown';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';

interface OpenUIAssistantTextProps {
  text: string;
  isStreaming: boolean;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  forceMarkdown?: boolean;
}

export function OpenUIAssistantText({
  text,
  isStreaming,
  sendMessage,
  forceMarkdown = false,
}: OpenUIAssistantTextProps) {
  const [parseFailed, setParseFailed] = useState(false);

  const handleAction = useCallback(
    (event: ActionEvent) => {
      if (
        event.type === BuiltinActionType.ContinueConversation &&
        event.humanFriendlyMessage
      ) {
        sendMessage({ text: event.humanFriendlyMessage });
      }
    },
    [sendMessage],
  );

  const handleParseResult = useCallback(
    (result: ParseResult | null) => {
      if (!isStreaming) {
        const hasRoot = !!result?.root;
        setParseFailed(!hasRoot);
      }
    },
    [isStreaming],
  );

  if (forceMarkdown || parseFailed) {
    return <MarkdownRenderer content={text} />;
  }

  return (
    <Renderer
      response={text}
      library={openuiChatLibrary}
      isStreaming={isStreaming}
      onAction={handleAction}
      onParseResult={handleParseResult}
    />
  );
}
