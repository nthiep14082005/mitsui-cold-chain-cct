import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import { CctDatabase } from '@/types/claim-billing-kpi';
import { AuditLog, NotificationItem, User } from '@/types/common';
import { createSeedDatabase } from './seed';

let schemaPromise: Promise<void> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

function getSanitizedDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not configured in environment.');
  }
  try {
    const parsed = new URL(raw);
    if (parsed.searchParams.has('channel_binding')) {
      parsed.searchParams.delete('channel_binding');
    }
    if (!parsed.searchParams.has('sslmode')) {
      parsed.searchParams.set('sslmode', 'require');
    }
    return parsed.toString();
  } catch {
    return raw.replace(/([?&])channel_binding=[^&]*&?/g, '$1').replace(/[?&]$/, '');
  }
}

function getSqlClient() {
  return neon(getSanitizedDatabaseUrl());
}

async function ensureTableInitialized() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getSqlClient();
      await sql`
        CREATE TABLE IF NOT EXISTS cct_store (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  await schemaPromise;
}

/**
 * Ensures any newly introduced seed users (such as admin2@mitsui-cct.vn) and passwords
 * exist inside an already-populated Neon database without wiping live user data.
 */
function ensureSeedUsersUpToDate(db: CctDatabase): boolean {
  const seedUsers = createSeedDatabase().users;
  let changed = false;
  for (const su of seedUsers) {
    const existing = db.users.find(
      (u) => u.id === su.id || u.email.toLowerCase() === su.email.toLowerCase()
    );
    if (!existing) {
      db.users.push(su);
      changed = true;
    } else if (!existing.password && su.password) {
      existing.password = su.password;
      changed = true;
    }
  }
  return changed;
}

/**
 * Writes the full CCT database state to Neon PostgreSQL (id = 'main').
 */
export async function writeDb(db: CctDatabase): Promise<void> {
  await ensureTableInitialized();
  const sql = getSqlClient();
  db.lastUpdatedAt = new Date().toISOString();
  const payloadJson = JSON.stringify(db);
  await sql`
    INSERT INTO cct_store (id, payload, updated_at)
    VALUES ('main', ${payloadJson}::jsonb, NOW())
    ON CONFLICT (id)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
  `;
}

/**
 * Reads state from Neon PostgreSQL (`cct_store` where id = 'main'); auto-seeds if empty.
 */
export async function readDb(): Promise<CctDatabase> {
  await ensureTableInitialized();
  const sql = getSqlClient();
  const rows = (await sql`SELECT payload FROM cct_store WHERE id = 'main' LIMIT 1`) as Array<{
    payload: CctDatabase;
  }>;

  if (!rows.length || !rows[0]?.payload) {
    const seeded = createSeedDatabase();
    await writeDb(seeded);
    return seeded;
  }

  const db = rows[0].payload;
  if (ensureSeedUsersUpToDate(db)) {
    await writeDb(db);
  }
  return db;
}

/**
 * Serializes read-modify-write mutations against Neon PostgreSQL within this runtime instance.
 */
export async function mutateDb<T>(
  mutator: (db: CctDatabase) => T | Promise<T>
): Promise<T> {
  const run = writeChain.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    await writeDb(db);
    return result;
  });
  writeChain = run.catch(() => undefined);
  return run;
}

/**
 * Overwrites Neon PostgreSQL (`cct_store` id = 'main') with fresh seed data.
 */
export async function resetDb(): Promise<CctDatabase> {
  const seeded = createSeedDatabase();
  await writeDb(seeded);
  return seeded;
}

/**
 * FR-53: Appends an immutable audit trail entry for create/update/confirm/adjudicate actions.
 */
export function appendAuditLog(
  db: CctDatabase,
  actor: User,
  params: {
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    beforeJson?: unknown;
    afterJson?: unknown;
  }
): AuditLog {
  const entry: AuditLog = {
    id: `AUD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    actorUserId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    actorOrgId: actor.orgId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    summary: params.summary,
    beforeJson: params.beforeJson ?? null,
    afterJson: params.afterJson ?? null,
  };
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  return entry;
}

/**
 * FR-54: Dispatches an in-app + simulated Zalo ZNS / SMS notification record.
 */
export function pushNotification(
  db: CctDatabase,
  params: Omit<NotificationItem, 'id' | 'createdAt' | 'isReadByUserIds'>
): NotificationItem {
  const item: NotificationItem = {
    id: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    createdAt: new Date().toISOString(),
    isReadByUserIds: [],
    ...params,
  };
  db.notifications.unshift(item);
  if (db.notifications.length > 300) {
    db.notifications = db.notifications.slice(0, 300);
  }
  return item;
}
