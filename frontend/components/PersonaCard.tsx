// No hooks and no "use client": rendered inside SegmentsView (client).
import Link from "next/link";
import Term from "@/components/Term";
import { formatInt, formatPercent, formatPounds, productName } from "@/lib/format";
import type { SegmentProfile } from "@/lib/types";

/** The selected segment as a short profile, its favourite products and an action. */
export default function PersonaCard({ profile }: { profile: SegmentProfile }) {
  return (
    <div className="persona" aria-live="polite">
      <h2>
        <span className={`swatch seg-${profile.segment}`} aria-hidden="true" />{" "}
        {profile.segment_name}
      </h2>
      <p className="persona-share">
        {formatPercent(profile.customer_share, 0)} of the customers,{" "}
        {formatPercent(profile.revenue_share, 0)} of the revenue.
      </p>
      <dl className="persona-facts">
        <div>
          <dt>
            <Term id="recency">Last purchase</Term>
          </dt>
          <dd>{formatInt(Math.round(profile.recency_median))} days ago</dd>
        </div>
        <div>
          <dt>
            <Term id="frequency">Invoices</Term>
          </dt>
          <dd>{formatInt(Math.round(profile.frequency_median))}</dd>
        </div>
        <div>
          <dt>
            <Term id="monetary">Spend</Term>
          </dt>
          <dd>{formatPounds(profile.monetary_median)}</dd>
        </div>
      </dl>
      <p className="note">Typical customer (median) of the {formatInt(profile.n_customers)}.</p>
      <h3>
        Products they <Term id="preference">prefer</Term>
      </h3>
      <ol className="persona-products">
        {profile.top_products.map((product) => (
          <li key={product.stock_code}>
            <span>{productName(product.description)}</span>
            <span className="code">
              {product.preference.toFixed(1)}×, bought by {formatPercent(product.customer_share, 0)}
            </span>
          </li>
        ))}
      </ol>
      <Link className="button" href={`/win-back?segment=${profile.segment}`}>
        See the {profile.segment_name} customers to win back
      </Link>
    </div>
  );
}
