# Verifier notes — assets/v6-extra-a.js core (V6XA)

Run: `node verify/verify-a.mjs`. The log is written to `verify/verify-a.log`; the exit code is 1 on any failure.
Seed 0xC5ED211 (mulberry32). Node v22.23.2. Runtime about 5.6 s.
All reference algorithms are independent of the core: string/Int32 sign-extension for integers,
DataView/Float64 bit decoding for floats, binary search over float32 bit patterns with exact BigInt
comparison for RNE encoding, and Number floor/ceil for roundBin.

## Result: ALL PASS (0 failures)

| Section | Checks |
|---|---|
| 1. B2U/B2T exhaustive w=3..8 (+ B2T=B2U-x_{w-1}2^w, TMin/TMax/UMax, Int8) | 1792/1792 |
| 2. bitop: w=4 all a,b,k,ops; w=8 all a,b (and/or/xor), all a×k (shifts/unary); ub flag, src mapping + recomputation, shl/lshr/ashr identities | 665856/665856 (218368 calls) |
| 3. inc/sext (to w..w+4)/trunc (k=1..w) exhaustive w=3..8 | 16224/16224 |
| 4. f32Decode: 10 presets with exact decimal strings (2^-149 via BigInt 5^149), 30000 random u32 + 4608 exponent-boundary patterns vs DataView; ratToDecimal exact + round-trip; ratToSci | 241729/241729 |
| 5. f32Encode: 30000 random decimal strings (1–25 digits, 10^-50..10^40, signs, varied formats) + 37 boundary/halfway strings + 600 crafted halfway±ε strings vs exact BigInt RNE and Math.fround; dir, cls, value, exact, err=value-exact, lo≤\|x\|≤hi, \|err\|≤ulp/2, specials, garbage | 271193/271193 |
| 6. roundBin/roundInfo/parseBinary/fixBin exhaustive (int 0..7, ≤8 frac bits, ±, k=0..6, 4 modes) + 20 textbook checks (CS:APP 2.4.4, PP 2.50, Fig 2.37) | 758202/758202 |

## Double-rounding cases (widget == exact reference, Math.fround(Number(s)) differs; not failures): 317

- 8 come from the explicit boundary strings, for example:
  - `1+2^-24+2^-60` → widget 0x3F800001, fround 0x3F800000
  - `1+3·2^-24-2^-60` → widget 0x3F800001, fround 0x3F800002
  - `2^128-2^103-1` → widget 0x7F7FFFFF, fround 0x7F800000
  - `2^-150+2^-210` → widget 0x00000001, fround 0
  - `2^-126-2^-150-2^-190` → widget 0x007FFFFF, fround 0x00800000
- 309 come from the 600 crafted halfway±ε strings.
- 0 come from the 30000 plain random strings.

The first 25 cases are listed in the log.

## Core discrepancies found: none

## Sensitivity check

The suite was run against 5 hand-mutated copies of the core in /tmp, selected with the `VERIFY_CORE` env var.
The mutations were: RNE ties→always up, a broken `not` bit, roundBin even→always up on ties, tOverflow=carryOut, and the denormal E off by one.
Every mutation was detected (exit 1, with failures in the expected section).
