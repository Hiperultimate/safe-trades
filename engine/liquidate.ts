// Get price
// go through open_orders
// check if current asset price is > open_orders.liquidatePrice for long and vice versa for short
// liquidate those orders automatically

import Decimal from "decimal.js";
import { balance, open_orders, prices } from "./store";

export function autoLiquidate() {
  let allOpenOrders = Object.values(open_orders).flat();
  allOpenOrders.forEach((order) => {
    const {
      id,
      type,
      owner,
      asset,
      autoLiquidatePrice,
      entryPrice,
      quantity: quantityND,
      margin,
      leverage,
    } = order;

    const currentAssetPriceObjND = prices[asset];

    if (!currentAssetPriceObjND) {
      console.log("While auto liquidating, found invalid asset : ", asset);
      return;
    }

    const currentAssetPrice = new Decimal(currentAssetPriceObjND.price)
      .div(new Decimal(10).pow(currentAssetPriceObjND.decimal))
      .toNumber();

    if (
      (type === "long" && autoLiquidatePrice >= currentAssetPrice) ||
      (type === "short" && autoLiquidatePrice <= currentAssetPrice)
    ) {
      const quantity = quantityND / 10 ** currentAssetPriceObjND.decimal;

      // Calculate the PnL
      let pnl = 0;
      if (type === "long") {
        pnl = (currentAssetPrice - entryPrice) * quantity * leverage;
      } else {
        pnl = (entryPrice - currentAssetPrice) * quantity * leverage;
      }

      // Update the USD balance
      const userBalanceUsd = balance[owner]?.USD;
      if (!userBalanceUsd) {
        console.error("User USD balance not found");
        return;
      }

      const totalAssetPrice = margin + pnl;

      // Asset Quantity is balance
      const newUserBalanceUsd = userBalanceUsd.balance + totalAssetPrice;
      const oldUserAssetBalance = balance[owner]?.[asset]?.balance || 0;
      const assetBalanceAfterTx =
        type === "long"
          ? oldUserAssetBalance - quantityND
          : oldUserAssetBalance + quantityND;

      // Update the user's balances
      balance[owner] = {
        ...balance[owner],
        USD: { balance: newUserBalanceUsd, decimal: 0 },
        [asset]: {
          balance: assetBalanceAfterTx,
          decimal: currentAssetPriceObjND.decimal,
        },
      };

      // Remove the closed position from open_orders
      if (!open_orders[owner]) {
        console.log(`Orders for user ${owner} not found`);
        return;
      }
      open_orders[owner] = open_orders[owner]?.filter(
        (order) => order.id !== id
      );
    
        console.log(
          "Order automatically liquidated :",
          id,
          type,
          autoLiquidatePrice,
          currentAssetPrice
        );
    }
  });
}
