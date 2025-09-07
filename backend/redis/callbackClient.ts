import {createClient} from "redis";

if(!process.env.REDIS){
    throw new Error("No redis URL found");
}

const client = await createClient({ url : process.env.REDIS})
      .on("error", (err) => console.log("Redis Client Error", err))
      .connect();


export default client;