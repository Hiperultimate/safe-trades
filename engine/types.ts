export const TRADE_STREAM = "trade-stream";
export const CALLBACK_QUEUE = "callback-queue";

export enum Operations {
  CreateTrade = "create-trade",
  CloseTrade = "close-trade",
  GetBalanceUsd = "get-balance-usd",
  GetBalance = "get-balance",
  SupportedAssets = "supported-assets",
  PriceUpdate = "price-update",
  UserRegister = "user-register",
}