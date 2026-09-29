export type MemorySourceType =
  | 'website'
  | 'audit'
  | 'growth_plan'
  | 'call'
  | 'review'
  | 'crm_note'
  | 'manual'

export interface MemoryDocumentInput {
  workspaceId?: string
  leadId?: string
  sourceType: MemorySourceType
  sourceUrl?: string
  title: string
  content: string
  metadata?: Record<string, unknown>
}

export interface MemoryDocument {
  id: string
  workspaceId?: string
  leadId?: string
  sourceType: MemorySourceType
  sourceUrl?: string
  title: string
  content: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface MemoryChunk {
  id: string
  documentId: string
  workspaceId?: string
  chunkIndex: number
  content: string
  keywords: string[]
  metadata: Record<string, unknown>
  createdAt: string
}

export interface MemorySearchResult {
  chunk: MemoryChunk
  score: number
}
