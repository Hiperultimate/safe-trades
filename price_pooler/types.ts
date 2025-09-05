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