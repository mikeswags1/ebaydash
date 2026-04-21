import { neon } from '@neondatabase/serverless'

type SqlClient = ReturnType<typeof neon>

let client: SqlClient | null = null

function getClient(): SqlClient {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured')
  }

  if (!client) {
    client = neon(databaseUrl)
  }

  return client
}

export const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
  return getClient()(strings, ...values)
}) as SqlClient

export async function queryRows<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  return (await getClient()(strings, ...values)) as T[]
}
