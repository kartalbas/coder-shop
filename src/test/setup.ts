import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet: MongoMemoryReplSet | undefined;

export const TEST_DB_NAME = "codershop-test";

export async function setup(): Promise<() => Promise<void>> {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  process.env.MONGODB_URI = replSet.getUri(TEST_DB_NAME);
  return async () => {
    await replSet?.stop();
    replSet = undefined;
    delete process.env.MONGODB_URI;
  };
}
