import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { registeredEmails } from "../store";

interface JwtPayload {
  email: string;
}

interface PartialAuthenticatedRequest extends Request {
  userEmail?: string;
}

const auth = (req: PartialAuthenticatedRequest, res: Response, next: NextFunction) => {
  const { auth_token } = req.headers;
  if (!auth_token || typeof auth_token !== "string") {
    return res.status(400).send({ message: "Invalid authentication" });
  }
  try {
    const decoded = jwt.verify(
      auth_token,
      process.env.JWT_KEY as string
    ) as JwtPayload;

    const email = decoded.email;

    if (!registeredEmails[email]) {
      res
        .status(404)
        .send({ message: "User not registered, please signup..." });
      return;
    }

    // Extract email and attach it to req
    req.userEmail = decoded.email;
  } catch (error) {
    return res.status(400).send({ message: "Invalid authentication" });
  }

  next();
};

export default auth;
