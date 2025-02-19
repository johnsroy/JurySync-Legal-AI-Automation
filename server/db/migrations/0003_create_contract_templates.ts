import { sql } from 'drizzle-orm';
import { contractTemplates } from '@shared/schema';

export async function up(db: any) {
  await db.schema.createTable(contractTemplates);
}

export async function down(db: any) {
  await db.schema.dropTable(contractTemplates);
} 