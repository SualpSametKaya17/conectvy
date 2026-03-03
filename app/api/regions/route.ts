import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { CreateRegionSchema, RegionQuerySchema } from "@/lib/validations/region";

/**
 * GET /api/regions?search=...&companyId=...&page=1&pageSize=20
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = RegionQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!query.success) return apiValidationError(query.error);

    const { search, companyId, page, pageSize } = query.data;
    const skip = (page - 1) * pageSize;

    const where = {
      ...(search ? { name: { contains: search } } : {}),
      ...(companyId ? { companyId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.region.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
        include: {
          company: { select: { id: true, name: true } },
          _count: { select: { connections: true } },
        },
      }),
      prisma.region.count({ where }),
    ]);

    return apiSuccess({ items, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/regions]", error);
    return apiError("Bölgeler alınamadı", 500);
  }
}

/**
 * POST /api/regions
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateRegionSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { name, description, companyId } = parsed.data;

    const region = await prisma.region.create({
      data: {
        name,
        description: description || null,
        companyId: companyId ?? null,
      },
      include: { company: { select: { id: true, name: true } } },
    });

    return apiSuccess(region, 201);
  } catch (error) {
    console.error("[POST /api/regions]", error);
    return apiError("Bölge oluşturulamadı", 500);
  }
}
