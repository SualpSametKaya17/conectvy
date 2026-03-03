import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { UpdateRegionSchema, RegionIdSchema } from "@/lib/validations/region";

function parseId(params: { id: string }) {
  return RegionIdSchema.safeParse(params);
}

/**
 * GET /api/regions/:id
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const region = await prisma.region.findUnique({
    where: { id: parsed.data.id },
    include: {
      company: { select: { id: true, name: true } },
      _count: { select: { connections: true } },
    },
  });

  if (!region) return apiError("Bölge bulunamadı", 404);
  return apiSuccess(region);
}

/**
 * PATCH /api/regions/:id
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const body = await request.json();
  const update = UpdateRegionSchema.safeParse(body);
  if (!update.success) return apiValidationError(update.error);

  try {
    const region = await prisma.region.update({
      where: { id: parsed.data.id },
      data: {
        ...(update.data.name !== undefined && { name: update.data.name }),
        ...(update.data.description !== undefined && { description: update.data.description || null }),
        ...(update.data.companyId !== undefined && { companyId: update.data.companyId ?? null }),
      },
      include: { company: { select: { id: true, name: true } } },
    });
    return apiSuccess(region);
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2025") return apiError("Bölge bulunamadı", 404);
    console.error("[PATCH /api/regions/:id]", error);
    return apiError("Bölge güncellenemedi", 500);
  }
}

/**
 * DELETE /api/regions/:id  (soft delete)
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    await prisma.region.update({
      where: { id: parsed.data.id },
      data: { isActive: false },
    });
    return apiSuccess({ deleted: true });
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2025") return apiError("Bölge bulunamadı", 404);
    console.error("[DELETE /api/regions/:id]", error);
    return apiError("Bölge silinemedi", 500);
  }
}
