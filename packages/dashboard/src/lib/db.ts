import Database from 'better-sqlite3';
import { join } from 'node:path';
import { CREATE_TABLES_SQL } from './schema';

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), 'data.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(CREATE_TABLES_SQL);
  }
  return db;
}
