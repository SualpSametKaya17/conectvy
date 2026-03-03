import { z } from "zod";

export const CreateCompanySchema = z.object({
  name: z
    .string()
    .min(1, "Firma adı zorunludur")
    .max(255, "Firma adı en fazla 255 karakter olabilir"),
  description: z
    .string()
    .max(1000, "Açıklama en fazla 1000 karakter olabilir")
    .optional()
    .or(z.literal("")),
});

export const UpdateCompanySchema = CreateCompanySchema.partial();

export const CompanyIdSchema = z.object({
  id: z.coerce.number().int().positive("Geçerli bir ID giriniz"),
});

export const CompanyQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;
export type CompanyQuery = z.infer<typeof CompanyQuerySchema>;
