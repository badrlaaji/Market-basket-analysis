// Server only: the one file that knows where FastAPI is.
// Imported by pages (server components) and app/api routes, never by a client component.

const API_URL = process.env.API_URL ?? "http://localhost:8000";

/** GET a FastAPI endpoint for a page; errors go to app/error.tsx. */
export async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`FastAPI ${path} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/** Send a request to FastAPI and pass its status and body back; 502 if it is down. */
async function forward(path: string, init: RequestInit): Promise<Response> {
  try {
    const response = await fetch(`${API_URL}${path}`, init);
    // Keep the type FastAPI sent (JSON, or CSV for /rules/export) and its file name
    const headers = new Headers({
      "content-type": response.headers.get("content-type") ?? "application/json",
    });
    const disposition = response.headers.get("content-disposition");
    if (disposition) headers.set("content-disposition", disposition);
    return new Response(await response.text(), { status: response.status, headers });
  } catch {
    return Response.json({ detail: "The API is not reachable." }, { status: 502 });
  }
}

/** Forward a browser GET (with its query string) to the same FastAPI path. */
export async function forwardGet(request: Request, path: string): Promise<Response> {
  const query = new URL(request.url).search;
  return forward(`${path}${query}`, { method: "GET" });
}

/** Forward a browser POST (JSON body) to the same FastAPI path. */
export async function forwardPost(request: Request, path: string): Promise<Response> {
  return forward(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
