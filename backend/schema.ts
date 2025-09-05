import z from "zod";

export const USER_SCHEMA = z.object({
    email: z.email(),
})