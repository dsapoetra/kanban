import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Database connection pool
let pool: Pool | null = null;

/**
 * Get or create database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      // Connection pool settings optimized for serverless (Vercel)
      max: 1, // Serverless environments should use minimal connections
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 60000, // Increased to 60 seconds for serverless cold starts
      statement_timeout: 30000, // 30 seconds max for any single query
      query_timeout: 30000, // 30 seconds max for query execution
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  return pool;
}

/**
 * Execute a query with automatic connection management
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T extends QueryResultRow = any>(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const result = await client.query<T>(text, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the database connection pool
 * Should be called when the application is shutting down
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});
