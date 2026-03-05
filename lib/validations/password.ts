import { z } from "zod";

export const PASSWORD_CATEGORIES = [
  "Genel",
  "E-posta",
  "Sosyal Medya",
  "Banka",
  "İş",
  "Sunucu",
  "Diğer",
] as const;

export const CreatePasswordSchema = z.object({
  title:    z.string().min(1, "Başlık zorunludur").max(255),
  username: z.string().max(255).optional().or(z.literal("")),
  password: z.string().max(1000).optional().or(z.literal("")),
  url:      z.string().max(500).optional().or(z.literal("")),
  category: z.string().max(50).optional().or(z.literal("")),
  notes:    z.string().max(5000).optional().or(z.literal("")),
});

export const UpdatePasswordSchema = CreatePasswordSchema.partial();

export type CreatePasswordInput = z.infer<typeof CreatePasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;
