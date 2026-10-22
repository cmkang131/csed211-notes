// verify/verify-a.mjs — independent numerical verification of assets/v6-extra-a.js (core V6XA).
// Run: node verify/verify-a.mjs   (Node >= 18, no npm packages)
// Writes the log to verify/verify-a.log. Exit code 1 if any section has failures.
// All reference algorithms below are written independently of the core (black-box testing).
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const core = require(process.env.VERIFY_CORE || path.join(HERE, "..", "assets", "v6-extra-a.js")); // VERIFY_CORE: mutation testing only

const SEED = 0xC5ED211;
const N_DECODE_RANDOM = 30000;
const N_ENCODE_RANDOM = 30000;
const N_DR_CRAFTED = 600;
const T0 = Date.now();

/* ------------------------------------------------------------------ */
/* logging / section bookkeeping                                       */
/* ------------------------------------------------------------------ */
const out = [];
function log(s = "") { out.push(s); console.log(s); }
const sections = [];
function section(name) {
  const S = { name, pass: 0, fail: 0, fails: [], notes: [] };
  S.check = (ok, detail) => {
    if (ok) S.pass++;
    else { S.fail++; if (S.fails.length < 10) S.fails.push(typeof detail === "function" ? detail() : detail); }
    return ok;
  };
  sections.push(S);
  return S;
}
function report(S) {
  const tot = S.pass + S.fail;
  log(`[${S.fail === 0 ? "PASS" : "FAIL"}] ${S.name}: ${S.pass}/${tot} passed, ${S.fail} failed`);
  for (const n of S.notes) log("    note: " + n);
  for (const f of S.fails) log("    FAIL: " + f);
}
const J = (o) => JSON.stringify(o, (k, v) => (typeof v === "bigint" ? v.toString() + "n" : v));

/* deterministic PRNG (mulberry32) */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1)); // inclusive
const ru32 = () => (Math.floor(rnd() * 65536) * 65536 + Math.floor(rnd() * 65536)) >>> 0;

/* ------------------------------------------------------------------ */
/* independent BigInt helpers                                          */
/* ------------------------------------------------------------------ */
const absB = (a) => (a < 0n ? -a : a);
function gcdB(a, b) { a = absB(a); b = absB(b); while (b) [a, b] = [b, a % b]; return a; }
function reduce(n, d) { if (d < 0n) { n = -n; d = -d; } const g = gcdB(n, d) || 1n; return { num: n / g, den: d / g }; }
const ratEq = (a, b) => a.num * b.den === b.num * a.den;
const ratCmp = (a, b) => { const l = a.num * b.den, r = b.num * a.den; return l < r ? -1 : l > r ? 1 : 0; };
const ratSub = (a, b) => reduce(a.num * b.den - b.num * a.den, a.den * b.den);
const ratAbs = (a) => ({ num: absB(a.num), den: a.den });
const hexU = (u) => "0x" + (u >>> 0).toString(16).toUpperCase().padStart(8, "0");

/* exact rational of a double, from its IEEE-754 binary64 bits */
const dv8 = new DataView(new ArrayBuffer(8));
function doubleToRat(d) {
  dv8.setFloat64(0, d);
  const hi = dv8.getUint32(0), lo = dv8.getUint32(4);
  const neg = hi >>> 31 === 1, ex = (hi >>> 20) & 0x7FF;
  let mant = (BigInt(hi & 0xFFFFF) << 32n) | BigInt(lo);
  let p;
  if (ex === 0) p = -1074; else { mant |= 1n << 52n; p = ex - 1075; }
  let n = mant, den = 1n;
  if (p >= 0) n <<= BigInt(p); else den = 1n << BigInt(-p);
  const r = reduce(neg ? -n : n, den);
  return r;
}
/* float32 bits -> double via DataView */
const dv4 = new DataView(new ArrayBuffer(4));
function bitsToF(u) { dv4.setUint32(0, u >>> 0); return dv4.getFloat32(0); }
function fToBits(f) { dv4.setFloat32(0, f); return dv4.getUint32(0); }

/* my own exact decimal expansion of n/d when d = 2^a 5^b (scale by the needed power of ten) */
function dyadicDecimal(n, d) {
  const r = reduce(n, d);
  let k = 0, t = r.den, p10 = 1n;
  while (absB(r.num) * p10 % t !== 0n) { k++; p10 *= 10n; if (k > 2000) return null; }
  const q = absB(r.num) * p10 / t;
  let s = q.toString();
  if (k > 0) { s = s.padStart(k + 1, "0"); s = s.slice(0, s.length - k) + "." + s.slice(s.length - k); }
  return (r.num < 0n ? "-" : "") + s;
}

/* my own decimal-string parser -> exact rational (or special) */
function myParseDecimal(str) {
  let s = str.trim(), neg = false;
  if (s[0] === "+" || s[0] === "-") { neg = s[0] === "-"; s = s.slice(1); }
  const low = s.toLowerCase();
  if (low === "inf" || low === "infinity") return { special: "inf", neg };
  if (low === "nan") return { special: "nan", neg };
  let exp = 0;
  const ei = low.indexOf("e");
  if (ei >= 0) { const es = s.slice(ei + 1); if (!/^[+-]?[0-9]+$/.test(es)) return null; exp = Number(es); s = s.slice(0, ei); }
  const parts = s.split(".");
  if (parts.length > 2) return null;
  const ip = parts[0], fp = parts.length === 2 ? parts[1] : "";
  if (!/^[0-9]*$/.test(ip) || !/^[0-9]*$/.test(fp) || ip.length + fp.length === 0) return null;
  let num = BigInt(ip + fp || "0"), den = 1n;
  const sc = exp - fp.length;
  if (sc >= 0) num *= 10n ** BigInt(sc); else den = 10n ** BigInt(-sc);
  return { neg, ...reduce(num, den) };
}

