import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiValidationError } from "@/lib/utils";
import { CreateCompanySchema, CompanyQuerySchema } from "@/lib/validations/company";

/**
 * GET /api/companies?search=...&page=1&pageSize=20
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = CompanyQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!query.success) return apiValidationError(query.error);

    const { search, page, pageSize } = query.data;
    const skip = (page - 1) * pageSize;

    const where = search
      ? { name: { contains: search } }
      : {};

    const [items, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
        include: { _count: { select: { connections: true, regions: true } } },
      }),
      prisma.company.count({ where }),
    ]);

    return apiSuccess({ items, total, page, pageSize });
  } catch (error) {
    console.error("[GET /api/companies]", error);
    return apiError("Firmalar alınamadı", 500);
  }
}

/**
 * POST /api/companies
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateCompanySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { name, description } = parsed.data;

    // Uniqueness check (Prisma will also throw, but we give friendly message)
    const existing = await prisma.company.findUnique({ where: { name } });
    if (existing) return apiError("Bu firma adı zaten kayıtlı", 409);

    const company = await prisma.company.create({
      data: { name, description: description || null },
    });

    return apiSuccess(company, 201);
  } catch (error) {
    console.error("[POST /api/companies]", error);
    return apiError("Firma oluşturulamadı", 500);
  }
}
