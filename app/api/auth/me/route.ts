import { cookies } from "next/headers";
import { apiSuccess, apiError } from "@/lib/utils";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return apiError("Oturum açılmamış", 401);

  try {
    const session = await verifySessionToken(token);
    return apiSuccess({ userId: session.userId, username: session.username });
  } catch {
    return apiError("Oturum geçersiz", 401);
  }
}
