import { UseChatHelpers } from '@ai-sdk/react';
import { ChatMessage } from '@/lib/types';
import { SearchGroupId, SearchGroup } from '@/lib/utils';
import { ComprehensiveUserData } from '@/hooks/use-user-data';
import { models } from '@/ai/providers';

export type DiscountConfig = {
  enabled: boolean;
  code?: string;
  message?: string;
  percentage?: number;
  originalPrice?: number;
  finalPrice?: number;
  inrPrice?: number;
  dev?: boolean;
  showPrice?: boolean;
  buttonText?: string;
};

export type ConnectorProvider = 'google_drive' | 'notion' | 'slack' | 'github';

export type ConnectorConfig = {
  id: ConnectorProvider;
  name: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
};

export interface Attachment {
  name: string;
  contentType?: string;
  mediaType?: string;
  url: string;
  size: number;
}

export interface UploadingAttachment {
  file: File;
  progress: number;
}

export interface ModelSwitcherProps {
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  className?: string;
  attachments: Array<Attachment>;
  messages: Array<ChatMessage>;
  status: UseChatHelpers<ChatMessage>['status'];
  onModelSelect?: (model: (typeof models)[0]) => void;
  subscriptionData?: any;
  user?: ComprehensiveUserData | null;
}

export interface FormComponentProps {
  input: string;
  setInput: (input: string) => void;
  attachments: Array<Attachment>;
  setAttachments: React.Dispatch<React.SetStateAction<Array<Attachment>>>;
  chatId: string;
  user: ComprehensiveUserData | null;
  subscriptionData?: any;
  fileInputRef: React.RefObject<HTMLInputElement>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  stop: () => void;
  messages: Array<ChatMessage>;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  resetSuggestedQuestions: () => void;
  lastSubmittedQueryRef: React.MutableRefObject<string>;
  selectedGroup: SearchGroupId;
  setSelectedGroup: React.Dispatch<React.SetStateAction<SearchGroupId>>;
  showExperimentalModels: boolean;
  status: UseChatHelpers<ChatMessage>['status'];
  setHasSubmitted: React.Dispatch<React.SetStateAction<boolean>>;
  isLimitBlocked?: boolean;
  onOpenSettings?: (tab?: string) => void;
  selectedConnectors?: ConnectorProvider[];
  setSelectedConnectors?: React.Dispatch<React.SetStateAction<ConnectorProvider[]>>;
}

export interface GroupSelectorProps {
  selectedGroup: SearchGroupId;
  onGroupSelect: (group: SearchGroup) => void;
  status: UseChatHelpers<ChatMessage>['status'];
  onOpenSettings?: (tab?: string) => void;
  isProUser?: boolean;
}

export interface ConnectorSelectorProps {
  selectedConnectors: ConnectorProvider[];
  onConnectorToggle: (provider: ConnectorProvider) => void;
  user: ComprehensiveUserData | null;
  isProUser?: boolean;
}
