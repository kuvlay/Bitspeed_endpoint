import { Router } from "express";
import { z } from "zod";
import { reconcileIdentity } from "../lib/reconcile";
import type { IdentifyInput } from "../types/api";

const identifySchema = z
  .object({
    email: z.string().trim().email().nullable().optional(),
    phoneNumber: z
      .union([z.string(), z.number()])
      .transform((value) => String(value).trim())
      .pipe(z.string().min(1))
      .nullable()
      .optional(),
  })
  .refine((data) => data.email || data.phoneNumber, {
    message: "Either email or phoneNumber must be provided.",
  });

function normalizeInput(input: z.infer<typeof identifySchema>): IdentifyInput {
  const email = input.email ? input.email.toLowerCase() : null;
  const phoneNumber = input.phoneNumber
    ? input.phoneNumber.replace(/\D/g, "")
    : null;

  return {
    email: email || null,
    phoneNumber: phoneNumber || null,
  };
}

export const identifyRouter = Router();

identifyRouter.post("/", async (req, res, next) => {
  try {
    const parsed = identifySchema.parse(req.body);
    const normalized = normalizeInput(parsed);

    if (!normalized.email && !normalized.phoneNumber) {
      return res
        .status(400)
        .json({ error: "Either email or phoneNumber must be provided." });
    }

    const result = await reconcileIdentity(normalized);
    return res.status(200).json({
      contact: {
        primaryContatctId: result.primaryContactId,
        emails: result.emails,
        phoneNumbers: result.phoneNumbers,
        secondaryContactIds: result.secondaryContactIds,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: error.issues,
      });
    }

    return next(error);
  }
});
