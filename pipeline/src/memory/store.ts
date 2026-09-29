import pg from 'pg'
import type { MemoryDocumentInput, MemorySearchResult } from './types.js'

const { Pool } = pg

export async function saveMemoryDocument(input: MemoryDocumentInput): Promise<{ documentId: string; chunkIds: string[] }> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO memory_documents (
         workspace_id, lead_id, source_type, source_url, title, content, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        input.workspaceId ?? null,
        input.leadId ?? null,
        input.sourceType,
        input.sourceUrl ?? null,
        input.title,
        input.content,
        JSON.stringify(input.metadata ?? {}),
      ]
    )
    const documentId = rows[0].id as string
    const chunks = chunkText(input.content)
    const chunkIds: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const keywords = extractKeywords(chunk)
      const saved = await client.query(
        `INSERT INTO memory_chunks (
           document_id, workspace_id, chunk_index, content, keywords, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [
          documentId,
          input.workspaceId ?? null,
          i,
          chunk,
          keywords,
          JSON.stringify({ sourceType: input.sourceType, title: input.title }),
        ]
      )
      chunkIds.push(saved.rows[0].id as string)
    }

    await client.query('COMMIT')
    return { documentId, chunkIds }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

export async function searchMemory(params: {
  workspaceId: string
  query: string
  limit?: number
}): Promise<MemorySearchResult[]> {
  const keywords = extractKeywords(params.query)
  if (!keywords.length) return []

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { rows } = await pool.query(
      `SELECT id, document_id, workspace_id, chunk_index, content, keywords, metadata, created_at,
              cardinality(keywords && $2::text[]) AS exact_match
       FROM memory_chunks
       WHERE workspace_id = $1
         AND keywords && $2::text[]
       ORDER BY exact_match DESC, created_at DESC
       LIMIT $3`,
      [params.workspaceId, keywords, params.limit ?? 8]
    )

    return rows.map((row: any) => ({
      chunk: {
        id: row.id,
        documentId: row.document_id,
        workspaceId: row.workspace_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        keywords: row.keywords ?? [],
        metadata: row.metadata ?? {},
        createdAt: row.created_at,
      },
      score: Number(row.exact_match ?? 0),
    }))
  } finally {
    await pool.end()
  }
}

function chunkText(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const chunks: string[] = []
  const max = 1200
  const overlap = 150
  for (let start = 0; start < normalized.length; start += max - overlap) {
    chunks.push(normalized.slice(start, start + max).trim())
  }
  return chunks.filter(Boolean)
}

function extractKeywords(text: string): string[] {
  const stop = new Set([
    'about', 'after', 'again', 'also', 'because', 'before', 'being', 'business',
    'from', 'have', 'into', 'more', 'that', 'their', 'there', 'this', 'with',
    'your', 'they', 'will', 'would', 'could', 'should', 'the', 'and', 'for',
  ])

  return Array.from(new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stop.has(word))
  )).slice(0, 80)
}
