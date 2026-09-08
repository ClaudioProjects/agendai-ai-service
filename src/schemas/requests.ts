import { z } from "zod";

export const parseInputSchema = z
  .object({
    text: z.string().trim().min(1),
    context: z
      .object({
        currentDateTime: z.string().datetime({ offset: true }),
        timezone: z.string().trim().min(1),
        locale: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();
export type ParseInput = z.infer<typeof parseInputSchema>;
