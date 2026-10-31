import { z } from "zod";

export const extractionFormSchema = z.object({
  sourceType: z.enum(["google-maps", "website-list", "directory", "linkedin"]),
  niche: z.string().min(1, "Niche/keyword is required"),
  country: z.string().min(1, "Country is required"),
  city: z.string().optional(),
  targetDesignations: z.array(z.string()).optional(),
  companySize: z.string().optional(),
  urls: z
    .string()
    .refine(
      (val) => {
        if (!val.trim()) return true;
        const lines = val.split("\n").filter((l) => l.trim());
        return lines.length <= 100;
      },
      { message: "Maximum 100 URLs" }
    )
    .optional(),
  maxLeads: z
    .number()
    .min(1)
    .max(1000, "Maximum 1000 leads per extraction"),
  requireEmail: z.boolean().default(false),
  saveList: z.string().min(1, "List name is required"),
});

export type ExtractionFormValues = z.infer<typeof extractionFormSchema>;

export const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  senderIds: z.array(z.string().uuid()).min(1, "Select at least one sender"),
  listId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  scheduleType: z.enum(["now", "later"]),
  scheduledAt: z.string().optional(),
});

export type CampaignValues = z.infer<typeof campaignSchema>;

export const senderAccountSchema = z.object({
  fromName: z.string().min(1, "From name is required"),
  fromEmail: z.string().email("Invalid email"),
  replyTo: z.string().email().optional(),
  signature: z.string().optional(),
  dailyLimit: z.number().min(1).max(1000),
  hourlyLimit: z.number().min(1).max(200),
  minDelay: z.number().min(30),
  maxDelay: z.number().min(30),
});

export type SenderAccountValues = z.infer<typeof senderAccountSchema>;

export const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  subject: z.string().min(1, "Subject is required"),
  bodyHtml: z.string().min(1, "Body is required"),
  bodyText: z.string().optional(),
});

export type TemplateValues = z.infer<typeof templateSchema>;
