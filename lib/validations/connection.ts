import { z } from "zod";

export const ConnectionToolEnum = z.enum(["RUSTDESK", "ANYDESK", "OTHER"]);

export const CreateConnectionSchema = z.object({
  name: z
    .string()
    .min(1, "Ad zorunludur")
    .max(255, "Ad en fazla 255 karakter olabilir"),
  tool: ConnectionToolEnum.default("RUSTDESK"),
  remoteId: z
    .string()
    .min(1, "Remote ID zorunludur")
    .max(100, "Remote ID en fazla 100 karakter olabilir"),
  password: z
    .string()
    .max(255, "Şifre en fazla 255 karakter olabilir")
    .optional()
    .or(z.literal("")),
  companyId: z.coerce.number().int().positive().optional().nullable(),
  regionId: z.coerce.number().int().positive().optional().nullable(),
  computerId: z.coerce.number().int().positive().optional().nullable(),
  notes: z
    .string()
    .max(2000, "Notlar en fazla 2000 karakter olabilir")
    .optional()
    .or(z.literal("")),
});

export const UpdateConnectionSchema = CreateConnectionSchema.partial();

export const ConnectionIdSchema = z.object({
  id: z.coerce.number().int().positive("Geçerli bir ID giriniz"),
});

export const ConnectionQuerySchema = z.object({
  search: z.string().optional(),
  tool: ConnectionToolEnum.optional(),
  companyId: z.coerce.number().int().positive().optional(),
  regionId: z.coerce.number().int().positive().optional(),
  computerId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(5000).default(20),
});

export type CreateConnectionInput = z.infer<typeof CreateConnectionSchema>;
export type UpdateConnectionInput = z.infer<typeof UpdateConnectionSchema>;
export type ConnectionQuery = z.infer<typeof ConnectionQuerySchema>;
