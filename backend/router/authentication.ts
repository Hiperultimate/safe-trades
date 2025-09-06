import express, { type Request } from "express";
import { registeredEmails } from "../store";
import jwt from "jsonwebtoken";
import { USER_SCHEMA } from "../schema";
import { sendAuthMail } from "../mail/sendMail";
import client from "../redisClient";
import { Operations, TRADE_STREAM } from "../types";

const authenticationRouter = express.Router();

authenticationRouter.post("/signup", async (req, res) => {
  const { email } = req.body;
  const isValidEmail = USER_SCHEMA.safeParse({ email: email });

  if (!isValidEmail.success) {
    res.status(400).send({ message: "Invalid email provided" });
  }

  const validEmail = isValidEmail.data!.email;

  if (registeredEmails[validEmail]) {
    res.status(400).send({ message: "User already has an account" });
  }

  // Registering user to DB 
  registeredEmails[validEmail] = true;

  // Initialize dummy balance to the user on engine
  await client.xAdd(TRADE_STREAM, "*", {message : JSON.stringify({operation: Operations.UserRegister ,userEmail : validEmail})})

  const authToken = jwt.sign({ email: email }, process.env.JWT_KEY!);

  if (process.env.NODE_ENV === "production") {
    await sendAuthMail(validEmail, authToken);
    res.status(200).send({ message: "Email sent successfully" });
  } else {
    const response = `Sending Auth token email http://localhost:3000/api/v1/signin/search?email=${validEmail}&auth_token=${authToken}`;
    console.log(response);
    res.status(200).send({message :response});
  }
});

authenticationRouter.post("/signin", async (req: Request<{}, any ,{ otp: string; email: string, auth_token: string }>, res) => {
    // Send email to the user
    const { email } = req.body;
    const isValidEmail = USER_SCHEMA.safeParse({ email: email });
    const validEmail = isValidEmail.data!.email;
    const authToken = jwt.sign({ email: email }, process.env.JWT_KEY!);

  if (process.env.NODE_ENV === "production") {
    // Add rate limiting so user cannot spam auth mails
    await sendAuthMail(validEmail, authToken);
    res.status(200).send({ message: "Email sent successfully" });
  } else {
    const response = `Sending Auth token email http://localhost:3000/api/v1/signin/search?email=${validEmail}&auth_token=${authToken}`;
    console.log(response);
    res.status(200).send({message :response});
  }
  }
);

authenticationRouter.get("/signin", (req: Request<any,any,any, {email : string, auth_token : string}>,res) => {
  // check auth_token
  const { email , auth_token } = req.query;
  const isValidEmail = USER_SCHEMA.safeParse({ email: email });
  const validEmail = isValidEmail.data!.email;

  if(!registeredEmails[validEmail]){
    res.status(404).send({message : "User not registered, please signup..."});
    return
  }

  try{
    jwt.verify(auth_token, process.env.JWT_KEY!);
  }catch(err){
    res.status(404).send({message : "Something went wrong..."})
    return;
  }

  // set cookie
  res.cookie("auth_token", auth_token); 

  res.status(200).send({message : "Signed in successfully"});

})

export default authenticationRouter