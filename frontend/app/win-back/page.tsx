import { connection } from "next/server";
import WinBackList from "@/components/WinBackList";
import { fetchApi } from "@/lib/fastapi";
import { DEFAULT_THRESHOLD, atRiskQuery } from "@/lib/queries";
import type { AtRiskPage } from "@/lib/types";

export default async function WinBackPage() {
  await connection(); // render at request time: no FastAPI call during next build
  const page = await fetchApi<AtRiskPage>(`/at-risk${atRiskQuery(DEFAULT_THRESHOLD)}`);

  return (
    <main>
      <div className="page-head">
        <h1>Who is about to stop buying?</h1>
        <p className="lede">
          Customers the model expects not to order in the next 90 days, most valuable first.
          Net spend subtracts the products they cancelled; gross spend does not.
        </p>
      </div>
      <WinBackList initialThreshold={DEFAULT_THRESHOLD} initialPage={page} />
    </main>
  );
}
