import { forwardGet } from "@/lib/fastapi";

/** Browser → Next.js → FastAPI GET /products. */
export async function GET(request: Request): Promise<Response> {
  return forwardGet(request, "/products");
}
