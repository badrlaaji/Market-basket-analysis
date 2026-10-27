// Server component: reads the date of the last order once per request.
import { connection } from "next/server";
import { fetchApi } from "@/lib/fastapi";
import { formatDate } from "@/lib/format";
import type { Stats } from "@/lib/types";

/** "Data as of 9 Dec 2011": every "last order" and "next 90 days" counts from this date. */
export default async function DataDate() {
  await connection(); // render at request time: no FastAPI call during next build
  let lastDate: string;
  try {
    lastDate = (await fetchApi<Stats>("/stats")).last_date; // same request as the page: deduped
  } catch {
    return null; // the page itself shows the error; the header stays usable
  }
  return (
    <p className="data-date" title="Date of the last order in the data">
      Data as of <strong>{formatDate(lastDate)}</strong>
    </p>
  );
}
