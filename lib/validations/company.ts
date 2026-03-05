import { z } from "zod";

const dateFieldSchema = z.string().optional().nullable().or(z.literal(""));

const dateOrderRefinement = (start: string | null | undefined, end: string | null | undefined) =>
  !start || !end || start <= end;

const DATE_ORDER_ERROR = {
  message: "Başlangıç tarihi bitiş tarihinden sonra olamaz",
  path: ["maintenanceStartDate"],
};

const BaseCompanySchema = z.object({
  name: z
    .string()
    .min(1, "Firma adı zorunludur")
    .max(255, "Firma adı en fazla 255 karakter olabilir"),
  description: z
    .string()
    .max(1000, "Açıklama en fazla 1000 karakter olabilir")
    .optional()
    .or(z.literal("")),
  maintenanceStartDate: dateFieldSchema,
  maintenanceEndDate: dateFieldSchema,
});

export const CreateCompanySchema = BaseCompanySchema.refine(
  (d) => dateOrderRefinement(d.maintenanceStartDate, d.maintenanceEndDate),
  DATE_ORDER_ERROR
);

export const UpdateCompanySchema = BaseCompanySchema.partial().refine(
  (d) => dateOrderRefinement(d.maintenanceStartDate, d.maintenanceEndDate),
  DATE_ORDER_ERROR
);

export const CompanyIdSchema = z.object({
  id: z.coerce.number().int().positive("Geçerli bir ID giriniz"),
});

export const CompanyQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
});

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;
export type CompanyQuery = z.infer<typeof CompanyQuerySchema>;
