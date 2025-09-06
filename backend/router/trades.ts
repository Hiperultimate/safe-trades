import express, { type Request, type Response } from "express";
import auth from "../middleware/authMiddleware";
import { TRADE_STREAM, Operations, type ICreatePayload, type AuthenticatedRequest } from "../types";
import { CreateTradeSchema } from "../schema";
import z from "zod";
import redisClient from "../redisClient";
import { registeredEmails } from "../store";

const tradeRouter = express.Router();

// save no states here
// we are just sending requests to the redis streams
tradeRouter.post("/trade/create", auth, async (req, res : Response<{ message: string } | {orderId : string}>) => {
    const typedReq = req as AuthenticatedRequest & { body: ICreatePayload };
    const { asset, type, margin, leverage, slippage } = typedReq.body;
    const email = typedReq.userEmail;
    // Create a request payload to send to the redis stream

    const zodValidation = CreateTradeSchema.safeParse({ asset, type, margin, leverage, slippage });

    if (!zodValidation.success) {
        console.log("Error :", zodValidation.error.message);
        return res.status(404).send({ message: "Invalid input" })
    }

    const validData = zodValidation.data;

    const id = Bun.randomUUIDv7();
    const payload = {
        operation: Operations.CreateTrade,
        id,
        email,
        asset: validData.asset,
        type: validData.type,
        margin: validData.margin,
        leverage: validData.leverage,
        slippage: validData.slippage, // in bips, so this means 1%	
    };

    // Send payload to redis stream
    await redisClient.xAdd(TRADE_STREAM, "*", { message : JSON.stringify(payload)});
    

    // Watch second redis stream until some response is given about the transaction id
    // const payloadResponse = await transactionWatch(id);
    const payloadResponse = true;

    // If success
    if(!payloadResponse) return res.status(400).send({message : "Transaction creation un-successful"})
    res.status(200).send({ orderId: id });
})

tradeRouter.post("/trade/close", auth, (req: Request<{}, {}, { id: string }>, res: Response<{ message: string } | {orderId : string}>) => {
    const { id } = req.body;
    const zodValidation = z.uuidv7().safeParse(id);

    if (!zodValidation.success) {
      console.log("Error :", zodValidation.error.message);
      return res.status(404).send({ message: "Invalid input" });
    }

    const validId = zodValidation.data;

    const payload = {
        operation: Operations.CloseTrade,
        id: validId,
    };

    // Send payload to redis stream

    // const payloadResponse = await transactionWatch(id);
    const payloadResponse = true;

    // If success
    if(!payloadResponse) return res.status(400).send({message : "Transaction close un-successful"})
    res.status(200).send({ orderId: validId });

})

tradeRouter.get("/balance/usd", auth, async (req: Request<{}, {}, {}, {email : string}>, res: Response<{ message: string } | {balance : number}>) => {
    const { email } = req.query;
    const zodValidation = z.email().safeParse(email);

    if (!zodValidation.success) {
        console.log("Error :", zodValidation.error.message);
        return res.status(404).send({ message: "Invalid input" });
    }

    const validEmail = zodValidation.data;

    if (!registeredEmails[validEmail]) {
        res.status(400).send({ message: "Email not found..." });
    }

    const payload = {
        operation: Operations.GetBalanceUsd,
        email: validEmail,
    };

    const id = Bun.randomUUIDv7();
    // Send payload to redis stream
    await redisClient.xAdd(TRADE_STREAM, "*", {message : JSON.stringify({operation: Operations.GetBalanceUsd, id ,userEmail : validEmail})})


    // const payloadResponse = await transactionWatch(id);
    const payloadResponse = 20000;

    // If success
    if (!payloadResponse)
    return res.status(400).send({ message: "Unable to fetch user balance" });
    res.status(200).send({ balance: payloadResponse }); // here payloadResponse should be a number denoting user balance
});

tradeRouter.get("/balance", auth, (req: Request<{}, {}, {}, { email: string }>, res: Response<{ message: string } | { [assetName: string]: {balance : number, decimals: number} }>) => {
    const { email } = req.query;
    const zodValidation = z.email().safeParse(email);

    if (!zodValidation.success) {
        console.log("Error :", zodValidation.error.message);
        return res.status(404).send({ message: "Invalid input" });
    }

    const validEmail = zodValidation.data;

    const payload = {
        operation: Operations.GetBalance,
        email: validEmail,
    };

    // Send payload to redis stream

    // const payloadResponse = await transactionWatch(id);
    const payloadResponse = {
      BTC: {
        balance: 10000000,
        decimals: 4,
      },
    };

    // If success
    if (!payloadResponse)
    return res.status(400).send({ message: "Unable to fetch user balance" });
    res.status(200).send(payloadResponse); // here payloadResponse should be a number denoting user balance
});

tradeRouter.get("/supportedAssets", (req, res) => {
    const payload = {
        operation : Operations.SupportedAssets
    }

    // Send payload to redis stream

    const payloadResponse = {
      assets: [
        {
          symbol: "BTC",
          name: "Bitcoin",
          imageUrl: "image.com/png",
        },
      ],
    };

    if (!payloadResponse)
        return res.status(400).send({ message: "Unable to fetch supported assets" });
    res.status(200).send(payloadResponse); // here payloadResponse should be a number denoting user balance

});

export default tradeRouter;