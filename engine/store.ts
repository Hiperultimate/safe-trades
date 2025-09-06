import type { IPosition } from "./types";

export const prices: { [assetName : string]: {price: number, decimal : number} } = {}; // asset prices
export const balance: { [email: string]: { [assetName: string]: { balance : number, decimal: number} } } = {}; // email : { asset1 : {balance : number[storing quantity of assets], decimal: 0}}
export const open_orders: { [email: string]: IPosition[] } = {}; // {email : OrderDetails[]}