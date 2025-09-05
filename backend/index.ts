import express from "express";
import cors from "cors";
import authenticationRouter from "./router/authentication";

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend healthy...");
});

app.use("/api/v1" , authenticationRouter);


app.listen(port, () => {
  console.log(`Contest app listening on port ${port}`);
});
