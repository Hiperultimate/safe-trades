import { connectDb } from "./dbClient/mongoClient";
import { balance, open_orders, prices } from "./store";

export async function SnapCurrentState() {
  try {
    const db = await connectDb();
    const collection = db.collection("state");

    const stringifyBalance = JSON.stringify(balance);
    const stringifyPrices = JSON.stringify(prices);
    const stringifyOpenOrders = JSON.stringify(open_orders);

    const stateDocument = {
      balance: stringifyBalance,
      open_orders: stringifyOpenOrders,
      prices: stringifyPrices,
      timestamp: new Date(),
    };

    await collection.insertOne(stateDocument);
    console.log("Snapshotting current state");
  } catch (error) {
    console.log(
      "Something went wrong while creating snapshot, check connection with mongoDB"
    );
  }
}

export async function LoadExistingState() {
  try {
    const db = await connectDb();
    const collection = db.collection("state");

    const latestState = await collection
      .find()
      .sort({ timestamp: -1 })
      .limit(1)
      .next();

    if (latestState) {
      Object.assign(balance, JSON.parse(latestState.balance));
      Object.assign(open_orders, JSON.parse(latestState.open_orders));
      Object.assign(prices, JSON.parse(latestState.prices));
      console.log("Existing state loaded from database.");
    } else {
      console.log("No existing state found in database.");
    }
  } catch (error) {
    console.log(
      "Something went wrong while creating snapshot, check connection with mongoDB"
    );
  }
}
