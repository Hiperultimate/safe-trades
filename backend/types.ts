import type { Request } from "express";

export type ICreatePayload = {
    asset: string,
    type: "long" | "short",
    margin: number,
    leverage: number,
    slippage: number
};

export interface AuthenticatedRequest extends Request {
  userEmail: string;
}

export enum Operations {
    CreateTrade = "create-trade",
    CloseTrade = "close-trade",
    GetBalanceUsd = "get-balance-usd",
    GetBalance = "get-balance",
    SupportedAssets = "supported-assets",
    PriceUpdate = "price-update",
    UserRegister = "user-register"
}

// Names of two redis streams we are using
export const TRADE_STREAM = "trade-stream";
export const CALLBACK_QUEUE = "callback-queue";
