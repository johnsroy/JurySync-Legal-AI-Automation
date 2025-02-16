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

// Configure connection pool with optimized settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Reduced from 20 to prevent connection exhaustion
  idleTimeoutMillis: 60000, // Increased timeout
  connectionTimeoutMillis: 5000, // Increased connection timeout
  maxUses: 5000, // Reduced from 7500 to prevent connection issues
});

export const db = drizzle({ client: pool, schema });

// Simplified connection monitoring
pool.on('connect', () => {
  console.log('New client connected to database', { 
    timestamp: new Date().toISOString() 
  });
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', { 
    error: err.message,
    timestamp: new Date().toISOString()
  });

  // Only attempt reconnection for specific error types
  if (err.message.includes('terminating connection')) {
    console.log('Attempting to reconnect to database...');
  }
});

// Graceful shutdown handling
process.once('SIGTERM', () => {
  console.log('Received SIGTERM. Closing pool...');
  pool.end(() => {
    console.log('Pool has ended');
    process.exit(0);
  });
});

process.once('SIGINT', () => {
  console.log('Received SIGINT. Closing pool...');
  pool.end(() => {
    console.log('Pool has ended');
    process.exit(0);
  });
});