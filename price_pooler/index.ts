import redisClient from "./redisClient";
import Decimal from "decimal.js";
import { Operations, TRADE_STREAM, type IBookTickerResponse } from "./types";
import env from "./env";

const ws = new WebSocket(env.NODE_ENV === "production" ? env.BACKPACK_WSS : env.TEST_WSS as string);

const subscribetoken = {
  id: 1,
  method: "SUBSCRIBE",
  params: ["bookTicker.SOL_USDC", "bookTicker.BTC_USDC", "bookTicker.ETH_USDC"],
};

const TOKEN_DECIMALS: Record<string, number> = {
  SOL_USDC: 6,
  ETH_USDC: 6,
  BTC_USDC: 4,
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
  const priceExcludingDecimal = tokenPrice.mul(new Decimal(10).toPower(decimals)).toNumber();
  aggregateToken[tokenName] = priceExcludingDecimal;
};

ws.onclose = (message) => {
  console.log("Connection close to Backback servers : ", message);
};

// Pushing data every 100ms
setInterval(async () => {
  const tokens = Object.keys(aggregateToken);
  const prices = tokens.map((assetName) => ({
    asset: assetName,
    price: aggregateToken[assetName]!,
    decimal: TOKEN_DECIMALS[assetName]!,
  }));
  const payload = {
    operation: Operations.PriceUpdate,
    price_updates: prices,
  };
  console.log(payload);
  // redisClient.publish("asset_prices", JSON.stringify(payload));

  await redisClient.xAdd(TRADE_STREAM, "*", {
    message: JSON.stringify(payload),
  });
}, 100);
