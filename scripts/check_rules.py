"""Recompute 5 association rules with pandas, independently of Spark.

Run from the repository root, after pipeline.rules: python -m scripts.check_rules
"""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CLEAN_PARQUET = ROOT / "data" / "interim" / "clean.parquet"
RULES_PARQUET = ROOT / "outputs" / "rules.parquet"
TOP_PRODUCT = "85123A"  # most frequent product (5,464 invoices)
TOLERANCE = 1e-9
METRICS = ["support", "confidence", "lift"]


def invoices_by_product(clean: pd.DataFrame) -> dict[str, set[str]]:
    """Map each stock code to the set of invoices that contain it."""
    return clean.groupby("stock_code")["invoice"].agg(set).to_dict()


def count_invoices(items: list[str], invoices: dict[str, set[str]]) -> int:
    """Number of invoices that contain every item."""
    return len(set.intersection(*(invoices[item] for item in items)))


def recompute(
    antecedent: list[str], consequent: str, invoices: dict[str, set[str]], n: int
) -> dict[str, float]:
    """Support, confidence and lift of one rule, from invoice counts."""
    n_both = count_invoices(antecedent + [consequent], invoices)
    n_antecedent = count_invoices(antecedent, invoices)
    confidence = n_both / n_antecedent
    return {
        "support": n_both / n,
        "confidence": confidence,
        "lift": confidence / (len(invoices[consequent]) / n),
    }


def pick_rules(rules: pd.DataFrame) -> dict[str, int]:
    """Pick 5 different rules (row index), one per criterion."""
    has_top = rules["consequent"].eq(TOP_PRODUCT) | rules["antecedent"].map(
        lambda items: TOP_PRODUCT in items
    )
    criteria = {
        "max lift": rules["lift"],
        "max confidence": rules["confidence"],
        "max support": rules["support"],
        "3-item antecedent": rules["lift"].where(rules["antecedent"].map(len) == 3),
        f"rule with {TOP_PRODUCT}": rules["lift"].where(has_top),
    }
    picked: dict[str, int] = {}
    for label, score in criteria.items():
        picked[label] = score.drop(list(picked.values())).idxmax()
    return picked


def descriptions(clean: pd.DataFrame, codes: set[str]) -> dict[str, str]:
    """Most frequent description of each stock code."""
    rows = clean[clean["stock_code"].isin(codes)]
    modes = rows.groupby("stock_code")["description"].agg(lambda s: s.mode()[0])
    return modes.to_dict()


def main() -> None:
    """Print Spark and pandas values side by side; fail on any difference."""
    clean = pd.read_parquet(
        CLEAN_PARQUET, columns=["invoice", "stock_code", "description"]
    )
    rules = pd.read_parquet(RULES_PARQUET)
    invoices = invoices_by_product(clean)
    n = clean["invoice"].nunique()
    print(f"{len(rules):,} rules, {n:,} invoices")

    picked = pick_rules(rules)
    chosen = rules.loc[list(picked.values())]
    codes = set(chosen["consequent"]).union(*map(set, chosen["antecedent"]))
    names = descriptions(clean, codes)
    worst = 0.0
    for label, idx in picked.items():
        rule = rules.loc[idx]
        antecedent = list(rule["antecedent"])
        mine = recompute(antecedent, rule["consequent"], invoices, n)
        print(f"\n[{label}] {' + '.join(antecedent)} -> {rule['consequent']}")
        for code in antecedent + [rule["consequent"]]:
            print(f"  {code}: {names[code]}")
        for metric in METRICS:
            diff = abs(rule[metric] - mine[metric])
            worst = max(worst, diff)
            print(
                f"  {metric:<10} spark {rule[metric]:.10f}  pandas {mine[metric]:.10f}"
            )
    if worst > TOLERANCE:
        raise SystemExit(f"Mismatch: max difference {worst:.2e} > {TOLERANCE:.0e}")
    print(f"\nOK: 5 rules match, max difference {worst:.2e}")


if __name__ == "__main__":
    main()
