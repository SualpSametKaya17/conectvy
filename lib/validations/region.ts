import { z } from "zod";

export const CreateRegionSchema = z.object({
  name: z
    .string()
    .min(1, "Bölge adı zorunludur")
    .max(255, "Bölge adı en fazla 255 karakter olabilir"),
  description: z
    .string()
    .max(1000, "Açıklama en fazla 1000 karakter olabilir")
    .optional()
    .or(z.literal("")),
  companyId: z.coerce.number().int().positive().optional().nullable(),
});

export const UpdateRegionSchema = CreateRegionSchema.partial();

export const RegionIdSchema = z.object({
  id: z.coerce.number().int().positive("Geçerli bir ID giriniz"),
});

export const RegionQuerySchema = z.object({
  search: z.string().optional(),
  companyId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateRegionInput = z.infer<typeof CreateRegionSchema>;
export type UpdateRegionInput = z.infer<typeof UpdateRegionSchema>;
export type RegionQuery = z.infer<typeof RegionQuerySchema>;
