import { forwardPost } from "@/lib/fastapi";

/** Browser → Next.js → FastAPI POST /recommend. */
export async function POST(request: Request): Promise<Response> {
  return forwardPost(request, "/recommend");
}