/* exact value of a non-negative float32 magnitude pattern p (0..0x7F800000), as m*2^s.
   p = 0x7F800000 maps naturally to 2^128 (used as the "next float" above max finite). */
function magVal(p) {
  const e = Math.floor(p / 0x800000), f = p % 0x800000;
  if (e === 0) return { m: BigInt(f), s: -149 };
  return { m: BigInt(f + 0x800000), s: e - 150 };
}
function magRat(p) { const v = magVal(p); return v.s >= 0 ? { num: v.m << BigInt(v.s), den: 1n } : reduce(v.m, 1n << BigInt(-v.s)); }
/* compare (sum of up to two magVals) * c  vs  N/D  -> sign */
function cmpMag(p, N, D) { // val(p) vs N/D
  const v = magVal(p);
  let L = v.m * D, R = N;
  if (v.s >= 0) L <<= BigInt(v.s); else R <<= BigInt(-v.s);
  return L < R ? -1 : L > R ? 1 : 0;
}
/* reference RNE: binary search over float bit patterns (monotone) */
function refRoundMag(N, D) { // N/D >= 0
  if (N === 0n) return { bits: 0, exact: true, tie: false };
  let lo = 0, hi = 0x7F800000;
  while (lo < hi) { const mid = Math.floor((lo + hi + 1) / 2); if (cmpMag(mid, N, D) <= 0) lo = mid; else hi = mid - 1; }
  const p = lo;
  if (cmpMag(p, N, D) === 0) return { bits: p, exact: true, tie: false };
  if (p === 0x7F800000) return { bits: p, exact: false, tie: false };
  // compare 2x with val(p)+val(p+1)
  const a = magRat(p), b = magRat(p + 1);
  const sum = reduce(a.num * b.den + b.num * a.den, a.den * b.den);
  const c = ratCmp({ num: 2n * N, den: D }, sum);
  if (c < 0) return { bits: p, exact: false, tie: false, lo: p };
  if (c > 0) return { bits: p + 1, exact: false, tie: false, lo: p };
  return { bits: p % 2 === 0 ? p : p + 1, exact: false, tie: true, lo: p };
}

/* ================================================================== */
/* 1. B2U / B2T                                                         */
/* ================================================================== */
{
  const S = section("1. B2U/B2T exhaustive w=3..8");
  for (let w = 3; w <= 8; w++) {
    let tmin = Infinity, tmax = -Infinity, umax = -Infinity;
    const seenT = new Set();
    for (let x = 0; x < 1 << w; x++) {
      const s = x.toString(2).padStart(w, "0");
      let u = 0; for (const ch of s) u = u * 2 + (ch === "1" ? 1 : 0);           // string-based
      const t = (x << (32 - w)) >> (32 - w);                                      // int32 sign extension
      const gu = core.b2u(x, w), gt = core.b2t(x, w);
      S.check(gu === u, () => `b2u(${s},${w}) got ${gu} exp ${u}`);
      S.check(gt === t, () => `b2t(${s},${w}) got ${gt} exp ${t}`);
      S.check(gt === gu - (s[0] === "1" ? 2 ** w : 0), () => `B2T!=B2U-x_{w-1}2^w for ${s}`);
      if (w === 8) S.check(gt === new Int8Array([x])[0], () => `b2t vs Int8 for ${x}`);
      tmin = Math.min(tmin, gt); tmax = Math.max(tmax, gt); umax = Math.max(umax, gu); seenT.add(gt);
    }
    S.check(tmin === -(2 ** (w - 1)), `w=${w} TMin got ${tmin}`);
    S.check(tmax === 2 ** (w - 1) - 1, `w=${w} TMax got ${tmax}`);
    S.check(umax === 2 ** w - 1, `w=${w} UMax got ${umax}`);
    S.check(seenT.size === 2 ** w, `w=${w} B2T not bijective`);
  }
  report(S);
}

