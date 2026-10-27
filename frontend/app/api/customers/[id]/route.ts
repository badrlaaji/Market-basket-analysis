import { forwardGet } from "@/lib/fastapi";

/** Browser → Next.js → FastAPI GET /customers/{id}; only a customer number goes through. */
export async function GET(request: Request, { params }: RouteContext<"/api/customers/[id]">) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) {
    return Response.json({ detail: "A customer number has digits only." }, { status: 422 });
  }
  return forwardGet(request, `/customers/${id}`);
}
