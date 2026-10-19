/** Shown at once while a page waits for FastAPI (Next.js loading.js = React Suspense). */
export default function Loading() {
  return (
    <main aria-busy="true">
      <div className="page-head">
        <p className="question">Loading the data…</p>
        <div className="skeleton skeleton-answer" />
      </div>
      <div className="skeleton skeleton-chart" />
    </main>
  );
}