/* ================================================================== */
/* 2. bitop                                                             */
/* ================================================================== */
{
  const S = section("2. bitop (w=4 all a,b,k,ops; w=8 binary all a,b; shifts/unary all a,k) + src + identities");
  const SH = new Set(["shl", "lshr", "ashr"]);
  function ref(op, a, b, k, w) {
    const m = (1 << w) - 1, sx = (a << (32 - w)) >> (32 - w);
    switch (op) {
      case "not": return ~a & m;
      case "lnot": return a === 0 ? 1 : 0;
      case "and": return a & b;
      case "or": return a | b;
      case "xor": return a ^ b;
      case "shl": return k >= w ? 0 : (a << k) & m;
      case "lshr": return k >= w ? 0 : a >>> k;
      case "ashr": return k >= w ? (sx < 0 ? m : 0) : (sx >> k) & m;
    }
  }
  const bitOf = (v, i) => Math.floor(v / 2 ** i) % 2;
  function checkOne(op, a, b, k, w) {
    const g = core.bitop(op, a, b, k, w), e = ref(op, a, b, k, w), tag = `bitop(${op},a=${a},b=${b},k=${k},w=${w})`;
    S.check(g.r === e, () => `${tag} r got ${g.r} exp ${e}`);
    S.check(g.ub === (SH.has(op) && k >= w), () => `${tag} ub got ${g.ub}`);
    // identities
    if (op === "shl") S.check(g.r === (a * 2 ** k) % 2 ** w, () => `${tag} shl identity`);
    if (op === "lshr") S.check(g.r === Math.floor(a / 2 ** k), () => `${tag} lshr identity`);
    if (op === "ashr") {
      const t = a >= 2 ** (w - 1) ? a - 2 ** w : a, q = Math.floor(t / 2 ** k), pat = ((q % 2 ** w) + 2 ** w) % 2 ** w;
      S.check(g.r === pat, () => `${tag} ashr identity got ${g.r} exp ${pat}`);
    }
    // src: structural expectation + recomputation reproduces r
    let ok = Array.isArray(g.src) && g.src.length === w, why = "src length";
    if (ok) {
      let rr = 0;
      for (let i = 0; i < w && ok; i++) {
        const s = g.src[i], get = ([nm, j]) => bitOf(nm === "A" ? a : b, j);
        let v;
        // expected mapping
        let expFrom, expFill = null, expSign = false;
        if (op === "not") expFrom = [["A", i]];
        else if (op === "and" || op === "or" || op === "xor") expFrom = [["A", i], ["B", i]];
        else if (op === "lnot") { if (i === 0) expFrom = Array.from({ length: w }, (_, j) => ["A", j]); else { expFrom = []; expFill = 0; } }
        else if (op === "shl") { if (i - k >= 0) expFrom = [["A", i - k]]; else { expFrom = []; expFill = 0; } }
        else if (op === "lshr") { if (i + k < w) expFrom = [["A", i + k]]; else { expFrom = []; expFill = 0; } }
        else if (op === "ashr") { if (i + k < w) expFrom = [["A", i + k]]; else { expFrom = [["A", w - 1]]; expFill = bitOf(a, w - 1); expSign = true; } }
        const sortKey = (arr) => JSON.stringify([...arr].map((x) => x.join(":")).sort());
        if (sortKey(s.from) !== sortKey(expFrom) || s.fill !== expFill || !!s.sign !== expSign) { ok = false; why = `src[${i}] = ${J(s)} expected from=${J(expFrom)} fill=${expFill} sign=${expSign}`; break; }
        // recompute from src only
        if (s.sign) v = get(s.from[0]);
        else if (s.fill !== null) v = s.fill;
        else if (op === "not") v = 1 - get(s.from[0]);
        else if (op === "lnot") v = s.from.every((x) => get(x) === 0) ? 1 : 0;
        else if (op === "and") v = get(s.from[0]) & get(s.from[1]);
        else if (op === "or") v = get(s.from[0]) | get(s.from[1]);
        else if (op === "xor") v = get(s.from[0]) ^ get(s.from[1]);
        else v = get(s.from[0]);
        if (s.sign && s.fill !== v) { ok = false; why = `src[${i}] sign fill ${s.fill} != sign bit ${v}`; break; }
        rr += v * 2 ** i;
      }
      if (ok && rr !== g.r) { ok = false; why = `recomputed ${rr} != r ${g.r}`; }
    }
    S.check(ok, () => `${tag} ${why}`);
  }
  const OPS = ["not", "lnot", "and", "or", "xor", "shl", "lshr", "ashr"];
  let calls = 0;
  for (const op of OPS) for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) for (let k = 0; k <= 4; k++) { checkOne(op, a, b, k, 4); calls++; }
  for (const op of ["and", "or", "xor"]) for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) { checkOne(op, a, b, 0, 8); calls++; }
  for (const op of ["not", "lnot", "shl", "lshr", "ashr"]) for (let a = 0; a < 256; a++) for (let k = 0; k <= 8; k++) { checkOne(op, a, ri(0, 255), k, 8); calls++; }
  S.notes.push(`${calls} bitop calls`);
  report(S);
}

