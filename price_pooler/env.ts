const REDIS = process.env.REDIS;
const BACKPACK_WSS = process.env.BACKPACK_WSS;
const NODE_ENV = process.env.NODE_ENV;
const TEST_WSS = process.env.TEST_WSS;

function env() { 
    if (REDIS === undefined) {
        throw new Error("REDIS connection string not found in .env")
    }
    
    if (!BACKPACK_WSS) {
      throw new Error("BACKPACK_WSS connection string not found in .env");
    }
    
    if (!NODE_ENV) {
        throw new Error("NODE_ENV not found in .env");
    }

    if (!["production", "test"].includes(NODE_ENV)) {
        throw new Error("Invalid NODE_ENV value passed in .env");
    }

    if (NODE_ENV === "test" && !TEST_WSS) {
      throw new Error( "TEST_WSS not found in .env which is required to run tests");
    }
    return { REDIS, BACKPACK_WSS, NODE_ENV, TEST_WSS };
}

const validEnv = env();

export default {
  REDIS: validEnv.REDIS,
  BACKPACK_WSS: validEnv.BACKPACK_WSS,
  NODE_ENV: validEnv.NODE_ENV,
  TEST_WSS : validEnv.TEST_WSS
};