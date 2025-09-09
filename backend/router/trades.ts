import express, { type Request, type Response } from "express";
import auth from "../middleware/authMiddleware";
import { TRADE_STREAM, Operations, type ICreatePayload, type AuthenticatedRequest } from "../types";
import { CreateTradeSchema } from "../schema";
import z from "zod";
import redisClient from "../redis/redisClient";
import { registeredEmails } from "../store";
import RedisSubscriber from "../redisSubscriber";

const tradeRouter = express.Router();
const redisSubscriber = new RedisSubscriber();


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
    
    try {
      const result = (await redisSubscriber.waitForMessage(id)) as {
        id: string;
      };
      return res.status(200).send({ orderId : result.id });
    } catch (error : any) {
      console.log("Some error occurred:", error.message);
      return res.status(400).send({ message: error.message });
    }
})

tradeRouter.post("/trade/close", auth, async (req: Request<{}, {}, { id: string }>, res: Response<{ message: string } | {orderId : string}>) => {
    const typedReq = req as AuthenticatedRequest & { body: {id : string} };
    const { id } = req.body;
    const zodValidation = z.uuidv7().safeParse(id);
    const email = typedReq.userEmail;

    if (!zodValidation.success) {
      console.log("Error :", zodValidation.error.message);
      return res.status(404).send({ message: "Invalid input" });
    }

    const validId = zodValidation.data;

    const payload = {
        operation: Operations.CloseTrade,
        email,
        id: validId,
    };

    // Send payload to redis stream
    await redisClient.xAdd(TRADE_STREAM, "*", {
      message: JSON.stringify(payload),
    });

    try {
      const result = (await redisSubscriber.waitForMessage(id)) as {
        id: string;
      };
        return res.status(200).send({ orderId: result.id });
        
    } catch (error : any) {
      console.log("Some error occurred:", error.message);
      return res.status(400).send({ message: error.message });
    }
})

tradeRouter.get("/balance/usd", auth, async (req, res: Response<{ message: string } | {balance : number}>) => {
    const typedReq = req as AuthenticatedRequest;
    const email = typedReq.userEmail;
    const zodValidation = z.email().safeParse(email);

    if (!zodValidation.success) {
        console.log("Error :", zodValidation.error.message);
        return res.status(404).send({ message: "Invalid input" });
    }

    const validEmail = zodValidation.data;

    if (!registeredEmails[validEmail]) {
        return res.status(400).send({ message: "Email not found..." });
    }

    
    const id = Bun.randomUUIDv7();
    const payload = {
      operation: Operations.GetBalanceUsd,
      id,
      userEmail: validEmail,
    };
    
    await redisClient.xAdd(TRADE_STREAM, "*", { message: JSON.stringify(payload) })

    try {
        const result = (await redisSubscriber.waitForMessage(id)) as {
          id: string;
          balance: { USD: { balance: number; decimal: number } };
        };
        return res.status(200).send({ balance : result.balance.USD.balance})
    } catch (error) {
        console.log("Some error occured : ", error);
        return res.status(400).send({ message: "Unable to fetch user balance" });
    }
});

tradeRouter.get("/balance", auth, async (req, res) => {
    const typedReq = req as AuthenticatedRequest;
    const email = typedReq.userEmail;
    const zodValidation = z.email().safeParse(email);

    if (!zodValidation.success) {
        console.log("Error :", zodValidation.error.message);
        return res.status(404).send({ message: "Invalid input" });
    }

    const validEmail = zodValidation.data;

    const id = Bun.randomUUIDv7();
    const payload = {
        operation: Operations.GetBalance,
        id,
        userEmail: validEmail,
    };

    // Send payload to redis stream
    await redisClient.xAdd(TRADE_STREAM, "*", {
      message: JSON.stringify(payload),
    });

    try {
      const result = (await redisSubscriber.waitForMessage(id)) as {
        id: string;
        balance: { [assetName : string]: { balance: number; decimal: number } };
      };
      return res.status(200).send(result.balance);
    } catch (error) {
      console.log("Some error occured : ", error);
      return res.status(400).send({ message: "Unable to fetch user balance" });
    }
});

tradeRouter.get("/supportedAssets", async (_req, res) => {
    const id = Bun.randomUUIDv7();
    const payload = {
        operation : Operations.SupportedAssets,
        id
    }

    // Send payload to redis stream
    await redisClient.xAdd(TRADE_STREAM, "*", {
        message: JSON.stringify(payload),
    });

    try {
      const result = (await redisSubscriber.waitForMessage(id)) as {
        id: string;
        assets: string[];
      };
      return res.status(200).send(result.assets);
    } catch (error) {
      console.log("Some error occured : ", error);
      return res.status(400).send({ message: "Unable to fetch supported assets" });
    }
});

export default tradeRouter;