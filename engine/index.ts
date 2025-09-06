import redisClient from "./redis/redisClient";
import { TRADE_STREAM } from "./types";

async function main() {
    while (true) {
        
        // Go through all items being added in the redis stream
        const response = await redisClient.xRead(
          {
            key: TRADE_STREAM,
            id: "$",
          },
          { BLOCK: 0 }
        );

        if (!response) {
            continue;
        }

        const { name: operationName, messages } = response[0];
        const rawOperationPayload = messages[0].message.message;
        console.log("Reading : ", response);

        if (!operationName) {
          continue;
        };

        // Perform the required operation according to the operationName

    
    };
};


main();