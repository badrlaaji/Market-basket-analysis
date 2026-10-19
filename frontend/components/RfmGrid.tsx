// No hooks and no "use client": a CSS grid, rendered inside SegmentsView (client).
import { formatInt, formatPercent } from "@/lib/format";
import type { GridCell, SegmentProfile } from "@/lib/types";

/** Customers per recency quintile (columns) and frequency band (rows, most frequent on top). */
export default function RfmGrid({
  cells,
  profiles,
}: {
  cells: GridCell[];
  profiles: SegmentProfile[];
}) {
  const names = new Map(profiles.map((p) => [p.segment, p.segment_name]));
  const bands = [...new Set(cells.map((c) => c.frequency_band))].reverse(); // "10+" first
  const quintiles = [...new Set(cells.map((c) => c.recency_quintile))];
  const max = Math.max(...cells.map((c) => c.n_customers));
  const total = cells.reduce((sum, c) => sum + c.n_customers, 0);
  const single = cells
    .filter((c) => c.frequency_band === "1")
    .reduce((sum, c) => sum + c.n_customers, 0);
  const cell = (band: string, quintile: number) =>
    cells.find((c) => c.frequency_band === band && c.recency_quintile === quintile);

  return (
    <>
      <p className="note status">
        Columns: fifths of the customers by days since their last purchase. Rows: number of
        invoices, in fixed bands ({formatPercent(single / total, 0)} of customers have a single
        invoice, so equal fifths are impossible). Darker = more customers; the name is the main segment of the cell.
      </p>
      <div className="scroll-x">
        <table className="rfm-grid">
          <caption className="visually-hidden">
            Customers per recency fifth and number of invoices
          </caption>
          <thead>
            <tr>
              <th scope="col">Invoices</th>
              {quintiles.map((q) => {
                const first = cell(bands[0], q);
                return (
                  <th scope="col" key={q}>
                    {first ? `${first.recency_min}–${first.recency_max} days` : q}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {bands.map((band) => (
              <tr key={band}>
                <th scope="row">{band.replace("-", "–")}</th>
                {quintiles.map((q) => {
                  const c = cell(band, q);
                  const n = c?.n_customers ?? 0;
                  return (
                    <td
                      key={q}
                      style={{ "--heat": `${Math.round((n / max) * 100)}%` } as React.CSSProperties}
                      className={n / max > 0.55 ? "is-dark" : undefined}
                    >
                      <strong>{formatInt(n)}</strong>
                      <span>{c?.top_segment != null ? names.get(c.top_segment) : "—"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
