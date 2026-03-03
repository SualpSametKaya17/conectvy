import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/utils";

/**
 * GET /api/dashboard
 * Dashboard için özet istatistikleri döner.
 */
export async function GET() {
  try {
    const [
      totalConnections,
      activeConnections,
      totalCompanies,
      totalRegions,
      recentConnections,
      toolStats,
    ] = await Promise.all([
      prisma.connection.count(),
      prisma.connection.count({ where: { isActive: true } }),
      prisma.company.count({ where: { isActive: true } }),
      prisma.region.count({ where: { isActive: true } }),
      prisma.connection.findMany({
        take: 5,
        orderBy: { updatedAt: "desc" },
        include: { company: true, region: true },
        where: { isActive: true },
      }),
      prisma.connection.groupBy({
        by: ["tool"],
        _count: { id: true },
        where: { isActive: true },
      }),
    ]);

    return apiSuccess({
      stats: {
        totalConnections,
        activeConnections,
        totalCompanies,
        totalRegions,
      },
      recentConnections,
      toolStats: toolStats.map((t) => ({ tool: t.tool, count: t._count.id })),
    });
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return apiError("Veriler alınamadı", 500);
  }
}
