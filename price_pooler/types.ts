export type IBookTickerResponse = {
    data : {
        A: string,
        E: number,
        B: string,
        T: number,
        a: string,
        b: string, // price of tokem in USD
        e: string, // eg :- bookTicker
        s: string, // Token name
        u: string,
    },
    stream : string // eg :- bookTicker.SOL_USDC
}


export enum Operations {
  CreateTrade = "create-trade",
  CloseTrade = "close-trade",
  GetBalanceUsd = "get-balance-usd",
  GetBalance = "get-balance",
  SupportedAssets = "supported-assets",
  PriceUpdate = "price-update",
  UserRegister = "user-register",
}

// Redis stream
export const TRADE_STREAM = "trade-stream";