import redisClient from "./redisClient";
import Decimal from "decimal.js";
import { Operations, TRADE_STREAM, type IBookTickerResponse } from "./types";

// redisClient.pSubscribe()

const ws = new WebSocket("wss://ws.backpack.exchange/");

const subscribetoken = {
  id: 1,
  method: "SUBSCRIBE",
  params: ["bookTicker.SOL_USDC", "bookTicker.BTC_USDC", "bookTicker.ETH_USDC"],
};

const TOKEN_DECIMALS: Record<string, number> = {
  SOL_USDC: 2,
  ETH_USDC: 2,
  BTC_USDC: 1,
};

ws.onopen = () => {
  ws.send(JSON.stringify(subscribetoken));
  console.log("Connected to BP servers");
};

const aggregateToken: Record<string, number> = {}; // tokenName : price without decimals
ws.onmessage = (event) => {
  const parsedData: IBookTickerResponse = JSON.parse(event.data);
  const tokenPrice = new Decimal(parsedData.data.b);
  const tokenName = parsedData.data.s;
  const decimals = TOKEN_DECIMALS[tokenName] as number;

  aggregateToken[tokenName] = tokenPrice.mul(decimals).toNumber();
};

ws.onclose = (message) => {
  console.log("Connection close to Backback servers : ", message);
};

// Pushing data every 100ms
setInterval(async () => {
  const tokens = Object.keys(aggregateToken);
  const prices = tokens.map((assetName) => ({
    operation: Operations.PriceUpdate,
    asset: assetName,
    price: aggregateToken[assetName]!,
    decimal: TOKEN_DECIMALS[assetName]!,
  }));
  const payload = {
    price_updates: prices,
  };
  console.log(payload);
  // redisClient.publish("asset_prices", JSON.stringify(payload));

  await redisClient.xAdd(TRADE_STREAM, "*", {
    message: JSON.stringify(payload),
  });
}, 100);
