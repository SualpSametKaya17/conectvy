import { z } from "zod";

export const DeviceTypeEnum = z.enum(["COMPUTER", "SERVER", "VIRTUAL_SERVER"]);

export const CreateComputerSchema = z.object({
  deviceType: DeviceTypeEnum.default("COMPUTER"),
  companyId: z.coerce.number().int().positive("Firma seçimi zorunludur"),
  name: z
    .string()
    .min(1, "Cihaz adı zorunludur")
    .max(255, "Cihaz adı en fazla 255 karakter olabilir"),
  description: z
    .string()
    .max(1000, "Açıklama en fazla 1000 karakter olabilir")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(5000, "Not en fazla 5000 karakter olabilir")
    .optional()
    .or(z.literal("")),
});

export const UpdateComputerSchema = CreateComputerSchema.partial();

export const ComputerIdSchema = z.object({
  id: z.coerce.number().int().positive("Geçerli bir ID giriniz"),
});

export const ComputerQuerySchema = z.object({
  search: z.string().optional(),
  companyId: z.coerce.number().int().positive().optional(),
  deviceType: DeviceTypeEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(5000).default(20),
});

export type CreateComputerInput = z.infer<typeof CreateComputerSchema>;
export type UpdateComputerInput = z.infer<typeof UpdateComputerSchema>;
export type ComputerQuery = z.infer<typeof ComputerQuerySchema>;
