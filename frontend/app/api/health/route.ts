import { forwardGet } from "@/lib/fastapi";

/** Browser → Next.js → FastAPI GET /health. */
export async function GET(request: Request): Promise<Response> {
  return forwardGet(request, "/health");
}
