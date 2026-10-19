import { connection } from "next/server";
import SegmentsChart from "@/components/SegmentsChart";
import { fetchApi } from "@/lib/fastapi";
import type { SegmentProfile } from "@/lib/types";

export default async function SegmentsPage() {
  await connection(); // render at request time: no FastAPI call during next build
  const profiles = await fetchApi<SegmentProfile[]>("/segments");

  return (
    <main>
      <div className="page-head">
        <h1>Who are the customers?</h1>
        <p className="lede">
          Four groups built from how recently, how often and how much each customer bought,
          measured on the day after the last invoice.
        </p>
      </div>
      <SegmentsChart profiles={profiles} />
    </main>
  );
}
