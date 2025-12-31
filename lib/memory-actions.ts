'use server';

import { getUser } from '@/lib/auth-utils';

export interface MemoryItem {
  id: string;
  customId: string;
  connectionId: string | null;
  containerTags: string[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
  status: string;
  summary: string;
  title: string;
  type: string;
  content: string;
  name?: string;
  memory?: string;
  user_id?: string;
  owner?: string;
  immutable?: boolean;
  expiration_date?: string | null;
  created_at?: string;
  categories?: string[];
}

export interface MemoryResponse {
  memories: MemoryItem[];
  total: number;
}

export async function searchMemories(_query: string, _page = 1, _pageSize = 20): Promise<MemoryResponse> {
  const user = await getUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return { memories: [], total: 0 };
}

export async function getAllMemories(_page = 1, _pageSize = 20): Promise<MemoryResponse> {
  const user = await getUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return { memories: [], total: 0 };
}

export async function deleteMemory(_memoryId: string) {
  const user = await getUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return { success: true };
}