/* ================================================================== */
/* 3. inc / sext / trunc                                                */
/* ================================================================== */
{
  const S = section("3. inc/sext/trunc exhaustive w=3..8");
  for (let w = 3; w <= 8; w++) {
    const M = 2 ** w, m = M - 1;
    const T = (x, ww) => (x >= 2 ** (ww - 1) ? x - 2 ** ww : x);
    for (let x = 0; x < M; x++) {
      const g = core.inc(x, w), tag = `inc(${x},${w})`;
      const r = (x + 1) % M, carries = (x ^ (x + 1)) & m;
      S.check(g.r === r, () => `${tag} r got ${g.r} exp ${r}`);
      S.check(g.carryOut === (x === m ? 1 : 0), () => `${tag} carryOut ${g.carryOut}`);
      S.check(g.carries === carries, () => `${tag} carries got ${g.carries.toString(2)} exp ${carries.toString(2)}`);
      S.check((g.carries & 1) === 1, () => `${tag} carries bit0 not set`);
      S.check(g.uWrap === (x === m), () => `${tag} uWrap ${g.uWrap}`);
      S.check(g.tOverflow === (x === 2 ** (w - 1) - 1), () => `${tag} tOverflow ${g.tOverflow}`);
      S.check(g.uWrap ? r === 0 : r === x + 1, () => `${tag} unsigned semantics`);
      S.check(g.tOverflow ? T(r, w) === -(2 ** (w - 1)) : T(r, w) === T(x, w) + 1, () => `${tag} signed semantics`);
      for (let w2 = w; w2 <= w + 4; w2++) {
        const gs = core.sext(x, w, w2), es = ((x << (32 - w)) >> (32 - w)) & (2 ** w2 - 1);
        S.check(gs === es, () => `sext(${x},${w},${w2}) got ${gs} exp ${es}`);
        S.check(T(gs, w2) === T(x, w), () => `sext(${x},${w},${w2}) B2T not preserved`);
      }
      for (let k = 1; k <= w; k++) {
        const gt = core.trunc(x, w, k), U = x % 2 ** k;
        S.check(gt === U, () => `trunc(${x},${w},${k}) got ${gt} exp ${U}`);
        S.check(core.b2t(gt, k) === T(U, k), () => `trunc(${x},${w},${k}) T != U2T_k`);
      }
    }
  }
  report(S);
}

/* ================================================================== */
/* 4. f32Decode                                                         */
/* ================================================================== */
const pow5 = (k) => 5n ** BigInt(k);
{
  const S = section("4. f32Decode presets + random + exponent boundaries vs DataView");
  const exactStrDyadic = (mant, k) => { // mant * 2^-k  = mant*5^k / 10^k  (computed independently)
    let s = (mant * pow5(k)).toString().padStart(k + 1, "0");
    s = s.slice(0, s.length - k) + "." + s.slice(s.length - k);
    return s.replace(/0+$/, "").replace(/\.$/, "");
  };
  const presets = [
    ["+0", 0x00000000, "zero", "0"],
    ["-0", 0x80000000, "zero", "0"],
    ["minDenorm", 0x00000001, "denormal", exactStrDyadic(1n, 149)],
    ["maxDenorm", 0x007FFFFF, "denormal", exactStrDyadic((1n << 23n) - 1n, 149)],
    ["minNorm", 0x00800000, "normal", exactStrDyadic(1n, 126)],
    ["one", 0x3F800000, "normal", "1"],
    ["0.1", 0x3DCCCCCD, "normal", "0.100000001490116119384765625"],
    ["maxFinite", 0x7F7FFFFF, "normal", "340282346638528859811704183484516925440"],
    ["+inf", 0x7F800000, "inf", null],
    ["nan", 0x7FC00000, "nan", null],
  ];
  // sanity of my own independent strings against well-known digits
  S.check(presets[2][3].startsWith("0." + "0".repeat(44) + "140129846432481707092372958328991613128026194187651577175706828388979108268586060148663818836212158203125")
    && presets[2][3].length === 2 + 44 + 105, "self-check 2^-149 digits");
  S.check(presets[4][3].startsWith("0." + "0".repeat(37) + "11754943508222875079687365372222456778186655567720875215087517062784172594547271728515625"), "self-check 2^-126 digits");
  S.check((2n ** 128n - 2n ** 104n).toString() === presets[7][3], "self-check max finite integer");
  for (const [name, u, cls, str] of presets) {
    const g = core.f32Decode(u);
    S.check(g.cls === cls, () => `preset ${name} cls ${g.cls} exp ${cls}`);
    S.check(g.s === u >>> 31, () => `preset ${name} sign`);
    if (str !== null) {
      const d = core.ratToDecimal(g.num, g.den), want = (u >>> 31 && str !== "0" ? "-" : "") + str;
      S.check(d.str === want && d.exact === true, () => `preset ${name} ratToDecimal got ${d.str} exp ${want}`);
      const sc = core.ratToSci(g.num, g.den), f = bitsToF(u);
      S.check(Number(sc.mant + "e" + sc.exp) === f && sc.exact === true && sc.digits === sc.mant.replace(/[-.]/g, "").length,
        () => `preset ${name} ratToSci ${J(sc)}`);
      if (name === "minDenorm") S.check(sc.exp === -45 && sc.mant.startsWith("1.40129846432481707"), `minDenorm sci ${J(sc)}`);
      if (name === "maxFinite") S.check(sc.exp === 38 && sc.mant.startsWith("3.40282346638528859811704183484516925440".slice(0, 20)), `maxFinite sci ${J(sc)}`);
      if (name === "0.1") S.check(sc.exp === -1 && sc.mant === "1.00000001490116119384765625", `0.1 sci ${J(sc)}`);
      if (name === "one") S.check(sc.exp === 0 && sc.mant === "1" && sc.digits === 1, `one sci ${J(sc)}`);
    } else {
      S.check(g.num === undefined && g.den === undefined, () => `preset ${name} should have no num/den`);
    }
  }
  // random + boundary inputs
  const inputs = [];
  for (let i = 0; i < N_DECODE_RANDOM; i++) inputs.push(ru32());
  const fset = [0, 1, 2, 0x3FFFFF, 0x400000, 0x400001, 0x7FFFFE, 0x7FFFFF];
  for (let e = 0; e < 256; e++) for (const f of fset.concat([ri(0, 0x7FFFFF)])) for (const s of [0, 1]) inputs.push(((s << 31) | (e << 23) | f) >>> 0);
  let nb = 0;
  for (const u of inputs) {
    const g = core.f32Decode(u), d = bitsToF(u), tag = `f32Decode(${hexU(u)})`;
    const cls = Number.isNaN(d) ? "nan" : !Number.isFinite(d) ? "inf" : d === 0 ? "zero" : Math.abs(d) < 2 ** -126 ? "denormal" : "normal";
    S.check(g.cls === cls, () => `${tag} cls ${g.cls} exp ${cls}`);
    const sgn = Number.isNaN(d) ? u >>> 31 : (d < 0 || Object.is(d, -0)) ? 1 : 0;
    S.check(g.s === sgn, () => `${tag} s ${g.s} exp ${sgn}`);
    if (cls === "nan" || cls === "inf") { S.check(g.num === undefined, () => `${tag} num should be absent`); nb++; continue; }
    // field-level: Mnum * 2^(E-23) == |d|  (double arithmetic is exact here)
    S.check(Number(g.Mnum) * 2 ** (g.E - 23) === Math.abs(d), () => `${tag} Mnum/E mismatch Mnum=${g.Mnum} E=${g.E}`);
    S.check(cls === "normal" ? (g.Mnum >= 1n << 23n && g.Mnum < 1n << 24n && g.E === g.e - 127) : (g.Mnum < 1n << 23n && g.E === -126),
      () => `${tag} Mnum range/E rule`);
    S.check(g.f === Number(g.Mnum % (1n << 23n)) && g.e === ((fToBits(Math.abs(d)) >>> 23)), () => `${tag} e/f fields`);
    const R = doubleToRat(d);
    const want = (sgn && R.num === 0n) ? R : R; // zero sign lives in s
    S.check(g.num === want.num && g.den === want.den, () => `${tag} rational ${g.num}/${g.den} exp ${want.num}/${want.den}`);
    const rd = core.ratToDecimal(g.num, g.den), mine = dyadicDecimal(R.num, R.den);
    S.check(rd.exact === true && Number(rd.str) === d && rd.str === mine, () => `${tag} ratToDecimal ${rd.str} exp ${mine}`);
    nb++;
  }
  S.notes.push(`${N_DECODE_RANDOM} random u32 + ${inputs.length - N_DECODE_RANDOM} exponent-boundary patterns (all 256 exponents x 9 fractions x 2 signs)`);
  report(S);
}

