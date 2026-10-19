"""Tests for pipeline.rules, on 5 hand-made baskets."""

import pytest
from pyspark.sql import DataFrame, SparkSession

from pipeline.rules import build_baskets, count_products, format_rules, mine_rules

# Counts: A in 3 baskets, B in 2, C in 3; A+B in 2, A+C in 1 (N = 5)
BASKETS = [["A", "B"], ["A", "B"], ["A", "C"], ["C"], ["C"]]


@pytest.fixture(scope="module")
def all_rules(spark: SparkSession) -> DataFrame:
    """Raw FP-Growth rules; min_support 0.1 makes every itemset frequent."""
    baskets = spark.createDataFrame([(b,) for b in BASKETS], "items array<string>")
    return mine_rules(baskets, min_support=0.1, min_confidence=0.2).associationRules


def as_pairs(rules: DataFrame) -> list[tuple[list[str], str]]:
    """Return (antecedent, consequent) of each formatted rule, sorted."""
    return sorted((r.antecedent, r.consequent) for r in rules.collect())


def test_build_baskets_one_set_per_invoice(spark: SparkSession) -> None:
    """One basket per invoice; a product bought twice appears once."""
    rows = [("1", "A"), ("1", "A"), ("1", "B"), ("2", "B")]
    df = spark.createDataFrame(rows, "invoice string, stock_code string")
    baskets = {r.invoice: sorted(r.items) for r in build_baskets(df).collect()}
    assert baskets == {"1": ["A", "B"], "2": ["B"]}


def test_consequent_is_one_stock_code_as_text(all_rules: DataFrame) -> None:
    """Contract: consequent is a string, antecedent a list of strings."""
    rules = format_rules(all_rules)
    assert rules.columns == [
        "antecedent",
        "consequent",
        "support",
        "confidence",
        "lift",
    ]
    assert rules.schema["consequent"].dataType.simpleString() == "string"
    assert rules.schema["antecedent"].dataType.simpleString() == "array<string>"
    assert as_pairs(rules) == [(["A"], "B"), (["B"], "A")]


def test_rule_metrics_match_hand_computation(all_rules: DataFrame) -> None:
    """B -> A: support 2/5, confidence 2/2, lift 1.0 / (3/5) = 5/3."""
    rule = format_rules(all_rules).filter("consequent = 'A'").first()
    assert rule.support == pytest.approx(2 / 5)
    assert rule.confidence == pytest.approx(1.0)
    assert rule.lift == pytest.approx(5 / 3)


def test_lift_filter_removes_weak_rules(all_rules: DataFrame) -> None:
    """A -> C and C -> A pass confidence (1/3) but not lift (5/9 < 1.5)."""
    assert all_rules.count() == 4
    assert as_pairs(format_rules(all_rules, min_lift=0.0)) == [
        (["A"], "B"), (["A"], "C"), (["B"], "A"), (["C"], "A"),
    ]  # fmt: skip
    assert format_rules(all_rules).count() == 2


def test_count_products(all_rules: DataFrame) -> None:
    """Only A and B appear in the rules kept after the lift filter."""
    assert count_products(format_rules(all_rules)) == 2
