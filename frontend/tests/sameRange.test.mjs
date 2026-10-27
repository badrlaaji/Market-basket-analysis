// Run with: npm test (Node's own test runner; it reads the TypeScript file directly).
import assert from "node:assert/strict";
import { test } from "node:test";
import { sameRange } from "../lib/sameRange.ts";

// 20 pairs of real product names, each checked by hand
const VARIANTS = [
  ["JUMBO BAG RED RETROSPOT", "JUMBO BAG TOYS"],
  ["JUMBO BAG RED RETROSPOT", "JUMBO BAG PINK POLKADOT"],
  ["LUNCH BAG SUKI  DESIGN", "LUNCH BAG  BLACK SKULL."],
  ["PINK REGENCY TEACUP AND SAUCER", "GREEN REGENCY TEACUP AND SAUCER"],
  ["RED RETROSPOT CHARLOTTE BAG", "CHARLOTTE BAG SUKI DESIGN"],
  ["WHITE HANGING HEART T-LIGHT HOLDER", "RED HANGING HEART T-LIGHT HOLDER"],
  ["WHITE HANGING HEART T-LIGHT HOLDER", "HANGING HEART ZINC T-LIGHT HOLDER"],
  ["HEART OF WICKER SMALL", "HEART OF WICKER LARGE"],
  ["PACK OF 72 RETROSPOT CAKE CASES", "PACK OF 60 PINK PAISLEY CAKE CASES"],
  ["ALARM CLOCK BAKELIKE RED", "ALARM CLOCK BAKELIKE GREEN"],
  ["PAPER CHAIN KIT 50'S CHRISTMAS", "PAPER CHAIN KIT VINTAGE CHRISTMAS"],
];
const OTHER_PRODUCTS = [
  ["JUMBO STORAGE BAG SUKI", "JUMBO BAG STRAWBERRY"], // shared words, never side by side
  ["JUMBO BAG RED RETROSPOT", "RED RETROSPOT CHARLOTTE BAG"], // same print, other product
  ["LUNCH BAG RED RETROSPOT", "JUMBO BAG RED RETROSPOT"],
  ["SET OF 3 REGENCY CAKE TINS", "SET OF 4 KNICK KNACK TINS LEAF"],
  ["REGENCY CAKESTAND 3 TIER", "ROSES REGENCY TEACUP AND SAUCER"],
  ["WHITE HANGING HEART T-LIGHT HOLDER", "NATURAL SLATE HEART CHALKBOARD"],
  ["PARTY BUNTING", "WHITE HANGING HEART T-LIGHT HOLDER"],
  ["RED HARMONICA IN BOX", "WORLD WAR 2 GLIDERS ASSTD DESIGNS"],
  ["SPOTTY BUNTING", "CHILDRENS APRON SPACEBOY DESIGN"],
];

test("variants of one product share a range", () => {
  for (const [a, b] of VARIANTS) assert.equal(sameRange(a, b), true, `${a} / ${b}`);
});

test("other products, or the same print on another product, do not", () => {
  for (const [a, b] of OTHER_PRODUCTS) assert.equal(sameRange(a, b), false, `${a} / ${b}`);
});

test("the order of the two names does not matter", () => {
  for (const [a, b] of [...VARIANTS, ...OTHER_PRODUCTS]) {
    assert.equal(sameRange(a, b), sameRange(b, a), `${a} / ${b}`);
  }
});

test("a name of one word, or an empty one, never matches", () => {
  assert.equal(sameRange("BUNTING", "PARTY BUNTING"), false);
  assert.equal(sameRange("", "JUMBO BAG TOYS"), false);
});
