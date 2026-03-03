import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { UpdateCompanySchema, CompanyIdSchema } from "@/lib/validations/company";

function parseId(params: { id: string }) {
  return CompanyIdSchema.safeParse(params);
}

/**
 * GET /api/companies/:id
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const company = await prisma.company.findUnique({
    where: { id: parsed.data.id },
    include: {
      regions: { orderBy: { name: "asc" } },
      _count: { select: { connections: true } },
    },
  });

  if (!company) return apiError("Firma bulunamadı", 404);
  return apiSuccess(company);
}

/**
 * PATCH /api/companies/:id
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const body = await request.json();
  const update = UpdateCompanySchema.safeParse(body);
  if (!update.success) return apiValidationError(update.error);

  try {
    const company = await prisma.company.update({
      where: { id: parsed.data.id },
      data: {
        ...(update.data.name !== undefined && { name: update.data.name }),
        ...(update.data.description !== undefined && { description: update.data.description || null }),
      },
    });
    return apiSuccess(company);
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2025") return apiError("Firma bulunamadı", 404);
    if (e?.code === "P2002") return apiError("Bu firma adı zaten kayıtlı", 409);
    console.error("[PATCH /api/companies/:id]", error);
    return apiError("Firma güncellenemedi", 500);
  }
}

/**
 * DELETE /api/companies/:id
 * Soft-delete: isActive = false
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    await prisma.company.update({
      where: { id: parsed.data.id },
      data: { isActive: false },
    });
    return apiSuccess({ deleted: true });
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2025") return apiError("Firma bulunamadı", 404);
    console.error("[DELETE /api/companies/:id]", error);
    return apiError("Firma silinemedi", 500);
  }
}
