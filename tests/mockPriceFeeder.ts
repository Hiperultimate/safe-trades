import { WebSocketServer } from "ws";
import type { IAssets } from "./types";

const wss = new WebSocketServer({ port: 8079 });

const ASSETS: IAssets[] = ["SOL_USDC", "ETH_USDC", "BTC_USDC"];

const initPrice: Record<IAssets, number> = {
  SOL_USDC: 215,
  ETH_USDC: 4350,
  BTC_USDC: 111000,
};
let ORDER = 0;

wss.on("connection", function connection(ws) {
  // May add a message listener to change price of an asset
  ws.on("message", function message(data) {
    console.log("received: %s", data);
  });

  setInterval(() => {
    if (ORDER >= ASSETS.length) ORDER = 0;
    let currentAssetPrice = initPrice[ASSETS[ORDER] as IAssets];
    const incrOrDecr = Math.floor(Math.random() * 2);
    const randomPercent1to2 = +(Math.random() * (2 - 1) + 1).toFixed(2);

    let variantPrice =
      currentAssetPrice * (incrOrDecr < 1
        ? 1 + randomPercent1to2 / 100
        : 1 - randomPercent1to2 / 100);

    const payload = {
      data: { b: variantPrice.toFixed(3).toString(), s: ASSETS[ORDER] },
    };

    console.log("Check payload : ", payload);

    ws.send(JSON.stringify(payload));

    ORDER++;
  }, 50);
});
