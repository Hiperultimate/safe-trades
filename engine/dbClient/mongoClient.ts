import { MongoClient } from "mongodb";

const uri = process.env.MONGO_DB as string;
const client = new MongoClient(uri);

export async function connectDb() {
    await client.connect();

  return client.db("snapshot");
}

export async function closeDb() {
  await client.close();
}
