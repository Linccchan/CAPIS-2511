import { z } from 'zod'

export const MAX_CHAT_BODY_BYTES = 32_000

const historyMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2_000),
  })
  .strict()

export const customerChatRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(1_000),
    orderId: z.uuid().optional(),
    orderNumber: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
      .optional(),
    history: z.array(historyMessageSchema).max(8).default([]),
  })
  .strict()

export function parseCustomerChatRequest(value) {
  return customerChatRequestSchema.safeParse(value)
}
