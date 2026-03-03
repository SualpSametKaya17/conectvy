import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { UpdateConnectionSchema, ConnectionIdSchema } from "@/lib/validations/connection";

function parseId(params: { id: string }) {
  return ConnectionIdSchema.safeParse(params);
}

/**
 * GET /api/connections/:id
 * Şifreyi de döner (tek kayıt görüntüleme için).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const connection = await prisma.connection.findUnique({
    where: { id: parsed.data.id, isActive: true },
    include: {
      company: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
  });

  if (!connection) return apiError("Bağlantı bulunamadı", 404);
  return apiSuccess(connection);
}

/**
 * PATCH /api/connections/:id
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  const body = await request.json();
  const update = UpdateConnectionSchema.safeParse(body);
  if (!update.success) return apiValidationError(update.error);

  try {
    const connection = await prisma.connection.update({
      where: { id: parsed.data.id },
      data: {
        ...(update.data.name !== undefined && { name: update.data.name }),
        ...(update.data.tool !== undefined && { tool: update.data.tool }),
        ...(update.data.remoteId !== undefined && { remoteId: update.data.remoteId }),
        ...(update.data.password !== undefined && { password: update.data.password || null }),
        ...(update.data.companyId !== undefined && { companyId: update.data.companyId ?? null }),
        ...(update.data.regionId !== undefined && { regionId: update.data.regionId ?? null }),
        ...(update.data.notes !== undefined && { notes: update.data.notes || null }),
      },
      include: {
        company: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    });
    return apiSuccess(connection);
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2025") return apiError("Bağlantı bulunamadı", 404);
    console.error("[PATCH /api/connections/:id]", error);
    return apiError("Bağlantı güncellenemedi", 500);
  }
}

/**
 * DELETE /api/connections/:id  (soft delete)
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const parsed = parseId(params);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    await prisma.connection.update({
      where: { id: parsed.data.id },
      data: { isActive: false },
    });
    return apiSuccess({ deleted: true });
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e?.code === "P2025") return apiError("Bağlantı bulunamadı", 404);
    console.error("[DELETE /api/connections/:id]", error);
    return apiError("Bağlantı silinemedi", 500);
  }
}
