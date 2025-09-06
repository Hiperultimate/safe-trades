import redisClient from "./redis/redisClient";
import { balance, open_orders, prices } from "./store";
import { CALLBACK_QUEUE, Operations, TRADE_STREAM } from "./types";
import Decimal from "decimal.js";

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
      newPrices.forEach(
        (assetDetail: { asset: string; price: number; decimal: number }) => {
          prices[assetDetail.asset] = {
            price: assetDetail.price,
            decimal: assetDetail.decimal,
          };
        }
      );
      continue;
    }

    // Perform the required operation according to the operationName
    if (operationName === Operations.CreateTrade) {
      const { id, email, asset, type, margin, leverage, slippage } =
        operationPayload;

      const userBalanceUsd = balance[email]?.USD;
      
      const currentPrice = prices[asset];

      // Get current price of asset
      if (currentPrice === undefined) {
        console.log("Error, invalid asset name provided : ", asset);
        // send error notification through callback-queue
        return;
      }

      if (type === "long") {
        // Calculate required amount for the asset
        if (userBalanceUsd === undefined || userBalanceUsd.balance < margin) {
          console.error("Insufficient USD balance");
          return; // handle error appropriately
        }

        const positionSize = new Decimal(margin).mul(new Decimal(leverage));
        const executionPrice = new Decimal(currentPrice.price)
          .mul(new Decimal(1).plus(new Decimal(slippage).div(100))); // (currentPrice.price * (1 + (slippage / 100))) / currentPrice.decimal;
        const quantity = new Decimal(positionSize).div(
          new Decimal(executionPrice).toDP(currentPrice.decimal, Decimal.ROUND_DOWN)
        );
        const borrowed = positionSize.sub(new Decimal(margin));

        const openPosition = {
          id,
          owner: email,
          asset,
          type,
          entryPrice: executionPrice.toNumber(),
          quantity: quantity.toNumber(),
          margin,
          leverage,
          positionSize: positionSize.toNumber(),
          borrowed: borrowed.toNumber(),
          slippage,
          createdAt: Date.now(),
        };

        // reduce the required amount
        // transfer the asset to balance[email][AssetName]
        balance[email] = {
          ...balance[email],
          USD: { balance: userBalanceUsd.balance - margin, decimal: 0 },
          [asset]: {
            balance:
              balance[email]?.[asset] !== undefined ? 
                quantity.mul(new Decimal(currentPrice.decimal)).plus(new Decimal(balance[email][asset].balance)).toNumber() :
                quantity.mul(new Decimal(currentPrice.decimal)).toNumber(),
            decimal: currentPrice.decimal
          }
        };

        // Add it in open_orders array
        open_orders[email]?.push(openPosition);
      } else {
        // Write shorting logic
        if (userBalanceUsd === undefined || userBalanceUsd.balance < margin) {
          console.error("Insufficient USD balance");
          return;
        }

        const positionSize = new Decimal(margin).mul(new Decimal(leverage));
        const executionPrice = new Decimal(currentPrice.price).mul(
          new Decimal(1).minus(new Decimal(slippage).div(100))
        );
        const quantity = new Decimal(positionSize).div(executionPrice);
        const borrowed = new Decimal(positionSize).sub(new Decimal(margin));

        const openPosition = {
          id,
          owner: email,
          asset,
          type,
          entryPrice: executionPrice.toNumber(),
          quantity: quantity.toNumber(),
          margin,
          leverage,
          positionSize: positionSize.toNumber(),
          borrowed: borrowed.toNumber(),
          slippage,
          createdAt: Date.now(),
        };

        const newUsdBalance = new Decimal(userBalanceUsd.balance)
          .sub(new Decimal(margin))
          .plus(positionSize)
          .toNumber();

        const existingAssetBalance = new Decimal(
          balance[email]?.[asset]?.balance ?? 0
        );
        const newAssetBalance = existingAssetBalance.sub(quantity).toNumber();

        balance[email] = {
          ...balance[email],
          USD: { balance: newUsdBalance, decimal: 0 },
          [asset]: {
            balance: newAssetBalance,
            decimal: currentPrice.decimal,
          },
        };

        open_orders[email]?.push(openPosition);
      }
    }

    if (operationName === Operations.CloseTrade) {
    }

    if (operationName === Operations.GetBalanceUsd) {
      const { userEmail, id } = operationPayload;
      // Get userEmail's balance and stream it to redis streams CALLBACK_QUEUE
      const payload = { id, balance: { USD: balance[userEmail]?.USD } };
      await redisClient.xAdd(CALLBACK_QUEUE, "*", {
        message: JSON.stringify(payload),
      });
      continue;
    }

    if (operationName === Operations.GetBalance) {
      const { userEmail, id } = operationPayload;
      // Get userEmail's balance and stream it to redis streams CALLBACK_QUEUE
      const payload = { id, balance: balance[userEmail] };
      await redisClient.xAdd(CALLBACK_QUEUE, "*", {
        message: JSON.stringify(payload),
      });
      continue;
    }

    if (operationName === Operations.SupportedAssets) {
      const { id } = operationPayload;
      const assetNames = Object.keys(prices);
      const payload = { id, assets: assetNames };
      await redisClient.xAdd(CALLBACK_QUEUE, "*", {
        message: JSON.stringify(payload),
      });
      continue;
    }

    if (operationName === Operations.UserRegister) {
      const userEmail = operationPayload.userEmail;
      balance[userEmail] = { USD: { balance: 10_000, decimal: 0 } };
      open_orders[userEmail] = [];
      continue;
    }
  }
}

main();
