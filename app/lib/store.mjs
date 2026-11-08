// Tiny JSON-file store. One process, one writer; writes are atomic renames.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_DIR } from './paypal.mjs';
import { seedWorks } from './ratecard.mjs';

const DIR = process.env.DATA_DIR || join(APP_DIR, 'data');
const FILE = join(DIR, 'db.json');

export const db = existsSync(FILE)
  ? JSON.parse(readFileSync(FILE, 'utf8'))
  : { works: {}, quotes: {}, licenses: {}, seenEvents: [] };

// Sample works are (re)seeded on start so rate-card edits in code reach the demo.
for (const w of seedWorks()) db.works[w.id] = { ...w, ...(db.works[w.id]?.edited ? db.works[w.id] : {}) };

const seen = new Set(db.seenEvents);
export const hasSeen = (id) => seen.has(id);
export const markSeen = (id) => { seen.add(id); };

export function save() {
  mkdirSync(DIR, { recursive: true });
  db.seenEvents = [...seen].slice(-5000);
  writeFileSync(`${FILE}.tmp`, JSON.stringify(db, null, 2));
  renameSync(`${FILE}.tmp`, FILE);
}

export function newId(prefix) {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${d}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
