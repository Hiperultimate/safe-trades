import express from "express";
import cors from "cors";
import authenticationRouter from "./router/authentication";
import tradeRouter from "./router/trades";
import cookieParser from "cookie-parser";

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Backend healthy...");
});

app.use("/api/v1", authenticationRouter);
app.use("/api/v1", tradeRouter);


app.listen(port, () => {
  console.log(`Contest app listening on port ${port}`);
});
