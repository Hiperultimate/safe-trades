export type ICreatePayload = {
    asset: string,
    type: "long" | "short",
    margin: number,
    leverage: number,
    slippage: number
};

export enum Operations {
    CreateTrade = "create-trade",
    CloseTrade = "close-trade",
    GetBalanceUsd = "get-balance-usd",
    GetBalance = "get-balance",
    SupportedAssets = "supported-assets"
}


