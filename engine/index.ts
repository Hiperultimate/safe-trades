import redisClient from "./redis/redisClient";
import { prices } from "./store";
import { Operations, TRADE_STREAM } from "./types";

async function main() {
  while (true) {
    // Go through all items being added in the redis stream
    const response = await redisClient.xRead(
      {
        key: TRADE_STREAM,
        id: "$",
      },
      { BLOCK: 0 }
    );

    if (!response) {
      continue;
    }

    const { name: _queueName, messages } = response[0];
    const rawOperationPayload = messages[0].message.message;
    const operationPayload = JSON.parse(rawOperationPayload);
    const { operation: operationName } = operationPayload;

    // console.log("Reading : ", operationPayload);
    // console.log("Reading : ", operationName , Operations.PriceUpdate, operationName === Operations.PriceUpdate );

    if (!operationName) {
      console.log("Invalid operationName, skipping.... ");
      continue;
    }

    if (operationName === Operations.PriceUpdate) {
      const newPrices = operationPayload.price_updates as [];
      newPrices.forEach((assetDetail: { asset: string, price: number, decimal: number}) => {
        prices[assetDetail.asset] = { price: assetDetail.price, decimal: assetDetail.decimal };
      })
      continue;
    }

    // Perform the required operation according to the operationName
    if (operationName === Operations.CreateTrade) {
    }

    if (operationName === Operations.CloseTrade) {
    }

    if (operationName === Operations.GetBalanceUsd) {
    }

    if (operationName === Operations.GetBalance) {
    }

    if (operationName === Operations.SupportedAssets) {
    }
  }
}

main();
