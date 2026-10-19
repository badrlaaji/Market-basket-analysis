import { forwardGet } from "@/lib/fastapi";

/** Browser → Next.js → FastAPI GET /at-risk. */
export async function GET(request: Request): Promise<Response> {
  return forwardGet(request, "/at-risk");
}
