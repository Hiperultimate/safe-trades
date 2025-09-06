export const prices: { [assetName : string]: {price: number, decimal : number} } = {}; // asset prices
export const balance: { [email: string]: { [assetName: string]: { balance : number, decimal: number} } } = {}; // email : { asset1 : {balance : 12313, decimal: 0}}
export const open_orders = {};