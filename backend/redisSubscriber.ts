import { createClient } from "redis";
import type { RedisClientType } from "redis";
import { CALLBACK_QUEUE } from "./types";

class RedisSubscriber {
  private redisClient: RedisClientType;
  private callback: Record<string, () => void>;
  private removeTimeout: Record<string, () => void>;
  private resolvePayload: Record<string, {}>;
  constructor() {
    this.redisClient = createClient({ url: process.env.REDIS as string });
    this.redisClient.connect();
    this.resolvePayload = {};
    this.removeTimeout = {};
    this.callback = {};
    this.startListening();
  }

  // This is always running, even when its not needed
  async startListening() {
    while (true) {
      console.log("Checking callback-queue");
      const response = await this.redisClient.xRead(
        { key: CALLBACK_QUEUE, id: "$" },
        { BLOCK: 0 }
      );

      if (!response) continue;

      const payload = JSON.parse(response[0]?.messages[0]?.message?.message || ""); // log cbId and dot walk till you reach to id
      const cbId = payload?.id;
      console.log("Show response : ", payload, cbId);
      if (response && cbId && this.callback[cbId]) {
        this.resolvePayload[cbId] = payload;
        this.callback[cbId](); // resolving
        delete this.callback[cbId];
        if (this.removeTimeout[cbId]) {
          this.removeTimeout[cbId]();
          delete this.removeTimeout[cbId];
        }
      };
    }
  }

  async waitForMessage(id: string) {

    return new Promise((resolve, reject) => {
      function resolveCb( this : RedisSubscriber) {
        const returningPayload = this.resolvePayload[id];
        delete this.resolvePayload[id];
        return resolve(returningPayload);
      }
      
      this.callback[id] = resolveCb.bind(this);
      const timerRef = setTimeout(() => { 
        if (this.callback[id]) {
          reject({ message: "Time limit exceeded" });
          delete this.removeTimeout[id];
        }
      }, 5000);
      this.removeTimeout[id] = () => clearTimeout(timerRef);
    });
  }
}

export default RedisSubscriber;
