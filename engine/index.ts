import redisClient from "./dbClient/redisClient";
import { autoLiquidate } from "./liquidate";
import { LoadExistingState, SnapCurrentState } from "./snapshotting";
import { balance, open_orders, prices } from "./store";
import { CALLBACK_QUEUE, Operations, TRADE_STREAM } from "./types";
import Decimal from "decimal.js";

const LIQUIDATION_THRESHOLD = 0.1 // 10%

async function runtime() {
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

    switch (operationName) {
      case Operations.PriceUpdate: {
        const newPrices = operationPayload.price_updates as [];
        newPrices.forEach(
          (assetDetail: { asset: string; price: number; decimal: number }) => {
            prices[assetDetail.asset] = {
              price: assetDetail.price,
              decimal: assetDetail.decimal,
            };
          }
        );
        autoLiquidate();
        break;
      }
      case Operations.CreateTrade: {
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
          // const executionPrice = new Decimal(currentPrice.price)
          //   .div(new Decimal(10).pow(new Decimal(currentPrice.decimal)))
          //   .mul(new Decimal(1).plus(new Decimal(slippage).div(100))); // (currentPrice.price * (1 + (slippage / 100))) / currentPrice.decimal;
          const executionPrice = new Decimal(currentPrice.price).div(
            new Decimal(10).pow(new Decimal(currentPrice.decimal))
          );
          let quantity = new Decimal(positionSize).div(
            new Decimal(executionPrice).toDP(
              currentPrice.decimal,
              Decimal.ROUND_DOWN
            )
          );
          const borrowed = positionSize.sub(new Decimal(margin));

          quantity = quantity.mul(Decimal(10).pow(currentPrice.decimal));

          const liquidationPrice = executionPrice.mul(new Decimal(1).minus(new Decimal(1).div(new Decimal(leverage))))
          const autoLiquidatePrice = liquidationPrice.mul(new Decimal(1).add(new Decimal(LIQUIDATION_THRESHOLD)))

          const openPosition = {
            id,
            owner: email,
            asset,
            type,
            entryPrice: executionPrice.toNumber(),
            quantity: quantity.toNumber(),
            margin,
            leverage,
            autoLiquidatePrice : autoLiquidatePrice.toNumber(),
            positionSize: positionSize.toNumber(),
            borrowed: borrowed.toNumber(),
            slippage,
            createdAt: Date.now(),
          };

          balance[email] = {
            ...balance[email],
            USD: { balance: userBalanceUsd.balance - margin, decimal: 0 },
            [asset]: {
              balance:
                balance[email]?.[asset] !== undefined
                  ? quantity
                      .plus(new Decimal(balance[email][asset].balance))
                      .toNumber()
                  : quantity.toNumber(),
              decimal: currentPrice.decimal,
            },
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
          // const executionPrice = new Decimal(currentPrice.price)
          //   .div(new Decimal(10).pow(new Decimal(currentPrice.decimal)))
          //   .mul(new Decimal(1).minus(new Decimal(slippage).div(100)));
          const executionPrice = new Decimal(currentPrice.price).div(
            new Decimal(10).pow(new Decimal(currentPrice.decimal))
          );
          let quantity = new Decimal(positionSize).div(executionPrice);
          quantity = quantity.mul(Decimal(10).pow(currentPrice.decimal));
          const borrowed = new Decimal(positionSize).sub(new Decimal(margin));


          const liquidationPrice = executionPrice.mul(new Decimal(1).plus(new Decimal(1).div(new Decimal(leverage))))
          const autoLiquidatePrice = liquidationPrice.mul(new Decimal(1).add(new Decimal(LIQUIDATION_THRESHOLD)))

          const openPosition = {
            id,
            owner: email,
            asset,
            type,
            entryPrice: executionPrice.toNumber(),
            quantity: quantity.toNumber(),
            autoLiquidatePrice: autoLiquidatePrice.toNumber(),
            margin,
            leverage,
            positionSize: positionSize.toNumber(),
            borrowed: borrowed.toNumber(),
            slippage,
            createdAt: Date.now(),
          };

          const newUsdBalance = new Decimal(userBalanceUsd.balance)
            .sub(new Decimal(margin))
            .toNumber();

          const existingAssetBalance = new Decimal(
            balance[email]?.[asset]?.balance ?? 0
          );
          // existingAssetQty - qty * (10 ** 4)
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

        await redisClient.xAdd(CALLBACK_QUEUE, "*", {
          message: JSON.stringify({ id }),
        });
        console.log(`CreateTrade result : ${id}`);
        break;
      }
        
      case Operations.CloseTrade: {
        const { id, email } = operationPayload;

        const getOrderDetails = open_orders[email]?.find(
          (order) => order.id === id
        );
        if (!getOrderDetails) {
          console.error("Unable to find order");
          // send error through callback queue
          return;
        }

        const {
          type,
          entryPrice,
          quantity: quantityND,
          margin,
          leverage,
          borrowed,
          slippage,
          asset,
          createdAt,
        } = getOrderDetails;

        const currentPrice = prices[asset];
        if (!currentPrice) {
          console.error("Invalid asset price");
          return;
        }

        const currentAssetPrice =
          currentPrice.price / 10 ** currentPrice.decimal;

        // REMOVE SLIPPAGE
        // Calculate the execution price considering slippage
        // const executionPrice =
        //   type === "long"
        //     ? currentAssetPrice * (1 + slippage / 100)
        //     : currentAssetPrice * (1 - slippage / 100);
        const executionPrice = currentAssetPrice;

        const quantity = quantityND / 10 ** currentPrice.decimal;

        // Calculate the PnL
        let pnl = 0;
        if (type === "long") {
          pnl = (executionPrice - entryPrice) * quantity * leverage;
        } else {
          pnl = (entryPrice - executionPrice) * quantity * leverage;
        }

        // Update the USD balance
        const userBalanceUsd = balance[email]?.USD;
        if (!userBalanceUsd) {
          console.error("User USD balance not found");
          return;
        }

        const totalAssetPrice = margin + pnl;

        // Asset Quantity is balance
        const newUserBalanceUsd = userBalanceUsd.balance + totalAssetPrice;
        const oldUserAssetBalance = balance[email]?.[asset]?.balance || 0;
        const assetBalanceAfterTx =
          type === "long"
            ? oldUserAssetBalance - quantityND
            : oldUserAssetBalance + quantityND;

        // Update the user's balances
        balance[email] = {
          ...balance[email],
          USD: { balance: newUserBalanceUsd, decimal: 0 },
          [asset]: {
            balance: assetBalanceAfterTx,
            decimal: currentPrice.decimal,
          },
        };

        // Remove the closed position from open_orders
        if (!open_orders[email]) {
          console.log(`Orders for user ${email} not found`);
          return;
        }
        open_orders[email] = open_orders[email]?.filter(
          (order) => order.id !== id
        );

        console.log(`CloseTrade result : ${id}`);
        await redisClient.xAdd(CALLBACK_QUEUE, "*", {
          message: JSON.stringify({ id }),
        });
        break;
      }
      case Operations.GetBalanceUsd: {
        const { userEmail, id } = operationPayload;
        // Get userEmail's balance and stream it to redis streams CALLBACK_QUEUE
        const payload = { id, balance: { USD: balance[userEmail]?.USD } };
        await redisClient.xAdd(CALLBACK_QUEUE, "*", {
          message: JSON.stringify(payload),
        });
        console.log(`GetBalanceUsd result : ${payload}`);
        break;
      }
      case Operations.GetBalance: {
        const { userEmail, id } = operationPayload;
        // Get userEmail's balance and stream it to redis streams CALLBACK_QUEUE
        const payload = { id, balance: balance[userEmail] };
        await redisClient.xAdd(CALLBACK_QUEUE, "*", {
          message: JSON.stringify(payload),
        });
        console.log(`GetBalance result : ${JSON.stringify(payload)}`);
        break;
      }
      case Operations.SupportedAssets: {
        const { id } = operationPayload;
        const assetNames = Object.keys(prices);
        const payload = { id, assets: assetNames };
        await redisClient.xAdd(CALLBACK_QUEUE, "*", {
          message: JSON.stringify(payload),
        });
        console.log(`SupportedAssets result : ${payload}`);
        break;
      }
      case Operations.UserRegister: {
        const userEmail = operationPayload.userEmail;
        balance[userEmail] = { USD: { balance: 10_000, decimal: 0 } };
        open_orders[userEmail] = [];
        console.log(`UserRegister : ${userEmail}`);
        break;
      }
    }
  }
}

async function main() {
  await LoadExistingState();
  runtime();

  setInterval(SnapCurrentState, 15000);
}

main();
