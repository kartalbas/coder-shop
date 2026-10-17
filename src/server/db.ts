import fs from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import mongoose, { type Mongoose } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { env } from "./env";
import "@/models/product";
import "@/models/order";
import "@/models/user";
import "@/models/supplier";
import "@/models/purchase-order";
import "@/models/counter";

export type DbMode = "external" | "memory-server";

const DB_NAME = "codershop";
// Fixed port so the persisted replica-set config in data/mongo stays valid across restarts.
const DEV_MONGO_PORT = 37017;
const LOCK_FILE = path.join("data", "mongo", "mongod.lock");

interface MongoGlobal {
  __mongoPromise?: Promise<Mongoose>;
  __mongoReplSet?: MongoMemoryReplSet;
  __mongoIndexesSynced?: boolean;
  __mongoShutdownInstalled?: boolean;
}

const g = globalThis as typeof globalThis & MongoGlobal;

export function dbMode(): DbMode {
  return env.MONGODB_URI ? "external" : "memory-server";
}

export function isDbPathLocked(): boolean {
  return existsSync(LOCK_FILE) && statSync(LOCK_FILE).size > 0;
}

function isLockError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /lock|WiredTiger|already in use/i.test(message);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function startReplSetWithRetry(): Promise<MongoMemoryReplSet> {
  const dbPath = path.resolve("data/mongo");
  await fs.mkdir(dbPath, { recursive: true });
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: "wiredTiger" },
        instanceOpts: [{ dbPath, port: DEV_MONGO_PORT }],
      });
    } catch (error) {
      lastError = error;
      if (!isLockError(error) || attempt === 3) break;
      await delay(500 * attempt);
    }
  }
  throw new Error(
    `Could not start the embedded MongoDB (data/mongo is locked): ${String(lastError)}. ` +
      `Stop the other dev/seed process, or delete data/mongo/mongod.lock if no instance is running.`,
  );
}

function installShutdownHandlers(): void {
  if (g.__mongoShutdownInstalled) return;
  g.__mongoShutdownInstalled = true;
  const shutdown = async (signal: string) => {
    try {
      await mongoose.disconnect();
      if (g.__mongoReplSet) await g.__mongoReplSet.stop();
    } finally {
      process.exit(signal === "SIGINT" ? 130 : 0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

async function startAndConnect(): Promise<Mongoose> {
  if (env.MONGODB_URI) {
    await mongoose.connect(env.MONGODB_URI, { dbName: DB_NAME });
  } else {
    const replSet = await startReplSetWithRetry();
    g.__mongoReplSet = replSet;
    installShutdownHandlers();
    await mongoose.connect(replSet.getUri(DB_NAME));
  }
  if (!g.__mongoIndexesSynced) {
    g.__mongoIndexesSynced = true;
    await syncAllIndexes();
  }
  return mongoose;
}

async function syncAllIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}

export function connectDB(): Promise<Mongoose> {
  g.__mongoPromise ??= startAndConnect().catch((error: unknown) => {
    g.__mongoPromise = undefined;
    throw error;
  });
  return g.__mongoPromise;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (g.__mongoReplSet) {
    await g.__mongoReplSet.stop();
    g.__mongoReplSet = undefined;
  }
  g.__mongoPromise = undefined;
  g.__mongoIndexesSynced = false;
}