/* ================================================================== */
/* 5. f32Encode                                                         */
/* ================================================================== */
const drCases = [];
{
  const S = section("5. f32Encode vs exact BigInt RNE reference and Math.fround");
  const strs = [];
  const boundary = [];
  const dec = (n, d) => dyadicDecimal(n, d);
  const P = (k) => 1n << BigInt(k);
  // halfway & boundary points (exact decimals of dyadic rationals)
  boundary.push([dec(P(24) + 1n, P(24)), 0x3F800000, "1+2^-24 tie->even 1.0"]);
  boundary.push([dec(P(24) + 3n, P(24)), 0x3F800002, "1+3*2^-24 tie->even 1+2^-22"]);
  boundary.push([dec(P(128) - P(103), 1n), 0x7F800000, "(2^128-2^103) halfway maxFinite/2^128 -> +inf"]);
  boundary.push([dec(P(128) - P(103) - 1n, 1n), 0x7F7FFFFF, "2^128-2^103-1 -> maxFinite"]);
  boundary.push([dec((P(128) - P(103)) * P(80) - 1n, P(80)), 0x7F7FFFFF, "2^128-2^103-2^-80 -> maxFinite"]);
  boundary.push(["-" + dec(P(128) - P(103), 1n), 0xFF800000, "-(2^128-2^103) -> -inf"]);
  boundary.push([dec(1n, P(150)), 0x00000000, "2^-150 tie->0"]);
  boundary.push(["-" + dec(1n, P(150)), 0x80000000, "-2^-150 tie->-0"]);
  boundary.push([dec(P(60) + 1n, P(210)), 0x00000001, "2^-150+2^-210 -> minDenorm"]);
  boundary.push([dec(1n, P(150)) + "0000000000000000000000000000000001", 0x00000001, "2^-150 + 10^-k -> minDenorm"]);
  boundary.push([dec(3n, P(150)), 0x00000002, "3*2^-150 tie->2*2^-149"]);
  boundary.push([dec(5n, P(150)), 0x00000002, "5*2^-150 tie->2*2^-149"]);
  boundary.push([dec(1n, P(126)), 0x00800000, "2^-126 exact minNormal"]);
  boundary.push([dec(P(24) - 1n, P(150)), 0x00800000, "2^-126-2^-150 tie (maxDenorm odd) -> minNormal"]);
  boundary.push([dec((P(24) - 1n) * P(40) - 1n, P(190)), 0x007FFFFF, "2^-126-2^-150-2^-190 -> maxDenorm"]);
  boundary.push([dec(P(24) + 1n, P(150)), 0x00800000, "2^-126+2^-150 tie->minNormal"]);
  boundary.push([dec(P(24) + 3n, P(150)), 0x00800002, "2^-126+3*2^-150 tie->0x800002"]);
  boundary.push([dec(P(23) - 1n, P(149)), 0x007FFFFF, "maxDenorm exact"]);
  boundary.push(["1e-45", 0x00000001, ""]); boundary.push(["1.4e-45", 0x00000001, ""]); boundary.push(["7e-46", 0x00000000, ""]);
  boundary.push(["0.1", 0x3DCCCCCD, ""]); boundary.push(["-0", 0x80000000, ""]); boundary.push(["0", 0, ""]);
  boundary.push(["1e39", 0x7F800000, ""]); boundary.push(["-1e39", 0xFF800000, ""]);
  boundary.push(["3.4028235e38", 0x7F7FFFFF, ""]); boundary.push(["3.4028236e38", 0x7F800000, ""]);
  boundary.push([".5", 0x3F000000, ""]); boundary.push(["5.", 0x40A00000, ""]); boundary.push(["-1.5e-3", fToBits(Math.fround(-1.5e-3)), ""]);
  boundary.push(["1E-45", 0x00000001, ""]); boundary.push(["1e-400", 0, ""]); boundary.push(["1e400", 0x7F800000, ""]);
  // crafted double-rounding triggers (halfway +/- tiny beyond double precision)
  boundary.push([dec(P(60) + P(36) + 1n, P(60)), 0x3F800001, "1+2^-24+2^-60 (double-rounding trap)"]);
  boundary.push([dec(P(60) + 3n * P(36) - 1n, P(60)), 0x3F800001, "1+3*2^-24-2^-60 (double-rounding trap)"]);
  boundary.push([dec(P(200) + P(176) + 1n, P(200)), 0x3F800001, "1+2^-24+2^-200"]);
  for (const [s, bits] of boundary) strs.push({ s, expect: bits });
  // random crafted double-rounding candidates: (float + ulp/2) +/- 2^-(t) with t well beyond double precision
  for (let i = 0; i < N_DR_CRAFTED; i++) {
    const p = ri(1, 0x7F7FFFFE), a = magRat(p), b = magRat(p + 1);
    const mid = reduce(a.num * b.den + b.num * a.den, 2n * a.den * b.den);
    const ulp = ratSub(b, a);
    const eps = { num: ulp.num, den: ulp.den << BigInt(ri(30, 45)) };   // ulp * 2^-(30..45): below double resolution
    const x = rnd() < 0.5 ? reduce(mid.num * eps.den + eps.num * mid.den, mid.den * eps.den)
                          : reduce(mid.num * eps.den - eps.num * mid.den, mid.den * eps.den);
    strs.push({ s: (rnd() < 0.3 ? "-" : "") + dec(x.num, x.den), expect: null, crafted: true });
  }
  // random decimal strings
  for (let i = 0; i < N_ENCODE_RANDOM; i++) {
    const nd = ri(1, 25);
    let digits = "";
    for (let j = 0; j < nd; j++) digits += String(j === 0 && rnd() < 0.9 ? ri(1, 9) : ri(0, 9));
    const E10 = ri(-50, 40);                      // decimal exponent of leading digit
    const pos = ri(0, nd);                        // decimal point position in the digit string
    const e = E10 - (pos - 1);
    let mant = pos === nd ? digits + (rnd() < 0.3 ? "." : "") : (pos === 0 ? (rnd() < 0.5 ? "." : "0.") : "") + (pos === 0 ? digits : digits.slice(0, pos) + "." + digits.slice(pos));
    let s;
    const style = rnd();
    if (style < 0.15 && Math.abs(E10) <= 25) { // plain decimal, no exponent
      const all = digits; let k = E10 + 1;
      if (k <= 0) s = "0." + "0".repeat(-k) + all;
      else if (k >= all.length) s = all + "0".repeat(k - all.length);
      else s = all.slice(0, k) + "." + all.slice(k);
    } else s = mant + (rnd() < 0.5 ? "e" : "E") + (e >= 0 && rnd() < 0.3 ? "+" : "") + e;
    const sg = rnd(); if (sg < 0.4) s = "-" + s; else if (sg < 0.45) s = "+" + s;
    strs.push({ s, expect: null });
  }
  const errS = [];
  for (const { s, expect, crafted } of strs) {
    const tag = `f32Encode("${s.length > 80 ? s.slice(0, 40) + "..." + s.slice(-30) + `[len ${s.length}]` : s}")`;
    const mp = myParseDecimal(s), cp = core.parseDecimal(s);
    S.check(mp && cp && !cp.special && cp.neg === mp.neg && cp.num * mp.den === mp.num * cp.den, () => `parseDecimal("${s}") ${J(cp)} exp ${J(mp)}`);
    const g = core.f32Encode(s);
    if (g.error) { S.check(false, `${tag} returned error ${g.error}`); continue; }
    const rr = refRoundMag(mp.num, mp.den);
    const refBits = ((mp.neg ? 0x80000000 : 0) + rr.bits) >>> 0;
    if (expect !== null) S.check(refBits === (expect >>> 0), () => `SELF-CHECK reference ${tag} ref ${hexU(refBits)} expected ${hexU(expect)}`);
    const okRef = S.check(g.bits === refBits, () => `${tag} bits ${hexU(g.bits)} exp(ref) ${hexU(refBits)}`);
    const fr = fToBits(Math.fround(Number(s)));
    if (fr !== g.bits) {
      if (okRef) drCases.push({ s, widget: g.bits, fround: fr, crafted: !!crafted });
      else S.check(false, () => `${tag} differs from BOTH ref and fround (fround ${hexU(fr)})`);
    }
    // direction label
    const mag = rr.bits, isInf = mag === 0x7F800000;
    let dir;
    if (isInf) dir = "overflow";
    else if (rr.exact) dir = "exact";
    else dir = (mag > rr.lo ? "up" : "down") + (rr.tie ? "-tie" : "");
    S.check(g.dir === dir, () => `${tag} dir ${g.dir} exp ${dir}`);
    const clsE = isInf ? "inf" : mag === 0 ? "zero" : mag < 0x800000 ? "denormal" : "normal";
    S.check(g.cls === clsE, () => `${tag} cls ${g.cls} exp ${clsE}`);
    if (isInf) continue;
    // value / exact / err rational checks
    const X = { num: mp.neg ? -mp.num : mp.num, den: mp.den };
    const Vabs = magRat(mag), V = { num: mp.neg ? -Vabs.num : Vabs.num, den: Vabs.den };
    S.check(g.value && ratEq(g.value, V), () => `${tag} value ${J(g.value)} exp ${J(V)}`);
    S.check(g.exact && ratEq(g.exact, X), () => `${tag} exact ${J(g.exact)} exp ${J(X)}`);
    S.check(g.err && ratEq(g.err, ratSub(V, X)), () => `${tag} err != value-exact`);
    // lo/hi bracket (magnitudes), same sign
    const sgnBit = mp.neg ? 1 : 0;
    const loM = g.lo & 0x7FFFFFFF, hiM = g.hi & 0x7FFFFFFF;
    const okSign = (g.lo >>> 31) === sgnBit && (g.hi >>> 31) === sgnBit;
    const AX = ratAbs(X), Lr = magRat(loM), Hr = magRat(hiM);
    const okBr = okSign && ratCmp(Lr, AX) <= 0 && ratCmp(AX, Hr) <= 0 && (rr.exact ? loM === hiM && loM === mag : hiM === loM + 1) && (mag === loM || mag === hiM);
    S.check(okBr, () => `${tag} lo/hi bracket wrong lo=${hexU(g.lo)} hi=${hexU(g.hi)} bits=${hexU(g.bits)}`);
    // |err| <= half ulp
    if (!rr.exact) {
      const ulp = ratSub(Hr, Lr), e2 = ratAbs(ratSub(V, X));
      S.check(ratCmp({ num: 2n * e2.num, den: e2.den }, ulp) <= 0, () => `${tag} |err| > ulp/2`);
    } else S.check(g.err.num === 0n, () => `${tag} exact but err != 0`);
  }
  // specials and garbage
  const spec = [["inf", 0x7F800000, "inf"], ["-inf", 0xFF800000, "inf"], ["infinity", 0x7F800000, "inf"], ["nan", null, "nan"], ["NaN", null, "nan"]];
  for (const [s, bits, cls] of spec) {
    const g = core.f32Encode(s);
    S.check(g.special === true && g.cls === cls && (bits === null ? Number.isNaN(bitsToF(g.bits)) : g.bits === bits), () => `f32Encode("${s}") ${J(g)}`);
  }
  for (const s of ["", "abc", "1.2.3", "e5", "--1", "1e", "0x10", "."]) {
    const g = core.f32Encode(s);
    S.check(!!g.error, () => `f32Encode("${s}") should be error, got ${J(g)}`);
  }
  const dc = drCases.filter((c) => c.crafted).length;
  S.notes.push(`${N_ENCODE_RANDOM} random decimal strings + ${boundary.length} boundary strings + ${N_DR_CRAFTED} crafted halfway+/-eps strings`);
  S.notes.push(`double-rounding cases (widget == exact reference, Math.fround(Number(s)) differs; NOT failures): ${drCases.length} (crafted: ${dc}, random/boundary: ${drCases.length - dc})`);
  report(S);
  if (drCases.length) {
    log(`    double-rounding cases (first 25 of ${drCases.length}):`);
    for (const c of drCases.slice(0, 25)) {
      const s = c.s.length > 70 ? c.s.slice(0, 40) + "..." + c.s.slice(-20) + ` [len ${c.s.length}]` : c.s;
      log(`      "${s}"  widget/ref ${hexU(c.widget)}  fround ${hexU(c.fround)}${c.crafted ? "  (crafted)" : ""}`);
    }
  }
}

