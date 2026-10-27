"use client"; // dialog, copy button and keyboard on the customer card

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  formatDate,
  formatDaysAgo,
  formatInt,
  formatLift,
  formatPercent,
  formatPounds,
  productName,
} from "@/lib/format";
import type { CustomerCard, Offer, RiskLevel } from "@/lib/types";
import { useNarrow } from "@/lib/useNarrow";

const RISK_LABELS: Record<RiskLevel, string> = { high: "High", medium: "Medium", low: "Low" };
const COPIED_MS = 2000;

/** "Usually orders every 11 days. Last order 373 days ago." (or why there is no rhythm). */
function whyNow(card: CustomerCard): string {
  const last = `Last order ${formatDaysAgo(card.recency)}.`;
  if (card.usual_gap_days === null) return `One order day so far, no usual rhythm yet. ${last}`;
  return `Usually orders every ${formatInt(Math.round(card.usual_gap_days))} days. ${last}`;
}

/** One offer: the product and why (a buying pattern, or only a best seller). */
function OfferItem({ offer }: { offer: Offer }) {
  const pattern = offer.kind === "pattern";
  return (
    <li className={pattern ? "offer" : "offer is-fallback"}>
      <div>
        <p className="offer-name">{productName(offer.description)}</p>
        <p className="note">
          {pattern && offer.confidence !== null && offer.lift !== null
            ? `In ${formatPercent(offer.confidence, 0)} of the baskets with ${offer.because
                .map(productName)
                .join(" + ")}, ${formatLift(offer.lift)} more often than usual`
            : "Popular with all customers"}
        </p>
      </div>
      <span className={pattern ? "badge badge-pattern" : "badge"}>
        {pattern ? "Buying pattern" : "Best seller · not a pattern"}
      </span>
    </li>
  );
}

/** The card itself: why now, three figures, what they buy, what they stopped buying, what to offer. */
function CardBody({ card }: { card: CustomerCard }) {
  return (
    <>
      <p className="card-meta">
        <span className="chip">
          <span className={`swatch seg-${card.segment}`} aria-hidden="true" /> {card.segment_name}
        </span>{" "}
        {card.country} · customer since {formatDate(card.first_order)}
      </p>
      <p className="card-why">
        {whyNow(card)}{" "}
        {card.overdue && <span className="badge badge-alert">Overdue</span>}
      </p>
      {card.rough_rhythm && card.usual_gap_days !== null && (
        <p className="note">
          A rough guide: the rhythm comes from only {formatInt(card.n_order_days)} order days.
        </p>
      )}

      <dl className="card-figures">
        <div>
          <dt>Risk of leaving</dt>
          <dd>{RISK_LABELS[card.risk_level]}</dd>
          <dd className="note">
            Score {formatPercent(card.proba_90d, 0)}, tenth {card.risk_decile} of 10
          </dd>
        </div>
        <div>
          <dt>Spent (net)</dt>
          <dd>{formatPounds(card.monetary_net)}</dd>
          <dd className="note">
            {formatInt(card.n_orders)} orders, {formatPounds(card.average_order)} each
          </dd>
        </div>
        <div className="is-stake">
          <dt>Money at stake</dt>
          <dd>{formatPounds(card.stake)}</dd>
        </div>
      </dl>

      <h3>What they usually buy</h3>
      <ol className="card-list">
        {card.products.map((product) => (
          <li key={product.stock_code}>
            <span>{productName(product.description)}</span>
            <span className="code">{formatInt(product.n_orders)} orders</span>
          </li>
        ))}
      </ol>

      {card.lost_products.length > 0 && (
        <>
          <h3>No longer bought</h3>
          <ul className="card-list">
            {card.lost_products.map((product) => (
              <li key={product.stock_code}>
                <span>{productName(product.description)}</span>
                <span className="code">
                  {formatInt(product.n_orders)} orders, about every{" "}
                  {formatInt(Math.round(product.usual_gap_days))} days, none for{" "}
                  {formatInt(product.days_since)} days
                </span>
              </li>
            ))}
          </ul>
          <p className="note">They kept ordering, but not these: worth asking why.</p>
        </>
      )}

      <h3>What to offer</h3>
      <ul className="offers">
        {card.offers.map((offer) => (
          <OfferItem key={offer.stock_code} offer={offer} />
        ))}
      </ul>
    </>
  );
}

/**
 * Customer card next to the list (computer: non-modal <aside>), or full screen
 * on a phone (<dialog> + showModal: focus, Escape and focus return by the browser).
 */
export default function CustomerPanel({
  customerId,
  card,
  error,
  onClose,
  onPrevious,
  onNext,
}: {
  customerId: number;
  card: CustomerCard | null; // null while it loads
  error: string;
  onClose: () => void;
  onPrevious: (() => void) | null; // null: first of the list
  onNext: (() => void) | null;
}) {
  const narrow = useNarrow();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);
  const loaded = card !== null && card.customer_id === customerId;

  // Phone: open as a modal dialog; its "close" event (Escape, button) closes the card
  useEffect(() => {
    const dialog = dialogRef.current;
    if (narrow && dialog && !dialog.open) dialog.showModal();
  }, [narrow]);

  // Computer: the card takes the focus, so Tab goes to its buttons next
  useEffect(() => {
    if (!narrow) titleRef.current?.focus({ preventScroll: true });
  }, [narrow, customerId]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(String(customerId));
      setCopied(true);
    } catch {
      setCopied(false); // no clipboard (http page, permission): the number stays visible
    }
  }

  /** Phone: close the dialog (its close event calls onClose); computer: close the panel. */
  function requestClose() {
    if (narrow && dialogRef.current?.open) dialogRef.current.close();
    else onClose();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !narrow) {
      event.preventDefault();
      onClose();
    }
  }

  const titleId = `customer-${customerId}-title`;
  const content: ReactNode = (
    <div className="panel-scroll">
      <div className="panel-head">
        <h2 id={titleId} ref={titleRef} tabIndex={-1}>
          Customer <span className="num-id">{customerId}</span>
        </h2>
        <button type="button" className="icon-button" onClick={requestClose} aria-label="Close the card">
          ×
        </button>
      </div>
      <div className={loaded ? undefined : "is-loading"} aria-busy={!loaded}>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {card && <CardBody card={card} />}
        {!card && !error && <div className="skeleton skeleton-card" />}
      </div>
      <div className="panel-actions">
        <button type="button" onClick={copyNumber}>
          {copied ? "Copied" : "Copy number"}
        </button>
        <button type="button" onClick={onPrevious ?? undefined} disabled={!onPrevious}>
          <span aria-hidden="true">←</span> Previous
        </button>
        <button type="button" onClick={onNext ?? undefined} disabled={!onNext}>
          Next <span aria-hidden="true">→</span>
        </button>
        <span className="visually-hidden" aria-live="polite">
          {copied ? `Customer number ${customerId} copied` : ""}
        </span>
      </div>
      <p className="note panel-foot">
        The risk level ranks customers well but is not an exact forecast.{" "}
        <Link href="/model">How reliable is it?</Link>
      </p>
    </div>
  );

  return narrow ? (
    <dialog
      ref={dialogRef}
      className="customer-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
    >
      {content}
    </dialog>
  ) : (
    <aside className="customer-panel" aria-labelledby={titleId} onKeyDown={onKeyDown}>
      {content}
    </aside>
  );
}
