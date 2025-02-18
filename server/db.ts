import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Improved connection pool settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Reduced from 20 to prevent connection overload
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased from 2000 to allow more time for connection
  maxUses: 7500,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

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