/* ================================================================== */
/* 6. roundBin / roundInfo / parseBinary / fixBin                       */
/* ================================================================== */
{
  const S = section("6. roundBin exhaustive (int 0..7, <=8 frac bits, +/-, k=0..6, 4 modes) + textbook");
  const MODES = ["even", "zero", "up", "down"];
  const mod2 = (n) => ((n % 2) + 2) % 2;
  function refRound(t, mode) { // t = x*2^k exact Number
    const fl = Math.floor(t), ce = Math.ceil(t);
    if (fl === ce) return fl;
    if (mode === "down") return fl;
    if (mode === "up") return ce;
    if (mode === "zero") return t < 0 ? ce : fl;
    const d = t - fl;
    return d < 0.5 ? fl : d > 0.5 ? ce : (mod2(fl) === 0 ? fl : ce);
  }
  function myFixParse(str) { // "-10.01" -> Number
    const neg = str[0] === "-", s = neg ? str.slice(1) : str, [ip, fp = ""] = s.split(".");
    let v = 0; for (const c of ip) v = v * 2 + +c; let sc = 1; for (const c of fp) { sc /= 2; v += +c * sc; }
    return { v: neg ? -v : v, fd: s.includes(".") ? fp.length : 0 };
  }
  let n = 0;
  for (let ipv = 0; ipv <= 7; ipv++) for (let m = 0; m <= 8; m++) for (let fv = 0; fv < 2 ** m; fv++) for (const neg of [false, true]) {
    const s = (neg ? "-" : "") + ipv.toString(2) + (m > 0 ? "." + fv.toString(2).padStart(m, "0") : "");
    const x = (ipv + fv / 2 ** m) * (neg ? -1 : 1);
    const pb = core.parseBinary(s);
    S.check(pb && pb.den === 1n << BigInt(m) && Number(pb.num) / 2 ** m === x && pb.m === m, () => `parseBinary("${s}") ${J(pb)}`);
    if (!pb) continue;
    for (let k = 0; k <= 6; k++) {
      const t = x * 2 ** k;
      const info = core.roundInfo(pb.num, pb.den, k);
      const fl = Math.floor(t), ce = Math.ceil(t), half = t - fl === 0.5;
      S.check(Number(info.lo) === fl && Number(info.hi) === ce && info.exact === (fl === ce) && info.halfway === half && info.above === (t - fl > 0.5),
        () => `roundInfo("${s}",k=${k}) ${J(info)} exp lo=${fl} hi=${ce} halfway=${half}`);
      for (const mode of MODES) {
        const g = core.roundBin(pb.num, pb.den, k, mode), e = refRound(t, mode);
        S.check(g.den === 1n << BigInt(k) && g.num === BigInt(e), () => `roundBin("${s}",k=${k},${mode}) got ${g.num}/2^${k} exp ${e}`);
        S.check(info[mode] === BigInt(e), () => `roundInfo("${s}",k=${k}).${mode} got ${info[mode]} exp ${e}`);
        if (mode === "even" && half) S.check(mod2(Number(g.num)) === 0, () => `roundBin("${s}",k=${k},even) tie result odd ${g.num}`);
        const fb = core.fixBin(g.num, k), back = myFixParse(fb);
        S.check(back.v === e / 2 ** k && back.fd === k, () => `fixBin(${g.num},${k}) = "${fb}"`);
        n++;
      }
    }
  }
  S.notes.push(`${n} (value,k,mode) combinations`);
  // textbook checks
  const tb = [
    // CS:APP 2.4.4 round to nearest quarter (k=2, even)
    ["10.00011", 2, "even", "10.00"], ["10.00110", 2, "even", "10.01"], ["10.11100", 2, "even", "11.00"], ["10.10100", 2, "even", "10.10"],
    // Practice Problem 2.50 (k=1, even)
    ["10.010", 1, "even", "10.0"], ["10.011", 1, "even", "10.1"], ["10.110", 1, "even", "11.0"], ["11.001", 1, "even", "11.0"],
  ];
  // Figure 2.37 (k=0): 1.5, 2.5, -1.5
  const fig = { even: [2, 2, -2], zero: [1, 2, -1], down: [1, 2, -2], up: [2, 3, -1] };
  ["1.1", "10.1", "-1.1"].forEach((v, i) => { for (const md of MODES) tb.push([v, 0, md, (fig[md][i] < 0 ? "-" : "") + Math.abs(fig[md][i]).toString(2)]); });
  for (const [v, k, md, want] of tb) {
    const p = core.parseBinary(v), r = core.roundBin(p.num, p.den, k, md), got = core.fixBin(r.num, k);
    S.check(got === want, () => `textbook ${v} k=${k} ${md}: got ${got} exp ${want}`);
  }
  S.notes.push(`${tb.length} textbook checks (CS:APP 2.4.4, PP 2.50, Fig 2.37)`);
  for (const g of ["", "abc", "1.2", "10.0.1", "-", "2"]) S.check(core.parseBinary(g) === null, () => `parseBinary("${g}") should be null`);
  report(S);
}

/* ================================================================== */
const totalFail = sections.reduce((a, s) => a + s.fail, 0);
log("");
log("==== SUMMARY ====");
log(`seed=0x${SEED.toString(16).toUpperCase()}  N_DECODE_RANDOM=${N_DECODE_RANDOM}  N_ENCODE_RANDOM=${N_ENCODE_RANDOM}  N_DR_CRAFTED=${N_DR_CRAFTED}  node ${process.version}`);
for (const s of sections) log(`  ${s.fail === 0 ? "PASS" : "FAIL"}  ${s.pass}/${s.pass + s.fail}  ${s.name}`);
log(`  double-rounding cases (reference wins, not failures): ${drCases.length}`);
log(`runtime ${((Date.now() - T0) / 1000).toFixed(2)} s`);
log(totalFail === 0 ? "ALL PASS" : `TOTAL FAILURES: ${totalFail}`);
writeFileSync(path.join(HERE, "verify-a.log"), out.join("\n") + "\n");
process.exit(totalFail === 0 ? 0 : 1);
