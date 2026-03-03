import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { CreateConnectionSchema, ConnectionQuerySchema } from "@/lib/validations/connection";

/**
 * GET /api/connections?search=...&tool=...&companyId=...&regionId=...&page=1&pageSize=20
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = ConnectionQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!query.success) return apiValidationError(query.error);

    const { search, tool, companyId, regionId, page, pageSize } = query.data;
    const skip = (page - 1) * pageSize;

    const where = {
      isActive: true,
      ...(tool ? { tool } : {}),
      ...(companyId ? { companyId } : {}),
      ...(regionId ? { regionId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { remoteId: { contains: search } },
              { notes: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.connection.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          region: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
        },
      }),
      prisma.connection.count({ where }),
    ]);

    // Strip password from list response for security
    const safeItems = items.map(({ password: _pw, ...rest }) => rest);

    return apiSuccess({ items: safeItems, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/connections]", error);
    return apiError("Bağlantılar alınamadı", 500);
  }
}

/**
 * POST /api/connections
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateConnectionSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { name, tool, remoteId, password, companyId, regionId, notes } = parsed.data;

    const connection = await prisma.connection.create({
      data: {
        name,
        tool,
        remoteId,
        password: password || null,
        companyId: companyId ?? null,
        regionId: regionId ?? null,
        notes: notes || null,
      },
      include: {
        company: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
      },
    });

    return apiSuccess(connection, 201);
  } catch (error) {
    console.error("[POST /api/connections]", error);
    return apiError("Bağlantı oluşturulamadı", 500);
  }
}
