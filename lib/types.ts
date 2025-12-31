import { z } from 'zod';
import type {
  datetimeTool,
  greetingTool,
  eanSearchTool,
} from '@/lib/tools';

import type { InferUITool, UIMessage } from 'ai';

export type DataPart = { type: 'append-message'; message: string };
export type DataQueryCompletionPart = {
  type: 'data-query_completion';
  data: {
    query: string;
    index: number;
    total: number;
    status: 'started' | 'completed' | 'error';
    resultsCount: number;
    imagesCount: number;
  };
};

export type DataExtremeSearchPart = {
  type: 'data-extreme_search';
  data:
  | {
    kind: 'plan';
    status: { title: string };
    plan?: Array<{ title: string; todos: string[] }>;
  }
  | {
    kind: 'query';
    queryId: string;
    query: string;
    status: 'started' | 'reading_content' | 'completed' | 'error';
  }
  | {
    kind: 'source';
    queryId: string;
    source: { title: string; url: string; favicon?: string };
  }
  | {
    kind: 'content';
    queryId: string;
    content: { title: string; url: string; text: string; favicon?: string };
  }
  | {
    kind: 'code';
    codeId: string;
    title: string;
    code: string;
    status: 'running' | 'completed' | 'error';
    result?: string;
    charts?: any[];
  }
  | {
    kind: 'x_search';
    xSearchId: string;
    query: string;
    startDate: string;
    endDate: string;
    handles?: string[];
    status: 'started' | 'completed' | 'error';
    result?: {
      content: string;
      citations: any[];
      sources: Array<{ text: string; link: string; title?: string }>;
      dateRange: string;
      handles: string[];
    };
  };
};

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
  model: z.string(),
  completionTime: z.number().nullable(),
  inputTokens: z.number().nullable(),
  outputTokens: z.number().nullable(),
  totalTokens: z.number().nullable(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type greetingToolType = InferUITool<ReturnType<typeof greetingTool>>;
type datetimeToolType = InferUITool<typeof datetimeTool>;
type eanSearch = InferUITool<ReturnType<typeof eanSearchTool>>;

export type ChatTools = {
  datetime: datetimeToolType;
  greeting: greetingToolType;
  ean_search: eanSearch;
};

export type CustomUIDataTypes = {
  appendMessage: string;
  id: string;
  'message-annotations': any;
  query_completion: {
    query: string;
    index: number;
    total: number;
    status: 'started' | 'completed' | 'error';
    resultsCount: number;
    imagesCount: number;
  };
  extreme_search: DataExtremeSearchPart['data'];
  'ean-search-loading': {
    barcode: string;
    status: 'searching';
  };
  'ean-search-complete': {
    barcode: string;
    results: Array<{
      title: string;
      url: string;
      content: string;
      price?: string;
      images: string[];
      supplier?: string;
      ean: string;
    }>;
    images: string[];
    totalResults: number;
  };
};

export type ChatMessage = UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>;

export interface Attachment {
  name: string;
  url: string;
  contentType?: string;
  mediaType?: string;
}
