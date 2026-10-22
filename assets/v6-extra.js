/* v6-extra bootstrap: register wrapper + remount after webfonts load.
   Canvas text drawn before Noto Sans KR arrives renders tofu; remount fixes it. */
(function(){
"use strict";
var pending=[];
var origRegister = V6.register.bind(V6);
var registry = {};
V6.register = function(name, fn){ registry[name]=fn; origRegister(name, fn); };
function remount(){
  document.querySelectorAll('.v6-widget[data-widget]').forEach(function(el){
    var fn = registry[el.getAttribute('data-widget')];
    if(!fn) return;
    var cfg; try{ cfg = JSON.parse(el.getAttribute('data-config')||'{}'); }catch(e){ return; }
    el.innerHTML='';
    try{ fn(el, cfg); }catch(e){}
  });
}
if (document.fonts && document.fonts.ready){
  document.fonts.ready.then(function(){ setTimeout(remount, 50); });
}
})();
(function () {
  "use strict";

  if (!window.V6 || typeof window.V6.register !== "function") return;

  const V6 = window.V6;
  const INK = V6.INK || "#1a1a1a";
  const RED = V6.RED || "#9e2b25";
  const GRID = V6.GRID || "#e8e6e0";
  const MONO = "monospace, 'Noto Sans KR', sans-serif";
  const ONE = 1n;
  const ZERO = 0n;

  // ============================================================
  // Shared DOM helpers
  // ============================================================

  function el(tag, parent, text, cls) {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined && text !== null) x.textContent = String(text);
    if (parent) parent.appendChild(x);
    return x;
  }

  function clear(x) {
    x.replaceChildren();
  }

  function title(root, text) {
    V6.title(root, text);
  }

  function section(root, text) {
    return el("h4", root, text, "v6-section-title");
  }

  function bar(root) {
    return el("div", root, "", "v6-controls");
  }

  function button(root, text, callback) {
    const b = el("button", root, text, "v6-btn");
    b.type = "button";
    b.addEventListener("click", callback);
    return b;
  }

  function selectButton(b, active) {
    b.classList.toggle("is-selected", active);
    b.setAttribute("aria-pressed", active ? "true" : "false");
  }

  function state(root) {
    const x = el("div", root, "", "v6-state");
    x.setAttribute("role", "status");
    x.setAttribute("aria-live", "polite");
    return x;
  }

  function label(root, text, input) {
    const l = el("label", root);
    el("span", l, text);
    l.appendChild(input);
    return l;
  }

  function inputText(root, text, value) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = String(value);
    label(root, text, input);
    return input;
  }

  function select(root, text, options, initial) {
    const input = document.createElement("select");

    for (const [value, caption] of options) {
      const option = el("option", input, caption);
      option.value = String(value);
    }

    input.value = String(initial);
    label(root, text, input);
    return input;
  }

  function range(root, text, min, max, initial, callback) {
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    input.value = String(initial);

    const l = label(root, text, input);
    const value = el("span", l, String(initial), "v6-val");

    input.addEventListener("input", () => {
      value.textContent = input.value;
      callback(Number(input.value));
    });

    return {
      input,
      value,
      set(n) {
        input.value = String(n);
        value.textContent = String(n);
      }
    };
  }

  function message(root, text) {
    root.textContent = "안내: " + text;
  }

  function table(root, headings) {
    const scroll = el("div", root, "", "v6-table-scroll");
    const t = el("table", scroll, "", "v6-table");
    const tr = el("tr", el("thead", t));

    headings.forEach(h => el("th", tr, h));

    const tbody = el("tbody", t);

    return {
      add(cells, red = []) {
        const row = el("tr", tbody);

        cells.forEach((value, i) => {
          const cell = el("td", row, value);
          if (red.includes(i)) cell.classList.add("v6-changed");
        });

        return row;
      }
    };
  }

  function intConfig(value, fallback, min, max) {
    if (value === undefined || value === null) return fallback;
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= min && n <= max
      ? n : fallback;
  }

  function hex(value, digits) {
    return "0x" +
      BigInt(value).toString(16).toUpperCase().padStart(digits, "0");
  }

  function twos(u, width) {
    const sign = 1 << (width - 1);
    return (u & sign) ? u - (1 << width) : u;
  }

  function unsignedBits(u, width) {
    return Array.from(
      { length: width },
      (_, i) => (u >>> (width - 1 - i)) & 1
    );
  }

  function superscript(base, exponent) {
    const span = document.createElement("span");
    span.appendChild(document.createTextNode(String(base)));
    el("sup", span, exponent);
    return span;
  }

  function appendPower(root, base, exponent) {
    root.appendChild(superscript(base, exponent));
  }

  function formula(root, build) {
    const x = el("div", root);
    x.style.fontFamily = MONO;
    x.style.fontSize = "13px";
    x.style.lineHeight = "1.9";
    x.style.overflowWrap = "anywhere";
    build(x);
    return x;
  }

  function makeBits(root, width, editable, change, prefix) {
    const row = el("div", root);

    Object.assign(row.style, {
      display: "grid",
      gridTemplateColumns: `repeat(${width}, minmax(0,1fr))`,
      gap: "3px",
      maxWidth: "720px",
      margin: "8px 0"
    });

    const cells = [];

    for (let p = 0; p < width; p++) {
      const bit = width - 1 - p;
      const x = el(editable ? "button" : "div", row);

      x.textContent = "0";
      x.dataset.bit = String(bit);

      Object.assign(x.style, {
        minWidth: "0",
        minHeight: "40px",
        padding: "8px 0",
        textAlign: "center",
        fontFamily: MONO,
        fontSize: "16px",
        background: "white",
        border: `1px solid ${INK}`,
        borderRadius: "3px",
        color: INK
      });

      if (editable) {
        x.type = "button";
        x.classList.add("v6-btn");
        x.setAttribute(
          "aria-label",
          `${prefix}의 ${bit}번 비트 변경`
        );
        x.addEventListener("click", () => change(bit));
      }

      cells.push(x);
    }

    return {
      row,
      cells,
      paint(value, changedBits = []) {
        unsignedBits(value, width).forEach((bit, p) => {
          cells[p].textContent = String(bit);
          cells[p].style.color =
            changedBits.includes(width - 1 - p) ? RED : INK;
          cells[p].style.background = "white";
        });
      }
    };
  }

  // ============================================================
  // 1. bit-ops
  // ============================================================

  V6.register("bit-ops", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    title(root, "비트 연산 — Bitwise / Logical Operations");

    const model = {
      w: cfg.w === 4 ? 4 : 8,
      a: 0,
      b: 0,
      k: 1,
      op: "and"
    };

    model.a = intConfig(cfg.a, 0xA5, 0, 255) & ((1 << model.w) - 1);
    model.b = intConfig(cfg.b, 0x3C, 0, 255) & ((1 << model.w) - 1);
    model.k = intConfig(cfg.k, 1, 0, model.w);

    const top = bar(root);

    const width = select(
      top,
      "가상 비트 폭(w)",
      [[4, "4비트"], [8, "8비트"]],
      model.w
    );

    const shift = range(
      top, "이동 거리(k)", 0, model.w, model.k,
      v => {
        model.k = v;
        renderResult();
      }
    );

    const operations = bar(root);
    const definitions = [
      ["not", "~A"],
      ["logical", "!A"],
      ["and", "A & B"],
      ["or", "A | B"],
      ["xor", "A ^ B"],
      ["shl", "A << k"],
      ["shr", "A >> k (논리)"],
      ["sar", "A >> k (산술)"]
    ];

    const operationButtons = new Map();

    definitions.forEach(([key, text]) => {
      operationButtons.set(key, button(operations, text, () => {
        model.op = key;
        renderResult();
      }));
    });

    const inputHost = el("section", root);
    const resultHost = el("section", root);
    const formulaHost = el("section", root);
    const explanation = state(root);
    const cRules = state(root);

    let aRow, bRow, resultRow;
    let aMeta, bMeta, resultMeta;

    function mask() {
      return (1 << model.w) - 1;
    }

    function formatValue(u) {
      return (
        hex(u, Math.ceil(model.w / 4)) +
        " · unsigned " + u +
        " · signed " + twos(u, model.w)
      );
    }

    function compute() {
      const { w, a, b, k, op } = model;
      const m = mask();

      switch (op) {
        case "not": return (~a) & m;
        case "logical": return a === 0 ? 1 : 0;
        case "and": return a & b;
        case "or": return a | b;
        case "xor": return a ^ b;
        case "shl": return (a << k) & m;
        case "shr": return k >= w ? 0 : a >>> k;
        case "sar": {
          const sign = twos(a, w) < 0;
          if (k >= w) return sign ? m : 0;
          return (twos(a, w) >> k) & m;
        }
        default:
          throw new Error("지원하지 않는 연산입니다.");
      }
    }

    function origins(outputBit) {
      const { w, k, op } = model;
      const a = [];
      const b = [];

      function put(target, bit) {
        if (bit >= 0 && bit < w) {
          target.push(w - 1 - bit);
        }
      }

      if (op === "logical") {
        for (let p = 0; p < w; p++) put(a, p);
      } else if (op === "not") {
        put(a, outputBit);
      } else if (["and", "or", "xor"].includes(op)) {
        put(a, outputBit);
        put(b, outputBit);
      } else if (op === "shl") {
        put(a, outputBit - k);
      } else if (op === "shr") {
        put(a, outputBit + k);
      } else if (op === "sar") {
        put(a, Math.min(outputBit + k, w - 1));
      }

      return { a, b };
    }

    function highlight(row, positions, on) {
      positions.forEach(p => {
        const cell = row.cells[p];
        if (!cell) return;

        cell.style.background = on ? GRID : "white";
        cell.style.borderColor = on ? RED : INK;
      });
    }

    function renderInputs() {
      clear(inputHost);
      section(inputHost, "입력 비트 — MSB → LSB");

      const aSection = el("div", inputHost);
      el("div", aSection, "A · 비트를 클릭하여 변경");

      aRow = makeBits(aSection, model.w, true, bit => {
        model.a ^= 1 << bit;
        renderResult();
      }, "A");

      aMeta = el("div", aSection, "", "v6-val");

      const bSection = el("div", inputHost);
      el("div", bSection, "B · 비트를 클릭하여 변경");

      bRow = makeBits(bSection, model.w, true, bit => {
        model.b ^= 1 << bit;
        renderResult();
      }, "B");

      bMeta = el("div", bSection, "", "v6-val");

      clear(resultHost);
      section(resultHost, "결과 비트 — Result");

      resultRow = makeBits(
        resultHost, model.w, false, null, "결과"
      );

      resultMeta = el("div", resultHost, "", "v6-val");
    }

    function renderResult() {
      try {
        const result = compute();

        for (const [key, b] of operationButtons) {
          selectButton(b, key === model.op);
        }

        aRow.paint(model.a);
        bRow.paint(model.b);
        resultRow.paint(result);

        aMeta.textContent = formatValue(model.a);
        bMeta.textContent = formatValue(model.b);
        resultMeta.textContent = formatValue(result);

        resultRow.cells.forEach((cell, position) => {
          const bit = model.w - 1 - position;

          cell.onmouseenter = () => {
            const src = origins(bit);
            highlight(aRow, src.a, true);
            highlight(bRow, src.b, true);
            cell.style.color = RED;
          };

          cell.onmouseleave = () => {
            const src = origins(bit);
            highlight(aRow, src.a, false);
            highlight(bRow, src.b, false);
            cell.style.color = INK;
          };
        });

        clear(formulaHost);
        section(formulaHost, "계산식 — 가상 w비트 모델");

        formula(formulaHost, f => {
          el(
            "span",
            f,
            definitions.find(x => x[0] === model.op)[1] +
            " = " + formatValue(result)
          );
        });

        const signed = twos(model.a, model.w);
        const divisor = 2 ** model.k;

        const descriptions = {
          not: "Bitwise NOT(비트 반전): 각 비트를 반전합니다.",
          logical: "Logical NOT(논리 부정): A 전체가 0일 때만 결과는 1입니다.",
          and: "AND: 두 입력 비트가 모두 1일 때 1입니다.",
          or: "OR: 두 입력 비트 중 하나 이상 1이면 1입니다.",
          xor: "XOR: 두 입력 비트가 다르면 1입니다.",
          shl: "왼쪽 시프트: 낮은 비트를 0으로 채우고 넘친 비트를 버립니다.",
          shr: "논리적 오른쪽 시프트: 높은 비트를 0으로 채웁니다.",
          sar: "산술적 오른쪽 시프트: 부호 비트를 복제합니다."
        };

        const explanationLines = [
          "① 가상 비트 모델",
          descriptions[model.op],
          "이 위젯은 " + model.w +
          "비트 패턴에 대한 고정 폭 연산을 정의합니다."
        ];

        if (model.op === "sar") {
          explanationLines.push(
            "일반적인 산술 오른쪽 시프트 결과 = floor(T / " +
            divisor + ") = " + Math.floor(signed / divisor) + ".",
            "반면 C의 signed 정수 나눗셈 T / " +
            divisor + "는 0 방향으로 절삭하므로 " +
            Math.trunc(signed / divisor) + "입니다."
          );
        }

        if (model.k === model.w &&
            ["shl", "shr", "sar"].includes(model.op)) {
          explanationLines.push(
            "k=w의 결과는 이 위젯에서만 정의한 가상 모델 규칙입니다."
          );
        }

        explanation.textContent = explanationLines.join("\n");

        cRules.textContent =
          "② C 표준 규칙\n" +
          "이 화면의 w=4/8은 C의 실제 int 폭이 아닙니다.\n" +
          "char, int8_t 등의 작은 정수형은 일반적인 32비트 int 환경에서 정수 승격(integer promotion)을 거칩니다.\n" +
          "실제 32비트 int 시프트에서 음수 횟수 또는 k≥32는 undefined behavior입니다.\n" +
          "음수 signed 값을 왼쪽으로 시프트하는 연산은 C 언어 버전과 표현 가능성에 따라 주의가 필요합니다.\n\n" +
          "③ 일반적 하드웨어 동작\n" +
          "x86 산술 오른쪽 시프트(SAR)는 높은 자리에 부호 비트를 복제합니다.\n" +
          "이는 음수에서 음의 무한대 방향 내림에 해당하며, C 정수 나눗셈의 0 방향 절삭과 다를 수 있습니다.\n" +
          "C 표준 차원의 signed 오른쪽 시프트 의미는 사용하는 표준 버전에 따라 확인해야 합니다.";
      } catch (e) {
        message(explanation, e.message);
      }
    }

    width.addEventListener("change", () => {
      model.w = Number(width.value);
      model.a &= mask();
      model.b &= mask();
      model.k = Math.min(model.k, model.w);

      shift.input.max = String(model.w);
      shift.set(model.k);

      renderInputs();
      renderResult();
    });

    renderInputs();
    renderResult();
  });

  // ============================================================
  // 2. int-rep
  // ============================================================

  V6.register("int-rep", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    title(root, "정수 표현 — Two's Complement");

    const model = {
      w: intConfig(cfg.w, 5, 3, 8),
      u: 0,
      extra: null,
      note: ""
    };

    model.u = intConfig(
      cfg.value, 7, 0, (1 << model.w) - 1
    );

    const top = bar(root);

    const width = range(
      top, "비트 폭(w)", 3, 8, model.w,
      newWidth => {
        const oldW = model.w;
        const oldU = model.u;
        const oldT = twos(oldU, oldW);

        model.w = newWidth;
        model.u = oldU & ((1 << newWidth) - 1);
        model.extra = null;

        model.note =
          "폭 변경 " + oldW + " → " + newWidth + "비트\n" +
          "기존 비트 패턴의 하위 " + newWidth +
          "비트만 유지합니다. (부호 확장 아님)\n" +
          "unsigned: " + oldU + " → " + model.u + "\n" +
          "signed: " + oldT + " → " +
          twos(model.u, newWidth) + ".";

        render();
      }
    );

    button(top, "+1 (carry 관찰)", () => {
      const w = model.w;
      const old = model.u;
      const max = (1 << w) - 1;
      const tmax = (1 << (w - 1)) - 1;

      model.u = (model.u + 1) & max;
      model.extra = null;

      model.note =
        "+1: " + hex(old, Math.ceil(w / 4)) +
        " → " + hex(model.u, Math.ceil(w / 4)) +
        "\n최상위 carry-out: " + (old === max ? 1 : 0) +
        "\nsigned overflow: " + (old === tmax ? 1 : 0) +
        (old === tmax ? " · TMax → TMin" : "") +
        (old === max ? "\nUMax → 0" : "");

      render();
    });

    button(top, "부호 확장 w→w+4", () => {
      const w = model.w;
      const sign = (model.u >>> (w - 1)) & 1;
      const extended = sign
        ? model.u | (15 << w)
        : model.u;

      model.extra = {
        kind: "extend",
        value: extended,
        width: w + 4,
        oldWidth: w
      };

      model.note =
        "부호 확장(sign extension): 부호 비트 " +
        sign + "을 새 상위 4비트에 복제합니다.\n" +
        "원래 signed 값 " + twos(model.u, w) +
        " = 확장 후 signed 값 " +
        twos(extended, w + 4) + ".";
      render();
    });

    button(top, "truncate w→4", () => {
      const result = model.u & 15;

      model.extra = {
        kind: "truncate",
        value: result,
        width: 4,
        oldWidth: model.w
      };

      model.note =
        model.w > 4
          ? "상위 " + (model.w - 4) +
            "비트를 버립니다.\nunsigned 해석: " +
            model.u + " mod 16 = " + result +
            "\n4비트 two's complement 해석: " +
            twos(result, 4)
          : model.w === 4
            ? "이미 4비트이므로 버려지는 비트가 없습니다."
            : "3비트에서 4비트로는 truncation이 아닙니다. " +
              "이 버튼은 하위 비트를 4비트로 표시합니다.";

      render();
    });

    const bitsHost = el("section", root);
    const formulaHost = el("section", root);
    const linesHost = el("section", root);
    const extraHost = el("section", root);
    const explanation = state(root);

    let inputRow;

    function drawNumberLine(parent, name, min, max, current, marks) {
      const wrapper = el("div", parent);
      wrapper.style.margin = "18px 0 26px";

      el(
        "div",
        wrapper,
        name + " · 현재 값 " + current,
        "v6-val"
      );

      const track = el("div", wrapper);
      Object.assign(track.style, {
        position: "relative",
        height: "50px",
        margin: "28px 42px 24px",
        borderTop: `1px solid ${INK}`
      });

      function position(v) {
        return 100 * (v - min) / (max - min);
      }

      marks.forEach(({ value, name: label, level }) => {
        const marker = el("div", track);

        Object.assign(marker.style, {
          position: "absolute",
          left: position(value) + "%",
          top: "-5px",
          width: "1px",
          height: "10px",
          background: INK
        });

        const caption = el("span", marker, label);

        Object.assign(caption.style, {
          position: "absolute",
          left: "0",
          top: level === 1 ? "32px" : "13px",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          fontSize: "11px",
          fontFamily: MONO
        });
      });

      const dot = el("div", track, "●");
      Object.assign(dot.style, {
        position: "absolute",
        left: position(current) + "%",
        top: "-27px",
        transform: "translateX(-50%)",
        color: RED,
        fontSize: "20px"
      });
    }

    function render() {
      const w = model.w;
      const u = model.u;
      const signed = twos(u, w);
      const high = 1 << (w - 1);
      const max = (1 << w) - 1;

      clear(bitsHost);
      section(bitsHost, "비트 벡터 — MSB → LSB");

      inputRow = makeBits(
        bitsHost,
        w,
        true,
        bit => {
          model.u ^= 1 << bit;
          model.extra = null;
          model.note = "비트를 직접 변경했습니다.";
          render();
        },
        "정수"
      );

      inputRow.paint(u);

      const summary = state(bitsHost);
      summary.textContent =
        "Hex " + hex(u, Math.ceil(w / 4)) +
        " · unsigned " + u +
        " · signed " + signed;

      clear(formulaHost);
      section(formulaHost, "해석 공식 — B2U / B2T");

      formula(formulaHost, f => {
        el("strong", f, "Unsigned (부호 없음): ");
        el("span", f, "B2U = ");

        const terms = [];

        for (let i = w - 1; i >= 0; i--) {
          terms.push({
            bit: (u >>> i) & 1,
            power: i
          });
        }

        terms.forEach((term, i) => {
          if (i) el("span", f, " + ");
          el("span", f, term.bit + "×");
          appendPower(f, "2", term.power);
        });

        el("span", f, " = " + u);
      });

      formula(formulaHost, f => {
        el("strong", f, "Two's complement (2의 보수): ");
        el("span", f, "B2T = −");

        el("span", f, String((u >>> (w - 1)) & 1) + "×");
        appendPower(f, "2", w - 1);

        for (let i = w - 2; i >= 0; i--) {
          el("span", f, " + " + ((u >>> i) & 1) + "×");
          appendPower(f, "2", i);
        }

        el("span", f, " = " + signed);
      });

      clear(linesHost);
      section(linesHost, "숫자선 — Number Lines");

      drawNumberLine(
        linesHost,
        "Unsigned",
        0,
        max,
        u,
        [
          { value: 0, name: "0", level: 0 },
          { value: max, name: "UMax " + max, level: 0 }
        ]
      );

      drawNumberLine(
        linesHost,
        "Two's complement",
        -high,
        high - 1,
        signed,
        [
          { value: -high, name: "TMin " + (-high), level: 0 },
          { value: -1, name: "−1", level: 1 },
          { value: 0, name: "0", level: 0 },
          { value: high - 1, name: "TMax " + (high - 1), level: 1 }
        ]
      );

      clear(extraHost);

      if (model.extra) {
        const e = model.extra;
        section(
          extraHost,
          e.kind === "extend"
            ? "부호 확장 — Sign Extension"
            : "잘라내기 — Truncation"
        );

        const row = el("div", extraHost);
        row.style.display = "flex";
        row.style.flexWrap = "wrap";
        row.style.gap = "4px";

        if (e.kind === "truncate" && e.oldWidth > 4) {
          for (let bit = e.oldWidth - 1; bit >= 4; bit--) {
            const c = el("span", row, (u >>> bit) & 1);
            c.style.color = RED;
            c.style.textDecoration = "line-through";
            c.style.fontFamily = MONO;
            c.style.padding = "8px";
            c.style.border = `1px solid ${INK}`;
          }
        }

        unsignedBits(e.value, e.width).forEach((bit, p) => {
          const c = el("span", row, bit);
          c.style.padding = "8px";
          c.style.minWidth = "32px";
          c.style.textAlign = "center";
          c.style.fontFamily = MONO;
          c.style.border = `1px solid ${INK}`;

          if (e.kind === "extend" && p < 4) {
            c.style.color = RED;
          }
        });
      }

      explanation.textContent =
        (model.note ? model.note + "\n\n" : "") +
        "TMin = " + (-high) +
        " · TMax = " + (high - 1) +
        " · UMax = " + max + "\n" +
        "각 비트 패턴은 동일하지만 unsigned와 signed 해석에 따라 값이 달라집니다.\n" +
        "숫자선의 빨간 점은 현재 값입니다. 특수 눈금 이름과 현재 값 마커는 서로 다른 높이에 표시합니다.";
    }

    render();
  });

  // ============================================================
  // Exact BigInt rational arithmetic
  // ============================================================

  function absBig(n) {
    return n < ZERO ? -n : n;
  }

  function gcd(a, b) {
    a = absBig(a);
    b = absBig(b);

    while (b !== ZERO) {
      const r = a % b;
      a = b;
      b = r;
    }

    return a || ONE;
  }

  function rat(n, d) {
    if (d === ZERO) throw new Error("분모가 0입니다.");

    if (d < ZERO) {
      n = -n;
      d = -d;
    }

    const g = gcd(n, d);

    return {
      n: n / g,
      d: d / g
    };
  }

  function compare(a, b) {
    const difference = a.n * b.d - b.n * a.d;
    return difference < ZERO ? -1 :
      difference > ZERO ? 1 : 0;
  }

  function subtract(a, b) {
    return rat(
      a.n * b.d - b.n * a.d,
      a.d * b.d
    );
  }

  function decimalExact(r) {
    if (r.n === ZERO) return "0";

    let denominator = r.d;
    let twos = 0;
    let fives = 0;

    while (denominator % 2n === ZERO) {
      denominator /= 2n;
      twos++;
    }

    while (denominator % 5n === ZERO) {
      denominator /= 5n;
      fives++;
    }

    if (denominator !== ONE) {
      return r.n + "/" + r.d;
    }

    const k = Math.max(twos, fives);

    const scaled =
      absBig(r.n) *
      (2n ** BigInt(k - twos)) *
      (5n ** BigInt(k - fives));

    const digits = scaled.toString().padStart(k + 1, "0");
    const negative = r.n < ZERO ? "−" : "";

    if (k === 0) return negative + digits;

    const whole = digits.slice(0, -k);
    const fractional = digits.slice(-k).replace(/0+$/, "");

    return negative + whole +
      (fractional ? "." + fractional : "");
  }

  function parseDecimal(text) {
    const s = String(text).trim();
    const lower = s.toLowerCase();

    if (/^\+?(?:inf|infinity)$/.test(lower)) {
      return { kind: "infinity", negative: false };
    }

    if (/^-(?:inf|infinity)$/.test(lower)) {
      return { kind: "infinity", negative: true };
    }

    if (/^[+-]?nan$/.test(lower)) {
      return { kind: "nan" };
    }

    const match =
      /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(s);

    if (!match) {
      throw new Error(
        "10진 입력 형식이 아닙니다. 예: -0.1, 1e-45, inf, -inf, nan"
      );
    }

    const fraction =
      match[3] === undefined ? (match[4] || "") : match[3];

    const digits = (match[2] || "") + fraction;

    if (digits.length > 500) {
      throw new Error("10진수 유효 숫자는 최대 500자리입니다.");
    }

    const exponent = match[5] ? Number(match[5]) : 0;

    if (
      !Number.isSafeInteger(exponent) ||
      Math.abs(exponent) > 600
    ) {
      throw new Error("10진 지수는 -600부터 600까지입니다.");
    }

    const power = exponent - fraction.length;
    const magnitude = BigInt(digits || "0");
    const n = match[1] === "-" ? -magnitude : magnitude;

    const value = power >= 0
      ? rat(n * (10n ** BigInt(power)), ONE)
      : rat(n, 10n ** BigInt(-power));

    return {
      kind: "finite",
      value,
      negativeZero: match[1] === "-" && n === ZERO
    };
  }

  function decode32(raw) {
    const x = raw >>> 0;
    const sign = x >>> 31;
    const exponent = (x >>> 23) & 255;
    const fraction = x & 0x7fffff;

    if (exponent === 255) {
      return {
        raw: x,
        sign,
        exponent,
        fraction,
        finite: false,
        classification: fraction
          ? "NaN"
          : sign ? "−∞" : "+∞"
      };
    }

    const normalized = exponent !== 0;
    const power = normalized
      ? exponent - 150
      : -149;

    const significand = BigInt(
      normalized ? (0x800000 | fraction) : fraction
    );

    const numerator = sign ? -significand : significand;

    const value = power >= 0
      ? rat(numerator << BigInt(power), ONE)
      : rat(numerator, ONE << BigInt(-power));

    return {
      raw: x,
      sign,
      exponent,
      fraction,
      finite: true,
      value,
      E: normalized ? exponent - 127 : -126,
      normalized,
      classification:
        exponent === 0 && fraction === 0
          ? sign ? "−0" : "+0"
          : normalized
            ? "정규(normalized)"
            : "비정규(subnormal)"
    };
  }

  // Binary32 round-to-nearest, ties-to-even, using exact fractions.
  function encodeNearest(value, negativeZero = false) {
    if (value.n === ZERO) {
      return negativeZero ? 0x80000000 : 0;
    }

    const negative = value.n < ZERO;
    const magnitude = rat(absBig(value.n), value.d);

    // IEEE 754 binary32, round-to-nearest-even:
    // max finite = (2^24 - 1) * 2^104
    // overflow midpoint = (2^25 - 1) * 2^103.
    const overflowBoundary = rat(
      ((ONE << 25n) - ONE) << 103n,
      ONE
    );

    if (compare(magnitude, overflowBoundary) >= 0) {
      return negative ? 0xff800000 : 0x7f800000;
    }

    let lo = 0;
    let hi = 0x7f7fffff;

    // Positive non-NaN finite bit patterns are monotonically ordered.
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);

      if (compare(decode32(mid).value, magnitude) <= 0) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    let choice = lo;

    if (lo < 0x7f7fffff) {
      const lower = decode32(lo).value;
      const upper = decode32(lo + 1).value;

      const lowerDistance = subtract(magnitude, lower);
      const upperDistance = subtract(upper, magnitude);

      const cmp = compare(lowerDistance, upperDistance);

      if (cmp > 0 || (cmp === 0 && (lo & 1) !== 0)) {
        choice = lo + 1;
      }
    }

    return (choice | (negative ? 0x80000000 : 0)) >>> 0;
  }

  function encodeDecimal(text) {
    const parsed = parseDecimal(text);

    if (parsed.kind === "nan") {
      return {
        bits: 0x7fc00000,
        parsed
      };
    }

    if (parsed.kind === "infinity") {
      return {
        bits: parsed.negative ? 0xff800000 : 0x7f800000,
        parsed
      };
    }

    return {
      bits: encodeNearest(parsed.value, parsed.negativeZero),
      parsed
    };
  }

  function numberBits32(value) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, value, false);
    return view.getUint32(0, false);
  }

  function floatApprox(raw) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, raw >>> 0, false);
    return view.getFloat32(0, false);
  }

  // ============================================================
  // 3. float-lab
  // ============================================================

  V6.register("float-lab", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    title(root, "IEEE 754 binary32 — 부동소수점 실험실");

    const model = {
      raw: 0x3f800000,
      source: null,
      inputText: "",
      lastBit: null,
      error: ""
    };

    if (
      typeof cfg.hex === "string" &&
      /^0x[0-9a-f]{8}$/i.test(cfg.hex)
    ) {
      model.raw = Number.parseInt(cfg.hex.slice(2), 16) >>> 0;
    }

    const presetData = [
      {
        title: "영점과 정수",
        items: [
          ["+0", 0x00000000],
          ["−0", 0x80000000],
          ["1.0", 0x3f800000]
        ]
      },
      {
        title: "정규 / 비정규 경계",
        items: [
          ["최소 비정규", 0x00000001],
          ["최대 비정규", 0x007fffff],
          ["최소 정규", 0x00800000],
          ["최대 유한값", 0x7f7fffff]
        ]
      },
      {
        title: "오차 / 특수값",
        items: [
          ["0.1", 0x3dcccccd],
          ["+∞", 0x7f800000],
          ["NaN", 0x7fc00000]
        ]
      }
    ];

    const presetHost = el("section", root);
    section(presetHost, "프리셋 — Presets");

    const presetButtons = [];

    presetData.forEach(group => {
      const row = bar(presetHost);
      const name = el("span", row, group.title);
      name.style.fontSize = "12px";
      name.style.minWidth = "110px";

      group.items.forEach(([text, value]) => {
        const b = button(row, text, () => {
          model.raw = value >>> 0;
          model.source =
            text === "0.1" ? parseDecimal("0.1") : null;
          model.inputText = text === "0.1" ? "0.1" : "";
          model.lastBit = null;
          model.error = "";
          render();
        });

        presetButtons.push({ button: b, value });
      });
    });

    section(root, "10진수 인코딩 — Decimal Encoder");

    const controls = bar(root);
    const decimalInput = inputText(
      controls,
      "10진수 / 특수값",
      "0.1"
    );

    decimalInput.style.width = "220px";

    const inputCurrent = el(
      "span", controls, "0.1", "v6-val"
    );

    decimalInput.addEventListener("input", () => {
      inputCurrent.textContent =
        decimalInput.value || "(비어 있음)";
    });

    button(controls, "최근접 짝수 반올림 후 인코드", () => {
      try {
        const encoded = encodeDecimal(decimalInput.value);
        model.raw = encoded.bits;
        model.source = encoded.parsed;
        model.inputText = decimalInput.value.trim();
        model.lastBit = null;
        model.error = "";
        render();
      } catch (e) {
        model.error = e.message;
        render();
      }
    });

    const bitsHost = el("section", root);
    const summary = state(root);
    const formulaHost = el("section", root);
    const explanation = state(root);
    const detailsHost = el("section", root);

    function makeBinaryCells() {
      clear(bitsHost);
      section(bitsHost, "32비트 필드 — Sign / Exponent / Fraction");

      const fields = [
        {
          name: "부호(sign)",
          start: 0,
          length: 1
        },
        {
          name: "지수(exponent)",
          start: 1,
          length: 8
        },
        {
          name: "가수(fraction)",
          start: 9,
          length: 23
        }
      ];

      const all = [];

      for (const field of fields) {
        const wrapper = el("div", bitsHost);
        wrapper.style.margin = "10px 0 14px";

        const caption = el(
          "div",
          wrapper,
          field.name + " · " + field.length + "bit"
        );

        caption.style.fontSize = "12px";
        caption.style.fontWeight = "600";

        const grid = el("div", wrapper);
        grid.style.display = "grid";
        grid.style.gridTemplateColumns =
          `repeat(${Math.min(field.length, 12)}, minmax(0,1fr))`;
        grid.style.gap = "3px";
        grid.style.maxWidth = "720px";

        for (let local = 0; local < field.length; local++) {
          const index = field.start + local;
          const position = 31 - index;

          const cell = button(grid, "0", () => {
            model.raw = (
              model.raw ^ (1 << position)
            ) >>> 0;

            model.source = null;
            model.inputText = "";
            model.lastBit = index;
            model.error = "";
            render();
          });

          cell.style.fontFamily = MONO;
          cell.style.padding = "7px 0";
          cell.style.minWidth = "0";
          cell.style.fontSize = "14px";

          cell.setAttribute(
            "aria-label",
            field.name + "의 비트 " + position + " 토글"
          );

          all.push(cell);
        }
      }

      return all;
    }

    function render() {
      if (model.error) {
        summary.textContent = "안내: " + model.error;
        clear(formulaHost);
        explanation.textContent = "입력값을 수정한 뒤 다시 인코딩하세요.";
        clear(detailsHost);
        return;
      }

      const decoded = decode32(model.raw);
      const cells = makeBinaryCells();

      cells.forEach((cell, index) => {
        cell.textContent =
          String((model.raw >>> (31 - index)) & 1);
        cell.style.color =
          model.lastBit === index ? RED : INK;
      });

      presetButtons.forEach(({ button: b, value }) => {
        selectButton(b, model.raw === value);
      });

      const approx = floatApprox(model.raw);

      summary.textContent =
        "비트 패턴: " + hex(model.raw, 8) +
        "\n분류: " + decoded.classification +
        "\n근삿값(JS Number 표시): " +
        (Object.is(approx, -0) ? "−0" : String(approx));

      clear(formulaHost);
      section(formulaHost, "디코딩 공식 — IEEE 754");

      formula(formulaHost, f => {
        el(
          "span",
          f,
          "s=" + decoded.sign +
          ", e=" + decoded.exponent +
          ", frac=" + decoded.fraction
        );
      });

      if (decoded.finite) {
        formula(formulaHost, f => {
          el("span", f, "E = ");

          if (decoded.normalized) {
            el(
              "span",
              f,
              decoded.exponent + " − 127 = " + decoded.E
            );
          } else {
            el("span", f, "1 − 127 = −126");
          }
        });

        formula(formulaHost, f => {
          el("span", f, "M = ");

          if (decoded.normalized) {
            el(
              "span",
              f,
              "1 + " + decoded.fraction + " / "
            );
          } else {
            el(
              "span",
              f,
              decoded.fraction + " / "
            );
          }

          appendPower(f, "2", 23);
        });

        formula(formulaHost, f => {
          el("span", f, "값 = (−1)");
          el("sup", f, decoded.sign);
          el("span", f, " × M × 2");
          el("sup", f, decoded.E);
        });
      } else {
        formula(formulaHost, f => {
          el(
            "span",
            f,
            decoded.classification === "NaN"
              ? "e=255, frac≠0 → NaN"
              : "e=255, frac=0 → infinity"
          );
        });
      }

      const lines = [];

      if (model.source) {
        lines.push("입력: " + model.inputText);

        if (
          model.source.kind === "finite" &&
          decoded.finite
        ) {
          const difference = subtract(
            model.source.value,
            decoded.value
          );

          lines.push(
            "정확한 오차(입력 − binary32): " +
            difference.n + "/" + difference.d
          );

          lines.push(
            "오차의 정확한 10진수: " +
            decimalExact(difference)
          );
        } else if (
          model.source.kind === "finite" &&
          !decoded.finite
        ) {
          lines.push(
            "유한한 입력이 infinity로 반올림되었습니다."
          );
        }

        if (model.source.kind === "finite") {
          const n = Number(model.inputText);
          const viaFround = numberBits32(Math.fround(n));

          if (viaFround === model.raw) {
            lines.push(
              "Math.fround 경로와 BigInt 정확 반올림 경로가 일치합니다."
            );
          } else {
            lines.push(
              "이중 반올림 경로 차이:\n" +
              "BigInt 정확 반올림 = " +
              hex(model.raw, 8) +
              "\nNumber → Math.fround = " +
              hex(viaFround, 8) +
              "\n10진수를 먼저 binary64로 반올림할 때 발생한 차이입니다."
            );
          }
        }
      }

      if (
        model.raw === 0x7f7fffff ||
        model.raw === 0x7f800000 ||
        model.raw === 0xff7fffff ||
        model.raw === 0xff800000
      ) {
        lines.push(
          "오버플로 경계 설명은 IEEE 754 binary32, " +
          "round-to-nearest-even 기준입니다."
        );
      }

      lines.push(
        "정규수(normalized)는 숨은 선행 1을 사용합니다. " +
        "비정규수(subnormal)는 숨은 선행 1이 없습니다."
      );

      explanation.textContent = lines.join("\n\n");

      clear(detailsHost);
      section(detailsHost, "정확한 값 — Exact Representation");

      const detail = el("details", detailsHost);
      const caption = el(
        "summary",
        detail,
        "정확한 유리수 / 10진수 전개 펼치기"
      );

      caption.style.cursor = "pointer";
      caption.style.padding = "9px 0";
      caption.style.fontWeight = "600";

      const exact = state(detail);

      if (decoded.finite) {
        const v = decoded.value;

        exact.textContent =
          "유리수(num/den)\n" +
          v.n + "/" + v.d +
          "\n\n정확한 10진수\n" +
          (
            decoded.sign === 1 && v.n === ZERO
              ? "−0"
              : decimalExact(v)
          );
      } else {
        exact.textContent =
          decoded.classification +
          "는 유한한 유리수로 표현되지 않습니다.";
      }
    }

    render();
  });

  // ============================================================
  // 4. fp-round
  // ============================================================

  V6.register("fp-round", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    title(root, "이진 반올림 — Rounding Modes");

    let k = intConfig(cfg.k, 2, 1, 4);
    let source = typeof cfg.binary === "string"
      ? cfg.binary
      : "1.101";

    const top = bar(root);

    const width = range(
      top,
      "남길 소수 비트(k)",
      1, 4, k,
      value => {
        k = value;
        render();
      }
    );

    const binaryInput = inputText(
      top,
      "이진 소수",
      source
    );

    binaryInput.style.width = "150px";

    binaryInput.addEventListener("input", () => {
      source = binaryInput.value;
      render();
    });

    const presetBar = bar(root);

    const presets = [
      ["Halfway: 아래쪽 짝수", "1.101", 2],
      ["Halfway: 위쪽 짝수", "1.111", 2],
      ["음수 Halfway", "-1.101", 2],
      ["2.875 → 3", "10.111", 2],
      ["Halfway 아님", "1.1011", 2]
    ];

    const presetButtons = presets.map(([name, binary, bits]) => {
      const b = button(presetBar, name, () => {
        source = binary;
        binaryInput.value = binary;
        k = bits;
        width.set(k);
        render();
      });

      return { b, binary, bits };
    });

    const formulaHost = el("section", root);
    const plotHost = el("section", root);
    const explanation = state(root);

    function parseBinary(text) {
      const match =
        /^([+-]?)([01]{1,16})(?:\.([01]{1,24}))?$/.exec(text.trim());

      if (!match) {
        throw new Error(
          "이진 소수 입력 형식: -1.101 (정수 최대 16비트, 소수 최대 24비트)"
        );
      }

      const fraction = match[3] || "";
      const den = ONE << BigInt(fraction.length);

      const magnitude =
        (BigInt("0b" + match[2]) << BigInt(fraction.length)) +
        (fraction ? BigInt("0b" + fraction) : ZERO);

      return rat(
        match[1] === "-" ? -magnitude : magnitude,
        den
      );
    }

    function fixedBinary(value, bits) {
      const negative = value.n < ZERO;
      const scaled =
        absBig(value.n) * (ONE << BigInt(bits)) / value.d;
      const base = ONE << BigInt(bits);

      return (
        (negative ? "−" : "") +
        (scaled / base).toString(2) +
        "." +
        (scaled % base).toString(2).padStart(bits, "0")
      );
    }

    function drawLine(parent, origin, rounded, low, high) {
      const wrapper = el("div", parent);

      const track = el("div", wrapper);
      Object.assign(track.style, {
        position: "relative",
        margin: "30px 48px 34px",
        height: "30px",
        borderTop: `1px solid ${INK}`
      });

      const min = low - (high - low);
      const max = high + (high - low);

      function pos(value) {
        return 100 * (value - min) / (max - min);
      }

      [low, high].forEach(value => {
        const x = el("div", track);

        Object.assign(x.style, {
          position: "absolute",
          left: pos(value) + "%",
          top: "-6px",
          width: "1px",
          height: "12px",
          background: INK
        });

        const caption = el("span", x, String(value));

        Object.assign(caption.style, {
          position: "absolute",
          top: "14px",
          left: "0",
          transform: "translateX(-50%)",
          fontFamily: MONO,
          fontSize: "11px",
          whiteSpace: "nowrap"
        });
      });

      const start = Math.min(origin, rounded);
      const end = Math.max(origin, rounded);

      const distance = el("div", track);
      Object.assign(distance.style, {
        position: "absolute",
        left: pos(start) + "%",
        width: (pos(end) - pos(start)) + "%",
        top: "-2px",
        borderTop: `3px dashed ${RED}`
      });

      const originalMark = el("span", track, "│");
      Object.assign(originalMark.style, {
        position: "absolute",
        left: pos(origin) + "%",
        top: "-21px",
        transform: "translateX(-50%)",
        color: INK,
        fontSize: "20px"
      });

      const roundedMark = el("span", track, "●");
      Object.assign(roundedMark.style, {
        position: "absolute",
        left: pos(rounded) + "%",
        top: "-24px",
        transform: "translateX(-50%)",
        color: RED,
        fontSize: "20px"
      });
    }

    function render() {
      try {
        const x = parseBinary(source);
        const negative = x.n < ZERO;
        const scale = ONE << BigInt(k);

        const scaledNumerator = absBig(x.n) * scale;
        const lowerMagnitude = scaledNumerator / x.d;
        const remainder = scaledNumerator % x.d;

        const halfwayComparison =
          remainder * 2n - x.d;

        const roundUpEven =
          halfwayComparison > ZERO ||
          (
            halfwayComparison === ZERO &&
            (lowerMagnitude & ONE) === ONE
          );

        const modes = [
          {
            name: "최근접 짝수 — Round to Nearest, Ties to Even",
            magnitude:
              lowerMagnitude + (roundUpEven ? ONE : ZERO)
          },
          {
            name: "0 방향 절삭 — Toward Zero",
            magnitude: lowerMagnitude
          },
          {
            name: "양의 무한대 방향 올림 — Toward +∞",
            magnitude:
              lowerMagnitude +
              (!negative && remainder !== ZERO ? ONE : ZERO)
          },
          {
            name: "음의 무한대 방향 내림 — Toward −∞",
            magnitude:
              lowerMagnitude +
              (negative && remainder !== ZERO ? ONE : ZERO)
          }
        ];

        const signedResult = magnitude => rat(
          negative ? -magnitude : magnitude,
          scale
        );

        clear(formulaHost);
        section(formulaHost, "입력값과 양자화 간격");

        formula(formulaHost, f => {
          el(
            "span",
            f,
            source + " (binary) = " +
            decimalExact(x) + " (decimal)"
          );
        });

        formula(formulaHost, f => {
          el("span", f, "남길 간격 Δ = 1 / ");
          appendPower(f, "2", k);
          el("span", f, " = " + decimalExact(rat(ONE, scale)));
        });

        clear(plotHost);
        section(plotHost, "반올림 결과 — 4개 모드");

        const originNumber = Number(x.n) / Number(x.d);
        const base = Number(lowerMagnitude) / Number(scale);
        const step = 1 / Number(scale);

        const low = negative
          ? -(base + step)
          : base;

        const high = low + step;

        modes.forEach(mode => {
          const result = signedResult(mode.magnitude);
          const value = Number(result.n) / Number(result.d);

          const block = el("div", plotHost);
          block.style.margin = "15px 0 23px";

          const heading = el("div", block, mode.name);
          heading.style.fontWeight = "600";
          heading.style.marginBottom = "5px";

          el(
            "div",
            block,
            "결과: " + decimalExact(result) +
            " · 이진: " + fixedBinary(result, k),
            "v6-val"
          );

          drawLine(
            block,
            originNumber,
            value,
            low,
            high
          );
        });

        const halfway =
          remainder !== ZERO &&
          halfwayComparison === ZERO;

        const nearest = signedResult(modes[0].magnitude);

        explanation.textContent =
          "숫자선은 각 구간 안의 상대 위치를 나타냅니다. " +
          "│는 원래 입력, 빨간 ●는 반올림 결과, 빨간 점선은 두 값 사이 거리입니다.\n\n" +
          (
            halfway
              ? "정확한 halfway(중간값)입니다.\n" +
                "최근접 짝수 반올림은 두 후보 중 반올림 후 남기는 " +
                "마지막 비트가 0인 값(정수 배율에서 짝수)을 선택합니다.\n" +
                "선택한 값: " + decimalExact(nearest) + ".\n\n"
              : "halfway가 아닙니다. 최근접 반올림은 더 가까운 후보를 선택합니다.\n\n"
          ) +
          "0 방향 절삭은 부호와 무관하게 0에 가까운 쪽을 선택합니다.\n" +
          "음의 무한대 방향 내림은 항상 작거나 같은 격자점을 선택합니다.\n" +
          "최근접 짝수 규칙은 halfway에서 특정 방향을 반복적으로 선택하는 편향을 줄입니다.";

        presetButtons.forEach(({ b, binary, bits }) => {
          selectButton(b, source === binary && k === bits);
        });
      } catch (e) {
        clear(formulaHost);
        clear(plotHost);
        message(explanation, e.message);
      }
    }

    render();
  });

})();(function () {
  "use strict";

  if (!window.V6 || typeof window.V6.register !== "function") return;

  const V6 = window.V6;
  const INK = V6.INK || "#1a1a1a";
  const RED = V6.RED || "#9e2b25";
  const GRID = V6.GRID || "#e8e6e0";

  const TWO64 = 1n << 64n;
  const U64MAX = TWO64 - 1n;
  const I32MIN = -(1n << 31n);
  const I32MAX = (1n << 31n) - 1n;
  const I64MIN = -(1n << 63n);
  const I64MAX = (1n << 63n) - 1n;

  const REGS = [
    "rax", "rcx", "rdx", "rbx",
    "rsp", "rbp", "rsi", "rdi"
  ];

  const REG32 = [
    "eax", "ecx", "edx", "ebx",
    "esp", "ebp", "esi", "edi"
  ];

  const REG8 = [
    "al", "cl", "dl", "bl",
    "spl", "bpl", "sil", "dil"
  ];

  const REG64_INDEX = new Map(
    REGS.map((r, i) => [r, i])
  );

  const REG32_INDEX = new Map(
    REG32.map((r, i) => [r, i])
  );

  const REG8_INDEX = new Map(
    REG8.map((r, i) => [r, i])
  );

  const U = (value, bits = 64) =>
    BigInt.asUintN(bits, BigInt(value));

  const I = (value, bits = 64) =>
    BigInt.asIntN(bits, BigInt(value));

  function hex(value, digits = 16) {
    return "0x" +
      BigInt(value).toString(16).toUpperCase().padStart(digits, "0");
  }

  function hx64(value) {
    return hex(U(value), 16);
  }

  function hx8(value) {
    return Number(value).toString(16).toUpperCase().padStart(2, "0");
  }

  function parseNumber(value) {
    const s = String(value).trim();

    if (/^[+-]?0x[0-9a-f]+$/i.test(s)) {
      const negative = s.startsWith("-");
      const body = s.replace(/^[+-]/, "");
      const n = BigInt(body);
      return negative ? -n : n;
    }

    if (/^[+-]?\d+$/.test(s)) return BigInt(s);

    throw new Error("10진 정수 또는 0x 형식의 16진 정수를 입력하세요.");
  }

  function requireRange(value, min, max, name) {
    if (value < min || value > max) {
      throw new Error(
        name + " 범위: " + min.toString() +
        "부터 " + max.toString() + "까지"
      );
    }
    return value;
  }

  function parseSigned32(text, name = "변위") {
    return requireRange(parseNumber(text), I32MIN, I32MAX, name);
  }

  function parseImm32(text) {
    return parseSigned32(text, "signed imm32");
  }

  function parseImm64(text) {
    return requireRange(
      parseNumber(text),
      I64MIN,
      U64MAX,
      "64비트 즉시값"
    );
  }

  function parseReg64(name) {
    const index = REG64_INDEX.get(name);
    if (index === undefined) {
      throw new Error("지원하지 않는 레지스터: %" + name);
    }
    return index;
  }

  function parseScale(value) {
    const scale = Number(value);

    if (![1, 2, 4, 8].includes(scale)) {
      throw new Error("배율(scale)은 1, 2, 4, 8 중 하나여야 합니다.");
    }

    return scale;
  }

  function node(tag, parent, text, cls) {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }
    if (parent) parent.appendChild(element);
    return element;
  }

  function button(parent, text, handler) {
    const b = node("button", parent, text, "v6-btn");
    b.type = "button";
    b.addEventListener("click", handler);
    return b;
  }

  function bar(parent) {
    return node("div", parent, "", "v6-controls");
  }

  function stateBox(parent) {
    const x = node("div", parent, "", "v6-state");
    x.setAttribute("role", "status");
    x.setAttribute("aria-live", "polite");
    return x;
  }

  function heading(parent, text) {
    const h = node("h4", parent, text, "v6-section-title");
    return h;
  }

  function title(parent, text) {
    V6.title(parent, text);
  }

  function labeled(parent, text, input) {
    const label = node("label", parent);
    node("span", label, text);
    label.appendChild(input);
    return label;
  }

  function inputText(parent, text, value) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = String(value);
    labeled(parent, text, input);
    return input;
  }

  function selectInput(parent, text, options, initial) {
    const select = document.createElement("select");

    options.forEach(([value, label]) => {
      const option = node("option", select, label);
      option.value = String(value);
    });

    select.value = String(initial);
    labeled(parent, text, select);

    return select;
  }

  function rangeInput(parent, text, min, max, value, callback) {
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    input.value = String(value);

    const label = labeled(parent, text, input);
    const current = node("span", label, hex(value, 3), "v6-val");

    input.addEventListener("input", () => {
      const n = Number(input.value);
      current.textContent = hex(n, 3);
      callback(n);
    });

    return { input, current };
  }

  function selected(buttonElement, yes) {
    buttonElement.setAttribute("aria-pressed", yes ? "true" : "false");
    buttonElement.classList.toggle("is-selected", yes);
  }

  function clear(element) {
    element.replaceChildren();
  }

  function errorState(target, message) {
    target.textContent = "안내: " + message;
  }

  function table(parent, headers) {
    const scroll = node("div", parent, "", "v6-table-scroll");
    const t = node("table", scroll, "", "v6-table");
    const head = node("thead", t);
    const row = node("tr", head);

    headers.forEach(text => {
      node("th", row, text);
    });

    const body = node("tbody", t);

    return {
      body,
      add(values, changed = []) {
        const tr = node("tr", body);
        values.forEach((value, i) => {
          const td = node("td", tr, value);
          if (changed.includes(i)) td.classList.add("v6-changed");
        });
        return tr;
      }
    };
  }

  function little(value, size) {
    let v = U(value, size * 8);
    const bytes = [];

    for (let i = 0; i < size; i++) {
      bytes.push(Number(v & 255n));
      v >>= 8n;
    }

    return bytes;
  }

  function readLE(bytes, pos, size) {
    if (pos < 0 || pos + size > bytes.length) {
      throw new Error("명령어 바이트가 잘렸습니다.");
    }

    let result = 0n;

    for (let i = 0; i < size; i++) {
      result |= BigInt(bytes[pos + i]) << BigInt(i * 8);
    }

    return result;
  }

  function signedHex(value) {
    const n = BigInt(value);
    return n < 0n ? "-" + hex(-n) : hex(n);
  }

  function memoryText(base, index, scale, displacement) {
    const disp = displacement === 0n
      ? ""
      : displacement.toString();

    if (index === null) {
      return disp + "(%" + base + ")";
    }

    return disp + "(%" + base + ",%" + index + "," + scale + ")";
  }

  // ============================================================
  // 1. Effective Address Calculator
  // ============================================================

  V6.register("addr-modes", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    title(root, "유효주소 계산기 — Addressing Modes");

    const state = {
      rbx: 0x40n,
      rcx: 0x10n,
      scale: 4,
      disp: 8n,
      mode: "lea",
      error: ""
    };

    const inputBar = bar(root);

    const rbxControl = rangeInput(
      inputBar, "%rbx", 0, 0x200, 0x40,
      value => {
        state.rbx = BigInt(value);
        render();
      }
    );

    const rcxControl = rangeInput(
      inputBar, "%rcx", 0, 0x200, 0x10,
      value => {
        state.rcx = BigInt(value);
        render();
      }
    );

    const scaleSelect = selectInput(
      inputBar,
      "Scale (배율)",
      [1, 2, 4, 8].map(x => [x, String(x)]),
      4
    );

    const dispInput = inputText(
      inputBar,
      "Displacement (변위)",
      "8"
    );

    const dispCurrent = node(
      "span",
      inputBar,
      "8",
      "v6-val"
    );

    const modeBar = bar(root);

    const leaButton = button(modeBar, "leaq — 주소 계산", () => {
      state.mode = "lea";
      render();
    });

    const movButton = button(modeBar, "movq — 메모리 읽기", () => {
      state.mode = "mov";
      render();
    });

    const calculation = stateBox(root);
    const memoryHost = node("section", root);
    const formHost = node("section", root);
    const explanation = stateBox(root);

    // Deterministic teaching memory, byte-addressed.
    const memory = new Map();

    function writeQ(address, value) {
      little(value, 8).forEach((byte, i) => {
        memory.set(address + BigInt(i), byte);
      });
    }

    for (let address = 0n; address <= 0x1200n; address += 8n) {
      writeQ(address, 0x1122334455660000n + address);
    }

    function readQ(address) {
      let value = 0n;

      for (let i = 0n; i < 8n; i++) {
        const byte = memory.get(address + i);
        if (byte === undefined) return null;
        value |= BigInt(byte) << (8n * i);
      }

      return value;
    }

    function validateConfig(input) {
      const result = {
        rbx: state.rbx,
        rcx: state.rcx,
        scale: state.scale,
        disp: state.disp
      };

      if (input.rbx !== undefined) {
        result.rbx = requireRange(
          parseNumber(input.rbx), 0n, 0x200n, "%rbx"
        );
      }

      if (input.rcx !== undefined) {
        result.rcx = requireRange(
          parseNumber(input.rcx), 0n, 0x200n, "%rcx"
        );
      }

      if (input.scale !== undefined) {
        result.scale = parseScale(input.scale);
      }

      if (input.disp !== undefined) {
        result.disp = parseSigned32(input.disp);
      }

      return result;
    }

    function readControls() {
      return validateConfig({
        rbx: rbxControl.input.value,
        rcx: rcxControl.input.value,
        scale: scaleSelect.value,
        disp: dispInput.value
      });
    }

    function syncControls() {
      rbxControl.input.value = String(state.rbx);
      rbxControl.current.textContent = hex(state.rbx, 3);

      rcxControl.input.value = String(state.rcx);
      rcxControl.current.textContent = hex(state.rcx, 3);

      scaleSelect.value = String(state.scale);
      dispInput.value = state.disp.toString();
    }

    function showError(message) {
      calculation.textContent = "안내: " + message;
      clear(memoryHost);
      clear(formHost);
      explanation.textContent =
        "유효한 입력을 입력하면 주소 계산과 메모리 표가 다시 표시됩니다.";
    }

    scaleSelect.addEventListener("change", render);
    dispInput.addEventListener("input", render);

    function render() {
      selected(leaButton, state.mode === "lea");
      selected(movButton, state.mode === "mov");

      try {
        const values = readControls();
        Object.assign(state, values);
        state.error = "";
      } catch (e) {
        state.error = e.message;
        dispCurrent.textContent = "입력 확인";
        showError(state.error);
        return;
      }

      dispCurrent.textContent =
        state.disp.toString() + " (" + signedHex(state.disp) + ")";

      const indexTerm = state.rcx * BigInt(state.scale);
      const signedAddress = state.disp + state.rbx + indexTerm;
      const ea = U(signedAddress);

      const operand = memoryText(
        "rbx", "rcx", state.scale, state.disp
      );

      const value = readQ(ea);

      const lines = [
        "피연산자(operand): " + operand,
        "",
        "EA = Imm + R[%rbx] + R[%rcx] × S",
        "   = " + state.disp +
          " + " + state.rbx +
          " + " + state.rcx + " × " + state.scale,
        "   = " + state.disp +
          " + " + state.rbx + " + " + indexTerm,
        "   = " + signedAddress,
        "64비트 EA = " + hx64(ea),
        ""
      ];

      if (state.mode === "lea") {
        lines.push(
          "leaq " + operand + ", %rax",
          "%rax ← " + hx64(ea),
          "메모리 접근 없음(no dereference)."
        );
      } else {
        lines.push("movq " + operand + ", %rax");

        if (value === null) {
          lines.push(
            "예시 메모리에 매핑되지 않은 주소입니다.",
            "실제 명령은 이 주소에서 8바이트 읽기를 시도합니다."
          );
        } else {
          lines.push(
            "%rax ← M[" + hx64(ea) + "]",
            "      = " + hx64(value)
          );
        }
      }

      calculation.textContent = lines.join("\n");

      clear(memoryHost);
      heading(memoryHost, "메모리 — Little-endian (리틀 엔디안)");

      const mt = table(memoryHost, [
        "시작 주소",
        "8바이트 (주소 증가 순서)",
        "64비트 값"
      ]);

      const aligned = ea & ~7n;

      for (let delta = -16n; delta <= 16n; delta += 8n) {
        const start = aligned + delta;
        if (start < 0n) continue;

        const bytes = [];
        for (let i = 0n; i < 8n; i++) {
          const b = memory.get(start + i);
          bytes.push(b === undefined ? "??" : hx8(b));
        }

        const word = readQ(start);

        mt.add([
          hx64(start),
          bytes.join(" "),
          word === null ? "미매핑" : hx64(word)
        ], start <= ea && ea < start + 8n ? [0, 1] : []);
      }

      clear(formHost);
      heading(formHost, "주소 지정 형태 — Addressing Forms");

      const ft = table(formHost, [
        "표기",
        "계산",
        "특징"
      ]);

      ft.add([
        "(%rbx)", "R[%rbx]", "Base register"
      ]);

      ft.add([
        "(%rbx,%rcx)",
        "R[%rbx] + R[%rcx]",
        "Base + index"
      ]);

      ft.add([
        "16(%rbx)",
        "16 + R[%rbx]",
        "Base + displacement"
      ]);

      ft.add([
        "16(%rbx,%rcx,4)",
        "16 + R[%rbx] + 4×R[%rcx]",
        "Base + scaled index"
      ]);

      ft.add([
        "16(,%rcx,4)",
        "16 + 4×R[%rcx]",
        "SIB, base 없음"
      ]);

      ft.add([
        "16",
        "절대주소 16 (메모리 피연산자 문맥)",
        "표기·인코딩 가능 여부는 명령 형식에 의존"
      ]);

      ft.add([
        "16(%rip)",
        "다음 RIP + 16",
        "RIP-relative, 절대주소와 다름"
      ]);

      explanation.textContent =
        "leaq는 유효주소만 계산합니다. movq는 해당 주소를 역참조합니다.\n" +
        "x86-64의 주소 계산은 64비트 모듈러 연산입니다.\n" +
        "이 계산기는 %rbx/%rcx와 scale 1·2·4·8만 선택적으로 사용합니다.";
    }

    try {
      Object.assign(state, validateConfig(cfg));
      syncControls();
    } catch (e) {
      state.error = e.message;
      showError("data-config 오류: " + e.message);
      syncControls();
      // Preserve the reported error until a user interaction.
      return;
    }

    render();
  });

  // ============================================================
  // 2. Mini x86-64 Simulator
  // ============================================================

  V6.register("asm-sim", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    title(root, "x86-64 명령어 실행기 — Machine-Level Execution");

    const STACK_BASE = 0x1000n;
    const STACK_SIZE = 256;
    const STACK_END = STACK_BASE + BigInt(STACK_SIZE);

    const PROGRAMS = [
      {
        name: "산술: OF와 CF",
        code: [
          "movabsq $0x7fffffffffffffff, %rax",
          "addq $1, %rax",
          "movq $-1, %rbx",
          "addq $1, %rbx",
          "subq $1, %rbx",
          "negq %rbx",
          "notq %rbx"
        ]
      },
      {
        name: "leaq 산술 트릭",
        code: [
          "movq $7, %rdi",
          "leaq (%rdi,%rdi,2), %rax",
          "leaq 5(%rax,%rdi,4), %rbx",
          "subq $1, %rbx"
        ]
      },
      {
        name: "cmp + jcc 카운트다운",
        code: [
          "movq $4, %rcx",
          "movq $0, %rax",
          "loop:",
          "addq %rcx, %rax",
          "decq %rcx",
          "cmpq $0, %rcx",
          "jg loop"
        ]
      },
      {
        name: "조건 선택: 분기",
        code: [
          "movq $9, %rdi",
          "movq $12, %rsi",
          "cmpq %rsi, %rdi",
          "jge use_a",
          "movq %rsi, %rax",
          "jmp done",
          "use_a:",
          "movq %rdi, %rax",
          "done:",
          "nop"
        ]
      },
      {
        name: "조건 선택: cmov",
        code: [
          "movq $9, %rdi",
          "movq $12, %rsi",
          "movq %rsi, %rax",
          "cmpq %rsi, %rdi",
          "cmovge %rdi, %rax",
          "nop"
        ]
      },
      {
        name: "swap: push/pop",
        code: [
          "movq $17, %rax",
          "movq $42, %rbx",
          "pushq %rax",
          "movq %rbx, %rax",
          "popq %rbx",
          "nop"
        ]
      },
      {
        name: "논리·시프트·부호",
        code: [
          "movq $-8, %rax",
          "sarq $1, %rax",
          "shrq $1, %rax",
          "salq $1, %rax",
          "testq %rax, %rax",
          "negq %rax"
        ]
      },
      {
        name: "imul 이후 CF 기반 분기",
        code: [
          "movabsq $0x7fffffffffffffff, %rax",
          "movq $2, %rbx",
          "imulq %rbx, %rax",
          "jb overflow",
          "movq $0, %rdx",
          "jmp done",
          "overflow:",
          "movq $1, %rdx",
          "done:",
          "nop"
        ]
      }
    ];

    const initialPreset =
      Number.isInteger(cfg.preset) &&
      cfg.preset >= 0 &&
      cfg.preset < PROGRAMS.length
        ? cfg.preset
        : 0;

    let preset = initialPreset;
    let program = [];
    let labels = new Map();
    let machine;
    let history = [];
    let lastChanges = null;
    let explanation = "";
    let timer = null;
    let executionError = null;

    function initialMachine() {
      const regs = {};

      REGS.forEach(reg => {
        regs[reg] = 0n;
      });

      regs.rsp = STACK_END;
      regs.rbp = STACK_END;

      return {
        regs,
        flags: {
          ZF: 0,
          SF: 0,
          CF: 0,
          OF: 0
        },
        memory: new Uint8Array(STACK_SIZE),
        pc: 0,
        steps: 0,
        halted: false
      };
    }

    function cloneMachine(m) {
      return {
        regs: { ...m.regs },
        flags: { ...m.flags },
        memory: new Uint8Array(m.memory),
        pc: m.pc,
        steps: m.steps,
        halted: m.halted
      };
    }

    function compile(lines) {
      const instructions = [];
      const labelMap = new Map();

      lines.forEach((line, sourceLine) => {
        const clean = line.trim();
        if (!clean) return;

        if (/^[A-Za-z_]\w*:$/.test(clean)) {
          const name = clean.slice(0, -1);

          if (labelMap.has(name)) {
            throw new Error("중복 레이블: " + name);
          }

          labelMap.set(name, instructions.length);
          return;
        }

        instructions.push({
          text: clean,
          sourceLine
        });
      });

      return { instructions, labels: labelMap };
    }

    function splitOperands(source) {
      const parts = [];
      let depth = 0;
      let start = 0;

      for (let i = 0; i < source.length; i++) {
        if (source[i] === "(") depth++;
        if (source[i] === ")") depth--;

        if (depth < 0) {
          throw new Error("메모리 피연산자의 괄호가 잘못되었습니다.");
        }

        if (source[i] === "," && depth === 0) {
          parts.push(source.slice(start, i).trim());
          start = i + 1;
        }
      }

      if (depth !== 0) {
        throw new Error("메모리 피연산자의 괄호가 잘못되었습니다.");
      }

      const rest = source.slice(start).trim();
      if (rest) parts.push(rest);

      return parts;
    }

    function parseOperand(source) {
      const s = source.trim();

      if (s.startsWith("$")) {
        return {
          type: "imm",
          value: parseNumber(s.slice(1))
        };
      }

      if (/^%[A-Za-z0-9]+$/.test(s)) {
        return {
          type: "reg",
          name: s.slice(1).toLowerCase()
        };
      }

      const mem =
        /^([^()]*)\((%[A-Za-z0-9]+)(?:,(%[A-Za-z0-9]+)(?:,([1248]))?)?\)$/.exec(s);

      if (mem) {
        const base = mem[2].slice(1).toLowerCase();
        const index = mem[3]
          ? mem[3].slice(1).toLowerCase()
          : null;

        parseReg64(base);
        if (index !== null) parseReg64(index);

        if (index === "rsp") {
          throw new Error("%rsp는 x86-64 SIB index로 사용할 수 없습니다.");
        }

        return {
          type: "mem",
          disp: mem[1] ? parseSigned32(mem[1]) : 0n,
          base,
          index,
          scale: mem[4] ? parseScale(mem[4]) : 1
        };
      }

      // Symbolic branch target; required for `jg loop`.
      if (/^[A-Za-z_]\w*$/.test(s)) {
        return {
          type: "label",
          name: s
        };
      }

      throw new Error("지원하지 않는 피연산자: " + s);
    }

    function registerInfo(name) {
      if (REG64_INDEX.has(name)) {
        return {
          full: REGS[REG64_INDEX.get(name)],
          bits: 64
        };
      }

      if (REG32_INDEX.has(name)) {
        return {
          full: REGS[REG32_INDEX.get(name)],
          bits: 32
        };
      }

      if (REG8_INDEX.has(name)) {
        return {
          full: REGS[REG8_INDEX.get(name)],
          bits: 8
        };
      }

      throw new Error("지원하지 않는 레지스터: %" + name);
    }

    function regRead(name, bits) {
      const info = registerInfo(name);

      if (info.bits !== bits) {
        throw new Error(
          "%" + name + "는 " + bits + "비트 레지스터가 아닙니다."
        );
      }

      return U(machine.regs[info.full], bits);
    }

    function regWrite(name, value, bits) {
      const info = registerInfo(name);

      if (info.bits !== bits) {
        throw new Error("레지스터 폭이 명령어와 일치하지 않습니다.");
      }

      if (bits === 64) {
        machine.regs[info.full] = U(value, 64);
      } else if (bits === 32) {
        // x86-64 writes to r32 zero-extend to the full r64.
        machine.regs[info.full] = U(value, 32);
      } else {
        const old = machine.regs[info.full];
        machine.regs[info.full] =
          U((old & ~255n) | U(value, 8));
      }
    }

    function effectiveAddress(op) {
      if (op.type !== "mem") {
        throw new Error("메모리 피연산자가 필요합니다.");
      }

      return U(
        machine.regs[op.base] +
        (op.index ? machine.regs[op.index] : 0n) *
          BigInt(op.scale) +
        op.disp
      );
    }

    function memoryOffset(address, bytes) {
      const offset = address - STACK_BASE;

      if (
        offset < 0n ||
        offset + BigInt(bytes) > BigInt(STACK_SIZE)
      ) {
        throw new Error(
          "스택 창 범위 밖 메모리 접근: " + hx64(address)
        );
      }

      return Number(offset);
    }

    function memRead(address, size) {
      const start = memoryOffset(address, size);
      return readLE(machine.memory, start, size);
    }

    function memWrite(address, value, size) {
      const start = memoryOffset(address, size);
      const bytes = little(value, size);

      bytes.forEach((b, i) => {
        machine.memory[start + i] = b;
      });
    }

    function readOperand(op, bits) {
      if (op.type === "imm") return U(op.value, bits);
      if (op.type === "reg") return regRead(op.name, bits);
      if (op.type === "mem") {
        return memRead(effectiveAddress(op), bits / 8);
      }

      throw new Error("레이블은 데이터 피연산자가 아닙니다.");
    }

    function writeOperand(op, value, bits) {
      if (op.type === "reg") {
        regWrite(op.name, value, bits);
        return;
      }

      if (op.type === "mem") {
        memWrite(effectiveAddress(op), value, bits / 8);
        return;
      }

      throw new Error("목적지는 레지스터 또는 메모리여야 합니다.");
    }

    function assertOperands(opcode, args, spec) {
      if (args.length !== spec.length) {
        throw new Error(
          opcode + ": 피연산자 " + spec.length + "개가 필요합니다."
        );
      }

      args.forEach((arg, i) => {
        const allowed = spec[i];

        if (!allowed.includes(arg.type)) {
          throw new Error(
            opcode + ": " + (i + 1) + "번째 피연산자는 " +
            allowed.join("/") + "만 허용됩니다."
          );
        }
      });

      if (
        args.length === 2 &&
        args[0].type === "mem" &&
        args[1].type === "mem"
      ) {
        throw new Error(
          opcode + ": 메모리→메모리 직접 연산은 허용되지 않습니다."
        );
      }

      // For this subset, imm32 is sign-extended in 64-bit arithmetic.
      // movabsq is the only instruction with a full imm64 source.
      if (
        args.length &&
        args[0].type === "imm" &&
        opcode !== "movabsq" &&
        opcode !== "movq" &&
        opcode !== "movl" &&
        opcode !== "movzbl"
      ) {
        parseImm32(args[0].value.toString());
      }

      if (opcode === "movq" && args[0].type === "imm") {
        parseImm32(args[0].value.toString());
      }

      if (opcode === "movl" && args[0].type === "imm") {
        const n = args[0].value;
        if (n < I32MIN || n > 0xffffffffn) {
          throw new Error("movl immediate는 32비트 패턴이어야 합니다.");
        }
      }
    }

    function bitSign(v, bits = 64) {
      return Number((U(v, bits) >> BigInt(bits - 1)) & 1n);
    }

    function updateZS(result, bits = 64) {
      const r = U(result, bits);
      machine.flags.ZF = r === 0n ? 1 : 0;
      machine.flags.SF = bitSign(r, bits);
    }

    function addFlags(a, b, bits = 64) {
      const A = U(a, bits);
      const B = U(b, bits);
      const full = A + B;
      const result = U(full, bits);

      const sa = bitSign(A, bits);
      const sb = bitSign(B, bits);
      const sr = bitSign(result, bits);

      updateZS(result, bits);
      machine.flags.CF =
        full >= (1n << BigInt(bits)) ? 1 : 0;
      machine.flags.OF =
        sa === sb && sr !== sa ? 1 : 0;

      return result;
    }

    function subFlags(a, b, bits = 64) {
      const A = U(a, bits);
      const B = U(b, bits);
      const result = U(A - B, bits);

      const sa = bitSign(A, bits);
      const sb = bitSign(B, bits);
      const sr = bitSign(result, bits);

      updateZS(result, bits);
      machine.flags.CF = A < B ? 1 : 0;
      machine.flags.OF =
        sa !== sb && sr !== sa ? 1 : 0;

      return result;
    }

    function logicalFlags(result) {
      updateZS(result);
      machine.flags.CF = 0;
      machine.flags.OF = 0;
    }

    // A conditional instruction checks only the flags it actually uses.
    function condition(suffix) {
      const f = machine.flags;

      const needed = {
        e: ["ZF"],
        z: ["ZF"],
        ne: ["ZF"],
        nz: ["ZF"],
        s: ["SF"],
        ns: ["SF"],
        b: ["CF"],
        ae: ["CF"],
        a: ["CF", "ZF"],
        be: ["CF", "ZF"],
        l: ["SF", "OF"],
        ge: ["SF", "OF"],
        g: ["ZF", "SF", "OF"],
        le: ["ZF", "SF", "OF"]
      }[suffix];

      if (!needed) {
        throw new Error("지원하지 않는 조건 코드: " + suffix);
      }

      for (const name of needed) {
        if (f[name] === null) {
          throw new Error(
            suffix + " 조건 평가에 필요한 " +
            name + " 플래그가 미정의입니다."
          );
        }
      }

      const { ZF: Z, SF: S, CF: C, OF: O } = f;

      switch (suffix) {
        case "e":
        case "z": return Z === 1;
        case "ne":
        case "nz": return Z === 0;
        case "s": return S === 1;
        case "ns": return S === 0;
        case "b": return C === 1;
        case "ae": return C === 0;
        case "a": return C === 0 && Z === 0;
        case "be": return C === 1 || Z === 1;
        case "l": return S !== O;
        case "ge": return S === O;
        case "g": return Z === 0 && S === O;
        case "le": return Z === 1 || S !== O;
      }
    }

    function executeInstruction() {
      if (machine.halted) return;

      if (machine.pc >= program.length) {
        machine.halted = true;
        return;
      }

      const text = program[machine.pc].text;
      const match = /^([a-z][a-z0-9]*)\s*(.*)$/i.exec(text);

      if (!match) throw new Error("명령어 구문 오류: " + text);

      const op = match[1].toLowerCase();
      const args = splitOperands(match[2]).map(parseOperand);

      let nextPC = machine.pc + 1;
      let detail = "";

      if (op === "nop") {
        assertOperands(op, args, []);
        detail = "nop: 상태를 변경하지 않습니다.";
      }

      else if (op === "movq" || op === "movl" || op === "movabsq") {
        const bits = op === "movl" ? 32 : 64;

        assertOperands(op, args, [
          ["imm", "reg", "mem"],
          ["reg", "mem"]
        ]);

        if (op === "movabsq") {
          if (args[0].type !== "imm" || args[1].type !== "reg") {
            throw new Error("movabsq는 imm64→r64만 지원합니다.");
          }
          parseImm64(args[0].value.toString());
        }

        const value = readOperand(args[0], bits);
        writeOperand(args[1], value, bits);

        detail = op === "movl"
          ? "movl: r32 목적지에 쓸 때 상위 32비트가 0으로 클리어됩니다."
          : op === "movabsq"
            ? "movabsq: 전체 64비트 즉시값을 레지스터에 기록합니다."
            : "movq: 64비트 값을 이동하며 플래그는 변경하지 않습니다.";
      }

      else if (op === "movzbl") {
        assertOperands(op, args, [
          ["reg", "mem"],
          ["reg"]
        ]);

        let byte;

        if (args[0].type === "mem") {
          byte = memRead(effectiveAddress(args[0]), 1);
        } else {
          byte = regRead(args[0].name, 8);
        }

        writeOperand(args[1], byte, 32);
        detail =
          "movzbl: 8비트를 zero-extend해 r32에 기록합니다. " +
          "r64의 상위 32비트도 0이 됩니다.";
      }

      else if (op === "leaq") {
        assertOperands(op, args, [
          ["mem"],
          ["reg"]
        ]);

        const address = effectiveAddress(args[0]);
        writeOperand(args[1], address, 64);

        detail =
          "leaq: 메모리를 읽지 않고 주소 " +
          hx64(address) + "를 계산했습니다.";
      }

      else if (
        ["addq", "subq", "imulq", "xorq", "andq", "orq"]
          .includes(op)
      ) {
        assertOperands(op, args, [
          op === "imulq" ? ["reg", "mem"] : ["imm", "reg", "mem"],
          ["reg", "mem"]
        ]);

        if (op === "imulq" && args[1].type !== "reg") {
          throw new Error("2피연산자 imulq의 목적지는 레지스터입니다.");
        }

        const src = readOperand(args[0], 64);
        const dst = readOperand(args[1], 64);
        let result;

        if (op === "addq") {
          result = addFlags(dst, src);
          detail =
            "addq: OF=" + machine.flags.OF +
            " (signed overflow), CF=" + machine.flags.CF +
            " (unsigned carry-out).";
        } else if (op === "subq") {
          result = subFlags(dst, src);
          detail =
            "subq: destination−source. CF=" +
            machine.flags.CF + " (unsigned borrow).";
        } else if (op === "imulq") {
          const full = I(dst) * I(src);
          result = U(full);

          const overflow = full !== I(result) ? 1 : 0;
          machine.flags.CF = overflow;
          machine.flags.OF = overflow;
          machine.flags.ZF = null;
          machine.flags.SF = null;

          detail =
            "imulq: 하위 64비트만 저장. CF=OF=" +
            overflow + "; ZF/SF는 미정의입니다.";
        } else {
          result =
            op === "xorq" ? dst ^ src :
            op === "andq" ? dst & src :
            dst | src;

          logicalFlags(result);
          detail =
            op + ": CF=OF=0, ZF/SF는 결과에 따라 갱신됩니다.";
        }

        writeOperand(args[1], result, 64);
      }

      else if (["salq", "sarq", "shrq"].includes(op)) {
        assertOperands(op, args, [
          ["imm", "reg"],
          ["reg", "mem"]
        ]);

        if (
          args[0].type === "reg" &&
          args[0].name !== "cl"
        ) {
          throw new Error("시프트 횟수 레지스터는 %cl만 가능합니다.");
        }

        const rawCount = readOperand(
          args[0],
          args[0].type === "reg" ? 8 : 64
        );

        if (args[0].type === "imm") {
          requireRange(args[0].value, 0n, 255n, "shift imm8");
        }

        const count = Number(rawCount & 63n);
        const old = readOperand(args[1], 64);

        if (count !== 0) {
          let result;
          let cf;

          if (op === "salq") {
            cf = Number((old >> BigInt(64 - count)) & 1n);
            result = U(old << BigInt(count));
          } else if (op === "shrq") {
            cf = Number((old >> BigInt(count - 1)) & 1n);
            result = old >> BigInt(count);
          } else {
            cf = Number((old >> BigInt(count - 1)) & 1n);
            result = U(I(old) >> BigInt(count));
          }

          writeOperand(args[1], result, 64);
          updateZS(result);
          machine.flags.CF = cf;

          if (count === 1) {
            machine.flags.OF =
              op === "salq" ? bitSign(result) ^ cf :
              op === "shrq" ? bitSign(old) :
              0;
          } else {
            machine.flags.OF = null;
          }

          detail =
            op + ": 실효 이동 횟수 " + count +
            ". CF는 마지막으로 밀려난 비트입니다." +
            (count > 1 ? " OF는 미정의입니다." : "");
        } else {
          detail =
            op + ": 실효 이동 횟수 0. 값과 플래그를 유지합니다.";
        }
      }

      else if (["incq", "decq", "negq", "notq"].includes(op)) {
        assertOperands(op, args, [["reg", "mem"]]);

        const old = readOperand(args[0], 64);
        let result;

        if (op === "notq") {
          result = U(~old);
          detail = "notq: 모든 비트를 반전. 플래그는 변경하지 않습니다.";
        } else if (op === "negq") {
          result = subFlags(0n, old);
          machine.flags.CF = old === 0n ? 0 : 1;
          detail =
            "negq: 0−operand. 0이 아닌 값은 CF=1, TMin은 OF=1.";
        } else {
          const oldCF = machine.flags.CF;
          result = op === "incq"
            ? addFlags(old, 1n)
            : subFlags(old, 1n);
          machine.flags.CF = oldCF;

          detail =
            op + ": 값과 ZF/SF/OF를 갱신하지만 CF는 유지합니다.";
        }

        writeOperand(args[0], result, 64);
      }

      else if (op === "cmpq" || op === "testq") {
        assertOperands(op, args, [
          ["imm", "reg", "mem"],
          ["reg", "mem"]
        ]);

        const src = readOperand(args[0], 64);
        const dst = readOperand(args[1], 64);

        if (op === "cmpq") {
          subFlags(dst, src);
          detail =
            "cmpq b,a: a−b의 플래그만 갱신합니다.";
        } else {
          logicalFlags(src & dst);
          detail =
            "testq: a&b의 플래그만 갱신합니다. CF=OF=0.";
        }
      }

      else if (op === "pushq") {
        assertOperands(op, args, [["imm", "reg", "mem"]]);

        const value = readOperand(args[0], 64);
        const newSP = U(machine.regs.rsp - 8n);

        memWrite(newSP, value, 8);
        machine.regs.rsp = newSP;

        detail =
          "pushq: %rsp를 8 감소시킨 다음 8바이트를 기록합니다.";
      }

      else if (op === "popq") {
        assertOperands(op, args, [["reg", "mem"]]);

        const oldSP = machine.regs.rsp;
        const value = memRead(oldSP, 8);
        machine.regs.rsp = U(oldSP + 8n);
        writeOperand(args[0], value, 64);

        detail =
          "popq: 기존 %rsp에서 8바이트를 읽고 스택 포인터를 증가시킵니다.";
      }

      else if (op === "jmp" || /^j(e|ne|s|ns|g|ge|l|le|a|b)$/.test(op)) {
        assertOperands(op, args, [["label"]]);

        const target = args[0].name;

        if (!labels.has(target)) {
          throw new Error("정의되지 않은 레이블: " + target);
        }

        const take = op === "jmp"
          ? true
          : condition(op.slice(1));

        if (take) nextPC = labels.get(target);

        detail =
          op + " " + target + ": " +
          (take ? "분기함" : "분기하지 않음") +
          ", 다음 PC=" + nextPC;
      }

      else if (/^cmov(e|ne|s|ns|g|ge|l|le|a|b)q?$/.test(op)) {
        assertOperands(op, args, [
          ["reg", "mem"],
          ["reg"]
        ]);

        const suffix = op.slice(4).replace(/q$/, "");
        const take = condition(suffix);

        // CMOV reads the source even when the condition is false.
        const value = readOperand(args[0], 64);

        if (take) {
          writeOperand(args[1], value, 64);
        }

        detail =
          op + ": 조건 " +
          (take ? "참 — 목적지 갱신" : "거짓 — 목적지 유지") +
          ". 분기 없는 조건부 이동입니다.";
      }

      else {
        throw new Error("지원하지 않는 명령어: " + op);
      }

      machine.pc = nextPC;
      machine.steps++;

      if (nextPC >= program.length) {
        machine.halted = true;
      }

      explanation = detail;
    }

    const top = bar(root);

    const selector = selectInput(
      top,
      "예제 프로그램(Preset)",
      PROGRAMS.map((p, i) => [i, p.name]),
      preset
    );

    const actionBar = bar(root);

    const stepButton = button(actionBar, "한 단계", step);
    const undoButton = button(actionBar, "되돌리기", undo);
    const autoButton = button(actionBar, "자동 재생", auto);
    button(actionBar, "리셋", reset);

    const status = stateBox(root);
    const codeHost = node("section", root);
    const regHost = node("section", root);
    const flagHost = node("section", root);
    const stackHost = node("section", root);
    const note = stateBox(root);

    selector.addEventListener("change", () => {
      preset = Number(selector.value);
      reset();
    });

    function stopAuto() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }

      autoButton.textContent = "자동 재생";
      selected(autoButton, false);
    }

    function reset() {
      stopAuto();

      const compiled = compile(PROGRAMS[preset].code);
      program = compiled.instructions;
      labels = compiled.labels;

      machine = initialMachine();
      history = [];
      lastChanges = null;
      executionError = null;

      explanation =
        "예제 프로그램을 선택한 뒤 한 단계씩 실행합니다.";

      render();
    }

    function diff(before, after) {
      const regs = new Set();
      const flags = new Set();
      const memory = new Set();

      REGS.forEach(r => {
        if (before.regs[r] !== after.regs[r]) regs.add(r);
      });

      ["ZF", "SF", "CF", "OF"].forEach(f => {
        if (before.flags[f] !== after.flags[f]) flags.add(f);
      });

      for (let i = 0; i < STACK_SIZE; i++) {
        if (before.memory[i] !== after.memory[i]) {
          memory.add(i);
        }
      }

      return { regs, flags, memory };
    }

    function executeOne() {
      if (machine.halted) return false;

      const before = cloneMachine(machine);

      try {
        executeInstruction();
        history.push(before);
        lastChanges = diff(before, machine);
        executionError = null;
        return true;
      } catch (e) {
        machine = before;
        lastChanges = null;
        executionError = e.message;
        explanation = "실행 오류: " + e.message;
        return false;
      }
    }

    function step() {
      stopAuto();
      executeOne();
      render();
    }

    function undo() {
      stopAuto();

      if (history.length) {
        machine = history.pop();
        explanation = "직전 실행을 되돌렸습니다.";
        executionError = null;
        lastChanges = null;
      } else {
        explanation = "되돌릴 실행 기록이 없습니다.";
      }

      render();
    }

    function auto() {
      if (timer !== null) {
        stopAuto();
        render();
        return;
      }

      if (machine.halted) return;

      autoButton.textContent = "자동 재생 중지";
      selected(autoButton, true);

      timer = setInterval(() => {
        if (machine.steps >= 200) {
          explanation = "자동 재생 안전 제한: 최대 200단계입니다.";
          stopAuto();
          render();
          return;
        }

        const ok = executeOne();

        if (!ok || machine.halted) stopAuto();
        render();
      }, 550);
    }

    function render() {
      stepButton.disabled = machine.halted;
      undoButton.disabled = history.length === 0;

      status.textContent =
        "PC=" + machine.pc +
        " · 실행 횟수=" + machine.steps +
        " · " + (machine.halted ? "종료" : "실행 가능") +
        (executionError ? "\n오류: " + executionError : "");

      clear(codeHost);
      heading(codeHost, "명령어 흐름 — Instruction Trace");

      const code = node("div", codeHost, "", "v6-code-list");

      program.forEach((instruction, index) => {
        const row = node(
          "div",
          code,
          String(index).padStart(2, "0") +
            "  " + instruction.text
        );

        if (index === machine.pc && !machine.halted) {
          row.classList.add("is-current");
        }
      });

      clear(regHost);
      heading(regHost, "레지스터 — 64-bit Registers");

      const regs = table(regHost, [
        "레지스터",
        "Hex",
        "Signed decimal"
      ]);

      REGS.forEach(r => {
        const changed =
          lastChanges && lastChanges.regs.has(r);

        regs.add([
          "%" + r,
          hx64(machine.regs[r]),
          I(machine.regs[r]).toString()
        ], changed ? [0, 1, 2] : []);
      });

      clear(flagHost);
      heading(flagHost, "조건 코드 — Condition Codes");

      const flags = table(flagHost, [
        "플래그", "현재 값", "의미"
      ]);

      const meanings = {
        ZF: "Zero Flag",
        SF: "Sign Flag",
        CF: "Carry / Borrow Flag",
        OF: "Overflow Flag"
      };

      ["ZF", "SF", "CF", "OF"].forEach(f => {
        const changed =
          lastChanges && lastChanges.flags.has(f);

        const value = machine.flags[f];

        flags.add([
          f,
          value === null ? "미정의" : String(value),
          meanings[f]
        ], changed ? [0, 1] : []);
      });

      clear(stackHost);
      heading(stackHost, "스택 메모리 — 256 Bytes");

      const stack = table(stackHost, [
        "주소",
        "낮은 주소 → 높은 주소 (8바이트)"
      ]);

      for (let offset = 0; offset < STACK_SIZE; offset += 8) {
        const addr = STACK_BASE + BigInt(offset);

        const row = stack.add([
          hx64(addr) +
            (addr === machine.regs.rsp ? " ← %rsp" : ""),
          ""
        ]);

        const cell = row.children[1];
        cell.classList.add("v6-byte-sequence");

        for (let j = 0; j < 8; j++) {
          const index = offset + j;
          const span = node(
            "span",
            cell,
            hx8(machine.memory[index]) + (j === 7 ? "" : " ")
          );

          if (
            lastChanges &&
            lastChanges.memory.has(index)
          ) {
            span.classList.add("v6-changed");
          }
        }
      }

      note.textContent =
        explanation +
        "\n\n초기 ZF/SF/CF/OF=0은 교육용 초기값입니다.\n" +
        "64비트 산술 immediate는 sign-extended imm32 범위만 지원합니다. " +
        "전체 imm64 이동은 movabsq에서만 지원합니다.\n" +
        "이 실행기는 교육용 부분집합이며 실제 프로세스 전체 메모리를 모사하지 않습니다.";
    }

    reset();
  });

  // ============================================================
  // 3. x86-64 Encoding / Decoding
  // ============================================================

  V6.register("asm-encode", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    title(root, "x86-64 인코딩·디코딩 — Objdump Reading");

    const coverage = stateBox(root);

    coverage.textContent =
      "지원 범위(Coverage)\n" +
      "• pushq/popq %rbp, retq, nop, leaveq\n" +
      "• movq %rsp,%rbp / movq %rbp,%rsp\n" +
      "• movq 기본 8개 레지스터 ↔ 메모리, ModRM/SIB/disp\n" +
      "• subq $imm8,%rsp\n" +
      "• movq $signed-imm32,%r64 (C7 /0)\n" +
      "• movabsq $imm64,%r64 (B8+r)\n" +
      "• call rel32\n\n" +
      "부분집합 제한: REX.W=0x48 고정, rax/rcx/rdx/rbx/" +
      "rsp/rbp/rsi/rdi만 지원합니다. R8–R15, REX.R/X/B, " +
      "주소 크기 override, segment prefix, 일반 x86-64 ISA는 지원하지 않습니다.";

    const state = {
      mode: "encode",
      selected: "push",
      bytes: [],
      fields: [],
      asm: "",
      error: ""
    };

    const modeBar = bar(root);

    const encodeButton = button(modeBar, "인코드(Encode)", () => {
      state.mode = "encode";
      render();
    });

    const decodeButton = button(modeBar, "디코드(Decode)", () => {
      state.mode = "decode";
      render();
    });

    const selectionBar = bar(root);

    const OPTIONS = [
      ["push", "pushq %rbp"],
      ["pop", "popq %rbp"],
      ["ret", "retq"],
      ["nop", "nop"],
      ["leave", "leaveq"],
      ["mov-rsp-rbp", "movq %rsp,%rbp"],
      ["mov-rbp-rsp", "movq %rbp,%rsp"],
      ["mov-store", "movq r64 → memory"],
      ["mov-load", "movq memory → r64"],
      ["sub-rsp", "subq $imm8,%rsp"],
      ["mov-imm32", "movq $imm32,%r64"],
      ["movabs", "movabsq $imm64,%r64"],
      ["call", "call rel32"]
    ];

    const instructionSelect = selectInput(
      selectionBar,
      "명령어",
      OPTIONS,
      OPTIONS.some(x => x[0] === cfg.preset)
        ? cfg.preset
        : "push"
    );

    state.selected = instructionSelect.value;

    const regSelect = selectInput(
      selectionBar,
      "레지스터",
      REGS.map(r => [r, "%" + r]),
      "rax"
    );

    const baseSelect = selectInput(
      selectionBar,
      "Base",
      REGS.map(r => [r, "%" + r]),
      "rbx"
    );

    const indexSelect = selectInput(
      selectionBar,
      "Index",
      [
        ["none", "없음"],
        ...REGS.filter(r => r !== "rsp")
          .map(r => [r, "%" + r])
      ],
      "rcx"
    );

    const scaleSelect = selectInput(
      selectionBar,
      "Scale",
      [1, 2, 4, 8].map(n => [n, String(n)]),
      4
    );

    const dispInput = inputText(selectionBar, "Disp", "16");
    const immInput = inputText(selectionBar, "Immediate", "8");

    const hexBar = bar(root);
    const hexInput = inputText(
      hexBar,
      "Hex bytes",
      "48 89 E5"
    );

    const ripInput = inputText(
      hexBar,
      "기준 RIP (명령 시작 주소)",
      "0x401000"
    );

    const runBar = bar(root);
    button(runBar, "인코딩 / 디코딩 실행", render);

    const resultHost = node("section", root);
    const details = stateBox(root);
    const roundTrip = stateBox(root);
    const objdump = stateBox(root);

    function setVisible(input, show) {
      const parent = input.closest("label");
      if (parent) parent.hidden = !show;
    }

    function updateControls() {
      const encoding = state.mode === "encode";
      const kind = state.selected;

      selected(encodeButton, encoding);
      selected(decodeButton, !encoding);

      encodeButton.setAttribute(
        "aria-pressed",
        encoding ? "true" : "false"
      );

      decodeButton.setAttribute(
        "aria-pressed",
        encoding ? "false" : "true"
      );

      setVisible(instructionSelect, encoding);
      setVisible(hexInput, !encoding);

      const memory =
        kind === "mov-store" || kind === "mov-load";

      setVisible(regSelect,
        encoding && (memory ||
          kind === "mov-imm32" ||
          kind === "movabs")
      );

      setVisible(baseSelect, encoding && memory);
      setVisible(indexSelect, encoding && memory);
      setVisible(scaleSelect, encoding && memory);
      setVisible(dispInput, encoding && memory);

      setVisible(immInput,
        encoding &&
        ["sub-rsp", "mov-imm32", "movabs", "call"].includes(kind)
      );

      setVisible(ripInput,
        !encoding || kind === "call"
      );
    }

    function regCode(name) {
      return parseReg64(name);
    }

    function modrm(mod, reg, rm) {
      return (mod << 6) | (reg << 3) | rm;
    }

    function sib(scale, index, base) {
      const shift = Math.log2(scale);
      return (shift << 6) | (index << 3) | base;
    }

    function encode() {
      const bytes = [];
      const fields = [];
      let asm = "";
      const kind = state.selected;

      function put(value, name, meaning) {
        const index = bytes.length;
        bytes.push(value & 255);
        fields.push({
          name,
          meaning,
          indices: [index]
        });
      }

      function putLE(value, size, name, meaning) {
        const start = bytes.length;
        bytes.push(...little(value, size));
        fields.push({
          name,
          meaning,
          indices: Array.from(
            { length: size },
            (_, i) => start + i
          )
        });
      }

      if (kind === "push") {
        put(0x55, "opcode 55", "pushq %rbp");
        asm = "pushq %rbp";
      }

      else if (kind === "pop") {
        put(0x5d, "opcode 5D", "popq %rbp");
        asm = "popq %rbp";
      }

      else if (kind === "ret") {
        put(0xc3, "opcode C3", "retq");
        asm = "retq";
      }

      else if (kind === "nop") {
        put(0x90, "opcode 90", "nop");
        asm = "nop";
      }

      else if (kind === "leave") {
        put(0xc9, "opcode C9", "leaveq");
        asm = "leaveq";
      }

      else if (
        kind === "mov-rsp-rbp" ||
        kind === "mov-rbp-rsp"
      ) {
        const m = kind === "mov-rsp-rbp" ? 0xe5 : 0xec;

        put(0x48, "REX.W", "W=1, R=X=B=0");
        put(0x89, "opcode 89", "r64 → r/m64");
        put(m, "ModRM", "mod=11, reg/rm은 레지스터");

        asm = kind === "mov-rsp-rbp"
          ? "movq %rsp,%rbp"
          : "movq %rbp,%rsp";
      }

      else if (kind === "mov-store" || kind === "mov-load") {
        const reg = regSelect.value;
        const base = baseSelect.value;
        const index =
          indexSelect.value === "none"
            ? null
            : indexSelect.value;

        const scale = parseScale(scaleSelect.value);
        const disp = parseSigned32(dispInput.value);

        if (index === null && scale !== 1) {
          throw new Error("index가 없을 때 scale은 1이어야 합니다.");
        }

        const regNum = regCode(reg);
        const baseNum = regCode(base);

        let mod;
        let dispSize;

        if (disp === 0n && baseNum !== 5) {
          mod = 0;
          dispSize = 0;
        } else if (disp >= -128n && disp <= 127n) {
          mod = 1;
          dispSize = 1;
        } else {
          mod = 2;
          dispSize = 4;
        }

        // rbp cannot use mod=00 as an ordinary base.
        if (baseNum === 5 && mod === 0) {
          mod = 1;
          dispSize = 1;
        }

        const useSIB =
          index !== null || baseNum === 4;

        const opcode =
          kind === "mov-store" ? 0x89 : 0x8b;

        put(0x48, "REX.W", "64비트 피연산자");
        put(opcode, "opcode", kind === "mov-store"
          ? "레지스터 → 메모리"
          : "메모리 → 레지스터"
        );

        put(
          modrm(mod, regNum, useSIB ? 4 : baseNum),
          "ModRM",
          "mod=" + mod.toString(2).padStart(2, "0") +
          ", reg=" + regNum +
          ", r/m=" + (useSIB ? 4 : baseNum)
        );

        if (useSIB) {
          const indexNum =
            index === null ? 4 : regCode(index);

          if (indexNum === 4 && index !== null) {
            throw new Error("%rsp는 index가 될 수 없습니다.");
          }

          put(
            sib(scale, indexNum, baseNum),
            "SIB",
            "scale=" + scale +
            ", index=" + (index || "없음") +
            ", base=" + base
          );
        }

        if (dispSize) {
          putLE(
            disp,
            dispSize,
            "disp" + dispSize * 8,
            "signed displacement, little-endian"
          );
        }

        const memory = index === null
          ? (disp === 0n ? "" : disp.toString()) +
            "(%" + base + ")"
          : memoryText(base, index, scale, disp);

        asm = kind === "mov-store"
          ? "movq %" + reg + "," + memory
          : "movq " + memory + ",%" + reg;
      }

      else if (kind === "sub-rsp") {
        const imm = requireRange(
          parseNumber(immInput.value),
          -128n, 127n,
          "signed imm8"
        );

        put(0x48, "REX.W", "64비트 피연산자");
        put(0x83, "opcode 83", "Group 1, imm8 sign-extension");
        put(0xec, "ModRM EC", "mod=11, /5=sub, rm=rsp");
        putLE(imm, 1, "imm8", "signed immediate");

        asm = "subq $" + imm + ",%rsp";
      }

      else if (kind === "mov-imm32") {
        const imm = parseImm32(immInput.value);
        const reg = regSelect.value;

        put(0x48, "REX.W", "64비트 destination");
        put(0xc7, "opcode C7", "sign-extended imm32 → r/m64");
        put(
          modrm(3, 0, regCode(reg)),
          "ModRM",
          "mod=11, /0, r/m=" + reg
        );

        putLE(
          imm, 4, "imm32",
          "signed immediate, little-endian"
        );

        asm = "movq $" + imm + ",%" + reg;
      }

      else if (kind === "movabs") {
        const imm = parseImm64(immInput.value);
        const reg = regSelect.value;

        put(0x48, "REX.W", "64비트 피연산자");
        put(0xb8 + regCode(reg), "B8+r", "opcode와 reg 번호");

        putLE(
          imm, 8, "imm64",
          "64비트 immediate, little-endian"
        );

        asm = "movabsq $" + hx64(imm) + ",%" + reg;
      }

      else if (kind === "call") {
        const rel = parseImm32(immInput.value);

        put(0xe8, "opcode E8", "near relative call");
        putLE(
          rel, 4, "rel32",
          "다음 RIP 기준 signed 상대변위"
        );

        asm =
          "call " + (rel >= 0n ? "+" : "") +
          rel + " (rel32)";
      }

      else {
        throw new Error("지원하지 않는 인코딩 프리셋입니다.");
      }

      return { bytes, fields, asm };
    }

    function parseHexBytes(input) {
      const cleaned = String(input)
        .replace(/0x/gi, "")
        .replace(/[\s,:]/g, "");

      if (!cleaned || !/^[0-9a-f]+$/i.test(cleaned)) {
        throw new Error("hex 바이트열이 올바르지 않습니다.");
      }

      if (cleaned.length % 2 !== 0) {
        throw new Error("hex 자릿수는 짝수여야 합니다.");
      }

      if (cleaned.length > 30) {
        throw new Error("x86-64 명령어 최대 길이는 15바이트입니다.");
      }

      const bytes = [];
      for (let i = 0; i < cleaned.length; i += 2) {
        bytes.push(parseInt(cleaned.slice(i, i + 2), 16));
      }

      return bytes;
    }

    function decode(bytes) {
      let pos = 0;
      const fields = [];
      let asm = "";
      let semantic = null;

      function take(name, meaning) {
        if (pos >= bytes.length) {
          throw new Error("명령어 바이트가 잘렸습니다.");
        }

        const i = pos++;
        fields.push({ name, meaning, indices: [i] });
        return bytes[i];
      }

      function takeLE(size, name, meaning) {
        const start = pos;
        const value = readLE(bytes, pos, size);
        pos += size;

        fields.push({
          name,
          meaning,
          indices: Array.from(
            { length: size },
            (_, i) => start + i
          )
        });

        return value;
      }

      const first = bytes[0];

      const simple = {
        0x55: "pushq %rbp",
        0x5d: "popq %rbp",
        0xc3: "retq",
        0x90: "nop",
        0xc9: "leaveq"
      };

      if (Object.prototype.hasOwnProperty.call(simple, first)) {
        take("opcode", simple[first]);
        asm = simple[first];
        semantic = { kind: asm };
      }

      else if (first === 0xe8) {
        take("opcode E8", "near relative call");
        const rel = I(
          takeLE(4, "rel32", "signed little-endian relative offset"),
          32
        );

        const start = parseNumber(ripInput.value);
        requireRange(start, 0n, U64MAX, "기준 RIP");

        const nextRIP = U(start + 5n);
        const target = U(nextRIP + rel);

        asm =
          "call " + (rel >= 0n ? "+" : "") +
          rel + " (rel32)";

        semantic = {
          kind: "call",
          rel,
          nextRIP,
          target
        };
      }

      else if (first === 0x48) {
        take("REX.W", "W=1, R=X=B=0");

        const opcode = take("opcode", "명령어 opcode");

        if (opcode >= 0xb8 && opcode <= 0xbf) {
          const reg = REGS[opcode - 0xb8];
          const imm = takeLE(
            8, "imm64", "little-endian 64비트 즉시값"
          );

          asm = "movabsq $" + hx64(imm) + ",%" + reg;
          semantic = { kind: "movabs", reg, imm };
        }

        else if (opcode === 0x83) {
          const modrmByte = take("ModRM", "Group 1 /5");

          if (modrmByte !== 0xec) {
            throw new Error("83은 subq imm8,%rsp 형식만 지원합니다.");
          }

          const imm = I(
            takeLE(1, "imm8", "signed immediate"),
            8
          );

          asm = "subq $" + imm + ",%rsp";
          semantic = { kind: "sub-rsp", imm };
        }

        else if (opcode === 0xc7) {
          const m = take("ModRM", "mod/reg/rm");

          const mod = m >> 6;
          const ext = (m >> 3) & 7;
          const rm = m & 7;

          if (mod !== 3 || ext !== 0) {
            throw new Error("C7은 /0 레지스터 목적지만 지원합니다.");
          }

          const imm = I(
            takeLE(4, "imm32", "signed immediate"),
            32
          );

          asm = "movq $" + imm + ",%" + REGS[rm];
          semantic = {
            kind: "mov-imm32",
            reg: REGS[rm],
            imm
          };
        }

        else if (opcode === 0x89 || opcode === 0x8b) {
          const m = take("ModRM", "mod(2) | reg(3) | r/m(3)");

          const mod = (m >> 6) & 3;
          const reg = REGS[(m >> 3) & 7];
          const rm = m & 7;

          let operand;
          let addressInfo = null;

          if (mod === 3) {
            operand = "%" + REGS[rm];
            addressInfo = {
              kind: "reg",
              reg: REGS[rm]
            };
          } else {
            let base = null;
            let index = null;
            let scale = 1;
            let noBaseSIB = false;
            let ripRelative = false;

            if (rm === 4) {
              const sibByte = take(
                "SIB",
                "scale(2) | index(3) | base(3)"
              );

              scale = 1 << ((sibByte >> 6) & 3);
              const indexCode = (sibByte >> 3) & 7;
              const baseCode = sibByte & 7;

              if (indexCode !== 4) {
                index = REGS[indexCode];
              }

              if (mod === 0 && baseCode === 5) {
                noBaseSIB = true;
              } else {
                base = REGS[baseCode];
              }
            } else if (mod === 0 && rm === 5) {
              ripRelative = true;
            } else {
              base = REGS[rm];
            }

            let disp = 0n;

            if (mod === 1) {
              disp = I(
                takeLE(1, "disp8", "signed displacement"),
                8
              );
            } else if (mod === 2 || noBaseSIB || ripRelative) {
              disp = I(
                takeLE(4, "disp32", "signed displacement"),
                32
              );
            }

            if (ripRelative) {
              operand = disp + "(%rip)";
            } else if (noBaseSIB) {
              operand = disp.toString();

              if (index !== null) {
                operand += "(,%" + index + "," + scale + ")";
              }
            } else if (index !== null) {
              operand = memoryText(base, index, scale, disp);
            } else {
              operand =
                (disp === 0n ? "" : disp.toString()) +
                "(%" + base + ")";
            }

            addressInfo = {
              kind: "mem",
              base,
              index,
              scale,
              disp,
              noBaseSIB,
              ripRelative
            };
          }

          asm = opcode === 0x89
            ? "movq %" + reg + "," + operand
            : "movq " + operand + ",%" + reg;

          semantic = {
            kind: opcode === 0x89 ? "mov-store" : "mov-load",
            reg,
            address: addressInfo
          };
        }

        else {
          throw new Error(
            "REX.W 뒤 opcode 0x" + hx8(opcode) +
            "는 지원 범위 밖입니다."
          );
        }
      }

      else {
        throw new Error(
          "opcode 0x" + hx8(first) +
          "는 지원하지 않습니다."
        );
      }

      if (pos !== bytes.length) {
        throw new Error(
          "명령어 뒤에 추가 바이트가 있습니다. 한 번에 한 명령어만 지원합니다."
        );
      }

      return {
        bytes,
        fields,
        asm,
        semantic
      };
    }

    function expectedSemantic() {
      const kind = state.selected;

      if (["push", "pop", "ret", "nop", "leave"].includes(kind)) {
        const names = {
          push: "pushq %rbp",
          pop: "popq %rbp",
          ret: "retq",
          nop: "nop",
          leave: "leaveq"
        };
        return { kind: names[kind] };
      }

      if (kind === "mov-rsp-rbp") {
        return {
          kind: "mov-store",
          reg: "rsp",
          address: { kind: "reg", reg: "rbp" }
        };
      }

      if (kind === "mov-rbp-rsp") {
        return {
          kind: "mov-store",
          reg: "rbp",
          address: { kind: "reg", reg: "rsp" }
        };
      }

      if (kind === "mov-store" || kind === "mov-load") {
        return {
          kind,
          reg: regSelect.value,
          address: {
            kind: "mem",
            base: baseSelect.value,
            index:
              indexSelect.value === "none"
                ? null
                : indexSelect.value,
            scale:
              indexSelect.value === "none"
                ? 1
                : parseScale(scaleSelect.value),
            disp: parseSigned32(dispInput.value),
            noBaseSIB: false,
            ripRelative: false
          }
        };
      }

      if (kind === "sub-rsp") {
        return { kind, imm: parseNumber(immInput.value) };
      }

      if (kind === "mov-imm32") {
        return {
          kind,
          reg: regSelect.value,
          imm: parseImm32(immInput.value)
        };
      }

      if (kind === "movabs") {
        return {
          kind,
          reg: regSelect.value,
          imm: U(parseImm64(immInput.value))
        };
      }

      if (kind === "call") {
        return {
          kind,
          rel: parseImm32(immInput.value)
        };
      }

      throw new Error("알 수 없는 명령 프리셋입니다.");
    }

    function semanticEqual(a, b) {
      if (!a || !b || a.kind !== b.kind) return false;

      if (a.kind === "mov-store" || a.kind === "mov-load") {
        if (a.reg !== b.reg) return false;

        const x = a.address;
        const y = b.address;

        if (!x || !y || x.kind !== y.kind) return false;

        if (x.kind === "reg") {
          return x.reg === y.reg;
        }

        return (
          x.base === y.base &&
          x.index === y.index &&
          x.disp === y.disp &&
          (x.index === null || x.scale === y.scale) &&
          x.noBaseSIB === y.noBaseSIB &&
          x.ripRelative === y.ripRelative
        );
      }

      if (a.reg !== undefined && a.reg !== b.reg) return false;
      if (a.imm !== undefined && a.imm !== b.imm) return false;
      if (a.rel !== undefined && a.rel !== b.rel) return false;

      return true;
    }

    function display(result, verification) {
      clear(resultHost);
      heading(resultHost, "기계어 바이트 — Instruction Bytes");

      const byteRow = node(
        "div",
        resultHost,
        "",
        "v6-byte-row"
      );

      const selectedField = stateBox(resultHost);

      result.bytes.forEach((byte, index) => {
        const b = button(byteRow, hx8(byte), () => {
          const field = result.fields.find(
            f => f.indices.includes(index)
          );

          if (field) {
            selectedField.textContent =
              "Byte " + index + " · " +
              field.name + "\n" + field.meaning;
          }
        });

        b.classList.add("v6-byte-button");
        b.setAttribute(
          "aria-label",
          "바이트 " + index + ": " + hx8(byte)
        );
      });

      const fields = table(resultHost, [
        "필드",
        "바이트",
        "의미"
      ]);

      result.fields.forEach(f => {
        fields.add([
          f.name,
          f.indices.map(i => hx8(result.bytes[i])).join(" "),
          f.meaning
        ]);
      });

      details.textContent =
        "디스어셈블(Disassembly)\n" +
        result.asm + "\n\n" +
        "Hex bytes\n" +
        result.bytes.map(hx8).join(" ");

      if (result.semantic && result.semantic.kind === "call") {
        details.textContent +=
          "\n\n다음 RIP = " +
          hx64(result.semantic.nextRIP) +
          "\n목표 주소 = " +
          hx64(result.semantic.target);
      }

      if (verification) {
        roundTrip.textContent =
          verification.ok
            ? "Round-trip 검증: 통과\n" +
              "인코드 → 디코드 결과가 의미상 동일합니다."
            : "Round-trip 검증: 불일치\n" +
              verification.reason;
      } else {
        roundTrip.textContent =
          "디코드 모드: 입력 바이트열을 한 명령어로 해석했습니다.";
      }

      const start = parseNumber(ripInput.value);
      requireRange(start, 0n, U64MAX, "기준 RIP");

      objdump.textContent =
        "objdump 스타일\n" +
        start.toString(16).padStart(8, "0") +
        ":  " +
        result.bytes.map(hx8).join(" ").toLowerCase() +
        "    " +
        result.asm +
        "\n\nBomb Lab 포인트: 주소 → 바이트열 → 어셈블리 순서로 읽습니다.";
    }

    function render() {
      updateControls();

      try {
        let result;
        let verification = null;

        if (state.mode === "encode") {
          const encoded = encode();
          const decoded = decode(encoded.bytes);
          const expected = expectedSemantic();

          const ok = semanticEqual(
            expected,
            decoded.semantic
          );

          verification = {
            ok,
            reason: ok
              ? ""
              : "기대 의미와 디코드 의미가 일치하지 않습니다."
          };

          result = {
            ...encoded,
            semantic: decoded.semantic
          };

          hexInput.value =
            encoded.bytes.map(hx8).join(" ");
        } else {
          result = decode(
            parseHexBytes(hexInput.value)
          );
        }

        state.bytes = result.bytes;
        state.fields = result.fields;
        state.asm = result.asm;
        state.error = "";

        display(result, verification);
      } catch (e) {
        state.error = e.message;
        clear(resultHost);
        errorState(details, e.message);
        roundTrip.textContent = "검증을 수행하지 못했습니다.";
        objdump.textContent = "";
      }
    }

    instructionSelect.addEventListener("change", () => {
      state.selected = instructionSelect.value;
      render();
    });

    [
      regSelect,
      baseSelect,
      indexSelect,
      scaleSelect,
      dispInput,
      immInput,
      hexInput,
      ripInput
    ].forEach(input => {
      input.addEventListener("change", render);
    });

    render();
  });

})();(function () {
  "use strict";

  if (!window.V6 || typeof window.V6.register !== "function") return;

  const V6 = window.V6;
  const INK = V6.INK || "#1a1a1a";
  const RED = V6.RED || "#9e2b25";
  const GRID = V6.GRID || "#e8e6e0";
  const MONO = "monospace, 'Noto Sans KR', sans-serif";

  const U64 = 1n << 64n;
  const MASK64 = U64 - 1n;

  // ============================================================
  // Shared UI helpers
  // ============================================================

  function E(tag, parent, text, cls) {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined && text !== null) {
      x.textContent = String(text);
    }
    if (parent) parent.appendChild(x);
    return x;
  }

  function clear(parent) {
    parent.replaceChildren();
  }

  function B(parent, text, fn) {
    const b = E("button", parent, text, "v6-btn");
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  function C(parent) {
    return E("div", parent, "", "v6-controls");
  }

  function S(parent) {
    const x = E("div", parent, "", "v6-state");
    x.setAttribute("role", "status");
    x.setAttribute("aria-live", "polite");
    return x;
  }

  function T(parent, text) {
    V6.title(parent, text);
  }

  function H(parent, text) {
    return E("h4", parent, text, "v6-section-title");
  }

  function L(parent, text, input) {
    const label = E("label", parent);
    E("span", label, text);
    label.appendChild(input);
    return label;
  }

  function inputText(parent, text, value, fn) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = String(value);
    L(parent, text, input);

    if (fn) input.addEventListener("input", fn);
    return input;
  }

  function range(parent, text, min, max, value, fn) {
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    input.value = String(value);

    const label = L(parent, text, input);
    const current = E("span", label, String(value), "v6-val");

    input.addEventListener("input", () => {
      current.textContent = input.value;
      fn(Number(input.value));
    });

    return { input, current };
  }

  function selectState(button, active) {
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }

  function table(parent, heads) {
    const scroll = E("div", parent, "", "v6-table-scroll");
    const t = E("table", scroll, "", "v6-table");
    const header = E("tr", E("thead", t));

    heads.forEach(value => E("th", header, value));

    const body = E("tbody", t);

    return {
      table: t,
      body,
      row(values, redColumns = []) {
        const tr = E("tr", body);

        values.forEach((value, i) => {
          const td = E("td", tr, value);
          if (redColumns.includes(i)) {
            td.classList.add("v6-changed");
          }
        });

        return tr;
      }
    };
  }

  function hex(value, digits = 16) {
    return "0x" +
      BigInt(value).toString(16).toUpperCase().padStart(digits, "0");
  }

  function u64(value) {
    return BigInt.asUintN(64, BigInt(value));
  }

  function signed64(value) {
    return BigInt.asIntN(64, BigInt(value));
  }

  function parseIntExact(text) {
    const s = String(text).trim();

    if (/^[+-]?0x[0-9a-f]+$/i.test(s)) {
      const negative = s.startsWith("-");
      const value = BigInt(s.replace(/^[+-]/, ""));
      return negative ? -value : value;
    }

    if (/^[+-]?\d+$/.test(s)) return BigInt(s);

    throw new Error("10진수 또는 0x 형식의 16진수를 입력하세요.");
  }

  function goodInteger(value, fallback, lo, hi) {
    const n = Number(value);

    return Number.isSafeInteger(n) && n >= lo && n <= hi
      ? n : fallback;
  }

  function notice(parent, message) {
    parent.textContent = "안내: " + message;
  }

  function box(parent, text, changed = false) {
    const x = E("div", parent, text, "v6-note-cell");

    Object.assign(x.style, {
      border: `1px solid ${INK}`,
      padding: "9px 11px",
      minHeight: "40px",
      background: "white",
      color: changed ? RED : INK,
      fontFamily: MONO,
      fontSize: "13px",
      lineHeight: "1.6",
      overflowWrap: "anywhere"
    });

    if (changed) x.classList.add("v6-changed");
    return x;
  }

  function divider(parent) {
    const x = E("div", parent);

    Object.assign(x.style, {
      borderTop: `1px solid ${GRID}`,
      margin: "16px 0"
    });

    return x;
  }

  function noteHeader(parent, text) {
    const x = E("div", parent, text);

    Object.assign(x.style, {
      padding: "8px 2px",
      borderBottom: `1px solid ${GRID}`,
      fontWeight: "700",
      fontSize: "13px"
    });

    return x;
  }

  function explanation(parent, text) {
    const x = S(parent);
    x.textContent = text;
    return x;
  }

  // ============================================================
  // 1. Stack Frames — Procedures
  // ============================================================

  V6.register("stack-frames", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    T(root, "프로시저 호출과 스택 프레임 — Stack Frames");

    const TOP = 0x8000n;
    const args = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];
    const argRegs = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"];

    const state = {
      mode: cfg.mode === "recursive" ? "recursive" : "normal",
      index: 0,
      snapshots: [],
      timer: null,
      machine: null,
      instructions: [],
      explanation: "",
      changed: null,
      error: ""
    };

    function fresh() {
      return {
        rsp: TOP,
        rbp: TOP,
        rax: 0n,
        rbx: 0n,
        registers: Object.fromEntries(
          argRegs.map(name => [name, 0n])
        ),
        slots: new Map(),
        frames: [{
          name: "main",
          rbp: TOP,
          entry: TOP
        }],
        pc: 0,
        note: ""
      };
    }

    function clone(m) {
      return {
        ...m,
        registers: { ...m.registers },
        slots: new Map(
          [...m.slots].map(([k, v]) => [k, { ...v }])
        ),
        frames: m.frames.map(f => ({ ...f }))
      };
    }

    function push(m, value, label) {
      m.rsp -= 8n;
      m.slots.set(m.rsp, {
        value: u64(value),
        label
      });
      return m.rsp;
    }

    function pop(m) {
      const slot = m.slots.get(m.rsp);

      if (!slot) {
        throw new Error("스택 아래에 읽을 값이 없습니다.");
      }

      m.slots.delete(m.rsp);
      m.rsp += 8n;
      return slot.value;
    }

    function reserve(m, bytes, label) {
      if (bytes % 8 !== 0 || bytes < 0) {
        throw new Error("로컬 공간 크기가 유효하지 않습니다.");
      }

      for (let i = 0; i < bytes; i += 8) {
        push(m, 0n, label + " +" + i);
      }
    }

    function drop(m, bytes) {
      for (let i = 0; i < bytes; i += 8) {
        m.slots.delete(m.rsp);
        m.rsp += 8n;
      }
    }

    function buildNormal() {
      return [
        ["main: 인자 1~6을 레지스터에 배정", m => {
          argRegs.forEach((r, i) => {
            m.registers[r] = args[i];
          });

          return "System V AMD64: 정수·포인터 인자 1~6은 %rdi, %rsi, %rdx, %rcx, %r8, %r9입니다.";
        }],

        ["subq $16,%rsp — outgoing args 공간", m => {
          reserve(m, 16, "인자 전달 공간");

          return "7·8번째 인자를 위해 호출자가 16바이트 공간을 마련합니다. call 직전 %rsp는 16바이트 정렬됩니다.";
        }],

        ["movq $7,0(%rsp); movq $8,8(%rsp)", m => {
          m.slots.set(m.rsp, {
            value: 7n,
            label: "foo arg7"
          });

          m.slots.set(m.rsp + 8n, {
            value: 8n,
            label: "foo arg8"
          });

          return "foo의 arg7은 호출 전 0(%rsp), arg8은 8(%rsp)에 위치합니다.";
        }],

        ["call foo", m => {
          push(
            m,
            0x401020n,
            "main → 복귀 주소(return address)"
          );

          m.frames.push({
            name: "foo",
            rbp: null,
            entry: m.rsp
          });

          return "call이 다음 명령 주소를 8바이트 push합니다. foo 진입 시 %rsp mod 16 = 8.";
        }],

        ["foo: pushq %rbp", m => {
          push(m, m.rbp, "saved %rbp (foo)");
          return "기존 frame pointer를 저장합니다.";
        }],

        ["movq %rsp,%rbp", m => {
          m.rbp = m.rsp;
          m.frames[m.frames.length - 1].rbp = m.rbp;

          return "%rbp가 foo의 현재 프레임 기준점이 됩니다. arg7은 16(%rbp), arg8은 24(%rbp).";
        }],

        ["subq $16,%rsp", m => {
          reserve(m, 16, "foo local");
          return "foo의 로컬 변수 공간 16바이트를 확보합니다.";
        }],

        ["movq %rbx,0(%rsp) — callee-saved 저장", m => {
          m.slots.set(m.rsp, {
            value: m.rbx,
            label: "saved %rbx (foo local slot)"
          });

          return "%rbx는 callee-saved입니다. 사용 전에 기존 값을 저장합니다.";
        }],

        ["movq $99,%rbx — foo 본문", m => {
          m.rbx = 99n;
          return "foo에서 %rbx를 변경했습니다. 반환 전 복원해야 합니다.";
        }],

        ["call bar (8바이트 정렬 패딩 확보)", m => {
          reserve(m, 8, "bar 호출 정렬 패딩");
          push(m, 0x401080n, "foo → 복귀 주소");

          m.frames.push({
            name: "bar",
            rbp: null,
            entry: m.rsp
          });

          return "foo는 bar 호출 전에 %rsp를 16바이트 정렬합니다. call이 return address를 push합니다.";
        }],

        ["bar: pushq %rbp", m => {
          push(m, m.rbp, "saved %rbp (bar)");
          return "bar의 frame pointer를 저장합니다.";
        }],

        ["bar: movq %rsp,%rbp", m => {
          m.rbp = m.rsp;
          m.frames[m.frames.length - 1].rbp = m.rbp;
          return "bar 프레임을 설정했습니다.";
        }],

        ["bar: movq $42,%rax", m => {
          m.rax = 42n;
          return "반환값(return value)은 %rax에 저장합니다.";
        }],

        ["bar: leave", m => {
          m.rsp = m.rbp;
          m.rbp = pop(m);

          return "leave = movq %rbp,%rsp; popq %rbp.";
        }],

        ["bar: ret", m => {
          const address = pop(m);
          m.frames.pop();

          return "ret은 복귀 주소 " +
            hex(address) +
            "를 pop한 뒤 그 주소로 점프합니다.";
        }],

        ["foo: addq $8,%rsp", m => {
          drop(m, 8);
          return "bar 호출 전 마련한 8바이트 정렬 패딩을 제거합니다.";
        }],

        ["foo: %rbx 복원", m => {
          const slot = m.slots.get(m.rsp);

          if (!slot) {
            throw new Error("saved %rbx가 없습니다.");
          }

          m.rbx = slot.value;

          return "callee-saved %rbx를 원래 값으로 복원했습니다.";
        }],

        ["foo: movq $56,%rax", m => {
          m.rax = 56n;
          return "foo의 반환값을 %rax에 기록합니다.";
        }],

        ["foo: leave", m => {
          m.rsp = m.rbp;
          m.rbp = pop(m);

          return "foo의 local 공간을 한꺼번에 해제하고 saved %rbp를 복구합니다.";
        }],

        ["foo: ret", m => {
          const address = pop(m);
          m.frames.pop();

          return "main으로 복귀합니다. 반환 주소 " + hex(address);
        }],

        ["main: addq $16,%rsp", m => {
          drop(m, 16);

          return "caller인 main이 arg7·arg8의 16바이트 공간을 정리합니다.";
        }]
      ];
    }

    function buildRecursive() {
      const ops = [];
      const n0 = 4;

      ops.push(["main: movq $4,%rdi", m => {
        m.registers.rdi = 4n;
        return "팩토리얼 factorial(4)을 호출합니다.";
      }]);

      ops.push(["main: call fact", m => {
        push(m, 0x402000n, "main 복귀 주소");

        m.frames.push({
          name: "fact(4)",
          rbp: null,
          entry: m.rsp
        });

        return "첫 번째 fact(4) 프레임으로 진입합니다.";
      }]);

      for (let n = n0; n >= 1; n--) {
        ops.push(["fact(" + n + "): pushq %rbp", m => {
          push(m, m.rbp, "fact(" + n + ") saved rbp");

          return "fact(" + n + ")의 frame pointer를 저장합니다.";
        }]);

        ops.push(["fact(" + n + "): movq %rsp,%rbp", m => {
          m.rbp = m.rsp;
          m.frames[m.frames.length - 1].rbp = m.rbp;

          return "새 프레임 기준점을 설정합니다.";
        }]);

        ops.push(["fact(" + n + "): subq $16,%rsp", m => {
          reserve(m, 16, "fact(" + n + ") local");

          m.slots.set(m.rbp - 8n, {
            value: BigInt(n),
            label: "fact(" + n + ") saved n"
          });

          return "재귀 호출 뒤 곱할 n=" +
            n + "을 로컬 슬롯에 저장합니다.";
        }]);

        if (n > 1) {
          ops.push([
            "fact(" + n + "): call fact(" + (n - 1) + ")",
            m => {
              push(
                m,
                BigInt(0x402100 + n * 16),
                "fact(" + n + ") 복귀 주소"
              );

              m.frames.push({
                name: "fact(" + (n - 1) + ")",
                rbp: null,
                entry: m.rsp
              });

              return "재귀 호출로 프레임 깊이가 증가합니다. 현재 %rsp mod 16 = 8 (callee 진입).";
            }
          ]);
        } else {
          ops.push(["fact(1): movq $1,%rax", m => {
            m.rax = 1n;
            return "기저 사례(base case): factorial(1)=1.";
          }]);
        }
      }

      for (let n = 1; n <= n0; n++) {
        if (n > 1) {
          ops.push(["fact(" + n + "): imulq n,%rax", m => {
            const slot = m.slots.get(m.rbp - 8n);

            if (!slot) {
              throw new Error("로컬 n이 없습니다.");
            }

            m.rax = u64(m.rax * slot.value);

            return "factorial(" + n + ") = " +
              n + " × factorial(" + (n - 1) + ") = " + m.rax;
          }]);
        }

        ops.push(["fact(" + n + "): leave", m => {
          m.rsp = m.rbp;
          m.rbp = pop(m);

          return "fact(" + n + ")의 로컬 공간을 반환합니다.";
        }]);

        ops.push(["fact(" + n + "): ret", m => {
          const address = pop(m);
          m.frames.pop();

          return "복귀 주소 " + hex(address) + "로 돌아갑니다.";
        }]);
      }

      return ops;
    }

    const controls = C(root);

    const selector = document.createElement("select");

    [
      ["normal", "main → foo(8인자) → bar"],
      ["recursive", "재귀(recursion): factorial(4)"]
    ].forEach(([value, text]) => {
      const option = E("option", selector, text);
      option.value = value;
    });

    selector.value = state.mode;
    L(controls, "프로그램(Preset)", selector);

    const stepButton = B(controls, "한 단계", step);
    const undoButton = B(controls, "뒤로", undo);
    const autoButton = B(controls, "자동 재생", auto);
    B(controls, "리셋", reset);

    const info = S(root);
    const traceHost = E("section", root);
    const registerHost = E("section", root);
    const stackHost = E("section", root);
    const note = S(root);

    selector.addEventListener("change", () => {
      state.mode = selector.value;
      reset();
    });

    function stop() {
      if (state.timer !== null) {
        clearInterval(state.timer);
        state.timer = null;
      }

      autoButton.textContent = "자동 재생";
      selectState(autoButton, false);
    }

    function reset() {
      stop();

      state.machine = fresh();
      state.instructions =
        state.mode === "normal"
          ? buildNormal()
          : buildRecursive();

      state.index = 0;
      state.snapshots = [];
      state.changed = null;
      state.error = "";
      state.explanation =
        "첫 명령을 실행해 호출 규약을 관찰합니다.";

      render();
    }

    function execute() {
      if (state.index >= state.instructions.length) return false;

      const previous = clone(state.machine);
      const beforeIndex = state.index;

      try {
        const [, action] = state.instructions[state.index];
        const description = action(state.machine);

        state.snapshots.push({
          machine: previous,
          index: beforeIndex
        });

        state.index++;
        state.explanation = description;
        state.error = "";

        const current = state.machine;

        state.changed = {
          rsp: previous.rsp !== current.rsp,
          rbp: previous.rbp !== current.rbp,
          rax: previous.rax !== current.rax,
          rbx: previous.rbx !== current.rbx,
          slots: new Set(
            [...new Set([
              ...previous.slots.keys(),
              ...current.slots.keys()
            ])].filter(address => {
              const a = previous.slots.get(address);
              const b = current.slots.get(address);

              return !a || !b ||
                a.value !== b.value ||
                a.label !== b.label;
            })
          )
        };

        return true;
      } catch (e) {
        state.machine = previous;
        state.changed = null;
        state.error = e.message;
        state.explanation = "실행 오류: " + e.message;
        stop();
        return false;
      }
    }

    function step() {
      stop();
      execute();
      render();
    }

    function undo() {
      stop();

      const entry = state.snapshots.pop();

      if (entry) {
        state.machine = entry.machine;
        state.index = entry.index;
        state.changed = null;
        state.error = "";
        state.explanation = "이전 단계로 되돌렸습니다.";
      } else {
        state.explanation = "되돌릴 기록이 없습니다.";
      }

      render();
    }

    function auto() {
      if (state.timer !== null) {
        stop();
        render();
        return;
      }

      if (state.index >= state.instructions.length) return;

      autoButton.textContent = "자동 재생 중지";
      selectState(autoButton, true);

      state.timer = setInterval(() => {
        const ok = execute();

        if (!ok || state.index >= state.instructions.length) {
          stop();
        }

        render();
      }, 550);
    }

    function registerRows() {
      clear(registerHost);
      H(registerHost, "레지스터와 스택 정렬");

      const m = state.machine;
      const rt = table(registerHost, [
        "레지스터",
        "현재 값",
        "역할"
      ]);

      rt.row(
        ["%rsp", hex(m.rsp), "스택 최상단(top)"],
        state.changed && state.changed.rsp ? [0, 1] : []
      );

      rt.row(
        ["%rbp", hex(m.rbp), "프레임 기준점"],
        state.changed && state.changed.rbp ? [0, 1] : []
      );

      rt.row(
        ["%rax", hex(m.rax), "반환값(return value)"],
        state.changed && state.changed.rax ? [0, 1] : []
      );

      rt.row(
        ["%rbx", hex(m.rbx), "callee-saved"],
        state.changed && state.changed.rbx ? [0, 1] : []
      );

      argRegs.forEach((reg, index) => {
        rt.row([
          "%" + reg,
          hex(m.registers[reg]),
          "인자 " + (index + 1)
        ]);
      });

      const alignment = E(
        "div",
        registerHost,
        "%rsp mod 16 = " + (m.rsp % 16n),
        "v6-state"
      );

      alignment.style.marginTop = "8px";
    }

    function renderTrace() {
      clear(traceHost);
      H(traceHost, "실행 순서 — Assembly Trace");

      const scroll = E("div", traceHost, "", "v6-code-list");

      Object.assign(scroll.style, {
        width: "100%",
        maxWidth: "100%",
        maxHeight: "360px",
        overflowX: "auto",
        overflowY: "auto"
      });

      const list = E("div", scroll);
      list.style.minWidth = "500px";

      state.instructions.forEach(([name], index) => {
        const row = E(
          "div",
          list,
          String(index).padStart(2, "0") + "   " + name
        );

        Object.assign(row.style, {
          minHeight: "34px",
          padding: "7px 12px",
          fontFamily: MONO,
          fontSize: "13px",
          whiteSpace: "nowrap",
          lineHeight: "1.6",
          borderLeft: "3px solid transparent"
        });

        if (index === state.index) {
          row.classList.add("is-current");
          row.style.borderLeftColor = RED;
          row.style.background = GRID;
        }
      });
    }

    function renderStack() {
      clear(stackHost);
      H(stackHost, "스택 지도 — 높은 주소에서 낮은 주소로 성장 ↓");

      const m = state.machine;
      const slots = [...m.slots.entries()]
        .sort((a, b) => a[0] < b[0] ? 1 : -1);

      if (!slots.length) {
        box(stackHost, "현재 사용 중인 스택 슬롯이 없습니다.");
        return;
      }

      const scroll = E("div", stackHost, "", "v6-table-scroll");
      const grid = E("div", scroll);

      Object.assign(grid.style, {
        display: "grid",
        gridTemplateColumns: "170px minmax(240px,1fr) 165px 92px",
        gap: "3px",
        minWidth: "670px"
      });

      const headers = [
        "주소(Address)",
        "슬롯 역할",
        "저장 값",
        "포인터"
      ];

      headers.forEach(text => noteHeader(grid, text));

      slots.forEach(([address, slot]) => {
        const changed =
          state.changed &&
          state.changed.slots.has(address);

        box(grid, hex(address), changed);
        box(grid, slot.label, changed);
        box(grid, hex(slot.value), changed);

        const pointer =
          address === m.rsp && address === m.rbp
            ? "%rsp / %rbp"
            : address === m.rsp
              ? "← %rsp"
              : address === m.rbp
                ? "← %rbp"
                : "";

        const cell = box(grid, pointer);
        if (address === m.rsp) {
          cell.style.fontWeight = "700";
        }
      });
    }

    function render() {
      const m = state.machine;

      stepButton.disabled =
        state.index >= state.instructions.length;

      undoButton.disabled =
        state.snapshots.length === 0;

      info.textContent =
        "진행 " + state.index + "/" +
        state.instructions.length +
        " · 호출 깊이 " + m.frames.length +
        "\n현재 프레임: " +
        m.frames.map(f => f.name).join(" → ") +
        "\n\n" + state.explanation;

      if (state.error) {
        clear(traceHost);
        clear(registerHost);
        clear(stackHost);
        notice(note, state.error);
        return;
      }

      renderTrace();
      registerRows();
      renderStack();

      note.textContent =
        "System V AMD64 호출 규약\n" +
        "정수·포인터 인자 1~6: rdi, rsi, rdx, rcx, r8, r9.\n" +
        "7번째부터는 호출자가 스택에 배치합니다.\n" +
        "Caller-saved: rax, rcx, rdx, rsi, rdi, r8–r11.\n" +
        "Callee-saved: rbx, rbp, r12–r15; rsp도 복구합니다.\n" +
        "call 직전 %rsp는 16바이트 정렬, 함수 진입 직후 %rsp mod 16=8.\n" +
        "고정 단계별 교육용 추적이며 실제 명령어 인터프리터는 아닙니다.";
    }

    reset();
  });

  // ============================================================
  // 2. Struct Layout
  // ============================================================

  V6.register("struct-layout", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    T(root, "구조체 배치와 정렬 — Struct Layout");

    const TYPES = [
      ["char", 1, 1],
      ["short", 2, 2],
      ["int", 4, 4],
      ["long", 8, 8],
      ["double", 8, 8],
      ["void*", 8, 8],
      ["char[n]", null, 1]
    ];

    let fields = [
      { id: 1, type: "char", size: 1, align: 1, label: "a" },
      { id: 2, type: "long", size: 8, align: 8, label: "b" },
      { id: 3, type: "char", size: 1, align: 1, label: "c" }
    ];

    let nextId = 4;
    let messageText = "";

    const controls = C(root);

    const arrayInput = inputText(
      controls,
      "char[n] 배열 길이",
      "5"
    );

    arrayInput.setAttribute("aria-label", "char 배열 길이");

    TYPES.forEach(([type, size, align]) => {
      B(controls, "+ " + type, () => {
        try {
          let actualSize = size;

          if (type === "char[n]") {
            const n = Number(arrayInput.value);

            if (
              !Number.isSafeInteger(n) ||
              n < 1 ||
              n > 64
            ) {
              throw new Error(
                "char[n]의 길이는 1~64 사이 정수여야 합니다."
              );
            }

            actualSize = n;
          }

          if (fields.length >= 24) {
            throw new Error("필드는 최대 24개까지 추가할 수 있습니다.");
          }

          fields.push({
            id: nextId++,
            type: type === "char[n]"
              ? "char[" + actualSize + "]"
              : type,
            size: actualSize,
            align,
            label: "f" + nextId
          });

          messageText = type + " 필드를 추가했습니다.";
          render();
        } catch (e) {
          clear(gridHost);
          notice(info, e.message);
        }
      });
    });

    const actionBar = C(root);

    B(actionBar, "정렬 최적화", () => {
      const before = layout(fields).size;

      fields.sort((a, b) =>
        b.align - a.align ||
        b.size - a.size ||
        a.id - b.id
      );

      const after = layout(fields).size;

      messageText =
        "정렬 요구 K가 큰 필드부터 배치했습니다.\n" +
        "sizeof " + before + " → " + after +
        " B · 절약 " + (before - after) + " B.";

      render();
    });

    B(actionBar, "초기화", () => {
      fields = [
        { id: 1, type: "char", size: 1, align: 1, label: "a" },
        { id: 2, type: "long", size: 8, align: 8, label: "b" },
        { id: 3, type: "char", size: 1, align: 1, label: "c" }
      ];

      nextId = 4;
      messageText = "";
      render();
    });

    const listHost = E("section", root);
    const gridHost = E("section", root);
    const info = S(root);

    function roundUp(value, alignment) {
      return Math.ceil(value / alignment) * alignment;
    }

    function layout(items) {
      let cursor = 0;
      let maximumAlignment = 1;
      const positioned = [];
      const padding = [];

      items.forEach(field => {
        const offset = roundUp(cursor, field.align);

        for (let b = cursor; b < offset; b++) {
          padding.push({ offset: b, type: "internal" });
        }

        positioned.push({ ...field, offset });

        cursor = offset + field.size;
        maximumAlignment = Math.max(
          maximumAlignment,
          field.align
        );
      });

      const size = roundUp(cursor, maximumAlignment);

      for (let b = cursor; b < size; b++) {
        padding.push({ offset: b, type: "external" });
      }

      return {
        fields: positioned,
        size,
        maxAlign: maximumAlignment,
        padding,
        internal: padding.filter(
          p => p.type === "internal"
        ).length,
        external: padding.filter(
          p => p.type === "external"
        ).length
      };
    }

    function render() {
      const result = layout(fields);

      clear(listHost);
      H(listHost, "필드 구성 — Field Order");

      const tb = table(listHost, [
        "필드",
        "타입",
        "크기",
        "정렬 K",
        "Offset",
        "순서 변경"
      ]);

      result.fields.forEach((f, index) => {
        const row = tb.row([
          f.label,
          f.type,
          f.size + " B",
          f.align,
          f.offset,
          ""
        ]);

        const cell = row.children[5];

        const up = B(cell, "↑", () => {
          if (index > 0) {
            [fields[index - 1], fields[index]] =
              [fields[index], fields[index - 1]];
          }
          render();
        });

        const down = B(cell, "↓", () => {
          if (index < fields.length - 1) {
            [fields[index + 1], fields[index]] =
              [fields[index], fields[index + 1]];
          }
          render();
        });

        up.disabled = index === 0;
        down.disabled = index === fields.length - 1;

        B(cell, "삭제", () => {
          fields = fields.filter(x => x.id !== f.id);
          render();
        });
      });

      clear(gridHost);
      H(gridHost, "바이트 지도 — 8 Bytes per Row");

      const cells = new Array(result.size).fill(null);

      result.fields.forEach(f => {
        for (let i = 0; i < f.size; i++) {
          cells[f.offset + i] = {
            text: f.label,
            offset: i,
            padding: false
          };
        }
      });

      result.padding.forEach(p => {
        cells[p.offset] = {
          text: "PAD",
          padding: true,
          type: p.type
        };
      });

      const scroll = E("div", gridHost, "", "v6-table-scroll");
      const grid = E("div", scroll);

      Object.assign(grid.style, {
        display: "grid",
        gridTemplateColumns: "repeat(8, minmax(56px,1fr))",
        gap: "4px",
        minWidth: "480px"
      });

      cells.forEach((c, i) => {
        const cell = box(
          grid,
          c.padding ? "PAD" : c.text,
          c.padding
        );

        cell.style.minHeight = "58px";
        cell.style.textAlign = "center";
        cell.style.fontWeight = "600";

        const offsetLabel = E("div", cell, "+" + i);
        offsetLabel.style.fontSize = "11px";
        offsetLabel.style.fontWeight = "400";

        cell.title = c.padding
          ? c.type === "internal"
            ? "내부 패딩(internal padding)"
            : "끝 패딩(tail padding)"
          : "필드 바이트 offset " + i;
      });

      if (!result.size) {
        box(gridHost, "필드가 없습니다.");
      }

      const dataSize = result.fields.reduce(
        (sum, f) => sum + f.size,
        0
      );

      info.textContent =
        (messageText ? messageText + "\n\n" : "") +
        "sizeof(struct) = " + result.size + " B\n" +
        "최대 정렬 요구(max alignment) = " +
        result.maxAlign + " B\n" +
        "데이터 = " + dataSize + " B\n" +
        "내부 패딩 = " + result.internal + " B\n" +
        "끝 패딩 = " + result.external + " B\n\n" +
        "각 필드의 offset은 해당 타입 정렬 요구 K의 배수입니다.\n" +
        "구조체 전체 크기는 최대 정렬 요구의 배수로 올림합니다.\n" +
        "모델: 일반적인 x86-64 System V ABI " +
        "(long, 포인터, double = 8B).";
    }

    render();
  });

  // ============================================================
  // 3. Array Index
  // ============================================================

  V6.register("array-index", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    T(root, "배열 주소 계산 — Array Indexing");

    const ROWS = 4;
    const COLS = 5;
    const BASE = 0x1000n;
    const POINTER_BASE = 0x2000n;

    const state = {
      i: goodInteger(cfg.i, 1, 0, ROWS - 1),
      j: goodInteger(cfg.j, 2, 0, COLS - 1),
      mode: "nested"
    };

    const rowAddresses = [
      0x3000n,
      0x4100n,
      0x3500n,
      0x5000n
    ];

    const controls = C(root);

    const nestedButton = B(
      controls,
      "중첩 배열(nested)",
      () => {
        state.mode = "nested";
        render();
      }
    );

    const multiButton = B(
      controls,
      "다단계 배열(multi-level)",
      () => {
        state.mode = "multi";
        render();
      }
    );

    const matrixHost = E("section", root);
    const memoryHost = E("section", root);
    const info = S(root);

    function render() {
      selectState(nestedButton, state.mode === "nested");
      selectState(multiButton, state.mode === "multi");

      clear(matrixHost);
      H(matrixHost, "배열 선택 — int A[4][5]");

      const grid = E("div", matrixHost);

      Object.assign(grid.style, {
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0,1fr))",
        gap: "5px",
        maxWidth: "720px"
      });

      for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
          const selected = state.i === i && state.j === j;

          const b = B(
            grid,
            "A[" + i + "][" + j + "]",
            () => {
              state.i = i;
              state.j = j;
              render();
            }
          );

          b.style.minWidth = "0";
          b.style.padding = "9px 2px";
          b.style.fontSize = "12px";

          selectState(b, selected);
        }
      }

      clear(memoryHost);

      const i = state.i;
      const j = state.j;

      if (state.mode === "nested") {
        H(memoryHost, "연속 저장 — Row-major (80 Bytes)");

        const scroll = E(
          "div",
          memoryHost,
          "",
          "v6-table-scroll"
        );

        const strip = E("div", scroll);

        Object.assign(strip.style, {
          display: "grid",
          gridTemplateColumns: "repeat(20, minmax(30px,1fr))",
          gap: "3px",
          minWidth: "680px"
        });

        const selectedOffset = (i * COLS + j) * 4;

        for (let offset = 0; offset < 80; offset++) {
          const active =
            offset >= selectedOffset &&
            offset < selectedOffset + 4;

          const cell = box(strip, String(offset), active);

          cell.style.textAlign = "center";
          cell.style.padding = "8px 1px";
          cell.style.fontSize = "12px";
          cell.title = hex(BASE + BigInt(offset));
        }

        const linear = i * COLS + j;
        const offset = linear * 4;
        const address = BASE + BigInt(offset);

        info.textContent =
          "선택: A[" + i + "][" + j + "]\n\n" +
          "주소 = base + (i × C + j) × sizeof(int)\n" +
          "     = " + hex(BASE) +
          " + (" + i + " × 5 + " + j + ") × 4\n" +
          "     = " + hex(BASE) + " + " + offset + "\n" +
          "     = " + hex(address) + "\n\n" +
          "sizeof(A) = 4 × 5 × 4 = 80 B\n" +
          "int* p의 p+1은 4바이트 전진합니다.\n" +
          "int (*)[5] p의 p+1은 20바이트 전진합니다.\n" +
          "중첩 배열은 모든 행을 연속 저장합니다.";
      } else {
        H(memoryHost, "포인터 배열과 행 데이터 — Two Dereferences");

        const pointers = table(memoryHost, [
          "포인터 슬롯",
          "저장된 행 주소"
        ]);

        for (let r = 0; r < ROWS; r++) {
          pointers.row(
            [
              hex(POINTER_BASE + BigInt(r * 8)),
              hex(rowAddresses[r])
            ],
            r === i ? [0, 1] : []
          );
        }

        divider(memoryHost);

        const rows = table(memoryHost, [
          "행",
          "시작 주소",
          "int 요소 5개의 주소"
        ]);

        for (let r = 0; r < ROWS; r++) {
          rows.row(
            [
              "row " + r,
              hex(rowAddresses[r]),
              Array.from(
                { length: 5 },
                (_, c) =>
                  hex(rowAddresses[r] + BigInt(c * 4))
              ).join("  ")
            ],
            r === i ? [0, 1, 2] : []
          );
        }

        const pointerSlot =
          POINTER_BASE + BigInt(i * 8);

        const rowAddress = rowAddresses[i];
        const target = rowAddress + BigInt(j * 4);

        info.textContent =
          "모델: int *A[4] (행 포인터 4개)\n\n" +
          "1단계: &(A[" + i + "]) = " +
          hex(POINTER_BASE) +
          " + " + i + " × 8 = " +
          hex(pointerSlot) + "\n" +
          "2단계: A[" + i + "] = *(" +
          hex(pointerSlot) +
          ") = " + hex(rowAddress) + "\n" +
          "3단계: &A[" + i + "][" + j + "] = " +
          hex(rowAddress) +
          " + " + j + " × 4 = " +
          hex(target) + "\n\n" +
          "각 행은 다른 메모리 위치에 있을 수 있습니다.\n" +
          "포인터 배열 자체는 4 × 8 = 32 B이며 " +
          "각 행 데이터 20 B는 별도 공간입니다.\n" +
          "중첩 배열 int A[4][5]와 다단계 배열 int *A[4]는 다른 구조입니다.";
      }
    }

    render();
  });

  // ============================================================
  // 4. Buffer Overflow
  // ============================================================

  V6.register("buf-overflow", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    T(root, "스택 버퍼 오버플로 — Stack Smashing");

    let N = goodInteger(cfg.n, 8, 4, 16);
    let input = "HELLO";
    let canary = false;
    let aslr = true;
    let nx = true;
    let retResult = "";

    const controls = C(root);

    const sizeControl = range(
      controls,
      "buf 크기 N",
      4,
      16,
      N,
      value => {
        N = value;
        retResult = "";
        render();
      }
    );

    const text = inputText(
      controls,
      "입력 문자열",
      input,
      () => {
        input = text.value;
        retResult = "";
        render();
      }
    );

    text.style.width = "230px";

    const lengthControl = range(
      controls,
      "입력 길이(ASCII 예시)",
      0,
      40,
      input.length,
      value => {
        input = "A".repeat(value);
        text.value = input;
        retResult = "";
        render();
      }
    );

    const defenseBar = C(root);

    function checkbox(parent, caption, checked, fn) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checked;
      L(parent, caption, input);

      input.addEventListener("change", () => fn(input.checked));
      return input;
    }

    const canaryInput = checkbox(
      defenseBar,
      "Stack protector(canary)",
      false,
      value => {
        canary = value;
        retResult = "";
        render();
      }
    );

    checkbox(
      defenseBar,
      "ASLR",
      true,
      value => {
        aslr = value;
        render();
      }
    );

    checkbox(
      defenseBar,
      "NX",
      true,
      value => {
        nx = value;
        render();
      }
    );

    const retButton = B(defenseBar, "ret 실행", () => {
      const model = calculate();

      if (canary && model.canaryCorrupt) {
        retResult =
          "__stack_chk_fail: canary가 변경되어 반환 전 프로그램을 중단합니다.";
      } else if (model.returnCorrupt) {
        retResult =
          "반환 주소(return address)가 오염되었습니다. " +
          "ret은 변조된 주소를 읽습니다.\n" +
          "실제 결과는 메모리 권한·주소·시스템 방어에 따라 달라집니다. " +
          "유효하지 않은 주소라면 segmentation fault가 발생할 수 있습니다.";
      } else if (model.rbpCorrupt) {
        retResult =
          "saved %rbp가 손상되었지만 반환 주소 자체는 이 모델에서 보존되었습니다. " +
          "이후 실행은 손상된 프레임 포인터의 사용 여부에 따라 달라집니다.";
      } else {
        retResult =
          "saved %rbp와 반환 주소가 보존되었습니다. 정상 복귀를 시뮬레이션합니다.";
      }

      render();
    });

    const diagram = E("section", root);
    const resultPanel = S(root);
    const info = S(root);

    function utf8Bytes(s) {
      return Array.from(new TextEncoder().encode(s));
    }

    function calculate() {
      const bytes = utf8Bytes(input);
      const writeLength = bytes.length + 1;

      const canaryStart = N;
      const rbpStart = N + (canary ? 8 : 0);
      const retStart = rbpStart + 8;

      return {
        bytes,
        writeLength,
        canaryStart,
        rbpStart,
        retStart,
        canaryCorrupt:
          canary && writeLength > canaryStart,
        rbpCorrupt:
          writeLength > rbpStart,
        returnCorrupt:
          writeLength > retStart
      };
    }

    function regionName(offset, m) {
      if (offset < N) return "buf";
      if (canary && offset < m.rbpStart) return "canary";
      if (offset < m.retStart) return "saved %rbp";
      return "return address";
    }

    function renderRegion(parent, name, offsets, m, base) {
      const group = E("div", parent);
      group.style.marginBottom = "16px";

      noteHeader(group, name);

      const scroll = E("div", group, "", "v6-table-scroll");
      const grid = E("div", scroll);

      Object.assign(grid.style, {
        display: "grid",
        gridTemplateColumns: "repeat(8, minmax(64px,1fr))",
        gap: "4px",
        minWidth: "580px",
        marginTop: "8px"
      });

      offsets.forEach(offset => {
        const overwritten = offset < m.writeLength;
        const corrupted = overwritten && offset >= N;

        let value = "기존 값";

        if (offset < m.bytes.length) {
          value =
            "0x" +
            m.bytes[offset].toString(16).padStart(2, "0");
        } else if (offset === m.bytes.length) {
          value = "0x00 NUL";
        }

        const cell = box(
          grid,
          hex(base + BigInt(offset)) +
          "\n" +
          (overwritten ? value : "—"),
          corrupted
        );

        cell.style.whiteSpace = "pre-wrap";
        cell.style.textAlign = "center";
        cell.style.fontSize = "11px";
        cell.title =
          regionName(offset, m) +
          (corrupted ? " · 경계 밖 쓰기" : "");
      });
    }

    function render() {
      try {
        const m = calculate();
        clear(diagram);

        H(diagram, "스택 메모리 — 낮은 주소에서 높은 주소 순서");

        const base = 0x7fffffffe000n;
        const total = m.retStart + 8;

        const offsets = Array.from(
          { length: total },
          (_, i) => i
        );

        renderRegion(
          diagram,
          "1 · 지역 버퍼 buf[" + N + "]",
          offsets.filter(x => x < N),
          m,
          base
        );

        if (canary) {
          renderRegion(
            diagram,
            "2 · Stack Canary (8바이트)",
            offsets.filter(
              x => x >= N && x < m.rbpStart
            ),
            m,
            base
          );
        }

        renderRegion(
          diagram,
          canary
            ? "3 · Saved %rbp (8바이트)"
            : "2 · Saved %rbp (8바이트)",
          offsets.filter(
            x => x >= m.rbpStart && x < m.retStart
          ),
          m,
          base
        );

        renderRegion(
          diagram,
          canary
            ? "4 · Return Address (8바이트)"
            : "3 · Return Address (8바이트)",
          offsets.filter(x => x >= m.retStart),
          m,
          base
        );

        const overflowCount = Math.max(
          0,
          m.writeLength - N
        );

        resultPanel.textContent =
          "buf 크기: " + N + " B\n" +
          "입력 UTF-8 길이: " + m.bytes.length + " B\n" +
          "gets()가 쓰는 길이: " + m.writeLength +
          " B (끝 NUL 포함)\n" +
          "버퍼 경계 초과: " + overflowCount + " B\n\n" +
          "saved %rbp 침범: " +
          (m.rbpCorrupt ? "예" : "아니오") + "\n" +
          "return address 침범: " +
          (m.returnCorrupt ? "예" : "아니오") +
          (canary
            ? "\ncanary 변경: " +
              (m.canaryCorrupt ? "예" : "아니오")
            : "") +
          (retResult ? "\n\n" + retResult : "");

        info.textContent =
          "방어 기법 — Mitigations\n" +
          "Stack canary: 반환 직전에 변조 여부를 검사합니다.\n" +
          "ASLR: " + (aslr ? "활성" : "비활성") +
          " — 주소 배치를 예측하기 어렵게 합니다.\n" +
          "NX: " + (nx ? "활성" : "비활성") +
          " — 비실행 메모리에서 코드 실행을 제한합니다.\n\n" +
          "핵심 방어는 입력 길이를 검사하는 안전한 코드입니다.\n" +
          "이 그림은 설명용 스택 배치입니다. " +
          "실제 컴파일러의 패딩·canary·frame pointer 구성은 다를 수 있습니다.";
      } catch (e) {
        clear(diagram);
        resultPanel.textContent = "";
        notice(info, e.message);
      }
    }

    render();
  });

  // ============================================================
  // 5. Byte Ordering
  // ============================================================

  V6.register("byte-order", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    T(root, "바이트 순서 — Little / Big Endian");

    let value = 0x01234567n;
    let width = 4;
    let mode = "number";
    const ascii = "0123";
    let errorText = "";

    if (cfg.value !== undefined) {
      try {
        const parsed = parseIntExact(cfg.value);

        if (parsed < 0n || parsed > 0xffffffffn) {
          throw new Error("32비트 범위를 초과했습니다.");
        }

        value = parsed;
      } catch (e) {
        errorText = e.message;
      }
    }

    const controls = C(root);

    const text = inputText(
      controls,
      "정수(hex 또는 10진)",
      hex(value, 8),
      update
    );

    const intButton = B(controls, "32비트(int)", () => {
      width = 4;
      mode = "number";
      render();
    });

    const shortButton = B(controls, "16비트(short)", () => {
      width = 2;
      mode = "number";
      render();
    });

    const asciiButton = B(controls, "문자열(ASCII)", () => {
      mode = "ascii";
      render();
    });

    const diagram = E("section", root);
    const info = S(root);

    function update() {
      try {
        const n = parseIntExact(text.value);

        if (n < 0n || n > 0xffffffffn) {
          throw new Error("0부터 0xFFFFFFFF까지 입력하세요.");
        }

        value = n;
        mode = "number";
        errorText = "";
        render();
      } catch (e) {
        errorText = e.message;
        clear(diagram);
        notice(info, errorText);
      }
    }

    function drawRow(parent, name, bytes, indices) {
      H(parent, name);

      const grid = E("div", parent);

      Object.assign(grid.style, {
        display: "grid",
        gridTemplateColumns:
          "repeat(" + bytes.length + ", minmax(0,1fr))",
        gap: "6px",
        maxWidth: "720px"
      });

      bytes.forEach((byte, index) => {
        const cell = box(
          grid,
          "주소 +" + index +
          "\n0x" +
          byte.toString(16).padStart(2, "0")
        );

        cell.style.whiteSpace = "pre-wrap";
        cell.style.textAlign = "center";
        cell.style.fontSize = "14px";
        cell.style.padding = "13px 6px";

        cell.title =
          "원래 정수의 byte " + indices[index];
      });
    }

    function render() {
      selectState(
        intButton,
        mode === "number" && width === 4
      );

      selectState(
        shortButton,
        mode === "number" && width === 2
      );

      selectState(asciiButton, mode === "ascii");

      clear(diagram);

      if (errorText) {
        notice(info, errorText);
        return;
      }

      if (mode === "ascii") {
        const bytes = [
          ...Array.from(new TextEncoder().encode(ascii)),
          0
        ];

        H(diagram, '문자열 "0123"');

        drawRow(
          diagram,
          "메모리 주소 증가 방향",
          bytes,
          [0, 1, 2, 3, "NUL"]
        );

        info.textContent =
          '문자열 "0123" + NUL의 바이트\n' +
          "0x30 0x31 0x32 0x33 0x00\n\n" +
          "문자열은 바이트 배열이므로 바이트 순서가 문자를 재배열하지 않습니다.\n" +
          "다만 같은 바이트열을 다바이트 정수로 해석하면 endian에 따라 숫자 값이 달라집니다.";
        return;
      }

      const mask = (1n << BigInt(width * 8)) - 1n;
      const v = value & mask;

      const little = [];
      const big = [];

      for (let i = 0; i < width; i++) {
        little.push(
          Number((v >> BigInt(i * 8)) & 255n)
        );
      }

      for (let i = width - 1; i >= 0; i--) {
        big.push(little[i]);
      }

      drawRow(
        diagram,
        "Little-endian — x86-64",
        little,
        Array.from({ length: width }, (_, i) => i)
      );

      drawRow(
        diagram,
        "Big-endian",
        big,
        Array.from(
          { length: width },
          (_, i) => width - 1 - i
        )
      );

      info.textContent =
        "값: " + hex(v, width * 2) + "\n" +
        "크기: " + width + "바이트\n\n" +
        "Little-endian: " +
        little.map(x =>
          "0x" + x.toString(16).padStart(2, "0")
        ).join(" ") +
        "\nBig-endian: " +
        big.map(x =>
          "0x" + x.toString(16).padStart(2, "0")
        ).join(" ") +
        "\n\n" +
        "Little-endian은 최하위 바이트(LSB)를 낮은 주소에 저장합니다.\n" +
        "Big-endian은 최상위 바이트(MSB)를 낮은 주소에 저장합니다.\n" +
        "바이트 저장 순서는 달라도 같은 규칙으로 해석하면 원래 정수 값은 같습니다.";
    }

    render();
  });

  // ============================================================
  // 6. Virtual Memory Layout
  // ============================================================

  V6.register("mem-layout", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    T(root, "프로세스 가상주소 공간 — Virtual Memory Layout");

    const USER_TOP = 0x00007ffffffffffen;
    const KERNEL_START = 0xffff800000000000n;

    const BASES = {
      text: 0x400000n,
      data: 0x600000n,
      heap: 0x800000n,
      mmap: 0x7f0000000000n,
      stack: 0x7fffffffe000n
    };

    let heapSize = 0x1000n;
    let stackUsed = 0x1000n;
    let selected = BASES.text;
    let messageText = "";
    let errorText = "";

    const controls = C(root);

    const addressInput = inputText(
      controls,
      "가상주소(hex)",
      hex(selected),
      () => {
        try {
          const parsed = parseIntExact(addressInput.value);

          if (parsed < 0n || parsed > MASK64) {
            throw new Error("64비트 주소 범위를 초과했습니다.");
          }

          selected = parsed;
          messageText = "";
          errorText = "";
          render();
        } catch (e) {
          errorText = e.message;
          clear(diagram);
          notice(info, errorText);
        }
      }
    );

    addressInput.style.width = "230px";

    const mallocButton = B(
      controls,
      "malloc(+4KiB)",
      () => {
        if (heapSize + 0x1000n > 0x100000n) {
          errorText =
            "교육용 heap 크기 상한(1MiB)에 도달했습니다.";
          render();
          return;
        }

        heapSize += 0x1000n;
        errorText = "";
        messageText =
          "malloc 시뮬레이션: heap이 높은 주소 방향으로 4KiB 증가.";
        render();
      }
    );

    const callButton = B(
      controls,
      "함수 호출(stack −256B)",
      () => {
        if (stackUsed + 256n > 0x10000n) {
          errorText =
            "교육용 stack 사용량 상한(64KiB)에 도달했습니다.";
          render();
          return;
        }

        stackUsed += 256n;
        errorText = "";
        messageText =
          "함수 호출 시뮬레이션: %rsp가 낮은 주소로 256B 이동.";
        render();
      }
    );

    const returnButton = B(
      controls,
      "반환(stack +256B)",
      () => {
        stackUsed = stackUsed > 0x1000n
          ? stackUsed - 256n
          : 0x1000n;

        errorText = "";
        messageText =
          "함수 반환으로 스택 사용량이 감소했습니다.";
        render();
      }
    );

    B(controls, "리셋", () => {
      heapSize = 0x1000n;
      stackUsed = 0x1000n;
      errorText = "";
      messageText = "";
      render();
    });

    const diagram = E("section", root);
    const info = S(root);

    function classify(addr) {
      if (addr < 0n || addr > MASK64) {
        return {
          key: "invalid",
          text: "잘못된 주소"
        };
      }

      if (addr >= KERNEL_START) {
        return {
          key: "kernel",
          text: "커널 영역(kernel canonical half) — 사용자 모드 접근 불가"
        };
      }

      if (addr > USER_TOP) {
        return {
          key: "gap",
          text: "비정규 주소(non-canonical gap)"
        };
      }

      if (
        addr >= BASES.stack - stackUsed &&
        addr < BASES.stack
      ) {
        return {
          key: "stack",
          text: "스택(stack) — 아래로 성장"
        };
      }

      if (
        addr >= BASES.mmap &&
        addr < BASES.mmap + 0x100000n
      ) {
        return {
          key: "mmap",
          text: "mmap/공유 라이브러리 영역(예시)"
        };
      }

      if (
        addr >= BASES.heap &&
        addr < BASES.heap + heapSize
      ) {
        return {
          key: "heap",
          text: "힙(heap) — 위로 성장"
        };
      }

      if (
        addr >= BASES.data &&
        addr < BASES.data + 0x10000n
      ) {
        return {
          key: "data",
          text: "data/bss 영역(예시)"
        };
      }

      if (
        addr >= BASES.text &&
        addr < BASES.text + 0x10000n
      ) {
        return {
          key: "text",
          text: "text 코드 영역(예시, 읽기+실행)"
        };
      }

      return {
        key: "unmapped",
        text: "교육용 지도에서 매핑되지 않은 영역"
      };
    }

    function render() {
      clear(diagram);

      if (errorText) {
        notice(info, errorText);
        return;
      }

      const current = classify(selected);

      const exampleNotice = E(
        "div",
        diagram,
        "주소 공간 개념도 · 실제 프로세스 매핑이 아닌 교육용 예시",
        "v6-state"
      );

      exampleNotice.style.fontWeight = "600";

      H(diagram, "높은 주소 ↑ / 낮은 주소 ↓");

      const regions = [
        {
          key: "kernel",
          name: "커널 영역(kernel)",
          address: "0xFFFF800000000000 ~",
          desc: "사용자 접근 불가"
        },
        {
          key: "gap",
          name: "비정규 주소 간격",
          address: "canonical hole",
          desc: "접근 불가"
        },
        {
          key: "stack",
          name: "스택(stack)",
          address: "0x00007FFFFFFFE000 부근",
          desc: "↓ 낮은 주소 방향"
        },
        {
          key: "mmap",
          name: "mmap / 공유 라이브러리",
          address: "0x00007F0000000000 부근",
          desc: "매핑 기반"
        },
        {
          key: "unmapped",
          name: "미매핑 간격",
          address: "주소 범위는 실행마다 다름",
          desc: ""
        },
        {
          key: "heap",
          name: "힙(heap)",
          address: "0x0000000000800000 부근",
          desc: "↑ 높은 주소 방향"
        },
        {
          key: "data",
          name: "data / bss",
          address: "0x0000000000600000 부근",
          desc: "전역·정적 데이터"
        },
        {
          key: "text",
          name: "text",
          address: "0x0000000000400000 부근",
          desc: "읽기 + 실행"
        },
        {
          key: "unmapped-low",
          name: "낮은 주소 / 보호 영역",
          address: "0x0000000000000000 부근",
          desc: "NULL 등"
        }
      ];

      const layout = E("div", diagram);

      Object.assign(layout.style, {
        display: "grid",
        gap: "5px",
        maxWidth: "720px"
      });

      regions.forEach(region => {
        const active =
          region.key === current.key ||
          (
            region.key === "unmapped-low" &&
            current.key === "unmapped" &&
            selected < BASES.text
          );

        const card = E("div", layout);

        Object.assign(card.style, {
          border: `1px solid ${active ? RED : INK}`,
          borderLeft: active
            ? `4px solid ${RED}`
            : `1px solid ${INK}`,
          padding: "12px 14px",
          background: active ? GRID : "white"
        });

        const name = E("div", card, region.name);
        name.style.fontWeight = "700";
        name.style.fontSize = "14px";
        name.style.color = active ? RED : INK;

        const address = E("div", card, region.address);

        Object.assign(address.style, {
          fontFamily: MONO,
          fontSize: "12px",
          overflowWrap: "anywhere"
        });

        if (region.desc) {
          const desc = E("div", card, region.desc);
          desc.style.fontSize = "12px";
        }

        if (active) {
          const chosen = E(
            "div",
            card,
            "← 선택 주소가 속하는 영역"
          );

          chosen.style.color = RED;
          chosen.style.fontWeight = "600";
          chosen.style.fontSize = "12px";
          chosen.style.marginTop = "5px";
        }

        if (region.key === "stack" ||
            region.key === "heap") {
          const track = E("div", card);

          Object.assign(track.style, {
            height: "7px",
            border: `1px solid ${GRID}`,
            marginTop: "10px",
            overflow: "hidden"
          });

          const fill = E("div", track);

          const fraction = region.key === "stack"
            ? Number(stackUsed) / 65536
            : Number(heapSize) / 1048576;

          Object.assign(fill.style, {
            width: Math.max(
              2,
              Math.min(100, fraction * 100)
            ) + "%",
            height: "100%",
            background: RED,
            transition: "width 250ms ease"
          });
        }
      });

      info.textContent =
        (messageText ? messageText + "\n\n" : "") +
        "선택 주소: " + hex(selected) + "\n" +
        "영역 판정: " + current.text + "\n\n" +
        "현재 heap 시뮬레이션 크기: " +
        heapSize + " B\n" +
        "현재 stack 시뮬레이션 사용량: " +
        stackUsed + " B\n\n" +
        "Linux x86-64의 전형적인 4단계 페이지 테이블 " +
        "(48비트 canonical 주소) 설명용 지도입니다.\n" +
        "실제 주소·권한은 운영체제, ASLR, PIE, 프로세스 구성에 따라 달라집니다.\n" +
        "스택은 높은 주소에서 낮은 주소로 성장하고, " +
        "전형적인 brk 기반 힙은 낮은 주소에서 높은 주소로 확장됩니다.\n" +
        "Buffer Overflow 위젯에서는 return address 손상의 의미를 확인할 수 있습니다.";
    }

    render();
  });

})();