"use client"; // error boundaries must be client components (Next.js rule)

/** Shown when a page cannot load its data, usually because FastAPI is not running. */
export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main>
      <div className="page-head error-box">
        <h1>The data could not be loaded</h1>
        <p className="lede">
          The web app could not reach the API. Start it from the repository root, then try
          again.
        </p>
        <pre>uvicorn api.main:app</pre>
        <button type="button" className="button-primary" onClick={() => retry()}>
          Try again
        </button>
      </div>
    </main>
  );
}
