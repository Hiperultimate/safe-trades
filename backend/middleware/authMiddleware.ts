import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const auth = ((req: Request<{}, {}, {}, {} ,{auth_token?: string}>, res: Response, next: NextFunction) => { 
    const { auth_token } = req.headers;
    if (!auth_token || typeof auth_token !== "string") {
        return res.status(400).send({ message: "Invalid authentication" });
    }
    try {
        jwt.verify(auth_token, process.env.JWT_KEY as string);
    } catch (error) {
      return res.status(400).send({ message: "Invalid authentication" });
    }

    next();
})

export default auth;