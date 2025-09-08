import { WebSocketServer } from "ws";
import type { IAssets } from "./types";

const wss = new WebSocketServer({ port: 8079 });

const ASSETS: IAssets[] = ["SOL_USDC", "ETH_USDC", "BTC_USDC"];
const changedAssets = new Set<IAssets>();
const initPrice: Record<IAssets, number> = {
  SOL_USDC: 215,
  ETH_USDC: 4350,
  BTC_USDC: 111000,
};
let ORDER = 0;

wss.on("connection", function connection(ws) {
  ws.on("message", function message(data) {
    try {
      const parsed = JSON.parse(data.toString());

      const assetKeys = Object.keys(parsed);

      if (assetKeys.length === 0) {
        throw new Error("Something went wrong");
      }
      const assetKey = assetKeys[0] as IAssets;
      const newPrice = parsed[assetKey];

      if (!ASSETS.includes(assetKey as IAssets)) {
        throw new Error(`Invalid asset key: ${assetKey}`);
      }

      if (typeof newPrice !== "number") {
        throw new Error(`Invalid price value: ${newPrice}`);
      }

      initPrice[assetKey as IAssets] = newPrice;
      changedAssets.add(assetKey);
      console.log(`Updated ${assetKey} price to ${newPrice}`);
    } catch (error) {
      console.error("Failed to process message:", error);
    }
  });
});

setInterval(() => {
  if (ORDER >= ASSETS.length) ORDER = 0;

  const selectedAsset = ASSETS[ORDER] as IAssets;

  if (changedAssets.has(selectedAsset)) {
    broadcast({
      data: { b: initPrice[selectedAsset].toString(), s: ASSETS[ORDER] },
    });
    ORDER++;
    return;
  }

  let currentAssetPrice = initPrice[selectedAsset];
  const incrOrDecr = Math.floor(Math.random() * 2);
  const randomPercent1to2 = +(Math.random() * (2 - 1) + 1).toFixed(2);

  let variantPrice =
    currentAssetPrice *
    (incrOrDecr < 1
      ? 1 + randomPercent1to2 / 100
      : 1 - randomPercent1to2 / 100);

  const payload = {
    data: { b: variantPrice.toFixed(3).toString(), s: ASSETS[ORDER] },
  };

  console.log("Check payload : ", payload);

  broadcast(payload);

  ORDER++;
}, 50);

function broadcast(payload: Record<string, any>) {
  for (const client of wss.clients) {
    client.send(JSON.stringify(payload));
  }
}
