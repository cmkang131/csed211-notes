(function () {
  "use strict";

  if (!window.V6 || typeof window.V6.register !== "function") return;
  const V6 = window.V6;
  const INK = V6.INK || "#1a1a1a";
  const RED = V6.RED || "#9e2b25";
  const GRID = V6.GRID || "#e8e6e0";
  const FONT = '"Noto Sans KR", sans-serif';

  function node(tag, parent, text, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    if (parent) parent.appendChild(e);
    return e;
  }
  function btn(parent, text, click) {
    const b = node("button", parent, text, "v6-btn");
    b.type = "button";
    b.addEventListener("click", click);
    return b;
  }
  function control(parent, text, min, max, initial, change) {
    const label = node("label", parent);
    node("span", label, text + " ");
    const input = node("input", label);
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    input.value = String(initial);
    const out = node("span", label, String(initial), "v6-val");
    input.addEventListener("input", () => {
      out.textContent = input.value;
      change(Number(input.value));
    });
    return { input, out };
  }
  function status(el) {
    const s = node("div", el, "", "v6-state");
    s.setAttribute("role", "status");
    s.setAttribute("aria-live", "polite");
    return s;
  }
  function error(s, msg) { s.textContent = "안내: " + msg; }
  function integer(x, fallback, lo, hi) {
    const n = Number(x);
    return Number.isSafeInteger(n) && n >= lo && n <= hi ? n : fallback;
  }
  function mask(w) { return (1 << w) - 1; }
  function signed(u, w) { return (u & (1 << (w - 1))) ? u - (1 << w) : u; }
  function hex(u, w) { return "0x" + (u >>> 0).toString(16).toUpperCase().padStart(Math.ceil(w / 4), "0"); }
  function bits(u, w) { return Array.from({ length: w }, (_, p) => (u >>> (w - 1 - p)) & 1); }
  function bitRow(parent, title, w, get, change, sourceLabel) {
    const wrap = node("div", parent);
    const caption = node("div", wrap, title);
    caption.style.margin = "10px 0 4px";
    const strip = node("div", wrap);
    Object.assign(strip.style, { display: "grid", gridTemplateColumns: `repeat(${w}, minmax(0,1fr))`, gap: "3px", maxWidth: "720px" });
    const cells = [];
    for (let p = 0; p < w; p++) {
      const c = node(change ? "button" : "div", strip, "0");
      if (change) {
        c.type = "button";
        c.setAttribute("aria-label", `${sourceLabel || title}의 ${w - p - 1}번 비트 토글`);
        c.addEventListener("click", () => change(p));
      }
      c.dataset.bit = String(w - p - 1);
      Object.assign(c.style, { fontFamily: "monospace", fontSize: "17px", textAlign: "center", border: `1px solid ${INK}`, background: "white", color: INK, padding: "7px 0", cursor: change ? "pointer" : "default", minWidth: "0" });
      cells.push(c);
    }
    const meta = node("div", wrap);
    Object.assign(meta.style, { fontSize: "12px", marginTop: "4px", overflowWrap: "anywhere" });
    function paint(u, modified) {
      const b = bits(u, w);
      cells.forEach((c, i) => {
        c.textContent = String(b[i]);
        c.style.color = modified && modified.includes(i) ? RED : INK;
        c.style.borderColor = INK;
        c.style.background = "white";
      });
      meta.textContent = `${hex(u, w)} · unsigned(부호 없음) ${u} · signed(2의 보수) ${signed(u, w)}`;
    }
    paint(get());
    return { wrap, cells, paint };
  }
  function highlight(row, indices, on) {
    if (!row) return;
    for (const i of indices) if (row.cells[i]) {
      row.cells[i].style.background = on ? GRID : "white";
      row.cells[i].style.borderColor = on ? RED : INK;
    }
  }
  function title(el, text) { if (typeof V6.title === "function") V6.title(el, text); else node("h3", el, text); }

  // 1. Bits and operators: all shift results are explicitly reduced to w bits.
  V6.register("bit-ops", function (el, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    title(el, "비트 연산 놀이터(bitwise / logical)");
    const controls = node("div", el, "", "v6-controls");
    const state = { w: cfg.w === 4 ? 4 : 8, a: 0, b: 0, k: 1, op: "&", recently: [] };
    state.a = integer(cfg.a, 0xA5, 0, mask(state.w));
    state.b = integer(cfg.b, 0x3C, 0, mask(state.w));
    state.k = integer(cfg.k, 1, 0, state.w);
    const widthLabel = node("label", controls, "비트 폭(w) ");
    const widthSelect = node("select", widthLabel);
    [4, 8].forEach(w => { const o = node("option", widthSelect, String(w)); o.value = String(w); });
    widthSelect.value = String(state.w);
    const widthValue = node("span", widthLabel, String(state.w), "v6-val");
    widthSelect.addEventListener("change", () => {
      state.w = Number(widthSelect.value); widthValue.textContent = String(state.w);
      state.a &= mask(state.w); state.b &= mask(state.w);
      state.k = Math.min(state.k, state.w); slider.input.max = String(state.w);
      slider.input.value = String(state.k); slider.out.textContent = String(state.k);
      render();
    });
    const slider = control(controls, "이동 거리(k)", 0, state.w, state.k, k => { state.k = k; paint(); });
    const operations = node("div", el, "", "v6-controls");
    const names = [["~", "~A"], ["!", "!A"], ["&", "A & B"], ["|", "A | B"], ["^", "A ^ B"], ["<<", "A << k"], [">>L", "A >> k (논리)"], [">>A", "A >> k (산술)"]];
    let aRow, bRow, rRow, info;
    names.forEach(([op, name]) => btn(operations, name, () => { state.op = op; paint(); }));
    const host = node("div", el);
    const resultInfo = status(el);
    function compute() {
      const { w, a, b, k, op } = state, m = mask(w);
      let r = 0;
      switch (op) {
        case "~": r = (~a) & m; break;
        case "!": r = !a ? 1 : 0; break;
        case "&": r = a & b; break;
        case "|": r = a | b; break;
        case "^": r = a ^ b; break;
        case "<<": r = (a << k) & m; break;
        case ">>L": r = k >= w ? 0 : a >>> k; break;
        case ">>A": r = k >= w ? (signed(a, w) < 0 ? m : 0) : (signed(a, w) >> k) & m; break;
      }
      return r;
    }
    function origins(p) {
      const i = state.w - p - 1, k = state.k, w = state.w;
      const a = [], b = [];
      function add(which, bit) { if (bit >= 0 && bit < w) which.push(w - bit - 1); }
      if (["~", "!", "&", "|", "^"].includes(state.op)) {
        if (state.op === "!") for (let bit = 0; bit < w; bit++) add(a, bit);
        else add(a, i);
        if (["&", "|", "^"].includes(state.op)) add(b, i);
      } else if (state.op === "<<") add(a, i - k);
      else if (state.op === ">>L") add(a, i + k);
      else add(a, Math.min(i + k, w - 1));
      return { a, b };
    }
    function paint() {
      const r = compute();
      aRow.paint(state.a); bRow.paint(state.b); rRow.paint(r);
      rRow.cells.forEach((c, p) => {
        c.onmouseenter = () => { const src = origins(p); highlight(aRow, src.a, true); highlight(bRow, src.b, true); c.style.color = RED; };
        c.onmouseleave = () => { const src = origins(p); highlight(aRow, src.a, false); highlight(bRow, src.b, false); c.style.color = INK; };
      });
      const desc = {
        "~": `bitwise NOT(~): ${state.w}개 비트를 각각 반전합니다.`,
        "!": `logical NOT(!): A가 0일 때만 1, 나머지는 0입니다. 결과를 ${state.w}비트로 표현합니다.`,
        "&": "AND(&): 두 비트가 모두 1일 때만 1입니다.",
        "|": "OR(|): 둘 중 하나라도 1이면 1입니다.",
        "^": "XOR(^): 두 비트가 다를 때만 1입니다.",
        "<<": `왼쪽 이동(<<): 아래쪽 ${state.k}비트를 0으로 채우고 넘친 비트는 버립니다.`,
        ">>L": `논리적 오른쪽 이동(logical right shift): 왼쪽 ${state.k}자리를 0으로 채웁니다.`,
        ">>A": `산술적 오른쪽 이동(arithmetic right shift): 부호 비트 ${bits(state.a, state.w)[0]}을 복제합니다.`
      }[state.op];
      resultInfo.textContent = desc + "\n결과 비트에 마우스를 올리면 원본 비트를 표시합니다. (k=w는 설명용으로 정의한 결과이며 C에서는 유효하지 않습니다.)";
    }
    function render() {
      host.replaceChildren();
      aRow = bitRow(host, "입력 A (비트를 클릭해 변경)", state.w, () => state.a, p => { state.a ^= 1 << (state.w - p - 1); paint(); }, "A");
      bRow = bitRow(host, "입력 B (비트를 클릭해 변경)", state.w, () => state.b, p => { state.b ^= 1 << (state.w - p - 1); paint(); }, "B");
      rRow = bitRow(host, "결과(result) — 바로 위 입력들과 동일한 열", state.w, compute, null);
      paint();
    }
    render();
  });

  // 2. Two's complement and exact modular arithmetic.
  V6.register("int-rep", function (el, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    title(el, "Two's complement(2의 보수) 탐색기");
    const state = { w: integer(cfg.w, 5, 3, 8), u: 0, message: "", extra: null };
    state.u = integer(cfg.value, 7, 0, mask(state.w));
    const controls = node("div", el, "", "v6-controls");
    const host = node("div", el);
    const info = status(el);
    const diagram = node("div", el);
    const buttons = node("div", el, "", "v6-controls");
    const slider = control(controls, "비트 폭(w)", 3, 8, state.w, w => { state.w = w; state.u &= mask(w); state.extra = null; render(); });
    btn(buttons, "+1 (carry 관찰)", () => {
      const before = state.u, w = state.w;
      const after = (before + 1) & mask(w);
      const carry = before === mask(w);
      const overflow = before === (1 << (w - 1)) - 1;
      state.u = after; state.extra = null;
      state.message = `+1: ${hex(before, w)} → ${hex(after, w)} · 최상위 carry-out=${carry ? 1 : 0} · signed overflow=${overflow ? "발생 (TMax→TMin)" : "없음"}${carry ? " · UMax→0" : ""}`;
      render();
    });
    btn(buttons, "부호 확장(sign extension) w→w+4", () => {
      const w = state.w, sign = state.u & (1 << (w - 1));
      const out = sign ? state.u | (15 << w) : state.u;
      state.extra = { type: "extend", width: w + 4, value: out, original: w };
      state.message = `부호 비트 ${sign ? 1 : 0}을 4개 복제: signed ${signed(state.u, w)} = signed ${signed(out, w + 4)} (값 보존).`;
      render();
    });
    btn(buttons, "truncate(잘라내기) w→4", () => {
      const w = state.w, out = state.u & 15;
      state.extra = { type: "truncate", width: 4, value: out, original: w };
      state.message = w <= 4 ? (w === 4 ? "w=4: 제거되는 비트가 없습니다." : "w=3: 상위 0을 붙여 4비트로 표시합니다(잘라내기 아님).") :
        `버린 상위 ${w - 4}비트; U mod 16 = ${state.u} mod 16 = ${out}; signed 해석(4비트) = ${signed(out, 4)}.`;
      render();
    });
    let row;
    function numberLines() {
      diagram.replaceChildren();
      // Numeric placement is exact for w<=8; all endpoints are labelled.
      const w = state.w, M = 1 << w, U = state.u, T = signed(U, w);
      for (const entry of [
        { label: "Unsigned(부호 없음)", min: 0, max: M - 1, value: U, ticks: [[0, "0"], [M - 1, "UMax " + (M - 1)]] },
        { label: "Signed(2의 보수)", min: -M / 2, max: M / 2 - 1, value: T, ticks: [[-M / 2, "TMin " + (-M / 2)], [-1, "−1"], [0, "0"], [M / 2 - 1, "TMax " + (M / 2 - 1)]] }
      ]) {
        const label = node("div", diagram, `${entry.label} · 현재 값 ${entry.value}`);
        label.style.marginTop = "12px";
        const line = node("div", diagram);
        Object.assign(line.style, { position: "relative", height: "43px", margin: "0 32px 17px", borderTop: `1px solid ${INK}`, top: "14px" });
        for (const [v, text] of entry.ticks) {
          const tick = node("div", line);
          tick.style.position = "absolute";
          tick.style.left = `${100 * (v - entry.min) / (entry.max - entry.min)}%`;
          tick.style.top = "-6px";
          tick.style.height = "10px";
          tick.style.borderLeft = `1px solid ${INK}`;
          const lab = node("span", tick, text);
          Object.assign(lab.style, { position: "absolute", top: "12px", left: "0", transform: "translateX(-50%)", fontSize: "10px", whiteSpace: "nowrap" });
        }
        const point = node("div", line, "●");
        Object.assign(point.style, { position: "absolute", left: `${100 * (entry.value - entry.min) / (entry.max - entry.min)}%`, top: "-19px", color: RED, transform: "translateX(-50%)", fontSize: "16px" });
      }
    }
    function render() {
      host.replaceChildren();
      row = bitRow(host, "비트 벡터 (MSB → LSB, 클릭하여 변경)", state.w, () => state.u, p => {
        state.u ^= 1 << (state.w - p - 1); state.extra = null; state.message = "비트를 직접 변경했습니다."; render();
      });
      const terms = bits(state.u, state.w).map((v, p) => ({ v, power: state.w - 1 - p }));
      const unsignedExpansion = terms.map(t => `${t.v}×2<sup>${t.power}</sup>`).join(" + ");
      const signedExpansion = terms.map((t, i) => `${i === 0 ? "−" : "+ "}${t.v}×2<sup>${t.power}</sup>`).join(" ");
      const notes = node("div", host, "", "v6-state");
      notes.innerHTML = `B2U<sub>w</sub>(x) = Σ<sub>i</sub> x<sub>i</sub>·2<sup>i</sup> = ${unsignedExpansion} = ${state.u}<br>B2T<sub>w</sub>(x) = −x<sub>w−1</sub>·2<sup>w−1</sup> + Σ<sub>i&lt;w−1</sub> x<sub>i</sub>·2<sup>i</sup> = ${signedExpansion} = ${signed(state.u, state.w)}<br>TMin = ${-(1 << (state.w - 1))}, TMax = ${(1 << (state.w - 1)) - 1}, UMax = ${mask(state.w)}.`;
      if (state.extra) {
        const x = state.extra, box = node("div", host);
        node("div", box, x.type === "extend" ? "부호 확장 결과(새 비트는 빨강)" : "잘라내기 결과(버려지는 비트는 빨강)");
        const strip = node("div", box);
        Object.assign(strip.style, { display: "flex", gap: "3px", flexWrap: "wrap", fontFamily: "monospace" });
        if (x.type === "truncate" && state.w > 4) {
          const removed = bits(state.u, state.w).slice(0, -4).join("");
          const dead = node("span", strip, removed + " │ ");
          dead.style.color = RED;
          dead.style.textDecoration = "line-through";
        }
        const shown = bits(x.value, x.width);
        shown.forEach((b, i) => {
          const cell = node("span", strip, b);
          Object.assign(cell.style, { border: `1px solid ${INK}`, padding: "5px 10px", color: x.type === "extend" && i < 4 ? RED : INK });
        });
        node("div", box, `${hex(x.value, x.width)} · unsigned ${x.value} · signed ${signed(x.value, x.width)}`);
      }
      info.textContent = state.message || "같은 비트열이라도 unsigned와 two's complement 해석은 다릅니다.";
      numberLines();
    }
    render();
  });

  // Exact rational arithmetic for binary32 decoding AND decimal encoding.
  const ZERO = 0n, ONE = 1n;
  function absBig(n) { return n < ZERO ? -n : n; }
  function gcd(a, b) { a = absBig(a); b = absBig(b); while (b) { const r = a % b; a = b; b = r; } return a || ONE; }
  function rat(n, d) { if (d === ZERO) throw new Error("분모가 0입니다."); if (d < ZERO) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
  function addRat(a, b) { return rat(a.n * b.d + b.n * a.d, a.d * b.d); }
  function subRat(a, b) { return rat(a.n * b.d - b.n * a.d, a.d * b.d); }
  function cmpRat(a, b) { const z = a.n * b.d - b.n * a.d; return z < ZERO ? -1 : z > ZERO ? 1 : 0; }
  function rationalDecimal(r) {
    if (!r.n) return "0";
    const negative = r.n < ZERO;
    let d = r.d, a = 0, b = 0;
    while (d % 2n === ZERO) { d /= 2n; a++; }
    while (d % 5n === ZERO) { d /= 5n; b++; }
    if (d !== ONE) return `${r.n}/${r.d}`;
    const k = Math.max(a, b);
    const scaled = absBig(r.n) * (2n ** BigInt(k - a)) * (5n ** BigInt(k - b));
    const s = scaled.toString().padStart(k + 1, "0");
    if (!k) return (negative ? "−" : "") + s;
    const left = s.slice(0, -k), right = s.slice(-k).replace(/0+$/, "");
    return (negative ? "−" : "") + left + (right ? "." + right : "");
  }
  function parseDecimal(input) {
    const s = String(input).trim();
    const m = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(s);
    if (!m) throw new Error("10진수 형식이 아닙니다. 예: -0.1, 1.25e-8");
    const frac = m[3] === undefined ? (m[4] || "") : m[3];
    const digits = (m[2] || "") + frac;
    if (digits.length > 500) throw new Error("숫자는 최대 500자리까지 입력할 수 있습니다.");
    const exp = m[5] ? Number(m[5]) : 0;
    if (!Number.isSafeInteger(exp) || Math.abs(exp) > 600) throw new Error("지수는 -600에서 600까지 입력하세요.");
    const shift = exp - frac.length;
    const unsigned = BigInt(digits || "0");
    const n = (m[1] === "-" ? -unsigned : unsigned);
    if (shift >= 0) return { value: rat(n * 10n ** BigInt(shift), ONE), negativeZero: m[1] === "-" && n === ZERO };
    return { value: rat(n, 10n ** BigInt(-shift)), negativeZero: m[1] === "-" && n === ZERO };
  }
  function decode32(raw) {
    const s = raw >>> 31, e = (raw >>> 23) & 255, f = raw & 0x7fffff;
    const sign = s ? -ONE : ONE;
    if (e === 255) return { s, e, f, kind: f ? "NaN" : (s ? "−∞" : "+∞"), finite: false };
    const power = e ? e - 150 : -149;
    const significand = BigInt(e ? (0x800000 | f) : f);
    const numerator = sign * significand;
    const value = power >= 0 ? rat(numerator << BigInt(power), ONE) : rat(numerator, ONE << BigInt(-power));
    return { s, e, f, E: e ? e - 127 : -126, significand, value, kind: e ? "정규(normalized)" : (f ? "비정규(denormalized)" : (s ? "−0" : "+0")), finite: true };
  }
  function encodeNearest(x, negativeZero) {
    if (x.n === ZERO) return negativeZero ? 0x80000000 : 0;
    const negative = x.n < ZERO;
    const target = rat(absBig(x.n), x.d);
    // Overflow boundary for round-to-nearest-even: maxFinite + 1/2 ulp.
    const overflowThreshold = rat((0x1ffffffn << 103n), ONE);
    if (cmpRat(target, overflowThreshold) >= 0) return (negative ? 0x80000000 : 0) + 0x7f800000;
    let lo = 0, hi = 0x7f7fffff;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (cmpRat(decode32(mid).value, target) <= 0) lo = mid;
      else hi = mid - 1;
    }
    let selected = lo;
    if (lo < 0x7f7fffff) {
      const lower = decode32(lo).value, upper = decode32(lo + 1).value;
      const distLower = subRat(target, lower);
      const distUpper = subRat(upper, target);
      const comparison = cmpRat(distLower, distUpper);
      if (comparison > 0 || (comparison === 0 && (lo & 1))) selected = lo + 1;
    }
    return ((selected | (negative ? 0x80000000 : 0)) >>> 0);
  }
  function toHex32(x) { return "0x" + (x >>> 0).toString(16).toUpperCase().padStart(8, "0"); }

  // 3. IEEE754 binary32 laboratory.
  V6.register("float-lab", function (el, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    title(el, "IEEE 754 binary32 실험실");
    let raw = 0x3f800000, previousInput = null;
    if (typeof cfg.hex === "string" && /^0x[\da-f]{8}$/i.test(cfg.hex)) raw = Number.parseInt(cfg.hex.slice(2), 16) >>> 0;
    const presetHost = node("div", el, "", "v6-controls");
    const presets = [["+0", 0], ["-0", 0x80000000], ["최소 비정규", 1], ["최대 비정규", 0x007fffff], ["최소 정규", 0x00800000], ["1.0", 0x3f800000], ["0.1", 0x3dcccccd], ["최대 finite", 0x7f7fffff], ["+∞", 0x7f800000], ["NaN", 0x7fc00000]];
    presets.forEach(([name, val]) => btn(presetHost, name, () => { raw = val >>> 0; previousInput = name === "0.1" ? parseDecimal("0.1").value : null; paint(); }));
    const controls = node("div", el, "", "v6-controls");
    const label = node("label", controls, "10진수 입력(decimal encoder) ");
    const input = node("input", label);
    input.type = "text"; input.value = "0.1";
    input.setAttribute("aria-label", "인코딩할 10진수");
    const inputCurrent = node("span", label, "0.1", "v6-val");
    input.addEventListener("input", () => { inputCurrent.textContent = input.value || "(비어 있음)"; });
    btn(controls, "최근접 짝수 반올림 후 인코딩", () => {
      try {
        const parsed = parseDecimal(input.value);
        previousInput = parsed.value;
        raw = encodeNearest(parsed.value, parsed.negativeZero);
        paint();
      } catch (e) { error(info, e.message); }
    });
    const host = node("div", el);
    const fieldRow = node("div", host);
    const fieldLabels = node("div", fieldRow);
    Object.assign(fieldLabels.style, { display: "grid", gridTemplateColumns: "1fr 8fr 23fr", gap: "4px", fontSize: "11px", marginTop: "12px", maxWidth: "900px" });
    ["부호(sign) 1", "지수(exponent) 8", "가수(frac) 23"].forEach(x => { const sp = node("span", fieldLabels, x); Object.assign(sp.style, { whiteSpace: "nowrap", textAlign: "center" }); });
    const strip = node("div", fieldRow);
    Object.assign(strip.style, { display: "grid", gridTemplateColumns: "repeat(32, minmax(0, 1fr))", gap: "1px", maxWidth: "900px" });
    const cells = [];
    for (let i = 0; i < 32; i++) {
      const c = node("button", strip);
      c.type = "button";
      c.setAttribute("aria-label", `${i === 0 ? "부호" : i <= 8 ? "지수" : "가수"} 비트 ${31 - i} 토글`);
      Object.assign(c.style, { font: "12px monospace", padding: "8px 0", border: `1px solid ${INK}`, background: "white", color: INK, minWidth: "0", cursor: "pointer" });
      if (i === 1 || i === 9) c.style.borderLeft = `3px solid ${INK}`;
      c.addEventListener("click", () => { raw = (raw ^ (1 << (31 - i))) >>> 0; previousInput = null; paint(i); });
      cells.push(c);
    }
    const info = status(el);
    function paint(changed) {
      cells.forEach((c, i) => { c.textContent = String((raw >>> (31 - i)) & 1); c.style.color = i === changed ? RED : INK; });
      const d = decode32(raw);
      const lines = [`비트열: ${toHex32(raw)}  |  분류: ${d.kind}`, `s=${d.s}, e=${d.e} (10진), frac=${d.f} (10진)`];
      if (!d.finite) {
        lines.push(d.kind === "NaN" ? "exp=255, frac≠0 → NaN (숫자가 아님)" : "exp=255, frac=0 → 무한대(infinity)");
      } else {
        const M = d.e ? `1 + ${d.f}/2<sup>23</sup>` : `${d.f}/2<sup>23</sup>`;
        lines.push(`E = ${d.E}; M = ${M}; 값 = (−1)<sup>${d.s}</sup> × (${M}) × 2<sup>${d.E}</sup>`);
        lines.push(`정확한 유리수(num/den): ${d.value.n}/${d.value.d}`);
        lines.push(`정확한 10진 값: ${d.s && d.value.n === ZERO ? "−0" : rationalDecimal(d.value)}`);
      }
      if (previousInput && d.finite) {
        const diff = subRat(previousInput, d.value);
        lines.push(`오차(입력 정확값 − float 정확값): ${diff.n}/${diff.d} = ${rationalDecimal(diff)}`);
      } else if (previousInput && !d.finite) {
        lines.push("오차: 무한대 결과는 유한한 유리수 오차로 표시할 수 없습니다(overflow).");
      }
      info.innerHTML = lines.join("<br>");
    }
    paint();
  });

  // 4. Exact binary fixed-point rounding to k fractional bits.
  V6.register("fp-round", function (el, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    title(el, "이진 소수 반올림 모드 비교");
    const controls = node("div", el, "", "v6-controls");
    let k = integer(cfg.k, 2, 1, 4);
    const slider = control(controls, "남길 소수 비트(k)", 1, 4, k, value => { k = value; render(); });
    const label = node("label", controls, "이진 소수 입력 ");
    const input = node("input", label);
    input.type = "text";
    input.value = typeof cfg.binary === "string" ? cfg.binary : "1.101";
    input.setAttribute("aria-label", "부호 있는 이진 소수 입력");
    const shown = node("span", label, input.value, "v6-val");
    const presets = node("div", el, "", "v6-controls");
    [["Halfway: 짝수 아래 (1.101)", "1.101", 2], ["Halfway: 짝수 위 (1.111)", "1.111", 2], ["음수 halfway (−1.101)", "-1.101", 2], ["Halfway 아님 (1.1011)", "1.1011", 2]].forEach(([name, val, width]) => btn(presets, name, () => { input.value = val; shown.textContent = val; k = width; slider.input.value = String(k); slider.out.textContent = String(k); render(); }));
    const plot = node("div", el);
    const info = status(el);
    input.addEventListener("input", () => { shown.textContent = input.value || "(비어 있음)"; render(); });
    function parseBinary(s) {
      const match = /^([+-]?)([01]{1,16})(?:\.([01]{1,24}))?$/.exec(s.trim());
      if (!match) throw new Error("이진 소수 형식으로 입력하세요. 예: -1.101 (정수 최대 16비트, 소수 최대 24비트)");
      const fraction = match[3] || "";
      const denom = ONE << BigInt(fraction.length);
      const magnitude = (BigInt("0b" + match[2]) << BigInt(fraction.length)) + (fraction ? BigInt("0b" + fraction) : ZERO);
      return { signed: match[1] === "-" ? -magnitude : magnitude, denom, fraction };
    }
    function render() {
      try {
        const x = parseBinary(input.value);
        const signedValue = rat(x.signed, x.denom), neg = x.signed < ZERO;
        const scale = ONE << BigInt(k);
        const magScaled = absBig(x.signed) * scale;
        const q = magScaled / x.denom;
        const rem = magScaled % x.denom;
        const halfCmp = rem * 2n - x.denom;
        const evenUp = halfCmp > ZERO || (halfCmp === ZERO && q % 2n !== ZERO);
        const rows = [
          ["최근접 짝수(round-to-nearest-even)", evenUp ? q + ONE : q],
          ["0 방향(toward-zero)", q],
          ["+∞ 방향(toward +∞)", !neg && rem ? q + ONE : q],
          ["−∞ 방향(toward −∞)", neg && rem ? q + ONE : q]
        ];
        const signedResult = n => rat(neg ? -n : n, scale);
        const origin = Number(x.signed) / Number(x.denom);
        const lower = neg ? -Number(q + ONE) / Number(scale) : Number(q) / Number(scale);
        const upper = lower + 1 / Number(scale);
        const left = lower - 1 / Number(scale), right = upper + 1 / Number(scale);
        plot.replaceChildren();
        (d => { d.innerHTML = `입력 ${input.value}<sub>2</sub> = ${rationalDecimal(signedValue)}<sub>10</sub> · 해상도 2<sup>−${k}</sup> = ${1 / (2 ** k)}`; })(node("div", plot));
        rows.forEach(([name, magnitude]) => {
          const result = signedResult(magnitude), num = Number(result.n) / Number(result.d);
          const heading = node("div", plot, `${name}: ${rationalDecimal(result)} (이진: ${formatBinary(result, k)})`);
          heading.style.marginTop = "13px";
          const line = node("div", plot);
          Object.assign(line.style, { position: "relative", borderTop: `1px solid ${INK}`, margin: "16px 35px 25px", height: "24px" });
          for (const tickValue of [lower, upper]) {
            const pct = 100 * (tickValue - left) / (right - left);
            const t = node("div", line);
            Object.assign(t.style, { position: "absolute", left: pct + "%", top: "-6px", height: "12px", borderLeft: `1px solid ${INK}` });
            const lab = node("span", t, String(tickValue));
            Object.assign(lab.style, { position: "absolute", top: "13px", transform: "translateX(-50%)", fontSize: "11px" });
          }
          const pos = v => 100 * (v - left) / (right - left);
          const start = Math.min(origin, num), width = Math.abs(origin - num);
          const discarded = node("div", line);
          Object.assign(discarded.style, { position: "absolute", left: pos(start) + "%", top: "-2px", width: 100 * width / (right - left) + "%", borderTop: `2px dashed ${RED}` });
          for (const [val, symbol, color] of [[origin, "│", INK], [num, "●", RED]]) {
            const mark = node("span", line, symbol);
            Object.assign(mark.style, { position: "absolute", left: pos(val) + "%", top: "-15px", transform: "translateX(-50%)", color, fontSize: "18px" });
          }
        });
        const halfway = rem !== ZERO && halfCmp === ZERO;
        const nearest = rows[0][1];
        info.innerHTML = `원래 값 ${rationalDecimal(signedValue)} · 버려지는 부분의 크기 ${rem}/${x.denom} (단위: 2<sup>−${k}</sup>)<br>` +
          (halfway ? `정확히 halfway(중간값): ${q}와 ${q + ONE} 중 짝수 ${nearest}을 선택했습니다.<br>` : "halfway가 아니므로 가장 가까운 격자점을 선택합니다.<br>") +
          "점선(빨강)은 원래 값과 반올림 결과의 간격이며 ●가 결과입니다. round-to-even은 정확한 중간값에서 위·아래를 번갈아 택해 한쪽 방향의 누적 편향을 줄입니다.";
      } catch (e) { plot.replaceChildren(); error(info, e.message); }
    }
    function formatBinary(r, fracWidth) {
      const negative = r.n < ZERO, value = absBig(r.n) * (ONE << BigInt(fracWidth)) / r.d;
      const base = ONE << BigInt(fracWidth);
      return (negative ? "−" : "") + (value / base).toString(2) + "." + (value % base).toString(2).padStart(fracWidth, "0");
    }
    render();
  });
})();