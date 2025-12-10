import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Detect if using Neon (contains neon.tech) or local PostgreSQL
const isNeonDb = process.env.DATABASE_URL.includes('neon.tech') || process.env.DATABASE_URL.includes('neon.');

let pool: NeonPool | PgPool;
let db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzlePg>;

if (isNeonDb) {
  // Use Neon serverless driver with WebSockets
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });
  db = drizzleNeon(pool as NeonPool, { schema });
} else {
  // Use standard pg driver for local PostgreSQL
  pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  db = drizzlePg(pool as PgPool, { schema });
}

export { pool, db };

// Enhanced connection event monitoring
pool.on('connect', (client: any) => {
  console.log('New client connected to database', { 
    timestamp: new Date().toISOString() 
  });
});

pool.on('error', (err: Error & { code?: string }, client: any) => {
  console.error('Database error:', { 
    error: err.message,
    code: err.code,
    timestamp: new Date().toISOString()
  });

  // Attempt to reconnect if connection is lost
  if (err.code === '57P01' || err.code === 'ECONNRESET') {
    console.log('Attempting to reconnect...');
    setTimeout(() => {
      client?.connect().catch((connectErr: Error) => {
        console.error('Reconnection failed:', connectErr.message);
      });
    }, 1000); // Wait 1 second before reconnecting
  }
});

// Connection pool cleanup
const cleanup = async () => {
  console.log('Cleaning up database connections...');
  try {
    await pool.end();
    console.log('Pool has ended');
  } catch (err) {
    console.error('Error during pool cleanup:', err);
  }
  process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

export default db;