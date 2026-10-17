import mongoose from "mongoose";

export async function connectTestDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set — tests must run through the vitest globalSetup");
  if (mongoose.connection.readyState === 0) {
    mongoose.set("autoIndex", false);
    await mongoose.connect(uri);
    await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  }
  return mongoose;
}

export async function clearCollections(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Not connected to the test database");
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDB(): Promise<void> {
  await mongoose.disconnect();
}
