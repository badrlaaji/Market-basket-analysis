import { forwardGet } from "@/lib/fastapi";

/** Browser → Next.js → FastAPI GET /rules/export (CSV file). */
export async function GET(request: Request): Promise<Response> {
  return forwardGet(request, "/rules/export");
}
