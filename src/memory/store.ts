/**
 * JARVIS Memory Store
 *
 * Simple key-value + search memory backed by SQLite.
 * Later: plug in Supabase for cloud sync across devices.
 */

import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const JARVIS_DIR = path.join(os.homedir(), ".jarvis");

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    fs.mkdirSync(JARVIS_DIR, { recursive: true });
    const resolvedPath = dbPath ?? path.join(JARVIS_DIR, "memory.db");
    this.db = new Database(resolvedPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        transcript TEXT,
        summary TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  async set(key: string, value: string): Promise<void> {
    this.db
      .prepare(`
        INSERT INTO memory (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `)
      .run(key, value);
  }

  async get(key: string): Promise<string | null> {
    const row = this.db
      .prepare("SELECT value FROM memory WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  async delete(key: string): Promise<void> {
    this.db.prepare("DELETE FROM memory WHERE key = ?").run(key);
  }

  async search(query: string): Promise<Array<{ key: string; value: string }>> {
    const q = `%${query}%`;
    return this.db
      .prepare("SELECT key, value FROM memory WHERE key LIKE ? OR value LIKE ? LIMIT 20")
      .all(q, q) as Array<{ key: string; value: string }>;
  }

  async saveSession(id: string, transcript: string, summary?: string): Promise<void> {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO sessions (id, transcript, summary)
        VALUES (?, ?, ?)
      `)
      .run(id, transcript, summary ?? null);
  }

  async getAll(): Promise<Array<{ key: string; value: string }>> {
    return this.db
      .prepare("SELECT key, value FROM memory ORDER BY updated_at DESC")
      .all() as Array<{ key: string; value: string }>;
  }

  close() {
    this.db.close();
  }
}
