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

// Configure connection pool with better settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
  maxUses: 7500, // Close & replace a connection after it has been used this many times
});

export const db = drizzle({ client: pool, schema });

// Connection event monitoring
pool.on('connect', (client) => {
  console.log('New client connected to database', { 
    processID: client.processID,
    timestamp: new Date().toISOString() 
  });
});

pool.on('error', (err, client) => {
  console.error('Unexpected database error:', { 
    error: err.message,
    code: err.code,
    processID: client?.processID,
    timestamp: new Date().toISOString()
  });

  // Attempt to reconnect if connection is lost
  if (err.code === '57P01') {
    console.log('Attempting to reconnect...');
    client?.connect().catch(connectErr => {
      console.error('Reconnection failed:', connectErr.message);
    });
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Closing pool...');
  pool.end(() => {
    console.log('Pool has ended');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing pool...');
  pool.end(() => {
    console.log('Pool has ended');
    process.exit(0);
  });
});