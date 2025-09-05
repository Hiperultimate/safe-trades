import z from "zod";

export const USER_SCHEMA = z.object({
    email: z.email(),
})

export const CreateTradeSchema = z.object({
  asset: z.string(),
  type: z.union([z.literal("long"), z.literal("short")]),
  margin: z.number().positive("Margin must be a positive number"),
  leverage: z
    .number()
    .min(1, { message: "Leverage must be greater than or equal to 1" })
    .max(100, { message: "Leverage should be less than or equal to 100" })
    .positive("Leverage must be a positive number"),
  slippage: z
    .number()
    .min(1, { message: "Slippage must be greater than or equal to 1" })
    .max(100, { message: "Slippage should be less than or equal to 100" })
    .nonnegative("Slippage must be a non-negative number"),
});