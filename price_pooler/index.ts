import redisClient from "./redisClient";
import Decimal from "decimal.js";
import type { IBookTickerResponse } from "./types";

// redisClient.pSubscribe()

const ws = new WebSocket("wss://ws.backpack.exchange/");

const subscribetoken = {
  id: 1,
  method: "SUBSCRIBE",
  params: ["bookTicker.SOL_USDC", "bookTicker.BTC_USDC", "bookTicker.ETH_USDC"],
};

const TOKEN_DECIMALS : Record<string, number> = {
    "SOL_USDC" : 2,
    "ETH_USDC" : 2,
    "BTC_USDC" : 1,
}

ws.onopen = () => {
  ws.send(JSON.stringify(subscribetoken));
  console.log("Connected to BP servers");
};


const aggregateToken: Record<string, number> = {}; // tokenName : price without decimals
ws.onmessage = (event) => {
  const parsedData : IBookTickerResponse = JSON.parse(event.data);
  const tokenPrice = new Decimal(parsedData.data.b);
  const tokenName = parsedData.data.s;
  const decimals = TOKEN_DECIMALS[tokenName] as number;

    aggregateToken[tokenName] = tokenPrice.mul(decimals).toNumber();

    // console.log("Parsed data :", parsedData)
};

ws.onclose = (message) => {
  console.log("Connection close to Backback servers : ", message);
};

setInterval(() => {
    const tokens = Object.keys(aggregateToken);
    const prices = tokens.map((assetName) => ({
        asset : assetName,
        price : aggregateToken[assetName]!,
        decimal : TOKEN_DECIMALS[assetName]!
    }))
    const pongPayload = {
        price_updates : prices
    };
    // redis publish
    console.log(pongPayload);
    redisClient.publish("asset_prices", JSON.stringify(pongPayload));
}, 100)
