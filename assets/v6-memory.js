/* v6-memory bootstrap: register wrapper + remount after webfonts load (self-contained copy of the v6-extra pattern, isolated per task lane). */
(function(){
"use strict";
if(!window.V6||typeof window.V6.register!=="function")return;
var pendingRegistry={};
var origRegister=V6.register.bind(V6);
V6.register=function(name,fn){pendingRegistry[name]=fn;origRegister(name,fn);};
function remount(){
  document.querySelectorAll('.v6-widget[data-widget]').forEach(function(el){
    var fn=pendingRegistry[el.getAttribute('data-widget')];
    if(!fn)return;
    var cfg;try{cfg=JSON.parse(el.getAttribute('data-config')||'{}');}catch(e){return;}
    el.innerHTML='';
    try{fn(el,cfg);}catch(e){}
  });
}
if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){setTimeout(remount,50);});}
/* mobile: wrap each widget canvas in a local horizontal-scroll box (see v6-memory.css).
   Canvases are re-created on remount and on widget resets, so observe for them. */
function wrapCanvases(){
  if(window.innerWidth>760)return;
  document.querySelectorAll('.v6-widget').forEach(function(w){
    w.querySelectorAll('canvas').forEach(function(cv){
      var p=cv.parentElement;
      if(p&&p.classList&&p.classList.contains('v6-scrollx'))return;
      var d=document.createElement('div');d.className='v6-scrollx';
      p.insertBefore(d,cv);d.appendChild(cv);
    });
  });
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',function(){setTimeout(wrapCanvases,0);});}
else{setTimeout(wrapCanvases,0);}
new MutationObserver(function(muts){
  if(window.innerWidth>760)return;
  for(var i=0;i<muts.length;i++){
    var t=muts[i].target;
    if(t&&t.closest&&t.closest('.v6-widget')){wrapCanvases();return;}
  }
}).observe(document.documentElement,{childList:true,subtree:true});
})();

/* ===== widget: cache-mapping (ChatGPT web authored, 2026-10-24) ===== */
(function () {
  "use strict";

  V6.register("cache-mapping", function (el, cfg) {
    el.replaceChildren();
    cfg = cfg || {};

    const INK = V6.INK || "#1a1a1a";
    const RED = V6.RED || "#9e2b25";
    const GRID = V6.GRID || "#e8e6e0";
    const WHITE = "#ffffff";
    const FONT = "'Noto Sans KR', sans-serif";
    const WIDTH = 720;

    const CSS = `
      /* CSS */
      .v6-widget .cm-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 10px 14px;
        margin: 12px 0;
      }

      .v6-widget .cm-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
      }

      .v6-widget .cm-label {
        font: 500 12px 'Noto Sans KR', sans-serif;
        color: #1a1a1a;
      }

      .v6-widget .cm-input,
      .v6-widget .cm-select {
        box-sizing: border-box;
        height: 36px;
        padding: 6px 9px;
        border: 1px solid #1a1a1a;
        border-radius: 5px;
        background: #ffffff;
        color: #1a1a1a;
        font: 13px 'Noto Sans KR', sans-serif;
        max-width: 100%;
      }

      .v6-widget .cm-address {
        width: 190px;
        font-family: ui-monospace, monospace;
        font-size: 14px;
      }

      .v6-widget .cm-number {
        width: 75px;
      }

      .v6-widget .cm-select {
        width: 90px;
      }

      .v6-widget .cm-range-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .v6-widget .cm-range {
        width: 105px;
        max-width: 100%;
        accent-color: #9e2b25;
        cursor: pointer;
      }

      .v6-widget .cm-range-value {
        min-width: 48px;
        font: 600 12px ui-monospace, monospace;
        color: #1a1a1a;
        white-space: nowrap;
      }

      .v6-widget .cm-action {
        height: 36px;
        min-width: 104px;
        padding: 0 12px;
        border: 1px solid #1a1a1a;
        border-radius: 5px;
        background: #ffffff;
        color: #1a1a1a;
        font: 500 12px 'Noto Sans KR', sans-serif;
        cursor: pointer;
        transition: background 120ms, color 120ms;
      }

      .v6-widget .cm-action:hover,
      .v6-widget .cm-action:focus-visible {
        background: #1a1a1a;
        color: #ffffff;
      }

      .v6-widget .cm-action[aria-pressed="true"] {
        background: #9e2b25;
        border-color: #9e2b25;
        color: #ffffff;
      }

      .v6-widget .cm-action[aria-pressed="true"]:hover {
        background: #1a1a1a;
        border-color: #1a1a1a;
      }

      .v6-widget .cm-input:focus-visible,
      .v6-widget .cm-select:focus-visible,
      .v6-widget .cm-range:focus-visible {
        outline: 2px solid #9e2b25;
        outline-offset: 2px;
      }

      .v6-widget .cm-input[aria-invalid="true"] {
        border-color: #9e2b25;
        outline-color: #9e2b25;
      }

      .v6-widget .cm-error {
        margin: 7px 0;
        font: 12px/1.6 'Noto Sans KR', sans-serif;
        color: #9e2b25;
      }

      .v6-widget .cm-hint {
        margin: 4px 0 10px;
        color: #1a1a1a;
        font: 12px/1.65 'Noto Sans KR', sans-serif;
      }

      .v6-widget .cm-canvas {
        display: block;
        width: 100%;
        max-width: 720px;
        height: auto;
        margin: 12px auto;
      }

      .v6-widget .cm-state {
        box-sizing: border-box;
        width: 100%;
        margin-top: 10px;
        padding: 12px 14px;
        border-left: 3px solid #9e2b25;
        background: #f7f6f3;
        color: #1a1a1a;
        font: 13px/1.8 'Noto Sans KR', sans-serif;
        overflow-wrap: anywhere;
      }

      .v6-widget .cm-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin: 5px 0 12px;
      }

      .v6-widget .cm-legend-btn {
        box-sizing: border-box;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        min-width: 105px;
        padding: 6px 10px;
        border: 1px solid #1a1a1a;
        border-radius: 5px;
        background: #ffffff;
        color: #1a1a1a;
        font: 12px 'Noto Sans KR', sans-serif;
        cursor: pointer;
      }

      .v6-widget .cm-legend-btn:hover,
      .v6-widget .cm-legend-btn:focus-visible {
        background: #1a1a1a;
        color: #ffffff;
      }

      .v6-widget .cm-legend-btn[aria-pressed="true"] {
        background: #9e2b25;
        border-color: #9e2b25;
        color: #ffffff;
      }

      .v6-widget .cm-legend-btn[aria-pressed="true"]:hover {
        background: #1a1a1a;
        border-color: #1a1a1a;
      }

      .v6-widget .cm-summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin: 10px 0 12px;
      }

      .v6-widget .cm-result {
        min-width: 0;
        padding: 10px;
        border: 1px solid #e8e6e0;
        border-radius: 5px;
        background: #ffffff;
        overflow-wrap: anywhere;
      }

      .v6-widget .cm-result-name {
        font: 600 12px 'Noto Sans KR', sans-serif;
        margin-bottom: 5px;
      }

      .v6-widget .cm-result-value {
        font: 600 14px/1.6 ui-monospace, monospace;
        overflow-wrap: anywhere;
      }

      .v6-widget .cm-result-dec {
        color: #555555;
        font: 11px/1.5 'Noto Sans KR', sans-serif;
        overflow-wrap: anywhere;
      }

      @media (max-width: 480px) {
        .v6-widget .cm-controls {
          gap: 9px;
        }

        .v6-widget .cm-field {
          flex: 1 1 135px;
        }

        .v6-widget .cm-address,
        .v6-widget .cm-number,
        .v6-widget .cm-select {
          width: 100%;
        }

        .v6-widget .cm-range-row {
          width: 100%;
        }

        .v6-widget .cm-range {
          width: 100%;
          flex: 1;
        }

        .v6-widget .cm-action {
          flex: 1 1 120px;
        }

        .v6-widget .cm-summary {
          gap: 5px;
        }

        .v6-widget .cm-result {
          padding: 7px 5px;
        }

        .v6-widget .cm-result-name {
          font-size: 10px;
        }

        .v6-widget .cm-result-value {
          font-size: 11px;
        }

        .v6-widget .cm-result-dec {
          font-size: 10px;
        }
      }
    `;

    // CSS is supplied separately above for placement in the site's stylesheet.
    // No global stylesheet or external dependency is injected here.
    void CSS;

    const clampInt = (value, fallback, min, max) => {
      if (
        value === null ||
        value === undefined ||
        typeof value === "boolean" ||
        (typeof value === "string" && value.trim() === "")
      ) {
        return fallback;
      }
      const n = Number(value);
      return Number.isFinite(n)
        ? Math.max(min, Math.min(max, Math.trunc(n)))
        : fallback;
    };

    const validE = [1, 2, 4, 8];

    const readConfig = (keys, fallback) => {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(cfg, key)) {
          return cfg[key];
        }
      }
      return fallback;
    };

    const initialM = clampInt(
      readConfig(["m", "addressBits"], 32),
      32,
      3,
      64
    );

    const initialS = clampInt(
      readConfig(["s", "setBits"], 4),
      4,
      0,
      10
    );

    const initialB = clampInt(
      readConfig(["b", "blockBits"], 4),
      4,
      2,
      6
    );

    const initialE = Number(readConfig(["E", "linesPerSet"], 4));

    const state = {
      m: initialM,
      s: initialS,
      b: initialB,
      E: validE.includes(initialE) ? initialE : 4,
      addressText: String(
        readConfig(["address", "addr"], "0x1A3F")
      ),
      selected: "set",
      active: true
    };

    // Keep the bit allocation legal without changing the user's address width.
    if (state.s + state.b > state.m) {
      state.s = Math.max(0, Math.min(state.s, state.m - state.b));
      if (state.s + state.b > state.m) {
        state.b = Math.max(2, state.m - state.s);
      }
    }

    function node(tag, className, text) {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = String(text);
      return element;
    }

    function append(parent, ...children) {
      children.forEach(child => parent.appendChild(child));
      return parent;
    }

    function label(text, control) {
      const element = node("label", "cm-label", text);
      element.appendChild(control);
      return element;
    }

    function field(titleText, control) {
      const wrapper = node("div", "cm-field");
      const title = node("label", "cm-label", titleText);

      if (control.id) title.htmlFor = control.id;

      append(wrapper, title, control);
      return wrapper;
    }

    function button(text, onClick, extraClass) {
      const b = node(
        "button",
        "v6-btn cm-action" + (extraClass ? " " + extraClass : ""),
        text
      );
      b.type = "button";
      b.addEventListener("click", onClick);
      return b;
    }

    function makeRange(name, min, max, value, onChange) {
      const wrap = node("div", "cm-field");

      const range = node("input", "cm-range");
      range.type = "range";
      range.min = String(min);
      range.max = String(max);
      range.step = "1";
      range.value = String(value);
      range.id = "cm-" + name + "-" + instanceId;

      const out = node("output", "cm-range-value");
      out.htmlFor = range.id;

      const row = node("div", "cm-range-row");
      append(row, range, out);

      const title = node("label", "cm-label");
      title.htmlFor = range.id;
      title.textContent =
        name === "s" ? "set index 비트 (s)" : "block offset 비트 (b)";

      append(wrap, title, row);

      range.addEventListener("input", () => {
        onChange(Number(range.value));
        syncControls();
        render();
      });

      return { wrap, range, out };
    }

    const instanceId = (window.__v6CacheMappingInstanceCounter =
      (window.__v6CacheMappingInstanceCounter || 0) + 1);

    const widgetTitle = String(
      readConfig(["title"], "캐시 주소 해석기 — Cache Address Mapping")
    );
    V6.title(el, widgetTitle);

    const controls = node("div", "v6-controls cm-controls");

    const mInput = node("input", "cm-input cm-number");
    mInput.type = "number";
    mInput.min = "3";
    mInput.max = "64";
    mInput.step = "1";
    mInput.value = String(state.m);
    mInput.id = "cm-m-" + instanceId;

    const mField = field("주소 길이 m (3–64 bits)", mInput);

    const sControl = makeRange("s", 0, 10, state.s, value => {
      state.s = value;
    });

    const bControl = makeRange("b", 2, 6, state.b, value => {
      state.b = value;
    });

    const eSelect = node("select", "cm-select");
    eSelect.id = "cm-e-" + instanceId;

    for (const e of validE) {
      const option = node("option", "", String(e));
      option.value = String(e);
      eSelect.appendChild(option);
    }

    eSelect.value = String(state.E);
    const eField = field("lines per set (E)", eSelect);

    append(controls, mField, sControl.wrap, bControl.wrap, eField);
    el.appendChild(controls);

    const addressControls = node("div", "v6-controls cm-controls");

    const addressInput = node("input", "cm-input cm-address");
    addressInput.type = "text";
    addressInput.id = "cm-address-" + instanceId;
    addressInput.autocomplete = "off";
    addressInput.spellcheck = false;
    addressInput.inputMode = "text";
    addressInput.placeholder = "예: 0x1A3F";
    addressInput.value = state.addressText;

    const addressField = field("메모리 주소 (16진수)", addressInput);

    const randomButton = button("랜덤 주소", () => {
      const bytes = new Uint8Array(Math.ceil(state.m / 8));

      if (
        typeof crypto !== "undefined" &&
        typeof crypto.getRandomValues === "function"
      ) {
        crypto.getRandomValues(bytes);
      } else {
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }

      let address = 0n;
      for (const byte of bytes) {
        address = (address << 8n) | BigInt(byte);
      }

      const mask = (1n << BigInt(state.m)) - 1n;
      address &= mask;

      state.addressText = hex(address, state.m);
      addressInput.value = state.addressText;
      render();
    });

    append(addressControls, addressField, randomButton);
    el.appendChild(addressControls);

    const hint = node("div", "cm-hint");
    el.appendChild(hint);

    const errorBox = node("div", "cm-error");
    errorBox.setAttribute("role", "alert");
    errorBox.hidden = true;
    el.appendChild(errorBox);

    const segmentControls = node("div", "cm-legend");

    const segmentButtons = {};

    [
      ["tag", "tag"],
      ["set", "set index"],
      ["offset", "block offset"]
    ].forEach(([key, text]) => {
      const b = node("button", "cm-legend-btn", text);
      b.type = "button";
      b.setAttribute("aria-pressed", String(state.selected === key));

      b.addEventListener("click", () => {
        state.selected = key;
        updateSegmentButtons();
        render();
      });

      segmentButtons[key] = b;
      segmentControls.appendChild(b);
    });

    el.appendChild(segmentControls);

    const results = node("div", "cm-summary");
    const resultNodes = {};

    [
      ["tag", "tag"],
      ["set", "set index"],
      ["offset", "block offset"]
    ].forEach(([key, name]) => {
      const card = node("div", "cm-result");
      const heading = node("div", "cm-result-name", name);
      const value = node("div", "cm-result-value", "—");
      const decimal = node("div", "cm-result-dec", "—");

      append(card, heading, value, decimal);
      results.appendChild(card);

      resultNodes[key] = { card, value, decimal };
    });

    el.appendChild(results);

    // V6.canvas creates a 720px-wide canvas and appends it to el.
    const canvas = V6.canvas(el, 570);
    canvas.classList.add("cm-canvas");
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.maxWidth = "720px";
    canvas.style.display = "block";

    const ctx = canvas.getContext("2d");

    // Canvas CSS coordinate system stays 720px wide.
    // Rendering adapts to DPR without changing logical coordinates.
    const LOGICAL_WIDTH = WIDTH;

    function resizeCanvas(height) {
      const dpr = Math.min(
        3,
        Math.max(1, window.devicePixelRatio || 1)
      );

      const pxWidth = Math.round(LOGICAL_WIDTH * dpr);
      const pxHeight = Math.round(height * dpr);

      if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
        canvas.width = pxWidth;
        canvas.height = pxHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.style.aspectRatio = LOGICAL_WIDTH + " / " + height;
    }

    const explanation = node("div", "v6-state cm-state");
    explanation.setAttribute("role", "status");
    explanation.setAttribute("aria-live", "polite");
    el.appendChild(explanation);

    mInput.addEventListener("change", () => {
      const requested = Number(mInput.value);

      if (!Number.isInteger(requested) || requested < 3 || requested > 64) {
        errorBox.hidden = false;
        errorBox.textContent =
          "주소 길이 m은 3 이상 64 이하의 정수여야 합니다.";
        mInput.value = String(state.m);
        return;
      }

      state.m = requested;
      syncControls();
      render();
    });

    eSelect.addEventListener("change", () => {
      state.E = Number(eSelect.value);
      render();
    });

    addressInput.addEventListener("input", () => {
      state.addressText = addressInput.value;
      render();
    });

    function syncControls() {
      state.m = clampInt(state.m, 32, 3, 64);

      state.s = clampInt(state.s, 4, 0, 10);
      state.b = clampInt(state.b, 4, 2, 6);

      // Preserve the actively changed slider where possible.
      // Invalid s+b combinations are reported, not silently interpreted.
      mInput.value = String(state.m);

      sControl.range.value = String(state.s);
      bControl.range.value = String(state.b);

      sControl.out.textContent =
        String(state.s) + " → S=" + String(2 ** state.s);

      bControl.out.textContent =
        String(state.b) + " → B=" + String(2 ** state.b);

      eSelect.value = String(state.E);

      hint.textContent =
        "현재 설정: S=" + (2 ** state.s) +
        " sets, B=" + (2 ** state.b) +
        " bytes, E=" + state.E +
        " lines/set · 총 데이터 용량 " +
        ((2 ** state.s) * (2 ** state.b) * state.E) +
        " bytes (tag/valid bits 제외)";
    }

    function updateSegmentButtons() {
      for (const key of Object.keys(segmentButtons)) {
        segmentButtons[key].setAttribute(
          "aria-pressed",
          String(state.selected === key)
        );
      }
    }

    function hex(n, bits) {
      const digits = Math.max(1, Math.ceil(bits / 4));
      return "0x" + n.toString(16).toUpperCase().padStart(digits, "0");
    }

    function hexCompact(n) {
      return "0x" + n.toString(16).toUpperCase();
    }

    function binary(n, bits) {
      if (bits <= 0) return "";
      return n.toString(2).padStart(bits, "0");
    }

    function parseAddress(input, m) {
      const clean = input.trim().replace(/\s+/g, "");

      if (!/^(?:0[xX])?[0-9a-fA-F]+$/.test(clean)) {
        return {
          ok: false,
          error: "주소는 16진수로 입력하세요. 예: 0x1A3F"
        };
      }

      let value;

      try {
        const body = clean.replace(/^0[xX]/, "");
        value = BigInt("0x" + body);
      } catch (_) {
        return {
          ok: false,
          error: "주소를 해석할 수 없습니다."
        };
      }

      if (value >= (1n << BigInt(m))) {
        return {
          ok: false,
          error:
            m + "비트 주소 범위를 초과했습니다. 최대값은 " +
            hex((1n << BigInt(m)) - 1n, m) + "입니다."
        };
      }

      return { ok: true, value };
    }

    function decodeAddress(address) {
      const b = BigInt(state.b);
      const s = BigInt(state.s);

      const offsetMask = (1n << b) - 1n;
      const setMask = (1n << s) - 1n;

      const offset = address & offsetMask;
      const setIndex = (address >> b) & setMask;
      const tag = address >> (b + s);

      return {
        address,
        t: state.m - state.s - state.b,
        tag,
        setIndex,
        offset,
        S: 2 ** state.s,
        B: 2 ** state.b,
        E: state.E,
        addressBinary: binary(address, state.m)
      };
    }

    function line(x1, y1, x2, y2, color, width = 1) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    function rect(x, y, w, h, fill, stroke, radius = 0, sw = 1) {
      ctx.beginPath();

      if (radius && typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, w, h, radius);
      } else {
        ctx.rect(x, y, w, h);
      }

      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }

      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = sw;
        ctx.stroke();
      }
    }

    function text(
      content,
      x,
      y,
      size = 12,
      color = INK,
      align = "left",
      weight = 400
    ) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px ${FONT}`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(String(content), x, y);
      ctx.restore();
    }

    function mono(
      content,
      x,
      y,
      size = 12,
      color = INK,
      align = "left",
      weight = 400
    ) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px ui-monospace, monospace`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(String(content), x, y);
      ctx.restore();
    }

    function fitText(content, maxWidth, initialSize, minimumSize = 8) {
      let size = initialSize;

      while (size > minimumSize) {
        ctx.font = `500 ${size}px ${FONT}`;
        if (ctx.measureText(String(content)).width <= maxWidth) break;
        size -= 0.5;
      }

      return size;
    }

    function sectionTitle(title, y) {
      text(title, 24, y, 16, INK, "left", 700);
      line(24, y + 18, 696, y + 18, GRID);
    }

    function segmentName(key) {
      if (key === "tag") return "tag";
      if (key === "set") return "set index";
      return "block offset";
    }

    function segmentRanges(decoded) {
      return [
        {
          key: "tag",
          label: "tag",
          start: 0,
          bits: decoded.t,
          value: decoded.tag
        },
        {
          key: "set",
          label: "set index",
          start: decoded.t,
          bits: state.s,
          value: decoded.setIndex
        },
        {
          key: "offset",
          label: "block offset",
          start: decoded.t + state.s,
          bits: state.b,
          value: decoded.offset
        }
      ];
    }

    function drawBitField(decoded, y) {
      const m = state.m;
      const startX = 24;
      const usableWidth = 672;
      const cellW = usableWidth / m;

      // Two rows are used for larger address widths so every bit
      // remains legible at logical 720px resolution.
      const perRow =
        m <= 32 ? m : (m <= 48 ? 32 : 32);

      const rowCount = Math.ceil(m / perRow);
      const cellH = m <= 32 ? 31 : 28;
      const rowPitch = 78;

      const groups = segmentRanges(decoded);

      text("상위 비트 (MSB)", 24, y - 10, 11, INK);
      text("하위 비트 (LSB)", 696, y - 10, 11, INK, "right");

      const binaryString = decoded.addressBinary;

      for (let row = 0; row < rowCount; row++) {
        const from = row * perRow;
        const to = Math.min(m, from + perRow);
        const count = to - from;

        const visualCellW =
          count === perRow
            ? usableWidth / perRow
            : usableWidth / perRow;

        const rowY = y + row * rowPitch;

        for (let i = from; i < to; i++) {
          const local = i - from;
          const x = startX + local * visualCellW;

          const group = groups.find(
            g => i >= g.start && i < g.start + g.bits
          );

          const isSelected =
            group && group.key === state.selected;

          const fill = isSelected ? "#f7e9e7" : WHITE;
          const border = isSelected ? RED : INK;

          rect(
            x,
            rowY,
            visualCellW,
            cellH,
            fill,
            border,
            0,
            isSelected ? 1.4 : 0.8
          );

          const bitFontSize =
            visualCellW >= 19 ? 12 :
            visualCellW >= 15 ? 10.5 : 9;

          mono(
            binaryString[i],
            x + visualCellW / 2,
            rowY + cellH / 2,
            bitFontSize,
            isSelected ? RED : INK,
            "center",
            isSelected ? 700 : 400
          );
        }

        // Draw segment headers separately for portions visible on this row.
        for (const group of groups) {
          if (group.bits === 0) continue;

          const a = Math.max(from, group.start);
          const b = Math.min(to, group.start + group.bits);

          if (a >= b) continue;

          const leftX = startX + (a - from) * visualCellW;
          const rightX = startX + (b - from) * visualCellW;
          const center = (leftX + rightX) / 2;

          const selected = group.key === state.selected;
          const headerY = rowY + cellH + 15;

          line(
            leftX + 1,
            rowY + cellH + 5,
            rightX - 1,
            rowY + cellH + 5,
            selected ? RED : GRID,
            selected ? 3 : 2
          );

          const width = rightX - leftX;
          const labelText =
            width >= 75
              ? `${group.label} (${group.bits} bits)`
              : width >= 40
                ? group.label
                : group.key === "offset" ? "b" :
                  group.key === "set" ? "s" : "t";

          const size = fitText(
            labelText,
            Math.max(10, width - 2),
            11,
            8
          );

          text(
            labelText,
            center,
            headerY,
            size,
            selected ? RED : INK,
            "center",
            selected ? 700 : 500
          );
        }

        mono(
          String(m - from - 1),
          24,
          rowY - 8,
          10,
          INK
        );

        mono(
          String(m - to),
          696,
          rowY - 8,
          10,
          INK,
          "right"
        );
      }

      if (state.s === 0) {
        text(
          "s = 0: set index 비트가 없으며 모든 주소는 set 0으로 매핑됩니다.",
          24,
          y + rowCount * rowPitch - 7,
          11,
          RED
        );
        return y + rowCount * rowPitch + 17;
      }

      return y + rowCount * rowPitch + 3;
    }

    function drawValueSummary(decoded, y) {
      sectionTitle("주소 분해 결과", y);

      const items = [
        {
          name: "tag",
          bits: decoded.t,
          value: decoded.tag,
          selected: state.selected === "tag"
        },
        {
          name: "set index",
          bits: state.s,
          value: decoded.setIndex,
          selected: state.selected === "set"
        },
        {
          name: "block offset",
          bits: state.b,
          value: decoded.offset,
          selected: state.selected === "offset"
        }
      ];

      const boxY = y + 32;
      const gap = 10;
      const boxW = (672 - gap * 2) / 3;

      items.forEach((item, i) => {
        const x = 24 + i * (boxW + gap);

        rect(
          x,
          boxY,
          boxW,
          85,
          item.selected ? "#f7e9e7" : WHITE,
          item.selected ? RED : GRID,
          5,
          item.selected ? 1.6 : 1
        );

        text(
          `${item.name} (${item.bits} bits)`,
          x + 11,
          boxY + 17,
          11,
          item.selected ? RED : INK,
          "left",
          600
        );

        const hexValue =
          item.bits === 0 ? "0x0" : hexCompact(item.value);

        const fontSize = fitText(hexValue, boxW - 22, 15, 9);

        mono(
          hexValue,
          x + 11,
          boxY + 42,
          fontSize,
          INK,
          "left",
          600
        );

        const decimalValue = item.value.toString(10);
        const display = decimalValue.length > 26
          ? decimalValue.slice(0, 23) + "..."
          : decimalValue;

        mono(
          "10진: " + display,
          x + 11,
          boxY + 65,
          fitText("10진: " + display, boxW - 22, 11, 8),
          INK
        );
      });

      return boxY + 105;
    }

    function drawSetDiagram(decoded, y) {
      sectionTitle("캐시 구조와 주소 매핑", y);

      const S = decoded.S;
      const E = decoded.E;
      const target = Number(decoded.setIndex);

      const diagramTop = y + 37;
      const diagramLeft = 128;
      const diagramRight = 695;

      const rowHeight = 31;
      const rowGap = 5;

      // For large S, display a representative window around the
      // selected set, preserving actual set numbers.
      const maxVisibleRows = 13;

      let indices = [];

      if (S <= maxVisibleRows) {
        indices = Array.from({ length: S }, (_, i) => i);
      } else {
        const before = 5;
        const after = 5;

        const a = Math.max(0, target - before);
        const b = Math.min(S - 1, target + after);

        if (a > 0) indices.push(null);

        for (let i = a; i <= b; i++) {
          indices.push(i);
        }

        if (b < S - 1) indices.push(null);
      }

      const lineGap = 5;
      const lineAvailableWidth = diagramRight - diagramLeft - 8;
      const lineW = (lineAvailableWidth - (E - 1) * lineGap) / E;

      text("set", 25, diagramTop - 14, 11, INK, "left", 600);

      for (let j = 0; j < E; j++) {
        const x = diagramLeft + j * (lineW + lineGap);

        text(
          E === 1 ? "line 0 (direct-mapped)" : `line ${j}`,
          x + lineW / 2,
          diagramTop - 14,
          fitText(
            E === 1 ? "line 0 (direct-mapped)" : `line ${j}`,
            lineW - 2,
            10,
            8
          ),
          INK,
          "center",
          500
        );
      }

      indices.forEach((index, visibleRow) => {
        const rowY = diagramTop + visibleRow * (rowHeight + rowGap);

        if (index === null) {
          text(
            "⋮",
            76,
            rowY + rowHeight / 2,
            19,
            INK,
            "center"
          );

          text(
            "⋮   중간 set 생략",
            diagramLeft + 10,
            rowY + rowHeight / 2,
            11,
            INK
          );
          return;
        }

        const selected = index === target;

        rect(
          24,
          rowY,
          96,
          rowHeight,
          selected ? RED : "#f7f6f3",
          selected ? RED : GRID,
          4,
          1
        );

        text(
          `set ${index}`,
          72,
          rowY + rowHeight / 2,
          12,
          selected ? WHITE : INK,
          "center",
          selected ? 700 : 500
        );

        for (let lineIndex = 0; lineIndex < E; lineIndex++) {
          const x =
            diagramLeft + lineIndex * (lineW + lineGap);

          rect(
            x,
            rowY,
            lineW,
            rowHeight,
            selected ? "#f7e9e7" : WHITE,
            selected ? RED : GRID,
            4,
            selected ? 1.5 : 1
          );

          if (selected) {
            // Mapping selects a set, not a particular way.
            // A matching tag may occupy any one of its E lines.
            text(
              E === 1 ? "후보 line" : "tag 비교 후보",
              x + lineW / 2,
              rowY + rowHeight / 2,
              fitText(
                E === 1 ? "후보 line" : "tag 비교 후보",
                lineW - 8,
                11,
                8
              ),
              RED,
              "center",
              600
            );
          } else {
            text(
              "cache line",
              x + lineW / 2,
              rowY + rowHeight / 2,
              fitText("cache line", lineW - 8, 10, 8),
              INK,
              "center"
            );
          }
        }
      });

      const bottom =
        diagramTop + indices.length * (rowHeight + rowGap) + 7;

      rect(
        24,
        bottom,
        672,
        61,
        "#f7f6f3",
        GRID,
        5
      );

      const firstSentence =
        E === 1
          ? `E=1: set ${target}의 단일 line만 검사합니다 (direct-mapped).`
          : `E=${E}: set ${target}의 ${E}개 line을 후보로 tag를 비교합니다.`;

      text(firstSentence, 36, bottom + 19, 12, INK, "left", 600);

      text(
        "set index는 후보 set을 정하며, hit 여부는 valid bit와 tag 비교로 결정됩니다.",
        36,
        bottom + 42,
        11,
        INK
      );

      return bottom + 77;
    }

    function drawFormula(decoded, y) {
      sectionTitle("주소 해석 공식", y);

      const s = state.s;
      const b = state.b;

      const formulas = [
        `block offset = address mod 2^${b}`,
        `set index = floor(address / 2^${b}) mod 2^${s}`,
        `tag = floor(address / 2^${s + b})`
      ];

      formulas.forEach((formula, i) => {
        mono(formula, 30, y + 37 + i * 27, 12, INK);
      });

      return y + 122;
    }

    function drawCanvas(decoded) {
      if (!ctx) return;

      const rowCount =
        decoded.addressBinary.length <= 32 ? 1 : 2;

      const visibleRows =
        decoded.S <= 13
          ? decoded.S
          : Math.min(decoded.S, 11) +
            (Number(decoded.setIndex) > 5 ? 1 : 0) +
            (Number(decoded.setIndex) < decoded.S - 6 ? 1 : 0);

      const estimatedHeight =
        90 +
        rowCount * 78 +
        180 +
        visibleRows * 36 +
        175 +
        155;

      resizeCanvas(Math.max(530, estimatedHeight));

      ctx.clearRect(0, 0, WIDTH, estimatedHeight);
      rect(0, 0, WIDTH, estimatedHeight, WHITE);

      const addressString = hex(decoded.address, state.m);

      sectionTitle("메모리 주소 비트 분해", 30);

      mono(
        addressString,
        24,
        64,
        15,
        RED,
        "left",
        700
      );

      text(
        `${state.m}-bit address · t=${decoded.t}, s=${state.s}, b=${state.b}`,
        696,
        64,
        11,
        INK,
        "right"
      );

      let y = drawBitField(decoded, 99);
      y = drawValueSummary(decoded, y + 16);
      y = drawSetDiagram(decoded, y + 12);
      y = drawFormula(decoded, y + 13);

      // Trim the canvas to the exact drawing height.
      const exactHeight = Math.ceil(y + 12);

      const currentHeight =
        canvas.height / Math.min(
          3,
          Math.max(1, window.devicePixelRatio || 1)
        );

      if (Math.abs(currentHeight - exactHeight) > 2) {
        // A canvas resize clears the rendering.
        // Use a non-recursive second painting pass.
        resizeCanvas(exactHeight);
        ctx.clearRect(0, 0, WIDTH, exactHeight);
        rect(0, 0, WIDTH, exactHeight, WHITE);

        sectionTitle("메모리 주소 비트 분해", 30);

        mono(addressString, 24, 64, 15, RED, "left", 700);

        text(
          `${state.m}-bit address · t=${decoded.t}, s=${state.s}, b=${state.b}`,
          696,
          64,
          11,
          INK,
          "right"
        );

        let yy = drawBitField(decoded, 99);
        yy = drawValueSummary(decoded, yy + 16);
        yy = drawSetDiagram(decoded, yy + 12);
        drawFormula(decoded, yy + 13);
      }
    }

    function updateResults(decoded) {
      const data = {
        tag: {
          value: decoded.tag,
          bits: decoded.t
        },
        set: {
          value: decoded.setIndex,
          bits: state.s
        },
        offset: {
          value: decoded.offset,
          bits: state.b
        }
      };

      for (const key of Object.keys(data)) {
        const entry = data[key];
        const target = resultNodes[key];

        target.value.textContent =
          hexCompact(entry.value);

        target.decimal.textContent =
          entry.value.toString(10) + " (10진) · " +
          entry.bits + " bits";

        target.card.style.borderColor =
          state.selected === key ? RED : GRID;

        target.card.style.background =
          state.selected === key ? "#f7e9e7" : WHITE;

        target.value.style.color =
          state.selected === key ? RED : INK;
      }
    }

    function updateExplanation(decoded) {
      const address = decoded.address;
      const S = decoded.S;
      const B = decoded.B;
      const setIndex = decoded.setIndex;

      const blockNumber = address >> BigInt(state.b);

      const base = address & ~((1n << BigInt(state.b)) - 1n);

      const example =
        `주소 ${hexCompact(address)}에서 ` +
        `하위 ${state.b}비트는 block offset ` +
        `${decoded.offset.toString()}이며, ` +
        `그 위 ${state.s}비트가 set index ` +
        `${setIndex.toString()}입니다. ` +
        `따라서 set ${setIndex.toString()}으로 매핑됩니다.`;

      const formula =
        `계산: floor(${address.toString()} / ${B}) ` +
        `mod ${S} = ${blockNumber.toString()} mod ${S} ` +
        `= ${setIndex.toString()}.`;

      const mode =
        state.E === 1
          ? "direct-mapped이므로 해당 set의 유일한 line이 후보입니다."
          : `${state.E}-way set associative이므로 해당 set의 ` +
            `${state.E}개 line에서 valid bit와 tag를 비교합니다.`;

      explanation.replaceChildren();

      const p1 = node("div", "", example);
      const p2 = node("div", "", formula);
      const p3 = node("div", "", mode);

      const p4 = node(
        "div",
        "",
        `해당 메모리 block의 시작 주소: ${hexCompact(base)} ` +
        `(block 크기 ${B} bytes).`
      );

      p1.style.fontWeight = "600";
      p1.style.marginBottom = "4px";

      p2.style.marginBottom = "4px";
      p3.style.marginBottom = "4px";

      append(explanation, p1, p2, p3, p4);
    }

    function clearResults() {
      for (const key of Object.keys(resultNodes)) {
        resultNodes[key].value.textContent = "—";
        resultNodes[key].decimal.textContent = "계산 불가";
      }

      explanation.textContent =
        "설정을 수정하거나 유효한 16진수 주소를 입력하면 주소 매핑 결과가 표시됩니다.";

      if (ctx) {
        resizeCanvas(145);
        ctx.clearRect(0, 0, WIDTH, 145);
        rect(0, 0, WIDTH, 145, WHITE);
        rect(24, 20, 672, 105, "#f7f6f3", GRID, 5);
        text(
          "유효한 설정과 주소를 입력하세요.",
          360,
          73,
          15,
          INK,
          "center",
          600
        );
      }
    }

    function render() {
      if (!state.active) return;

      syncControls();
      updateSegmentButtons();

      const t = state.m - state.s - state.b;

      if (t < 0) {
        const message =
          `비트 수가 맞지 않습니다: s+b=${state.s + state.b} > m=${state.m}. ` +
          "s 또는 b를 줄이거나 m을 늘리세요.";

        errorBox.hidden = false;
        errorBox.textContent = message;
        addressInput.setAttribute("aria-invalid", "false");
        clearResults();
        return;
      }

      const parsed = parseAddress(state.addressText, state.m);

      if (!parsed.ok) {
        errorBox.hidden = false;
        errorBox.textContent = parsed.error;
        addressInput.setAttribute("aria-invalid", "true");
        clearResults();
        return;
      }

      errorBox.hidden = true;
      errorBox.textContent = "";
      addressInput.setAttribute("aria-invalid", "false");

      const decoded = decodeAddress(parsed.value);

      updateResults(decoded);
      updateExplanation(decoded);
      drawCanvas(decoded);
    }

    // Avoid adding global listeners, timers, or observers per mount.
    // All event listeners belong to DOM nodes replaced by the runtime.
    // The widget retains no mutable cross-instance cache state.
    syncControls();
    render();
  });
})();

/* ===== widget: cache-sim (ChatGPT web authored, 2026-10-24) ===== */
(function () {
  "use strict";

  V6.register("cache-sim", function (el, cfg) {
    el.replaceChildren();
    cfg = cfg || {};

    const INK = V6.INK || "#1a1a1a";
    const RED = V6.RED || "#9e2b25";
    const GRID = V6.GRID || "#e8e6e0";
    const WHITE = "#ffffff";
    const PALE = "#f7f6f3";
    const PALE_RED = "#f8ecea";
    const MUTED = "#777777";
    const FONT = "'Noto Sans KR', sans-serif";
    const MONO = "ui-monospace, SFMono-Regular, Consolas, monospace";
    const W = 720;
    const ADDRESS_BITS = 64;

    /*
     * CSS
     *
     * 아래 CSS 문자열은 외부 스타일시트로 이동할 수 있다.
     * 모든 선택자는 .v6-widget 아래로 스코프되어 있다.
     */
    const CSS = `
      .v6-widget .cs-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 10px 12px;
        margin: 12px 0;
      }

      .v6-widget .cs-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
      }

      .v6-widget .cs-label {
        font: 500 12px 'Noto Sans KR', sans-serif;
        color: #1a1a1a;
      }

      .v6-widget .cs-range-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .v6-widget .cs-range {
        width: 110px;
        max-width: 100%;
        accent-color: #9e2b25;
        cursor: pointer;
      }

      .v6-widget .cs-range-value {
        min-width: 55px;
        color: #1a1a1a;
        font: 600 12px ui-monospace, monospace;
        white-space: nowrap;
      }

      .v6-widget .cs-select,
      .v6-widget .cs-input {
        box-sizing: border-box;
        height: 36px;
        padding: 6px 9px;
        border: 1px solid #1a1a1a;
        border-radius: 5px;
        background: #ffffff;
        color: #1a1a1a;
        font: 13px 'Noto Sans KR', sans-serif;
        max-width: 100%;
      }

      .v6-widget .cs-select {
        width: 105px;
      }

      .v6-widget .cs-input {
        width: 100%;
        font-family: ui-monospace, monospace;
      }

      .v6-widget .cs-address-field {
        flex: 1 1 290px;
      }

      .v6-widget .cs-btn {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 104px;
        min-height: 36px;
        padding: 7px 12px;
        border: 1px solid #1a1a1a;
        border-radius: 5px;
        background: #ffffff;
        color: #1a1a1a;
        font: 500 12px 'Noto Sans KR', sans-serif;
        cursor: pointer;
        transition:
          background 120ms ease,
          color 120ms ease,
          border-color 120ms ease;
      }

      .v6-widget .cs-btn:hover:not(:disabled),
      .v6-widget .cs-btn:focus-visible:not(:disabled) {
        background: #1a1a1a;
        color: #ffffff;
      }

      .v6-widget .cs-btn:disabled {
        opacity: 0.42;
        cursor: not-allowed;
      }

      .v6-widget .cs-btn.cs-primary {
        background: #9e2b25;
        border-color: #9e2b25;
        color: #ffffff;
      }

      .v6-widget .cs-btn.cs-primary:hover:not(:disabled),
      .v6-widget .cs-btn.cs-primary:focus-visible:not(:disabled) {
        background: #1a1a1a;
        border-color: #1a1a1a;
      }

      .v6-widget .cs-btn[aria-pressed="true"] {
        background: #9e2b25;
        border-color: #9e2b25;
        color: #ffffff;
      }

      .v6-widget .cs-btn[aria-pressed="true"]:hover {
        background: #1a1a1a;
        border-color: #1a1a1a;
      }

      .v6-widget .cs-btn:focus-visible,
      .v6-widget .cs-input:focus-visible,
      .v6-widget .cs-select:focus-visible,
      .v6-widget .cs-range:focus-visible {
        outline: 2px solid #9e2b25;
        outline-offset: 2px;
      }

      .v6-widget .cs-input[aria-invalid="true"] {
        border-color: #9e2b25;
      }

      .v6-widget .cs-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin: 9px 0 12px;
      }

      .v6-widget .cs-section-label {
        margin: 13px 0 6px;
        font: 600 12px 'Noto Sans KR', sans-serif;
        color: #1a1a1a;
      }

      .v6-widget .cs-error {
        margin: 7px 0;
        color: #9e2b25;
        font: 12px/1.6 'Noto Sans KR', sans-serif;
        overflow-wrap: anywhere;
      }

      .v6-widget .cs-hint {
        color: #555555;
        font: 12px/1.6 'Noto Sans KR', sans-serif;
        margin: 5px 0 10px;
      }

      .v6-widget .cs-progress {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin: 10px 0;
        font: 12px 'Noto Sans KR', sans-serif;
        color: #1a1a1a;
      }

      .v6-widget .cs-progress-track {
        flex: 1 1 120px;
        height: 7px;
        border-radius: 4px;
        background: #e8e6e0;
        overflow: hidden;
      }

      .v6-widget .cs-progress-fill {
        width: 0%;
        height: 100%;
        background: #9e2b25;
        transition: width 100ms ease;
      }

      .v6-widget .cs-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 7px;
        margin: 10px 0;
      }

      .v6-widget .cs-stat {
        min-width: 0;
        box-sizing: border-box;
        padding: 10px 8px;
        border: 1px solid #e8e6e0;
        border-radius: 5px;
        background: #ffffff;
        text-align: center;
      }

      .v6-widget .cs-stat-name {
        color: #555555;
        font: 11px 'Noto Sans KR', sans-serif;
      }

      .v6-widget .cs-stat-value {
        margin-top: 4px;
        color: #1a1a1a;
        font: 700 19px ui-monospace, monospace;
        overflow-wrap: anywhere;
      }

      .v6-widget .cs-stat[data-stat="misses"] .cs-stat-value,
      .v6-widget .cs-stat[data-stat="evictions"] .cs-stat-value {
        color: #9e2b25;
      }

      .v6-widget .cs-canvas {
        display: block;
        width: 100%;
        max-width: 720px;
        height: auto;
        margin: 12px auto;
      }

      .v6-widget .cs-state {
        box-sizing: border-box;
        width: 100%;
        margin: 10px 0;
        padding: 12px 14px;
        border-left: 3px solid #9e2b25;
        background: #f7f6f3;
        color: #1a1a1a;
        font: 13px/1.8 'Noto Sans KR', sans-serif;
        overflow-wrap: anywhere;
      }

      .v6-widget .cs-history {
        display: flex;
        gap: 5px;
        overflow-x: auto;
        padding: 8px 2px 12px;
        scroll-behavior: smooth;
        scrollbar-width: thin;
      }

      .v6-widget .cs-history-item {
        flex: 0 0 57px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        min-height: 54px;
        padding: 5px 3px;
        border: 1px solid #e8e6e0;
        border-radius: 4px;
        background: #ffffff;
        color: #1a1a1a;
        text-align: center;
        font: 10px 'Noto Sans KR', sans-serif;
      }

      .v6-widget .cs-history-item[data-kind="hit"] {
        background: #1a1a1a;
        border-color: #1a1a1a;
        color: #ffffff;
      }

      .v6-widget .cs-history-item[data-kind="miss"] {
        background: #9e2b25;
        border-color: #9e2b25;
        color: #ffffff;
      }

      .v6-widget .cs-history-item[data-kind="eviction"] {
        background: #ffffff;
        border: 2px solid #9e2b25;
        color: #9e2b25;
      }

      .v6-widget .cs-history-item[data-kind="pending"] {
        background: #ffffff;
        color: #777777;
      }

      .v6-widget .cs-history-item[data-current="true"] {
        outline: 2px solid #9e2b25;
        outline-offset: 2px;
      }

      .v6-widget .cs-history-number {
        font: 600 10px ui-monospace, monospace;
      }

      .v6-widget .cs-history-result {
        font: 700 12px ui-monospace, monospace;
      }

      .v6-widget .cs-history-address {
        font: 9px ui-monospace, monospace;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .v6-widget .cs-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 5px 0;
        color: #555555;
        font: 11px 'Noto Sans KR', sans-serif;
      }

      .v6-widget .cs-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .v6-widget .cs-swatch {
        width: 11px;
        height: 11px;
        border: 1px solid #1a1a1a;
        border-radius: 2px;
      }

      .v6-widget .cs-swatch-hit {
        background: #1a1a1a;
      }

      .v6-widget .cs-swatch-miss {
        background: #9e2b25;
        border-color: #9e2b25;
      }

      .v6-widget .cs-swatch-evict {
        background: #ffffff;
        border: 2px solid #9e2b25;
      }

      @media (max-width: 480px) {
        .v6-widget .cs-controls {
          gap: 8px;
        }

        .v6-widget .cs-field {
          flex: 1 1 130px;
        }

        .v6-widget .cs-range-row {
          width: 100%;
        }

        .v6-widget .cs-range {
          flex: 1;
          width: 100%;
        }

        .v6-widget .cs-select {
          width: 100%;
        }

        .v6-widget .cs-btn {
          flex: 1 1 110px;
          min-width: 0;
        }

        .v6-widget .cs-summary {
          gap: 5px;
        }

        .v6-widget .cs-stat {
          padding: 8px 3px;
        }

        .v6-widget .cs-stat-name {
          font-size: 10px;
        }

        .v6-widget .cs-stat-value {
          font-size: 15px;
        }
      }
    `;

    // CSS 문자열은 사이트의 CSS 파일로 옮겨 사용할 수 있다.
    // 런타임 동작에 필요한 최소 스타일은 DOM inline style에도 지정한다.
    void CSS;

    const clampInt = (value, fallback, min, max) => {
      if (
        value === undefined ||
        value === null ||
        typeof value === "boolean" ||
        (typeof value === "string" && value.trim() === "")
      ) {
        return fallback;
      }

      const n = Number(value);

      return Number.isFinite(n)
        ? Math.max(min, Math.min(max, Math.trunc(n)))
        : fallback;
    };

    const allowedE = [1, 2, 4, 8];

    const readConfig = (keys, fallback) => {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(cfg, key)) {
          return cfg[key];
        }
      }
      return fallback;
    };

    const initialE = Number(readConfig(["E", "linesPerSet"], 2));

    const defaults = {
      s: clampInt(readConfig(["s", "setBits"], 4), 4, 1, 6),
      b: clampInt(readConfig(["b", "blockBits"], 4), 4, 2, 6),
      E: allowedE.includes(initialE) ? initialE : 2
    };

    const initialAccesses = String(
      readConfig(
        ["accesses", "trace", "addresses"],
        "0x0, 0x4, 0x20, 0x40, 0x0, 0x100, 0x20, 0x0"
      )
    );

    const model = {
      s: defaults.s,
      b: defaults.b,
      E: defaults.E,
      S: 1 << defaults.s,
      B: 1 << defaults.b,
      sets: [],
      trace: [],
      history: [],
      step: 0,
      clock: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      lastEvent: null,
      traceText: initialAccesses,
      loadedText: "",
      needsReset: false,
      active: true
    };

    function node(tag, className, content) {
      const n = document.createElement(tag);

      if (className) n.className = className;
      if (content !== undefined) n.textContent = String(content);

      return n;
    }

    function append(parent, ...children) {
      children.forEach(child => parent.appendChild(child));
      return parent;
    }

    function makeButton(content, handler, primary = false) {
      const b = node(
        "button",
        "v6-btn cs-btn" + (primary ? " cs-primary" : ""),
        content
      );

      b.type = "button";

      // Inline baseline guarantees visible click targets even when the
      // separately supplied CSS has not yet been installed.
      b.style.minHeight = "36px";
      b.style.padding = "7px 12px";
      b.style.border = "1px solid " + (primary ? RED : INK);
      b.style.borderRadius = "5px";
      b.style.background = primary ? RED : WHITE;
      b.style.color = primary ? WHITE : INK;
      b.style.cursor = "pointer";

      b.addEventListener("mouseenter", () => {
        if (!b.disabled) {
          b.style.background = INK;
          b.style.borderColor = INK;
          b.style.color = WHITE;
        }
      });

      b.addEventListener("mouseleave", () => {
        b.style.background = primary ? RED : WHITE;
        b.style.borderColor = primary ? RED : INK;
        b.style.color = primary ? WHITE : INK;
      });

      b.addEventListener("click", handler);

      return b;
    }

    function field(titleText, control) {
      const wrapper = node("div", "cs-field");
      const label = node("label", "cs-label", titleText);

      if (control.id) label.htmlFor = control.id;

      append(wrapper, label, control);
      return wrapper;
    }

    function makeRange(name, min, max, value, callback) {
      const input = node("input", "cs-range");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = "1";
      input.value = String(value);

      const output = node("output", "cs-range-value");

      const row = node("div", "cs-range-row");
      append(row, input, output);

      const wrapper = node("div", "cs-field");
      append(wrapper, node("label", "cs-label", name), row);

      input.addEventListener("input", () => {
        callback(Number(input.value));
        syncControls();
        resetSimulation();
      });

      return { wrapper, input, output };
    }

    function hex(value) {
      return "0x" + value.toString(16).toUpperCase();
    }

    function fixedHex(value, digits) {
      return "0x" +
        value.toString(16).toUpperCase().padStart(digits, "0");
    }

    function randomInt(maxExclusive) {
      if (
        typeof crypto !== "undefined" &&
        typeof crypto.getRandomValues === "function"
      ) {
        const array = new Uint32Array(1);
        const range = 0x100000000;
        const limit = Math.floor(range / maxExclusive) * maxExclusive;

        do {
          crypto.getRandomValues(array);
        } while (array[0] >= limit);

        return array[0] % maxExclusive;
      }

      return Math.floor(Math.random() * maxExclusive);
    }

    function parseTrace(value) {
      const raw = value.trim();

      if (!raw) {
        return {
          ok: false,
          error: "최소 하나의 메모리 주소를 입력하세요."
        };
      }

      const parts = raw.split(",");

      if (parts.length > 512) {
        return {
          ok: false,
          error: "한 번에 최대 512개의 주소까지 입력할 수 있습니다."
        };
      }

      const addresses = [];

      for (let i = 0; i < parts.length; i++) {
        const item = parts[i].trim();

        if (!/^(?:0[xX])?[0-9a-fA-F]+$/.test(item)) {
          return {
            ok: false,
            error:
              `${i + 1}번째 주소가 올바른 16진수가 아닙니다: ` +
              (item || "(빈 항목)")
          };
        }

        let address;

        try {
          address = BigInt(
            "0x" + item.replace(/^0[xX]/, "")
          );
        } catch (_) {
          return {
            ok: false,
            error: `${i + 1}번째 주소를 해석할 수 없습니다.`
          };
        }

        if (address < 0n || address >= (1n << 64n)) {
          return {
            ok: false,
            error:
              `${i + 1}번째 주소가 64-bit 주소 범위를 초과합니다.`
          };
        }

        addresses.push(address);
      }

      return {
        ok: true,
        addresses
      };
    }

    function decode(address) {
      const b = BigInt(model.b);
      const s = BigInt(model.s);

      const offset = address & ((1n << b) - 1n);
      const setIndex = Number(
        (address >> b) & ((1n << s) - 1n)
      );
      const tag = address >> (b + s);
      const block = address >> b;

      return { address, offset, setIndex, tag, block };
    }

    function createCache() {
      model.S = 1 << model.s;
      model.B = 1 << model.b;

      model.sets = Array.from({ length: model.S }, () =>
        Array.from({ length: model.E }, () => ({
          valid: false,
          tag: 0n,
          lastUsed: 0,
          insertedAt: 0
        }))
      );
    }

    function clearCounters() {
      model.step = 0;
      model.clock = 0;
      model.hits = 0;
      model.misses = 0;
      model.evictions = 0;
      model.history = [];
      model.lastEvent = null;
    }

    function executeAccess(address) {
      const info = decode(address);
      const lines = model.sets[info.setIndex];

      // Monotonically increasing timestamp, unique for every access.
      // The line with the smallest lastUsed is the LRU victim.
      model.clock += 1;
      const time = model.clock;

      let hitIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].valid && lines[i].tag === info.tag) {
          hitIndex = i;
          break;
        }
      }

      let event;

      if (hitIndex !== -1) {
        const line = lines[hitIndex];

        const oldTime = line.lastUsed;
        line.lastUsed = time;

        model.hits += 1;

        event = {
          kind: "hit",
          address,
          info,
          lineIndex: hitIndex,
          oldLastUsed: oldTime,
          time,
          evictedTag: null
        };
      } else {
        model.misses += 1;

        // A miss first uses an invalid line, if one exists.
        let targetIndex = lines.findIndex(line => !line.valid);
        let evictedTag = null;
        let evictedLastUsed = null;
        let kind = "miss";

        if (targetIndex === -1) {
          // All ways are valid: evict precisely the least recently used line.
          targetIndex = 0;

          for (let i = 1; i < lines.length; i++) {
            if (
              lines[i].lastUsed <
              lines[targetIndex].lastUsed
            ) {
              targetIndex = i;
            }
          }

          evictedTag = lines[targetIndex].tag;
          evictedLastUsed = lines[targetIndex].lastUsed;

          kind = "eviction";
          model.evictions += 1;
        }

        const target = lines[targetIndex];

        target.valid = true;
        target.tag = info.tag;
        target.lastUsed = time;
        target.insertedAt = time;

        event = {
          kind,
          address,
          info,
          lineIndex: targetIndex,
          time,
          evictedTag,
          evictedLastUsed
        };
      }

      model.step += 1;
      event.number = model.step;

      model.history.push(event);
      model.lastEvent = event;

      return event;
    }

    function stepForward() {
      if (model.step >= model.trace.length) return;

      executeAccess(model.trace[model.step]);
      render();
    }

    function runAll() {
      while (model.step < model.trace.length) {
        executeAccess(model.trace[model.step]);
      }

      render();
    }

    function rewind() {
      createCache();
      clearCounters();
      render();
    }

    function resetSimulation() {
      createCache();
      clearCounters();

      const parsed = parseTrace(model.traceText);

      if (parsed.ok) {
        model.trace = parsed.addresses;
        model.loadedText = model.traceText;
        model.needsReset = false;
      } else {
        model.trace = [];
        model.loadedText = "";
        model.needsReset = true;
      }

      render();
    }

    function loadPreset(name) {
      let values = [];

      if (name === "sequential") {
        values = Array.from({ length: 64 }, (_, i) => BigInt(i));
      } else if (name === "stride") {
        values = Array.from(
          { length: 16 },
          (_, i) => BigInt(i * 8)
        );
      } else if (name === "random") {
        // Small address range deliberately allows repeated blocks.
        values = Array.from(
          { length: 16 },
          () => BigInt(randomInt(256))
        );
      } else if (name === "repeat") {
        const B = 1 << model.b;

        values = [
          0, 1, 2, 3,
          B - 1, 0, 4, 2,
          B - 2, 1, 0, B - 1
        ].map(n => BigInt(n));
      }

      model.traceText = values.map(hex).join(", ");
      addressInput.value = model.traceText;

      resetSimulation();
    }

    // ------------------------------------------------------------
    // DOM setup
    // ------------------------------------------------------------

    V6.title(
      el,
      String(
        readConfig(
          ["title"],
          "캐시 시뮬레이터 — Hit / Miss / LRU Eviction"
        )
      )
    );

    const settings = node("div", "v6-controls cs-controls");
    settings.style.display = "flex";
    settings.style.flexWrap = "wrap";
    settings.style.gap = "10px 12px";

    const sControl = makeRange(
      "set index 비트 (s)",
      1,
      6,
      model.s,
      value => {
        model.s = value;
      }
    );

    const bControl = makeRange(
      "block offset 비트 (b)",
      2,
      6,
      model.b,
      value => {
        model.b = value;
      }
    );

    const eSelect = node("select", "cs-select");

    for (const value of allowedE) {
      const option = node("option", "", String(value));
      option.value = String(value);
      eSelect.appendChild(option);
    }

    eSelect.value = String(model.E);

    eSelect.addEventListener("change", () => {
      model.E = Number(eSelect.value);
      resetSimulation();
    });

    const eField = field("lines per set (E)", eSelect);

    const resetButton = makeButton("캐시 재설정", () => {
      resetSimulation();
    });

    append(
      settings,
      sControl.wrapper,
      bControl.wrapper,
      eField,
      resetButton
    );

    el.appendChild(settings);

    const configurationHint = node("div", "cs-hint");
    el.appendChild(configurationHint);

    const presetLabel = node(
      "div",
      "cs-section-label",
      "접근 패턴 프리셋"
    );

    el.appendChild(presetLabel);

    const presets = node("div", "cs-presets");
    presets.style.display = "flex";
    presets.style.flexWrap = "wrap";
    presets.style.gap = "7px";

    append(
      presets,
      makeButton("순차 0..63", () => loadPreset("sequential")),
      makeButton("stride 8", () => loadPreset("stride")),
      makeButton("랜덤 16개", () => loadPreset("random")),
      makeButton("같은 블록 반복", () => loadPreset("repeat"))
    );

    el.appendChild(presets);

    const addressControls = node("div", "v6-controls cs-controls");
    addressControls.style.display = "flex";
    addressControls.style.flexWrap = "wrap";
    addressControls.style.gap = "9px";

    const addressInput = node("input", "cs-input");
    addressInput.type = "text";
    addressInput.value = model.traceText;
    addressInput.placeholder = "0x0, 0x4, 0x20, 0x40";
    addressInput.autocomplete = "off";
    addressInput.spellcheck = false;
    addressInput.style.width = "100%";
    addressInput.style.minHeight = "36px";
    addressInput.style.boxSizing = "border-box";
    addressInput.style.border = "1px solid " + INK;
    addressInput.style.borderRadius = "5px";
    addressInput.style.padding = "7px 9px";
    addressInput.style.background = WHITE;
    addressInput.style.color = INK;

    const addressField = field(
      "직접 입력 — 16진 주소, 쉼표 구분 (load만 지원)",
      addressInput
    );

    addressField.classList.add("cs-address-field");
    addressField.style.flex = "1 1 290px";

    const applyButton = makeButton(
      "접근 목록 적용",
      () => {
        model.traceText = addressInput.value;
        resetSimulation();
      },
      true
    );

    append(addressControls, addressField, applyButton);
    el.appendChild(addressControls);

    const errorBox = node("div", "cs-error");
    errorBox.setAttribute("role", "alert");
    errorBox.hidden = true;
    el.appendChild(errorBox);

    addressInput.addEventListener("input", () => {
      model.traceText = addressInput.value;
      model.needsReset =
        model.traceText !== model.loadedText;

      renderControls();
    });

    addressInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyButton.click();
      }
    });

    const executionLabel = node(
      "div",
      "cs-section-label",
      "시뮬레이션 실행"
    );

    el.appendChild(executionLabel);

    const executionControls = node(
      "div",
      "v6-controls cs-controls"
    );

    executionControls.style.display = "flex";
    executionControls.style.flexWrap = "wrap";
    executionControls.style.gap = "8px";

    const stepButton = makeButton(
      "한 단계",
      stepForward,
      true
    );

    const allButton = makeButton(
      "끝까지 실행",
      runAll
    );

    const rewindButton = makeButton(
      "처음으로",
      rewind
    );

    append(
      executionControls,
      stepButton,
      allButton,
      rewindButton
    );

    el.appendChild(executionControls);

    const progress = node("div", "cs-progress");
    progress.style.display = "flex";
    progress.style.alignItems = "center";
    progress.style.flexWrap = "wrap";
    progress.style.gap = "10px";

    const progressText = node("span", "", "0 / 0 접근");

    const progressTrack = node(
      "div",
      "cs-progress-track"
    );

    progressTrack.style.flex = "1 1 120px";
    progressTrack.style.height = "7px";
    progressTrack.style.background = GRID;
    progressTrack.style.borderRadius = "4px";
    progressTrack.style.overflow = "hidden";

    const progressFill = node(
      "div",
      "cs-progress-fill"
    );

    progressFill.style.height = "100%";
    progressFill.style.width = "0%";
    progressFill.style.background = RED;

    progressTrack.appendChild(progressFill);
    append(progress, progressText, progressTrack);
    el.appendChild(progress);

    // ------------------------------------------------------------
    // Statistics
    // ------------------------------------------------------------

    const statistics = node("div", "cs-summary");
    statistics.style.display = "grid";
    statistics.style.gridTemplateColumns =
      "repeat(4, minmax(0, 1fr))";
    statistics.style.gap = "7px";

    const statNodes = {};

    [
      ["hits", "hits"],
      ["misses", "misses"],
      ["evictions", "evictions"],
      ["hitRate", "hit rate"]
    ].forEach(([key, label]) => {
      const card = node("div", "cs-stat");
      card.dataset.stat = key;
      card.style.border = "1px solid " + GRID;
      card.style.borderRadius = "5px";
      card.style.padding = "10px 5px";
      card.style.textAlign = "center";
      card.style.minWidth = "0";

      const title = node("div", "cs-stat-name", label);
      const value = node("div", "cs-stat-value", "0");

      title.style.fontSize = "11px";
      value.style.fontSize = "18px";
      value.style.fontWeight = "700";
      value.style.fontFamily = MONO;
      value.style.marginTop = "4px";

      if (key === "misses" || key === "evictions") {
        value.style.color = RED;
      } else {
        value.style.color = INK;
      }

      append(card, title, value);
      statistics.appendChild(card);

      statNodes[key] = value;
    });

    el.appendChild(statistics);

    // ------------------------------------------------------------
    // Canvas
    // ------------------------------------------------------------

    const canvas = V6.canvas(el, 570);
    canvas.classList.add("cs-canvas");

    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.maxWidth = "720px";
    canvas.style.margin = "12px auto";

    const ctx = canvas.getContext("2d");

    const stateBox = node("div", "v6-state cs-state");
    stateBox.setAttribute("role", "status");
    stateBox.setAttribute("aria-live", "polite");

    stateBox.style.borderLeft = "3px solid " + RED;
    stateBox.style.background = PALE;
    stateBox.style.color = INK;
    stateBox.style.padding = "12px 14px";
    stateBox.style.margin = "10px 0";
    stateBox.style.lineHeight = "1.8";
    stateBox.style.overflowWrap = "anywhere";

    el.appendChild(stateBox);

    const historyLabel = node(
      "div",
      "cs-section-label",
      "접근 히스토리"
    );

    el.appendChild(historyLabel);

    const legend = node("div", "cs-legend");
    legend.style.display = "flex";
    legend.style.flexWrap = "wrap";
    legend.style.gap = "12px";

    function legendItem(label, fill, border) {
      const item = node("span", "cs-legend-item");
      item.style.display = "inline-flex";
      item.style.alignItems = "center";
      item.style.gap = "5px";

      const swatch = node("span", "cs-swatch");
      swatch.style.display = "inline-block";
      swatch.style.width = "11px";
      swatch.style.height = "11px";
      swatch.style.background = fill;
      swatch.style.border = border;

      append(item, swatch, node("span", "", label));
      return item;
    }

    append(
      legend,
      legendItem("HIT", INK, "1px solid " + INK),
      legendItem("MISS", RED, "1px solid " + RED),
      legendItem("MISS + EVICT", WHITE, "2px solid " + RED),
      legendItem("미실행", WHITE, "1px solid " + GRID)
    );

    el.appendChild(legend);

    const historyStrip = node("div", "cs-history");

    historyStrip.style.display = "flex";
    historyStrip.style.gap = "5px";
    historyStrip.style.overflowX = "auto";
    historyStrip.style.padding = "9px 3px 13px";

    el.appendChild(historyStrip);

    const footerHint = node(
      "div",
      "cs-hint",
      "LRU: 각 set에서 마지막 접근 시각이 가장 오래된 valid line을 교체합니다. " +
      "hit 시에도 마지막 접근 시각을 갱신합니다. " +
      "캐시는 처음에 모두 invalid 상태이며, write/modify 명령은 다루지 않습니다."
    );

    el.appendChild(footerHint);

    // ------------------------------------------------------------
    // Canvas helpers
    // ------------------------------------------------------------

    let canvasHeight = 570;

    function setupCanvas(height) {
      canvasHeight = Math.ceil(height);

      const dpr = Math.min(
        3,
        Math.max(1, window.devicePixelRatio || 1)
      );

      const pixelWidth = Math.round(W * dpr);
      const pixelHeight = Math.round(canvasHeight * dpr);

      if (
        canvas.width !== pixelWidth ||
        canvas.height !== pixelHeight
      ) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.style.aspectRatio = W + " / " + canvasHeight;

      ctx.clearRect(0, 0, W, canvasHeight);

      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, W, canvasHeight);
    }

    function rect(
      x,
      y,
      width,
      height,
      fill,
      stroke = null,
      radius = 0,
      strokeWidth = 1
    ) {
      ctx.beginPath();

      if (radius && typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, width, height, radius);
      } else {
        ctx.rect(x, y, width, height);
      }

      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }

      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
    }

    function line(x1, y1, x2, y2, color = GRID, width = 1) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    function text(
      content,
      x,
      y,
      size = 12,
      color = INK,
      align = "left",
      weight = 400
    ) {
      ctx.save();
      ctx.font = `${weight} ${size}px ${FONT}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(String(content), x, y);
      ctx.restore();
    }

    function mono(
      content,
      x,
      y,
      size = 12,
      color = INK,
      align = "left",
      weight = 400
    ) {
      ctx.save();
      ctx.font = `${weight} ${size}px ${MONO}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(String(content), x, y);
      ctx.restore();
    }

    function fittedMono(
      content,
      x,
      y,
      maxWidth,
      initialSize = 12,
      minimumSize = 8,
      color = INK,
      align = "center",
      weight = 400
    ) {
      let size = initialSize;

      while (size > minimumSize) {
        ctx.font = `${weight} ${size}px ${MONO}`;

        if (ctx.measureText(String(content)).width <= maxWidth) {
          break;
        }

        size -= 0.5;
      }

      mono(content, x, y, size, color, align, weight);
    }

    function sectionTitle(content, y) {
      text(content, 24, y, 16, INK, "left", 700);
      line(24, y + 18, 696, y + 18, GRID);
    }

    function badge(content, x, y, kind, width = 140) {
      const height = 35;

      let fill = WHITE;
      let border = RED;
      let color = RED;

      if (kind === "hit") {
        fill = INK;
        border = INK;
        color = WHITE;
      } else if (kind === "miss") {
        fill = RED;
        border = RED;
        color = WHITE;
      }

      rect(x, y, width, height, fill, border, 5, 2);

      text(
        content,
        x + width / 2,
        y + height / 2,
        13,
        color,
        "center",
        700
      );
    }

    // ------------------------------------------------------------
    // Canvas: current access
    // ------------------------------------------------------------

    function drawCurrentAccess(y) {
      sectionTitle("현재 접근 주소", y);

      const event = model.lastEvent;
      const info = event ? event.info : null;

      const boxY = y + 33;

      rect(24, boxY, 672, 95, PALE, GRID, 5);

      if (!event) {
        text(
          model.trace.length
            ? "아직 실행한 접근이 없습니다. '한 단계'를 눌러 시작하세요."
            : "유효한 접근 목록을 입력하세요.",
          39,
          boxY + 29,
          13,
          INK
        );

        if (model.trace.length) {
          mono(
            "next: " + hex(model.trace[0]),
            39,
            boxY + 61,
            13,
            RED,
            "left",
            600
          );
        }

        return boxY + 115;
      }

      const label =
        `#${event.number}  ${hex(event.address)}`;

      fittedMono(
        label,
        39,
        boxY + 21,
        420,
        15,
        10,
        INK,
        "left",
        700
      );

      const resultLabel =
        event.kind === "hit"
          ? "HIT"
          : event.kind === "miss"
            ? "MISS"
            : "MISS + EVICT";

      badge(
        resultLabel,
        528,
        boxY + 7,
        event.kind,
        154
      );

      const segments = [
        {
          label: "tag",
          value: hex(info.tag),
          bits: ADDRESS_BITS - model.s - model.b
        },
        {
          label: "set index",
          value: String(info.setIndex),
          bits: model.s
        },
        {
          label: "block offset",
          value: String(info.offset),
          bits: model.b
        }
      ];

      const gap = 7;
      const segmentWidth = (642 - gap * 2) / 3;

      segments.forEach((segment, i) => {
        const x = 39 + i * (segmentWidth + gap);

        rect(
          x,
          boxY + 44,
          segmentWidth,
          40,
          segment.label === "set index" ? PALE_RED : WHITE,
          segment.label === "set index" ? RED : GRID,
          4
        );

        text(
          `${segment.label} (${segment.bits}b)`,
          x + 8,
          boxY + 55,
          10,
          segment.label === "set index" ? RED : INK,
          "left",
          600
        );

        fittedMono(
          segment.value,
          x + 8,
          boxY + 73,
          segmentWidth - 16,
          12,
          9,
          INK,
          "left",
          600
        );
      });

      return boxY + 115;
    }

    // ------------------------------------------------------------
    // Canvas: cache table
    // ------------------------------------------------------------

    function visibleSetIndices() {
      // S <= 16: display every set.
      // S > 16: preserve the real indices and show a window
      // around the most recently accessed set.
      const S = model.S;

      if (S <= 16) {
        return Array.from({ length: S }, (_, i) => i);
      }

      const target = model.lastEvent
        ? model.lastEvent.info.setIndex
        : 0;

      const windowSize = 13;
      const maxStart = S - windowSize;

      const start = Math.max(
        0,
        Math.min(maxStart, target - Math.floor(windowSize / 2))
      );

      const end = start + windowSize - 1;
      const indices = [];

      if (start > 0) indices.push(null);

      for (let i = start; i <= end; i++) {
        indices.push(i);
      }

      if (end < S - 1) indices.push(null);

      return indices;
    }

    function drawCacheTable(y) {
      sectionTitle("캐시 상태 (set × line)", y);

      const indices = visibleSetIndices();
      const E = model.E;

      const xSet = 24;
      const setWidth = 78;

      const firstLineX = 110;
      const gap = 6;
      const available = 696 - firstLineX;
      const lineWidth = (available - gap * (E - 1)) / E;

      const headerY = y + 35;
      const rowStart = headerY + 30;
      const rowHeight = 46;
      const rowGap = 5;

      text("set", xSet + 35, headerY, 11, INK, "center", 600);

      for (let j = 0; j < E; j++) {
        const x = firstLineX + j * (lineWidth + gap);

        text(
          E === 1 ? "line 0 · direct-mapped" : `line ${j}`,
          x + lineWidth / 2,
          headerY,
          E === 1 ? 11 : 12,
          INK,
          "center",
          600
        );
      }

      const event = model.lastEvent;
      const activeSet = event ? event.info.setIndex : -1;

      indices.forEach((index, row) => {
        const yRow = rowStart + row * (rowHeight + rowGap);

        if (index === null) {
          text(
            "⋮",
            xSet + setWidth / 2,
            yRow + rowHeight / 2,
            19,
            MUTED,
            "center"
          );

          text(
            "⋮  중간 set 생략",
            firstLineX + 10,
            yRow + rowHeight / 2,
            11,
            MUTED
          );

          return;
        }

        const selected = index === activeSet;

        rect(
          xSet,
          yRow,
          setWidth,
          rowHeight,
          selected ? RED : PALE,
          selected ? RED : GRID,
          5
        );

        text(
          `set ${index}`,
          xSet + setWidth / 2,
          yRow + rowHeight / 2,
          12,
          selected ? WHITE : INK,
          "center",
          selected ? 700 : 500
        );

        const lines = model.sets[index];

        for (let j = 0; j < E; j++) {
          const cacheLine = lines[j];
          const x = firstLineX + j * (lineWidth + gap);

          const isChanged =
            event &&
            event.info.setIndex === index &&
            event.lineIndex === j;

          const isEvicted =
            isChanged && event.kind === "eviction";

          let fill = WHITE;
          let border = GRID;
          let strokeWidth = 1;

          if (!cacheLine.valid) {
            fill = PALE;
          }

          if (selected) {
            border = RED;
            strokeWidth = 1.3;
          }

          if (isChanged) {
            fill = PALE_RED;
            border = RED;
            strokeWidth = 2;
          }

          rect(
            x,
            yRow,
            lineWidth,
            rowHeight,
            fill,
            border,
            4,
            strokeWidth
          );

          if (!cacheLine.valid) {
            text(
              "V=0 · invalid",
              x + lineWidth / 2,
              yRow + rowHeight / 2,
              Math.min(11, Math.max(8, lineWidth / 9)),
              MUTED,
              "center"
            );

            continue;
          }

          // Last-used timestamps provide an exact observable LRU order.
          const tagText = hex(cacheLine.tag);
          const tagFont =
            E >= 8 ? 9 :
            E >= 4 ? 10 : 11;

          fittedMono(
            tagText,
            x + lineWidth / 2,
            yRow + 14,
            lineWidth - 8,
            tagFont,
            8,
            isChanged ? RED : INK,
            "center",
            700
          );

          const timeText =
            E >= 8
              ? `V1 t${cacheLine.lastUsed}`
              : `V=1 · LRU t=${cacheLine.lastUsed}`;

          fittedMono(
            timeText,
            x + lineWidth / 2,
            yRow + 33,
            lineWidth - 7,
            E >= 8 ? 9 : 10,
            8,
            isChanged ? RED : MUTED,
            "center",
            400
          );

          // Eviction victim is identified by line index and old tag
          // in the event details below, rather than implying that
          // the new tag itself was evicted.
          if (isEvicted) {
            line(
              x + 3,
              yRow + rowHeight - 2,
              x + lineWidth - 3,
              yRow + rowHeight - 2,
              RED,
              2
            );
          }
        }
      });

      const tableBottom =
        rowStart + indices.length * (rowHeight + rowGap) + 10;

      rect(
        24,
        tableBottom,
        672,
        30,
        PALE,
        GRID,
        4
      );

      const note =
        model.S > 16
          ? `총 ${model.S}개 set 중 일부 표시 · ` +
            `각 set ${E}개 line · t는 마지막 접근 시각`
          : `총 ${model.S}개 set · ` +
            `각 set ${E}개 line · t는 마지막 접근 시각`;

      text(
        note,
        36,
        tableBottom + 15,
        11,
        INK
      );

      return tableBottom + 47;
    }

    // ------------------------------------------------------------
    // Canvas: eviction detail and statistics
    // ------------------------------------------------------------

    function drawEventDetail(y) {
      sectionTitle("접근 결과 상세", y);

      const event = model.lastEvent;

      const boxY = y + 32;

      rect(
        24,
        boxY,
        672,
        75,
        event && event.kind === "eviction" ? PALE_RED : PALE,
        event && event.kind === "eviction" ? RED : GRID,
        5,
        event && event.kind === "eviction" ? 1.4 : 1
      );

      if (!event) {
        text(
          "첫 번째 메모리 접근을 실행하면 hit / miss 결과가 표시됩니다.",
          37,
          boxY + 27,
          12,
          INK
        );

        text(
          "초기 상태: 모든 cache line의 valid bit = 0",
          37,
          boxY + 51,
          11,
          MUTED
        );

        return boxY + 94;
      }

      if (event.kind === "hit") {
        text(
          "HIT — 일치하는 valid tag 발견",
          37,
          boxY + 18,
          13,
          INK,
          "left",
          700
        );

        fittedMono(
          `set ${event.info.setIndex}, line ${event.lineIndex}` +
          ` · tag ${hex(event.info.tag)}`,
          37,
          boxY + 40,
          635,
          12,
          10,
          INK,
          "left"
        );

        text(
          `마지막 사용 시각: ${event.oldLastUsed} → ${event.time}`,
          37,
          boxY + 60,
          11,
          INK
        );
      } else if (event.kind === "miss") {
        text(
          "MISS — 빈 line에 새 block 적재",
          37,
          boxY + 18,
          13,
          RED,
          "left",
          700
        );

        fittedMono(
          `set ${event.info.setIndex}, line ${event.lineIndex}` +
          ` · new tag ${hex(event.info.tag)}`,
          37,
          boxY + 42,
          635,
          12,
          10,
          INK,
          "left"
        );

        text(
          "invalid line을 사용했으므로 eviction은 발생하지 않았습니다.",
          37,
          boxY + 62,
          11,
          INK
        );
      } else {
        text(
          "MISS + EVICT — LRU line 교체",
          37,
          boxY + 17,
          13,
          RED,
          "left",
          700
        );

        fittedMono(
          `victim: set ${event.info.setIndex}, line ${event.lineIndex}` +
          ` · old tag ${hex(event.evictedTag)}`,
          37,
          boxY + 39,
          635,
          12,
          9,
          RED,
          "left",
          600
        );

        fittedMono(
          `new tag ${hex(event.info.tag)}` +
          ` · victim의 이전 LRU t=${event.evictedLastUsed}`,
          37,
          boxY + 61,
          635,
          11,
          9,
          INK,
          "left"
        );
      }

      return boxY + 94;
    }

    function drawCanvas() {
      if (!ctx) return;

      const indices = visibleSetIndices();
      const rowHeight = 46;
      const rowGap = 5;

      const estimatedHeight =
        28 +
        170 +
        68 +
        indices.length * (rowHeight + rowGap) +
        55 +
        145;

      setupCanvas(estimatedHeight);

      let y = 30;
      y = drawCurrentAccess(y);
      y = drawCacheTable(y + 12);
      y = drawEventDetail(y + 12);

      const finalHeight = Math.ceil(y + 17);

      if (finalHeight !== canvasHeight) {
        // Resizing clears a canvas, so repaint exactly once at
        // the final calculated size.
        setupCanvas(finalHeight);

        let yy = 30;
        yy = drawCurrentAccess(yy);
        yy = drawCacheTable(yy + 12);
        drawEventDetail(yy + 12);
      }
    }

    // ------------------------------------------------------------
    // DOM rendering
    // ------------------------------------------------------------

    function syncControls() {
      sControl.input.value = String(model.s);
      bControl.input.value = String(model.b);
      eSelect.value = String(model.E);

      sControl.output.textContent =
        `${model.s} → S=${1 << model.s}`;

      bControl.output.textContent =
        `${model.b} → B=${1 << model.b}`;

      const capacity =
        (1 << model.s) * (1 << model.b) * model.E;

      configurationHint.textContent =
        `S=${1 << model.s} sets · ` +
        `E=${model.E} lines/set · ` +
        `B=${1 << model.b} bytes/block · ` +
        `cache data capacity=${capacity} bytes ` +
        "(metadata 제외)";
    }

    function renderControls() {
      const parsed = parseTrace(model.traceText);

      if (!parsed.ok) {
        errorBox.hidden = false;
        errorBox.textContent = parsed.error;
        addressInput.setAttribute("aria-invalid", "true");
      } else {
        errorBox.hidden = true;
        errorBox.textContent = "";
        addressInput.setAttribute("aria-invalid", "false");
      }

      const ready =
        parsed.ok &&
        !model.needsReset &&
        model.trace.length > 0;

      stepButton.disabled =
        !ready || model.step >= model.trace.length;

      allButton.disabled =
        !ready || model.step >= model.trace.length;

      rewindButton.disabled =
        !ready || model.step === 0;

      progressText.textContent =
        `${model.step} / ${model.trace.length} 접근`;

      const percent = model.trace.length
        ? (model.step / model.trace.length) * 100
        : 0;

      progressFill.style.width = percent.toFixed(2) + "%";

      if (model.needsReset && parsed.ok) {
        errorBox.hidden = false;
        errorBox.textContent =
          "접근 목록이 변경되었습니다. '접근 목록 적용'을 눌러 " +
          "시뮬레이션을 초기화하세요.";
      }
    }

    function renderStatistics() {
      const total = model.hits + model.misses;
      const rate = total > 0
        ? (100 * model.hits / total)
        : 0;

      statNodes.hits.textContent = String(model.hits);
      statNodes.misses.textContent = String(model.misses);
      statNodes.evictions.textContent = String(model.evictions);
      statNodes.hitRate.textContent = rate.toFixed(1) + "%";
    }

    function renderState() {
      const event = model.lastEvent;

      stateBox.replaceChildren();

      function addLine(content, strong = false) {
        const p = node("div", "", content);

        if (strong) {
          p.style.fontWeight = "600";
        }

        stateBox.appendChild(p);
      }

      if (!event) {
        addLine(
          "캐시가 초기화되었습니다. 모든 line은 invalid 상태입니다.",
          true
        );

        addLine(
          "첫 번째 접근은 해당 block이 미리 적재되어 있지 않으므로 miss가 발생합니다."
        );

        return;
      }

      const setNumber = event.info.setIndex;
      const lineNumber = event.lineIndex;
      const tagString = hex(event.info.tag);

      if (event.kind === "hit") {
        addLine(
          `HIT: set ${setNumber}의 line ${lineNumber}에서 ` +
          `tag ${tagString}가 일치하는 valid line을 찾았습니다.`,
          true
        );

        addLine(
          `데이터를 새로 적재하지 않고 마지막 사용 시각을 ` +
          `${event.oldLastUsed}에서 ${event.time}(으)로 갱신했습니다.`
        );
      } else if (event.kind === "miss") {
        addLine(
          `MISS: set ${setNumber}에 일치하는 tag가 없어 ` +
          `line ${lineNumber}의 빈 공간에 새 block` +
          `(tag ${tagString})을 적재했습니다.`,
          true
        );

        addLine(
          "invalid line을 사용했으므로 다른 block을 쫓아내지 않았습니다."
        );
      } else {
        addLine(
          `MISS + EVICT: set ${setNumber}의 모든 line이 차 있어 ` +
          `가장 오래 사용되지 않은 line ${lineNumber}` +
          `(tag ${hex(event.evictedTag)})을 쫓아냈습니다.`,
          true
        );

        addLine(
          `해당 line에 새 block(tag ${tagString})을 적재하고 ` +
          `마지막 사용 시각을 ${event.time}(으)로 설정했습니다.`
        );
      }

      if (model.step === model.trace.length) {
        addLine(
          `전체 ${model.trace.length}회 접근 실행 완료.`
        );
      }
    }

    function renderHistory() {
      historyStrip.replaceChildren();

      // Render the full sequence so students can distinguish
      // pending accesses from executed ones.
      model.trace.forEach((address, index) => {
        const event = model.history[index] || null;

        const item = node("div", "cs-history-item");
        item.dataset.kind = event ? event.kind : "pending";

        item.style.flex = "0 0 57px";
        item.style.boxSizing = "border-box";
        item.style.minHeight = "54px";
        item.style.padding = "5px 3px";
        item.style.borderRadius = "4px";
        item.style.display = "flex";
        item.style.flexDirection = "column";
        item.style.alignItems = "center";
        item.style.justifyContent = "center";
        item.style.gap = "3px";

        let background = WHITE;
        let foreground = MUTED;
        let border = "1px solid " + GRID;

        if (event) {
          if (event.kind === "hit") {
            background = INK;
            foreground = WHITE;
            border = "1px solid " + INK;
          } else if (event.kind === "miss") {
            background = RED;
            foreground = WHITE;
            border = "1px solid " + RED;
          } else {
            background = WHITE;
            foreground = RED;
            border = "2px solid " + RED;
          }
        }

        item.style.background = background;
        item.style.color = foreground;
        item.style.border = border;

        const number = node(
          "div",
          "cs-history-number",
          "#" + (index + 1)
        );

        const result = node(
          "div",
          "cs-history-result",
          !event
            ? "—"
            : event.kind === "hit"
              ? "H"
              : event.kind === "miss"
                ? "M"
                : "M+E"
        );

        const addressText = node(
          "div",
          "cs-history-address",
          hex(address)
        );

        addressText.style.maxWidth = "100%";
        addressText.style.overflow = "hidden";
        addressText.style.textOverflow = "ellipsis";
        addressText.style.whiteSpace = "nowrap";

        item.title =
          `#${index + 1} ${hex(address)} — ` +
          (!event
            ? "미실행"
            : event.kind === "hit"
              ? "HIT"
              : event.kind === "miss"
                ? "MISS"
                : "MISS + EVICT");

        if (event && index === model.step - 1) {
          item.dataset.current = "true";
          item.style.outline = "2px solid " + RED;
          item.style.outlineOffset = "2px";
        }

        append(item, number, result, addressText);
        historyStrip.appendChild(item);
      });

      const current = historyStrip.querySelector(
        '[data-current="true"]'
      );

      if (current) {
        const left = current.offsetLeft;
        const right = left + current.offsetWidth;
        const visibleLeft = historyStrip.scrollLeft;
        const visibleRight =
          visibleLeft + historyStrip.clientWidth;

        if (left < visibleLeft) {
          historyStrip.scrollLeft = left;
        } else if (right > visibleRight) {
          historyStrip.scrollLeft =
            right - historyStrip.clientWidth;
        }
      }
    }

    function render() {
      if (!model.active) return;

      syncControls();
      renderControls();
      renderStatistics();
      renderState();
      renderHistory();
      drawCanvas();
    }

    // ------------------------------------------------------------
    // Initialization
    // ------------------------------------------------------------

    createCache();
    clearCounters();

    const initialParsed = parseTrace(model.traceText);

    if (initialParsed.ok) {
      model.trace = initialParsed.addresses;
      model.loadedText = model.traceText;
      model.needsReset = false;
    } else {
      model.trace = [];
      model.loadedText = "";
      model.needsReset = true;
    }

    render();
  });
})();

/* ===== widget: mem-hierarchy (ChatGPT web authored, 2026-10-24) ===== */
(function () {
  "use strict";

  V6.register("mem-hierarchy", function (el, cfg) {
    el.replaceChildren();
    cfg = cfg || {};

    const INK = V6.INK || "#1a1a1a";
    const RED = V6.RED || "#9e2b25";
    const GRID = V6.GRID || "#e8e6e0";
    const WHITE = "#ffffff";
    const PALE = "#f7f6f3";
    const PALE_RED = "#f8ecea";
    const MUTED = "#666666";
    const FONT = "'Noto Sans KR', sans-serif";
    const MONO = "ui-monospace, SFMono-Regular, Consolas, monospace";
    const W = 720;

    /*
     * 기본값은 CS:APP 3판의 메모리 계층 개념에 맞춘
     * 교육용 대표 구성이다.
     *
     * 특정 CPU나 CS:APP의 단일 표에서 그대로 가져온
     * 정확한 하드웨어 사양이라는 의미는 아니다.
     *
     * 특히 SSD/remote storage의 cycle 환산값은
     * 3 GHz CPU를 가정한 대략적인 예시다.
     *
     * 각 계층의 용량은 개별 저장장치/계층의 용량이며,
     * 모든 CPU 및 시스템에 공통인 고정값이 아니다.
     *
     * latencyCycles는 해당 계층의 대표 접근 지연으로,
     * 연속적인 cache miss의 누적 지연이 아니다.
     *
     * blockBytes는 인접 계층 사이의 예시 전송 단위다.
     * 실제 전송 단위는 하드웨어, 파일 시스템, 네트워크
     * 프로토콜 및 요청 방식에 따라 달라질 수 있다.
     */

    const CPU_GHZ = (() => {
      const n = Number(cfg.cpuGHz);
      return Number.isFinite(n) && n > 0 && n <= 100
        ? n
        : 3;
    })();

    const DEFAULT_LAYERS = [
      {
        id: "register",
        name: "Register",
        size: "수 KB 이하 (총 레지스터 저장공간)",
        cycles: 1,
        blockBytes: 8,
        description:
          "CPU 내부에서 연산에 직접 사용하는 가장 빠른 저장 공간입니다. " +
          "레지스터 파일의 전체 용량은 아키텍처와 구현에 따라 달라집니다.",
        example:
          "일반적인 x86-64 정수 범용 레지스터 하나는 64 bits(8 bytes)입니다."
      },
      {
        id: "l1",
        name: "L1 cache",
        size: "32 KB / core (예시)",
        cycles: 4,
        blockBytes: 64,
        description:
          "CPU 코어 가까이에 있는 작은 cache입니다. " +
          "최근 사용하거나 인접한 데이터에 빠르게 접근하도록 돕습니다.",
        example:
          "대표적인 L1 data cache hit 지연을 약 4 cycles로 가정합니다."
      },
      {
        id: "l2",
        name: "L2 cache",
        size: "256 KB / core (예시)",
        cycles: 10,
        blockBytes: 64,
        description:
          "L1보다 일반적으로 크고 느린 cache입니다. " +
          "L1에서 찾지 못한 데이터를 보관할 수 있습니다.",
        example:
          "L2 cache hit 지연을 약 10 cycles로 가정합니다."
      },
      {
        id: "l3",
        name: "L3 cache",
        size: "8 MB (예시)",
        cycles: 50,
        blockBytes: 64,
        description:
          "일반적으로 L2보다 크고 지연이 긴 last-level cache입니다. " +
          "여러 코어가 공유하는 구성이 흔하지만 필수적인 것은 아닙니다.",
        example:
          "L3 cache hit 지연을 약 50 cycles로 가정합니다."
      },
      {
        id: "dram",
        name: "Main memory (DRAM)",
        size: "16 GB (예시)",
        cycles: 200,
        blockBytes: 4096,
        description:
          "실행 중인 프로그램의 코드와 데이터를 주로 저장하는 주기억장치입니다. " +
          "CPU cache보다 일반적으로 크고 느리며, 휘발성입니다.",
        example:
          "DRAM 접근 지연 약 200 CPU cycles를 가정합니다."
      },
      {
        id: "ssd",
        name: "Local SSD",
        size: "1 TB (예시)",
        cycles: 300000,
        blockBytes: 4096,
        description:
          "전원이 꺼져도 데이터를 유지하는 로컬 보조기억장치입니다. " +
          "메모리에 없는 파일이나 페이지를 읽는 데 사용할 수 있습니다.",
        example:
          "약 100 μs의 저장장치 접근 지연을 3 GHz CPU 기준 " +
          "300,000 cycles로 환산한 교육용 예시입니다."
      },
      {
        id: "remote",
        name: "Remote storage",
        size: "수 TB 이상 (구성 의존)",
        cycles: 30000000,
        blockBytes: 65536,
        description:
          "네트워크를 통해 접근하는 원격 저장 시스템입니다. " +
          "네트워크 왕복 지연, 서버 처리, 캐싱 여부 등에 따라 성능이 크게 달라집니다.",
        example:
          "약 10 ms의 원격 요청 지연을 3 GHz CPU 기준 " +
          "30,000,000 cycles로 환산한 교육용 예시입니다."
      }
    ];

    /*
     * cfg.layers 지원 형식:
     *
     * {
     *   "layers": [
     *     {
     *       "id": "l1",
     *       "size": "48 KB",
     *       "cycles": 5,
     *       "blockBytes": 64
     *     }
     *   ]
     * }
     *
     * 일부 계층만 제공해도 나머지는 기본값을 사용한다.
     *
     * blockBytes는 해당 계층과 바로 아래 계층 사이의
     * 대표 전송 단위를 의미한다.
     *
     * Register → L1의 blockBytes=8은 레지스터로 전달되는
     * 예시 operand 크기이지, L1 cache line 크기가 아니다.
     *
     * Main memory → SSD의 4096 bytes 역시
     * 예시 페이지 전송 단위이지 모든 I/O의 고정 단위는 아니다.
     */

    function validPositive(value, fallback) {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    }

    const overrides = Array.isArray(cfg.layers) ? cfg.layers : [];

    const layers = DEFAULT_LAYERS.map(base => {
      const override = overrides.find(
        item => item && item.id === base.id
      ) || {};

      return {
        id: base.id,
        name:
          typeof override.name === "string" && override.name.trim()
            ? override.name.trim()
            : base.name,
        size:
          typeof override.size === "string" && override.size.trim()
            ? override.size.trim()
            : base.size,
        cycles: validPositive(override.cycles, base.cycles),
        blockBytes: validPositive(
          override.blockBytes,
          base.blockBytes
        ),
        description:
          typeof override.description === "string"
            ? override.description
            : base.description,
        example:
          typeof override.example === "string"
            ? override.example
            : base.example
      };
    });

    // CSS can be moved into the site's existing stylesheet.
    // All selectors are scoped under .v6-widget.
    const CSS = `
      /* CSS */
      .v6-widget .mh-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin: 12px 0;
      }

      .v6-widget .mh-btn {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 112px;
        min-height: 37px;
        padding: 8px 12px;
        border: 1px solid #1a1a1a;
        border-radius: 5px;
        background: #ffffff;
        color: #1a1a1a;
        font: 500 12px 'Noto Sans KR', sans-serif;
        cursor: pointer;
        transition:
          background 120ms ease,
          color 120ms ease,
          border-color 120ms ease;
      }

      .v6-widget .mh-btn:hover,
      .v6-widget .mh-btn:focus-visible {
        background: #1a1a1a;
        color: #ffffff;
      }

      .v6-widget .mh-btn[aria-pressed="true"] {
        background: #9e2b25;
        border-color: #9e2b25;
        color: #ffffff;
      }

      .v6-widget .mh-btn[aria-pressed="true"]:hover {
        background: #1a1a1a;
        border-color: #1a1a1a;
      }

      .v6-widget .mh-btn:focus-visible {
        outline: 2px solid #9e2b25;
        outline-offset: 2px;
      }

      .v6-widget .mh-canvas {
        display: block;
        width: 100%;
        max-width: 720px;
        height: auto;
        margin: 12px auto;
        cursor: pointer;
      }

      .v6-widget .mh-detail {
        box-sizing: border-box;
        margin: 12px 0;
        padding: 15px;
        border: 1px solid #e8e6e0;
        border-top: 3px solid #9e2b25;
        border-radius: 5px;
        background: #ffffff;
        color: #1a1a1a;
        font: 13px/1.75 'Noto Sans KR', sans-serif;
      }

      .v6-widget .mh-detail-title {
        margin: 0 0 10px;
        color: #9e2b25;
        font: 700 16px 'Noto Sans KR', sans-serif;
      }

      .v6-widget .mh-detail-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin: 10px 0 14px;
      }

      .v6-widget .mh-metric {
        min-width: 0;
        box-sizing: border-box;
        padding: 10px;
        border: 1px solid #e8e6e0;
        border-radius: 4px;
        background: #f7f6f3;
        overflow-wrap: anywhere;
      }

      .v6-widget .mh-metric-name {
        margin-bottom: 5px;
        color: #666666;
        font: 11px 'Noto Sans KR', sans-serif;
      }

      .v6-widget .mh-metric-value {
        color: #1a1a1a;
        font: 600 13px/1.6 'Noto Sans KR', sans-serif;
      }

      .v6-widget .mh-detail-text {
        margin: 9px 0;
        overflow-wrap: anywhere;
      }

      .v6-widget .mh-note {
        margin: 8px 0;
        color: #666666;
        font: 11px/1.7 'Noto Sans KR', sans-serif;
      }

      .v6-widget .mh-section {
        margin: 16px 0 8px;
        color: #1a1a1a;
        font: 700 14px 'Noto Sans KR', sans-serif;
      }

      .v6-widget .mh-layer-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 9px 0 14px;
      }

      .v6-widget .mh-layer-buttons .mh-btn {
        min-width: 0;
        min-height: 33px;
        padding: 6px 9px;
        font-size: 11px;
      }

      .v6-widget .mh-scale {
        margin: 12px 0;
        padding: 12px;
        border: 1px solid #e8e6e0;
        border-radius: 5px;
        background: #ffffff;
      }

      .v6-widget .mh-scale-row {
        display: grid;
        grid-template-columns: 122px minmax(0, 1fr) 112px;
        align-items: center;
        gap: 9px;
        margin: 9px 0;
      }

      .v6-widget .mh-scale-name {
        font: 11px 'Noto Sans KR', sans-serif;
        color: #1a1a1a;
        overflow-wrap: anywhere;
      }

      .v6-widget .mh-scale-track {
        position: relative;
        height: 15px;
        border: 1px solid #e8e6e0;
        border-radius: 3px;
        background: #f7f6f3;
        overflow: hidden;
      }

      .v6-widget .mh-scale-fill {
        height: 100%;
        background: #1a1a1a;
      }

      .v6-widget .mh-scale-row[data-selected="true"] .mh-scale-fill {
        background: #9e2b25;
      }

      .v6-widget .mh-scale-value {
        color: #1a1a1a;
        text-align: right;
        font: 600 11px ui-monospace, monospace;
        white-space: nowrap;
      }

      .v6-widget .mh-scale-hint {
        font: 11px/1.7 'Noto Sans KR', sans-serif;
        color: #666666;
        margin-top: 12px;
      }

      @media (max-width: 480px) {
        .v6-widget .mh-controls {
          gap: 6px;
        }

        .v6-widget .mh-controls .mh-btn {
          flex: 1 1 130px;
        }

        .v6-widget .mh-detail {
          padding: 11px;
        }

        .v6-widget .mh-detail-grid {
          grid-template-columns: 1fr;
          gap: 6px;
        }

        .v6-widget .mh-metric {
          padding: 7px 9px;
        }

        .v6-widget .mh-scale {
          padding: 8px;
        }

        .v6-widget .mh-scale-row {
          grid-template-columns: 77px minmax(0, 1fr) 87px;
          gap: 5px;
        }

        .v6-widget .mh-scale-name {
          font-size: 10px;
        }

        .v6-widget .mh-scale-value {
          font-size: 10px;
        }
      }
    `;

    // Self-contained rendering; CSS is scoped and may be moved verbatim.
    const style = document.createElement("style");
    style.textContent = CSS;
    el.appendChild(style);

    const state = {
      selected: 1,
      hovered: -1,
      scaleMode: false,
      blockMode: false,
      layerRects: []
    };

    const initialSelected = Number(cfg.selected);
    if (
      Number.isInteger(initialSelected) &&
      initialSelected >= 0 &&
      initialSelected < layers.length
    ) {
      state.selected = initialSelected;
    }

    function node(tag, className, content) {
      const element = document.createElement(tag);

      if (className) element.className = className;
      if (content !== undefined) {
        element.textContent = String(content);
      }

      return element;
    }

    function append(parent, ...children) {
      for (const child of children) parent.appendChild(child);
      return parent;
    }

    function makeButton(content, callback) {
      const button = node("button", "v6-btn mh-btn", content);
      button.type = "button";
      button.addEventListener("click", callback);
      return button;
    }

    function formatNumber(n) {
      if (!Number.isFinite(n)) return "—";

      if (n >= 1e12) return n.toExponential(2);
      if (n >= 1000) {
        return n.toLocaleString("en-US", {
          maximumFractionDigits: 2
        });
      }

      return n.toLocaleString("en-US", {
        maximumFractionDigits: 3
      });
    }

    function formatCycles(n) {
      return formatNumber(n) + " cycles";
    }

    function formatBytes(bytes) {
      if (bytes < 1024) return formatNumber(bytes) + " B";

      const units = ["B", "KiB", "MiB", "GiB", "TiB"];
      let value = bytes;
      let index = 0;

      while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index++;
      }

      return formatNumber(value) + " " + units[index];
    }

    function formatDuration(seconds) {
      if (!Number.isFinite(seconds)) return "—";
      if (seconds < 1e-6) {
        return formatNumber(seconds * 1e9) + " ns";
      }
      if (seconds < 1e-3) {
        return formatNumber(seconds * 1e6) + " μs";
      }
      if (seconds < 1) {
        return formatNumber(seconds * 1000) + " ms";
      }
      if (seconds < 60) {
        return formatNumber(seconds) + "초";
      }
      if (seconds < 3600) {
        return formatNumber(seconds / 60) + "분";
      }
      if (seconds < 86400) {
        return formatNumber(seconds / 3600) + "시간";
      }
      if (seconds < 604800) {
        return formatNumber(seconds / 86400) + "일";
      }
      if (seconds < 31557600) {
        return formatNumber(seconds / 604800) + "주";
      }

      return formatNumber(seconds / 31557600) + "년";
    }

    function ratio(upper, lower) {
      return lower.cycles / upper.cycles;
    }

    function formatRatio(n) {
      if (!Number.isFinite(n)) return "—";

      return formatNumber(n) + "배";
    }

    function isNondecreasingLatency() {
      return layers.every(
        (layer, i) =>
          i === 0 || layer.cycles >= layers[i - 1].cycles
      );
    }

    // ------------------------------------------------------------
    // DOM
    // ------------------------------------------------------------

    V6.title(
      el,
      typeof cfg.title === "string"
        ? cfg.title
        : "메모리 계층 탐색기 — Memory Hierarchy"
    );

    const controls = node("div", "v6-controls mh-controls");

    const scaleButton = makeButton(
      "스케일 체험: OFF",
      () => {
        state.scaleMode = !state.scaleMode;
        updateModeButtons();
        renderScale();
        draw();
      }
    );

    const blockButton = makeButton(
      "블록 이동 설명: OFF",
      () => {
        state.blockMode = !state.blockMode;
        updateModeButtons();
        renderDetail();
        draw();
      }
    );

    const resetButton = makeButton(
      "보기 초기화",
      () => {
        state.selected = 1;
        state.hovered = -1;
        state.scaleMode = false;
        state.blockMode = false;
        render();
      }
    );

    append(controls, scaleButton, blockButton, resetButton);
    el.appendChild(controls);

    const introduction = node(
      "div",
      "mh-note",
      "위쪽 계층일수록 일반적으로 빠르고 작으며 bit당 비용이 높습니다. " +
      "층을 클릭하면 세부 정보가 표시됩니다. " +
      "크기와 지연은 대표적인 교육용 예시입니다."
    );

    el.appendChild(introduction);

    const canvas = V6.canvas(el, 660);
    canvas.classList.add("mh-canvas");

    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.maxWidth = "720px";
    canvas.style.display = "block";

    const ctx = canvas.getContext("2d");

    // Keyboard-accessible equivalents of the canvas layers.
    const selectorHeading = node(
      "div",
      "mh-section",
      "계층 선택"
    );

    el.appendChild(selectorHeading);

    const selectorRow = node("div", "mh-layer-buttons");
    const layerButtons = [];

    layers.forEach((layer, index) => {
      const button = makeButton(layer.name, () => selectLayer(index));

      button.setAttribute(
        "aria-pressed",
        String(index === state.selected)
      );

      layerButtons.push(button);
      selectorRow.appendChild(button);
    });

    el.appendChild(selectorRow);

    const detail = node("div", "mh-detail");
    el.appendChild(detail);

    const scaleSection = node("section", "");
    el.appendChild(scaleSection);

    function selectLayer(index) {
      if (index < 0 || index >= layers.length) return;

      state.selected = index;
      render();
    }

    function updateModeButtons() {
      scaleButton.textContent =
        "스케일 체험: " + (state.scaleMode ? "ON" : "OFF");

      blockButton.textContent =
        "블록 이동 설명: " + (state.blockMode ? "ON" : "OFF");

      scaleButton.setAttribute(
        "aria-pressed",
        String(state.scaleMode)
      );

      blockButton.setAttribute(
        "aria-pressed",
        String(state.blockMode)
      );

      for (let i = 0; i < layerButtons.length; i++) {
        layerButtons[i].setAttribute(
          "aria-pressed",
          String(i === state.selected)
        );
      }
    }

    // ------------------------------------------------------------
    // Detail panel
    // ------------------------------------------------------------

    function metric(name, value) {
      const container = node("div", "mh-metric");

      append(
        container,
        node("div", "mh-metric-name", name),
        node("div", "mh-metric-value", value)
      );

      return container;
    }

    function renderDetail() {
      detail.replaceChildren();

      const layer = layers[state.selected];
      const below = layers[state.selected + 1] || null;
      const above = layers[state.selected - 1] || null;

      detail.appendChild(
        node(
          "div",
          "mh-detail-title",
          `${state.selected + 1}. ${layer.name}`
        )
      );

      const metrics = node("div", "mh-detail-grid");

      append(
        metrics,
        metric("대표 크기", layer.size),
        metric("대표 접근 지연", formatCycles(layer.cycles)),
        metric(
          "지연시간 환산",
          formatDuration(layer.cycles / (CPU_GHZ * 1e9))
        )
      );

      detail.appendChild(metrics);

      detail.appendChild(
        node("p", "mh-detail-text", layer.description)
      );

      if (layer.example) {
        detail.appendChild(
          node("p", "mh-detail-text", layer.example)
        );
      }

      if (below) {
        const slowdown = ratio(layer, below);

        const comparison = node(
          "p",
          "mh-detail-text",
          `바로 아래의 ${below.name} 접근은 ` +
          `${layer.name} 접근보다 약 ${formatRatio(slowdown)} ` +
          `지연됩니다 (${formatNumber(layer.cycles)} → ` +
          `${formatNumber(below.cycles)} cycles).`
        );

        comparison.style.fontWeight = "600";
        detail.appendChild(comparison);
      } else {
        detail.appendChild(
          node(
            "p",
            "mh-detail-text",
            "이 모델에서 가장 아래에 있는 계층입니다. " +
            "그 아래 계층과의 비교값은 정의하지 않았습니다."
          )
        );
      }

      if (above) {
        detail.appendChild(
          node(
            "p",
            "mh-detail-text",
            `한 단계 위의 ${above.name} 접근과 비교하면 ` +
            `${formatRatio(ratio(above, layer))}의 지연 배수입니다.`
          )
        );
      }

      if (state.blockMode) {
        const blockSection = node("div", "");

        blockSection.style.marginTop = "13px";
        blockSection.style.padding = "11px";
        blockSection.style.border = "1px solid " + RED;
        blockSection.style.borderRadius = "5px";
        blockSection.style.background = "#f8ecea";

        blockSection.appendChild(
          node(
            "div",
            "",
            "인접 계층 간 데이터 이동"
          )
        );

        const connections = [];

        if (below) {
          connections.push(
            `${layer.name} ↔ ${below.name}: ` +
            `예시 전송 단위 ${formatBytes(layer.blockBytes)}`
          );
        }

        if (above) {
          connections.push(
            `${above.name} ↔ ${layer.name}: ` +
            `예시 전송 단위 ${formatBytes(above.blockBytes)}`
          );
        }

        if (!connections.length) {
          connections.push("연결된 하위 계층이 없습니다.");
        }

        for (const connection of connections) {
          blockSection.appendChild(
            node("div", "mh-detail-text", connection)
          );
        }

        blockSection.appendChild(
          node(
            "div",
            "mh-note",
            "이 수치는 교육용 예시입니다. Cache line, page, 파일 I/O " +
            "및 네트워크 전송 단위는 서로 다르며 실제 요청에 따라 달라집니다. " +
            "또한 아래에서 위로 데이터를 가져오는 과정은 항상 한 번의 " +
            "고정 크기 전송만으로 이루어지는 것은 아닙니다."
          )
        );

        detail.appendChild(blockSection);
      }

      detail.appendChild(
        node(
          "div",
          "mh-note",
          `기준 CPU clock: ${CPU_GHZ} GHz. ` +
          "접근 지연은 예시값이며, 계층마다 용량·지연·공유 방식이 다를 수 있습니다."
        )
      );
    }

    // ------------------------------------------------------------
    // Scale experience
    // ------------------------------------------------------------

    function renderScale() {
      scaleSection.replaceChildren();

      if (!state.scaleMode) return;

      scaleSection.appendChild(
        node(
          "div",
          "mh-section",
          "스케일 체험 — L1 cache 접근을 1초로 환산"
        )
      );

      scaleSection.appendChild(
        node(
          "div",
          "mh-note",
          "모든 지연시간에 같은 환산 비율을 적용합니다. " +
          "막대는 실제 선형 비율이며 로그 스케일이 아닙니다."
        )
      );

      const container = node("div", "mh-scale");

      const baseline = layers[1].cycles;
      const scaled = layers.map(layer => layer.cycles / baseline);
      const maximum = Math.max(...scaled);

      layers.forEach((layer, i) => {
        const row = node("div", "mh-scale-row");
        row.dataset.selected = String(i === state.selected);

        const name = node(
          "div",
          "mh-scale-name",
          layer.name
        );

        const track = node("div", "mh-scale-track");
        const fill = node("div", "mh-scale-fill");

        const fraction = scaled[i] / maximum;
        const percent = fraction * 100;

        fill.style.width =
          Math.max(0, Math.min(100, percent)) + "%";

        track.appendChild(fill);

        const value = node(
          "div",
          "mh-scale-value",
          formatDuration(scaled[i])
        );

        append(row, name, track, value);
        container.appendChild(row);
      });

      const hint = node(
        "div",
        "mh-scale-hint",
        `L1 = ${formatNumber(baseline)} cycles → 1초. ` +
        `최대 막대(${layers[scaled.indexOf(maximum)].name})는 ` +
        `${formatDuration(maximum)}입니다. ` +
        "상대적으로 짧은 지연의 막대는 선형 축에서 " +
        "너무 작아 보이지 않을 수 있습니다. 오른쪽 숫자가 정확한 환산값입니다."
      );

      container.appendChild(hint);
      scaleSection.appendChild(container);

      if (!isNondecreasingLatency()) {
        scaleSection.appendChild(
          node(
            "div",
            "mh-note",
            "현재 cfg 값에서는 일부 하위 계층의 지연이 더 짧습니다. " +
            "막대는 입력된 값을 그대로 사용했습니다."
          )
        );
      }
    }

    // ------------------------------------------------------------
    // Canvas
    // ------------------------------------------------------------

    function configureCanvas(height) {
      const dpr = Math.min(
        3,
        Math.max(1, window.devicePixelRatio || 1)
      );

      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(height * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      canvas.style.aspectRatio = `${W} / ${height}`;

      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, W, height);
    }

    function line(x1, y1, x2, y2, color = GRID, width = 1) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    function rect(
      x,
      y,
      width,
      height,
      fill,
      stroke = null,
      radius = 0,
      strokeWidth = 1
    ) {
      ctx.beginPath();

      if (radius && typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, width, height, radius);
      } else {
        ctx.rect(x, y, width, height);
      }

      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }

      if (stroke) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    }

    function text(
      content,
      x,
      y,
      size = 12,
      color = INK,
      align = "left",
      weight = 400
    ) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px ${FONT}`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(String(content), x, y);
      ctx.restore();
    }

    function fittedText(
      content,
      x,
      y,
      maxWidth,
      initialSize,
      color = INK,
      align = "center",
      weight = 500
    ) {
      let size = initialSize;

      while (size > 8) {
        ctx.font = `${weight} ${size}px ${FONT}`;

        if (ctx.measureText(String(content)).width <= maxWidth) {
          break;
        }

        size -= 0.5;
      }

      text(content, x, y, size, color, align, weight);
    }

    function polygon(points, fill, stroke, strokeWidth = 1) {
      ctx.beginPath();

      points.forEach((p, index) => {
        if (index === 0) {
          ctx.moveTo(p[0], p[1]);
        } else {
          ctx.lineTo(p[0], p[1]);
        }
      });

      ctx.closePath();

      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }

      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
    }

    function arrow(x1, y1, x2, y2, color = INK) {
      line(x1, y1, x2, y2, color, 1.5);

      const angle = Math.atan2(y2 - y1, x2 - x1);
      const length = 7;

      const a = angle - Math.PI / 6;
      const b = angle + Math.PI / 6;

      line(
        x2,
        y2,
        x2 - Math.cos(a) * length,
        y2 - Math.sin(a) * length,
        color,
        1.5
      );

      line(
        x2,
        y2,
        x2 - Math.cos(b) * length,
        y2 - Math.sin(b) * length,
        color,
        1.5
      );
    }

    function draw() {
      if (!ctx) return;

      const height = state.blockMode ? 745 : 665;
      configureCanvas(height);

      state.layerRects = [];

      text(
        "Memory hierarchy",
        24,
        27,
        17,
        INK,
        "left",
        700
      );

      line(24, 48, 696, 48, GRID);

      text(
        "빠름 · 작음 · bit당 비용 높음",
        360,
        68,
        12,
        RED,
        "center",
        600
      );

      // Pyramid occupies the central portion.
      const centerX = 360;
      const topY = 95;
      const layerHeight = 57;
      const gap = 8;

      // Wider lower layers visually encode increasing capacity.
      const widths = [240, 294, 348, 402, 456, 510, 564];

      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];

        const topWidth = widths[i] - 15;
        const bottomWidth = widths[i];

        const y = topY + i * (layerHeight + gap);

        const leftTop = centerX - topWidth / 2;
        const rightTop = centerX + topWidth / 2;
        const leftBottom = centerX - bottomWidth / 2;
        const rightBottom = centerX + bottomWidth / 2;

        const selected = i === state.selected;
        const hovered = i === state.hovered;

        const fill = selected
          ? RED
          : hovered
            ? PALE_RED
            : WHITE;

        const stroke = selected || hovered ? RED : INK;

        polygon(
          [
            [leftTop, y],
            [rightTop, y],
            [rightBottom, y + layerHeight],
            [leftBottom, y + layerHeight]
          ],
          fill,
          stroke,
          selected ? 2.2 : 1
        );

        const fg = selected ? WHITE : INK;

        fittedText(
          layer.name,
          centerX,
          y + 20,
          bottomWidth - 24,
          14,
          fg,
          "center",
          selected ? 700 : 600
        );

        fittedText(
          layer.size,
          centerX,
          y + 42,
          bottomWidth - 24,
          12,
          fg,
          "center",
          400
        );

        state.layerRects.push({
          top: y,
          bottom: y + layerHeight,
          leftTop,
          rightTop,
          leftBottom,
          rightBottom
        });

        if (state.blockMode && i < layers.length - 1) {
          const nextY = y + layerHeight + gap;

          const emphasized =
            i === state.selected ||
            i + 1 === state.selected;

          const arrowColor = emphasized ? RED : MUTED;

          const arrowX = 664;

          arrow(
            arrowX,
            y + layerHeight + 1,
            arrowX,
            nextY - 1,
            arrowColor
          );

          const labelText =
            formatBytes(layer.blockBytes);

          fittedText(
            labelText,
            622,
            y + layerHeight + gap / 2,
            70,
            10,
            arrowColor,
            "right",
            emphasized ? 700 : 400
          );
        }
      }

      const pyramidBottom =
        topY + 6 * (layerHeight + gap) + layerHeight;

      text(
        "느림 · 큼 · bit당 비용 낮음",
        360,
        pyramidBottom + 26,
        12,
        INK,
        "center",
        600
      );

      line(
        24,
        pyramidBottom + 45,
        696,
        pyramidBottom + 45,
        GRID
      );

      const selectedLayer = layers[state.selected];

      fittedText(
        `선택: ${selectedLayer.name}`,
        360,
        pyramidBottom + 70,
        635,
        14,
        RED,
        "center",
        700
      );

      fittedText(
        `크기 ${selectedLayer.size} · 접근 지연 ${formatCycles(selectedLayer.cycles)}`,
        360,
        pyramidBottom + 93,
        655,
        11,
        INK,
        "center"
      );

      if (state.blockMode) {
        text(
          "화살표의 수치는 인접 계층 사이의 예시 전송 단위입니다.",
          360,
          pyramidBottom + 119,
          11,
          MUTED,
          "center"
        );
      }

      // Instruction for mouse and touch users.
      text(
        "층을 클릭하여 선택",
        696,
        height - 16,
        10,
        MUTED,
        "right"
      );
    }

    // ------------------------------------------------------------
    // Canvas pointer interaction
    // ------------------------------------------------------------

    function pointerPosition(event) {
      const box = canvas.getBoundingClientRect();

      return {
        x: (event.clientX - box.left) * (W / box.width),
        y:
          (event.clientY - box.top) *
          (canvas.height /
            Math.min(3, Math.max(1, window.devicePixelRatio || 1)) /
            box.height)
      };
    }

    function hitTest(x, y) {
      for (let i = 0; i < state.layerRects.length; i++) {
        const r = state.layerRects[i];

        if (y < r.top || y > r.bottom) continue;

        const fraction = (y - r.top) / (r.bottom - r.top);
        const left =
          r.leftTop +
          (r.leftBottom - r.leftTop) * fraction;

        const right =
          r.rightTop +
          (r.rightBottom - r.rightTop) * fraction;

        if (x >= left && x <= right) return i;
      }

      return -1;
    }

    canvas.addEventListener("click", event => {
      const { x, y } = pointerPosition(event);
      const index = hitTest(x, y);

      if (index >= 0) {
        selectLayer(index);
      }
    });

    canvas.addEventListener("mousemove", event => {
      const { x, y } = pointerPosition(event);
      const index = hitTest(x, y);

      canvas.style.cursor = index >= 0 ? "pointer" : "default";

      if (index !== state.hovered) {
        state.hovered = index;
        draw();
      }
    });

    canvas.addEventListener("mouseleave", () => {
      if (state.hovered !== -1) {
        state.hovered = -1;
        draw();
      }

      canvas.style.cursor = "default";
    });

    function render() {
      updateModeButtons();
      draw();
      renderDetail();
      renderScale();
    }

    render();
  });
})();

/* ===== widget: virtual-memory (ChatGPT web authored, 2026-10-24) ===== */
(function () {
  "use strict";

  V6.register("virtual-memory", function (el, cfg) {
    el.replaceChildren();
    cfg = cfg || {};

    const INK = V6.INK || "#1a1a1a";
    const RED = V6.RED || "#9e2b25";
    const GRID = V6.GRID || "#e8e6e0";
    const WHITE = "#ffffff";
    const PALE = "#f7f6f3";
    const PALE_RED = "#f8eae8";
    const MUTED = "#686868";
    const FONT = "'Noto Sans KR', sans-serif";
    const MONO = "ui-monospace, SFMono-Regular, Consolas, monospace";
    const W = 720;
    const H = 790;

    /*
     * CS:APP Chapter 9 — Virtual Memory
     *
     * 교육용 단일 레벨 page table 모델.
     *
     * VA = VPN | VPO
     * PA = PPN | PPO
     * PPO = VPO
     *
     * TLB:
     *   TI      = VPN mod T
     *   TLB tag = floor(VPN / T)
     *
     * 여기서는 모든 TLB set에 E개의 way가 있으며,
     * page table entry는 valid bit와 PPN을 가진다.
     *
     * 주의:
     * - TLB hit는 translation cache hit이지 data cache hit가 아니다.
     * - TLB miss는 page fault와 같지 않다.
     * - PTE invalid는 이 모델에서 page not resident를 뜻한다.
     * - page fault 이후 disk에서 페이지를 가져오는 작업과
     *   OS의 page table/TLB 갱신은 자동 실행하지 않는다.
     * - 실제 시스템의 multi-level page table, permission,
     *   protection fault, replacement, ASID, huge page 등은 생략한다.
     */

    const CSS = `
      /* CSS */
      .v6-widget .vm-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 9px 12px;
        margin: 11px 0;
      }

      .v6-widget .vm-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
      }

      .v6-widget .vm-label {
        color: #1a1a1a;
        font: 500 12px 'Noto Sans KR', sans-serif;
      }

      .v6-widget .vm-input,
      .v6-widget .vm-select {
        box-sizing: border-box;
        height: 36px;
        padding: 6px 9px;
        border: 1px solid #1a1a1a;
        border-radius: 5px;
        background: #ffffff;
        color: #1a1a1a;
        font: 13px 'Noto Sans KR', sans-serif;
        max-width: 100%;
      }

      .v6-widget .vm-number {
        width: 95px;
      }

      .v6-widget .vm-address {
        width: 180px;
        font-family: ui-monospace, monospace;
      }

      .v6-widget .vm-select {
        width: 90px;
      }

      .v6-widget .vm-range-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .v6-widget .vm-range {
        width: 112px;
        max-width: 100%;
        accent-color: #9e2b25;
        cursor: pointer;
      }

      .v6-widget .vm-range-value {
        min-width: 54px;
        color: #1a1a1a;
        font: 600 12px ui-monospace, monospace;
        white-space: nowrap;
      }

      .v6-widget .vm-btn {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 108px;
        min-height: 36px;
        padding: 7px 11px;
        border: 1px solid #1a1a1a;
        border-radius: 5px;
        background: #ffffff;
        color: #1a1a1a;
        font: 500 12px 'Noto Sans KR', sans-serif;
        cursor: pointer;
        transition:
          background 120ms ease,
          color 120ms ease,
          border-color 120ms ease;
      }

      .v6-widget .vm-btn:hover:not(:disabled),
      .v6-widget .vm-btn:focus-visible:not(:disabled) {
        background: #1a1a1a;
        border-color: #1a1a1a;
        color: #ffffff;
      }

      .v6-widget .vm-btn[aria-pressed="true"],
      .v6-widget .vm-btn.vm-primary {
        background: #9e2b25;
        border-color: #9e2b25;
        color: #ffffff;
      }

      .v6-widget .vm-btn[aria-pressed="true"]:hover:not(:disabled),
      .v6-widget .vm-btn.vm-primary:hover:not(:disabled) {
        background: #1a1a1a;
        border-color: #1a1a1a;
      }

      .v6-widget .vm-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .v6-widget .vm-input:focus-visible,
      .v6-widget .vm-select:focus-visible,
      .v6-widget .vm-range:focus-visible,
      .v6-widget .vm-btn:focus-visible {
        outline: 2px solid #9e2b25;
        outline-offset: 2px;
      }

      .v6-widget .vm-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin: 8px 0 12px;
      }

      .v6-widget .vm-section-label {
        margin: 12px 0 6px;
        color: #1a1a1a;
        font: 600 12px 'Noto Sans KR', sans-serif;
      }

      .v6-widget .vm-hint {
        margin: 6px 0;
        color: #555555;
        font: 11px/1.7 'Noto Sans KR', sans-serif;
        overflow-wrap: anywhere;
      }

      .v6-widget .vm-error {
        margin: 7px 0;
        color: #9e2b25;
        font: 12px/1.6 'Noto Sans KR', sans-serif;
      }

      .v6-widget .vm-progress {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin: 10px 0;
      }

      .v6-widget .vm-progress-item {
        box-sizing: border-box;
        min-height: 30px;
        padding: 6px 9px;
        border: 1px solid #e8e6e0;
        border-radius: 4px;
        background: #ffffff;
        color: #686868;
        font: 11px 'Noto Sans KR', sans-serif;
      }

      .v6-widget .vm-progress-item[data-current="true"] {
        border-color: #9e2b25;
        background: #9e2b25;
        color: #ffffff;
        font-weight: 700;
      }

      .v6-widget .vm-progress-item[data-done="true"] {
        border-color: #1a1a1a;
        color: #1a1a1a;
      }

      .v6-widget .vm-canvas {
        display: block;
        width: 100%;
        max-width: 720px;
        height: auto;
        margin: 12px auto;
      }

      .v6-widget .vm-state {
        box-sizing: border-box;
        width: 100%;
        padding: 12px 14px;
        margin: 10px 0;
        border-left: 3px solid #9e2b25;
        background: #f7f6f3;
        color: #1a1a1a;
        font: 13px/1.8 'Noto Sans KR', sans-serif;
        overflow-wrap: anywhere;
      }

      .v6-widget .vm-status {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 10px 0;
      }

      .v6-widget .vm-badge {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 30px;
        padding: 5px 10px;
        border: 1px solid #e8e6e0;
        border-radius: 4px;
        background: #ffffff;
        color: #686868;
        font: 700 11px 'Noto Sans KR', sans-serif;
      }

      .v6-widget .vm-badge[data-kind="hit"] {
        background: #1a1a1a;
        border-color: #1a1a1a;
        color: #ffffff;
      }

      .v6-widget .vm-badge[data-kind="miss"] {
        background: #9e2b25;
        border-color: #9e2b25;
        color: #ffffff;
      }

      .v6-widget .vm-badge[data-kind="fault"] {
        background: #ffffff;
        border: 2px solid #9e2b25;
        color: #9e2b25;
      }

      @media (max-width: 480px) {
        .v6-widget .vm-controls {
          gap: 8px;
        }

        .v6-widget .vm-field {
          flex: 1 1 135px;
        }

        .v6-widget .vm-number,
        .v6-widget .vm-address,
        .v6-widget .vm-select {
          width: 100%;
        }

        .v6-widget .vm-range-row {
          width: 100%;
        }

        .v6-widget .vm-range {
          flex: 1;
          width: 100%;
        }

        .v6-widget .vm-btn {
          flex: 1 1 115px;
          min-width: 0;
        }

        .v6-widget .vm-progress {
          gap: 5px;
        }

        .v6-widget .vm-progress-item {
          padding: 5px 6px;
          font-size: 10px;
        }
      }
    `;

    const style = document.createElement("style");
    style.textContent = CSS;
    el.appendChild(style);

    function clampInt(value, fallback, min, max) {
      if (
        value === undefined ||
        value === null ||
        typeof value === "boolean" ||
        (typeof value === "string" && value.trim() === "")
      ) {
        return fallback;
      }

      const n = Number(value);

      return Number.isFinite(n)
        ? Math.max(min, Math.min(max, Math.trunc(n)))
        : fallback;
    }

    function readConfig(keys, fallback) {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(cfg, key)) {
          return cfg[key];
        }
      }
      return fallback;
    }

    const allowedE = [1, 2, 4, 8];

    const initialE = Number(readConfig(["E", "tlbWays"], 4));

    const defaults = {
      m: clampInt(readConfig(["m", "virtualBits"], 16), 16, 8, 24),
      p: clampInt(readConfig(["p", "pageBits"], 6), 6, 4, 8),
      n: clampInt(readConfig(["n", "physicalBits"], 12), 12, 5, 24),
      t: clampInt(readConfig(["t", "tlbSetBits"], 2), 2, 1, 3),
      E: allowedE.includes(initialE) ? initialE : 4
    };

    defaults.m = Math.max(defaults.m, defaults.p + defaults.t + 1);
    defaults.n = Math.max(defaults.n, defaults.p + 1);

    const model = {
      m: defaults.m,
      p: defaults.p,
      n: defaults.n,
      t: defaults.t,
      E: defaults.E,

      address: 0,
      scenario: "hit",

      tlb: [],
      pageTable: new Map(),

      step: 0,
      maxStep: 4,

      translation: null,
      lastError: "",
      active: true
    };

    const scenarioNames = {
      hit: "TLB hit",
      pageHit: "TLB miss → page hit",
      fault: "page fault",
      random: "랜덤"
    };

    function node(tag, className, content) {
      const element = document.createElement(tag);

      if (className) element.className = className;

      if (content !== undefined) {
        element.textContent = String(content);
      }

      return element;
    }

    function append(parent, ...children) {
      children.forEach(child => parent.appendChild(child));
      return parent;
    }

    function field(title, control) {
      const wrapper = node("div", "vm-field");
      const label = node("label", "vm-label", title);

      if (control.id) label.htmlFor = control.id;

      append(wrapper, label, control);
      return wrapper;
    }

    function button(text, callback, primary = false) {
      const element = node(
        "button",
        "v6-btn vm-btn" + (primary ? " vm-primary" : ""),
        text
      );

      element.type = "button";
      element.addEventListener("click", callback);

      return element;
    }

    function makeRange(title, min, max, value, callback) {
      const input = node("input", "vm-range");

      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = "1";
      input.value = String(value);

      const output = node("output", "vm-range-value");

      const row = node("div", "vm-range-row");
      append(row, input, output);

      const wrapper = node("div", "vm-field");
      append(wrapper, node("label", "vm-label", title), row);

      input.addEventListener("input", () => {
        callback(Number(input.value));
        normalizeSettings();
        syncControls();
        loadScenario(model.scenario);
      });

      return { wrapper, input, output };
    }

    function hex(value, digits = 0) {
      return (
        "0x" +
        value.toString(16).toUpperCase().padStart(digits, "0")
      );
    }

    function bits(value, count) {
      if (count <= 0) return "";

      return value.toString(2).padStart(count, "0");
    }

    function randomInt(maxExclusive) {
      if (maxExclusive <= 1) return 0;

      const range = 0x100000000;

      if (
        typeof crypto !== "undefined" &&
        typeof crypto.getRandomValues === "function"
      ) {
        const array = new Uint32Array(1);
        const limit =
          Math.floor(range / maxExclusive) * maxExclusive;

        do {
          crypto.getRandomValues(array);
        } while (array[0] >= limit);

        return array[0] % maxExclusive;
      }

      return Math.floor(Math.random() * maxExclusive);
    }

    function vpnCount() {
      return 2 ** (model.m - model.p);
    }

    function ppnCount() {
      return 2 ** (model.n - model.p);
    }

    function tlbSetCount() {
      return 2 ** model.t;
    }

    function pageSize() {
      return 2 ** model.p;
    }

    function normalizeSettings() {
      model.p = clampInt(model.p, 6, 4, 8);
      model.t = clampInt(model.t, 2, 1, 3);
      model.m = clampInt(model.m, 16, 8, 24);
      model.n = clampInt(model.n, 12, 5, 24);

      if (model.m < model.p + model.t + 1) {
        model.m = model.p + model.t + 1;
      }

      if (model.n <= model.p) {
        model.n = model.p + 1;
      }

      if (!allowedE.includes(model.E)) {
        model.E = 4;
      }
    }

    function decodeVA(address) {
      const P = pageSize();
      const T = tlbSetCount();

      const vpn = Math.floor(address / P);
      const vpo = address % P;

      const ti = vpn % T;
      const tlbTag = Math.floor(vpn / T);

      return {
        address,
        vpn,
        vpo,
        ti,
        tlbTag
      };
    }

    function composePA(ppn, offset) {
      return ppn * pageSize() + offset;
    }

    function makeTLB() {
      model.tlb = Array.from(
        { length: tlbSetCount() },
        () =>
          Array.from({ length: model.E }, () => ({
            valid: false,
            tag: 0,
            ppn: 0
          }))
      );
    }

    function makePTE(valid, ppn) {
      return {
        valid: !!valid,
        ppn: valid ? ppn : null
      };
    }

    function setPTE(vpn, valid, ppn = 0) {
      model.pageTable.set(vpn, makePTE(valid, ppn));
    }

    function insertTLB(vpn, ppn, way = 0) {
      const T = tlbSetCount();
      const ti = vpn % T;
      const tag = Math.floor(vpn / T);

      const line = model.tlb[ti][way];

      line.valid = true;
      line.tag = tag;
      line.ppn = ppn;
    }

    function lookupTLB(vpn) {
      const T = tlbSetCount();

      const ti = vpn % T;
      const tag = Math.floor(vpn / T);

      const ways = model.tlb[ti];

      for (let i = 0; i < ways.length; i++) {
        const line = ways[i];

        if (line.valid && line.tag === tag) {
          return {
            hit: true,
            ti,
            tag,
            way: i,
            ppn: line.ppn
          };
        }
      }

      return {
        hit: false,
        ti,
        tag,
        way: -1,
        ppn: null
      };
    }

    function assignBackgroundEntries(targetVPN, scenario) {
      const maxVPN = vpnCount();
      const maxPPN = ppnCount();

      const usedTags = new Set();

      for (let i = 0; i < 7; i++) {
        const vpn = (targetVPN + i + 1) % maxVPN;

        if (vpn === targetVPN) continue;

        const resident = i % 4 !== 2;
        const ppn = (vpn * 7 + 3) % maxPPN;

        setPTE(vpn, resident, ppn);
      }

      for (let set = 0; set < model.tlb.length; set++) {
        const ways = model.tlb[set];

        for (let way = 0; way < ways.length; way++) {
          // Keep some lines invalid to demonstrate valid bits.
          if ((set + way) % 3 === 2) continue;

          const possibleTagCount = Math.floor(
            (maxVPN - 1 - set) / tlbSetCount()
          ) + 1;

          if (possibleTagCount <= 0) continue;

          let candidateTag =
            (set * 11 + way * 5 + 1) % possibleTagCount;

          const targetTag = Math.floor(
            targetVPN / tlbSetCount()
          );

          if (set === targetVPN % tlbSetCount()) {
            if (candidateTag === targetTag) {
              candidateTag =
                (candidateTag + 1) % possibleTagCount;
            }

            // Avoid inserting the requested VPN.
            if (candidateTag === targetTag) continue;
          }

          const key = set + ":" + candidateTag;

          if (usedTags.has(key)) continue;
          usedTags.add(key);

          const vpn =
            candidateTag * tlbSetCount() + set;

          const ppn = (vpn * 13 + 5) % maxPPN;

          ways[way] = {
            valid: true,
            tag: candidateTag,
            ppn
          };

          setPTE(vpn, true, ppn);
        }
      }

      // The target PTE is assigned last, so it cannot be
      // overwritten by any background entry.
      if (scenario === "fault") {
        setPTE(targetVPN, false);
      } else if (scenario !== "hit") {
        const ppn = (targetVPN * 7 + 9) % maxPPN;
        setPTE(targetVPN, true, ppn);
      }
    }

    function loadScenario(name) {
      model.scenario = scenarioNames[name] ? name : "hit";
      model.step = 0;
      model.lastError = "";

      makeTLB();
      model.pageTable = new Map();

      const maxVPN = vpnCount();
      const maxPPN = ppnCount();
      const P = pageSize();

      let targetVPN;

      if (model.scenario === "random") {
        targetVPN = randomInt(maxVPN);
      } else {
        targetVPN = Math.min(
          maxVPN - 1,
          0x23 % maxVPN
        );
      }

      const offset =
        model.scenario === "random"
          ? randomInt(P)
          : Math.min(P - 1, 0x15);

      model.address = targetVPN * P + offset;

      let effectiveScenario = model.scenario;

      if (effectiveScenario === "random") {
        const choice = randomInt(3);
        effectiveScenario =
          choice === 0
            ? "hit"
            : choice === 1
              ? "pageHit"
              : "fault";
      }

      assignBackgroundEntries(
        targetVPN,
        effectiveScenario
      );

      if (effectiveScenario === "hit") {
        const ppn = (targetVPN * 7 + 9) % maxPPN;

        setPTE(targetVPN, true, ppn);
        insertTLB(targetVPN, ppn, 0);
      }

      model.translation = null;

      model.effectiveScenario = effectiveScenario;

      addressInput.value = hex(
        model.address,
        Math.ceil(model.m / 4)
      );

      render();
    }

    function parseAddress(value) {
      const raw = value.trim();

      if (!/^(?:0[xX])?[0-9a-fA-F]+$/.test(raw)) {
        return {
          ok: false,
          error: "주소는 16진수로 입력하세요. 예: 0x08D5"
        };
      }

      const address = Number.parseInt(
        raw.replace(/^0[xX]/, ""),
        16
      );

      if (
        !Number.isSafeInteger(address) ||
        address < 0 ||
        address >= 2 ** model.m
      ) {
        return {
          ok: false,
          error:
            `${model.m}-bit VA 범위를 초과했습니다. ` +
            `최대 주소는 ${hex(2 ** model.m - 1)}입니다.`
        };
      }

      return { ok: true, address };
    }

    function setCustomAddress(value) {
      const parsed = parseAddress(value);

      if (!parsed.ok) {
        model.lastError = parsed.error;
        render();
        return;
      }

      model.address = parsed.address;
      model.step = 0;
      model.translation = null;
      model.lastError = "";
      model.scenario = "custom";

      render();
    }

    /*
     * Translation path:
     *
     * Step 1: VA split.
     * Step 2: TLB lookup.
     * Step 3: Page table lookup on TLB miss.
     * Step 4: Assemble PA if resident.
     *
     * On TLB hit, Step 3 is skipped.
     * On page fault, Step 4 does not construct a PA.
     *
     * TLB fills are performed at the page-table lookup step
     * for resident pages, modeling the hardware's translation
     * cache update. Page faults do not install a TLB entry.
     */

    function inspectTranslation() {
      const info = decodeVA(model.address);
      const tlbResult = lookupTLB(info.vpn);

      const pte = model.pageTable.get(info.vpn) ||
        makePTE(false);

      return {
        ...info,
        tlbResult,
        pte,
        tlbHit: tlbResult.hit,
        pageFault: !tlbResult.hit && !pte.valid,
        ppn: tlbResult.hit
          ? tlbResult.ppn
          : pte.valid
            ? pte.ppn
            : null
      };
    }

    function nextStep() {
      if (model.lastError) return;

      if (model.step === 0) {
        model.translation = inspectTranslation();
        model.step = 1;
      } else if (model.step === 1) {
        model.step = 2;
      } else if (model.step === 2) {
        const tr = model.translation;

        if (tr.tlbHit) {
          // A TLB hit already supplies the PPN.
          model.step = 4;
        } else {
          model.step = 3;
        }
      } else if (model.step === 3) {
        const tr = model.translation;

        if (tr.pageFault) {
          // Terminal state: no physical address exists yet.
          model.step = 5;
        } else {
          // Model the TLB fill after a successful page-table lookup.
          // Use an invalid way if possible; otherwise replace way 0.
          const ways = model.tlb[tr.ti];
          let way = ways.findIndex(item => !item.valid);

          if (way < 0) way = 0;

          insertTLB(tr.vpn, tr.ppn, way);
          tr.filledWay = way;

          model.step = 4;
        }
      } else {
        return;
      }

      render();
    }

    function resetSteps() {
      // Reconstruct the selected scenario to restore initial TLB state,
      // including any entry installed by a previous translation.
      if (model.scenario === "custom") {
        model.step = 0;
        model.translation = null;
        model.lastError = "";
        render();
      } else {
        loadScenario(model.scenario);
      }
    }

    // ------------------------------------------------------------
    // Controls
    // ------------------------------------------------------------

    V6.title(
      el,
      String(
        readConfig(
          ["title"],
          "가상 주소 변환 시뮬레이터 — VA → TLB → PA"
        )
      )
    );

    const settings = node("div", "v6-controls vm-controls");

    const mInput = node("input", "vm-input vm-number");
    mInput.type = "number";
    mInput.min = "8";
    mInput.max = "24";
    mInput.step = "1";
    mInput.value = String(model.m);

    const nInput = node("input", "vm-input vm-number");
    nInput.type = "number";
    nInput.min = "5";
    nInput.max = "24";
    nInput.step = "1";
    nInput.value = String(model.n);

    const pControl = makeRange(
      "page offset bits (p)",
      4,
      8,
      model.p,
      value => {
        model.p = value;
      }
    );

    const tControl = makeRange(
      "TLB set index bits (s_TLB)",
      1,
      3,
      model.t,
      value => {
        model.t = value;
      }
    );

    const eSelect = node("select", "vm-select");

    for (const value of allowedE) {
      const option = node("option", "", String(value));
      option.value = String(value);
      eSelect.appendChild(option);
    }

    eSelect.value = String(model.E);

    append(
      settings,
      field("VA 비트 수 m", mInput),
      field("PA 비트 수 n", nInput),
      pControl.wrapper,
      tControl.wrapper,
      field("TLB ways (E)", eSelect)
    );

    el.appendChild(settings);

    function applyNumberSettings() {
      const requestedM = Number(mInput.value);
      const requestedN = Number(nInput.value);

      if (
        !Number.isInteger(requestedM) ||
        requestedM < 8 ||
        requestedM > 24 ||
        !Number.isInteger(requestedN) ||
        requestedN < 5 ||
        requestedN > 24
      ) {
        model.lastError =
          "VA 비트 수는 8~24, PA 비트 수는 5~24의 정수여야 합니다.";
        render();
        return;
      }

      model.m = requestedM;
      model.n = requestedN;

      normalizeSettings();
      loadScenario(model.scenario);
    }

    mInput.addEventListener("change", applyNumberSettings);
    nInput.addEventListener("change", applyNumberSettings);

    eSelect.addEventListener("change", () => {
      model.E = Number(eSelect.value);
      normalizeSettings();
      loadScenario(model.scenario);
    });

    const settingsHint = node("div", "vm-hint");
    el.appendChild(settingsHint);

    el.appendChild(
      node("div", "vm-section-label", "시나리오 선택")
    );

    const presets = node("div", "vm-presets");

    const presetButtons = {};

    [
      ["hit", "TLB hit"],
      ["pageHit", "TLB miss → page hit"],
      ["fault", "page fault"],
      ["random", "랜덤"]
    ].forEach(([key, label]) => {
      const b = button(label, () => loadScenario(key));

      presetButtons[key] = b;
      presets.appendChild(b);
    });

    el.appendChild(presets);

    const addressControls = node("div", "v6-controls vm-controls");

    const addressInput = node("input", "vm-input vm-address");
    addressInput.type = "text";
    addressInput.placeholder = "예: 0x08D5";
    addressInput.spellcheck = false;
    addressInput.autocomplete = "off";

    const addressButton = button(
      "주소 적용",
      () => setCustomAddress(addressInput.value)
    );

    append(
      addressControls,
      field("가상 주소 VA (16진수)", addressInput),
      addressButton
    );

    el.appendChild(addressControls);

    addressInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        setCustomAddress(addressInput.value);
      }
    });

    const errorBox = node("div", "vm-error");
    errorBox.setAttribute("role", "alert");
    errorBox.hidden = true;
    el.appendChild(errorBox);

    const executionControls = node(
      "div",
      "v6-controls vm-controls"
    );

    const nextButton = button("다음 단계", nextStep, true);
    const resetButton = button("처음으로", resetSteps);

    append(executionControls, nextButton, resetButton);
    el.appendChild(executionControls);

    const progress = node("div", "vm-progress");

    const progressLabels = [
      "① VA 분해",
      "② TLB 조회",
      "③ PTE 조회",
      "④ PA 조립"
    ];

    const progressNodes = progressLabels.map(label => {
      const item = node("div", "vm-progress-item", label);
      progress.appendChild(item);
      return item;
    });

    el.appendChild(progress);

    const statusRow = node("div", "vm-status");
    el.appendChild(statusRow);

    const canvas = V6.canvas(el, H);
    canvas.classList.add("vm-canvas");

    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.maxWidth = "720px";
    canvas.style.display = "block";

    const ctx = canvas.getContext("2d");

    const explanation = node("div", "v6-state vm-state");
    explanation.setAttribute("role", "status");
    explanation.setAttribute("aria-live", "polite");

    el.appendChild(explanation);

    const footer = node(
      "div",
      "vm-hint",
      "교육용 단일 레벨 page table 모델입니다. " +
      "TLB hit는 주소 변환 결과가 캐시되어 있다는 뜻이며, " +
      "실제 메모리 데이터의 cache hit를 의미하지 않습니다. " +
      "Page fault가 발생하면 OS가 페이지를 메모리에 적재하고 " +
      "page table을 갱신한 뒤 접근을 재시도해야 합니다. " +
      "이 과정의 실제 disk I/O와 OS 처리는 생략합니다."
    );

    el.appendChild(footer);

    // ------------------------------------------------------------
    // Canvas drawing helpers
    // ------------------------------------------------------------

    function setupCanvas() {
      const dpr = Math.min(
        3,
        Math.max(1, window.devicePixelRatio || 1)
      );

      const pw = Math.round(W * dpr);
      const ph = Math.round(H * dpr);

      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, W, H);

      canvas.style.aspectRatio = W + " / " + H;
    }

    function rect(
      x, y, w, h,
      fill = WHITE,
      stroke = GRID,
      radius = 0,
      lineWidth = 1
    ) {
      ctx.beginPath();

      if (radius && typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, w, h, radius);
      } else {
        ctx.rect(x, y, w, h);
      }

      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }

      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }

    function line(x1, y1, x2, y2, color = GRID, width = 1) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    function text(
      content,
      x,
      y,
      size = 12,
      color = INK,
      align = "left",
      weight = 400
    ) {
      ctx.save();
      ctx.font = `${weight} ${size}px ${FONT}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(String(content), x, y);
      ctx.restore();
    }

    function mono(
      content,
      x,
      y,
      size = 12,
      color = INK,
      align = "left",
      weight = 400
    ) {
      ctx.save();
      ctx.font = `${weight} ${size}px ${MONO}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.fillText(String(content), x, y);
      ctx.restore();
    }

    function fittedMono(
      content,
      x,
      y,
      maxWidth,
      initialSize = 12,
      minSize = 8,
      color = INK,
      align = "center",
      weight = 400
    ) {
      let size = initialSize;

      while (size > minSize) {
        ctx.font = `${weight} ${size}px ${MONO}`;

        if (ctx.measureText(String(content)).width <= maxWidth) {
          break;
        }

        size -= 0.5;
      }

      mono(content, x, y, size, color, align, weight);
    }

    function sectionTitle(label, y) {
      text(label, 24, y, 15, INK, "left", 700);
      line(24, y + 18, 696, y + 18, GRID);
    }

    function badge(label, x, y, type, width = 120) {
      let fill = WHITE;
      let stroke = RED;
      let color = RED;

      if (type === "hit") {
        fill = INK;
        stroke = INK;
        color = WHITE;
      } else if (type === "miss") {
        fill = RED;
        stroke = RED;
        color = WHITE;
      }

      rect(x, y, width, 29, fill, stroke, 4, 1.5);

      text(
        label,
        x + width / 2,
        y + 14.5,
        11,
        color,
        "center",
        700
      );
    }

    function drawBits(value, totalBits, firstBits, x, y, width, highlight) {
      const binary = bits(value, totalBits);
      const cellW = width / totalBits;
      const cellH = 28;

      for (let i = 0; i < totalBits; i++) {
        const first = i < firstBits;
        const selected =
          highlight === "first"
            ? first
            : highlight === "second"
              ? !first
              : false;

        const px = x + i * cellW;

        rect(
          px,
          y,
          cellW,
          cellH,
          selected ? PALE_RED : WHITE,
          selected ? RED : INK,
          0,
          selected ? 1.4 : 0.8
        );

        mono(
          binary[i],
          px + cellW / 2,
          y + cellH / 2,
          Math.min(12, Math.max(8, cellW * 0.55)),
          selected ? RED : INK,
          "center",
          selected ? 700 : 400
        );
      }

      if (firstBits > 0 && firstBits < totalBits) {
        const splitX = x + firstBits * cellW;

        line(
          splitX,
          y - 4,
          splitX,
          y + cellH + 4,
          RED,
          2
        );
      }
    }

    function drawAddressSection(tr) {
      sectionTitle("① Virtual Address (VA)", 27);

      const vpnBits = model.m - model.p;

      text(
        `${model.m}-bit VA`,
        24,
        65,
        11,
        MUTED
      );

      fittedMono(
        hex(model.address, Math.ceil(model.m / 4)),
        696,
        65,
        250,
        14,
        9,
        RED,
        "right",
        700
      );

      drawBits(
        model.address,
        model.m,
        vpnBits,
        24,
        85,
        672,
        model.step >= 1 ? "first" : null
      );

      const splitX = 24 + 672 * (vpnBits / model.m);

      text(
        `VPN (${vpnBits} bits)`,
        (24 + splitX) / 2,
        127,
        11,
        model.step >= 1 ? RED : INK,
        "center",
        600
      );

      text(
        `VPO (${model.p} bits)`,
        (splitX + 696) / 2,
        127,
        11,
        INK,
        "center",
        600
      );

      if (model.step >= 1) {
        fittedMono(
          `VPN = ${hex(tr.vpn)} (${tr.vpn})`,
          24,
          153,
          350,
          12,
          9,
          RED,
          "left",
          600
        );

        fittedMono(
          `VPO = ${hex(tr.vpo)} (${tr.vpo})`,
          696,
          153,
          285,
          12,
          9,
          INK,
          "right",
          600
        );
      } else {
        text(
          "다음 단계를 누르면 VPN과 VPO가 분리됩니다.",
          24,
          153,
          12,
          MUTED
        );
      }
    }

    function displayTLBRows(tr) {
      const rows = [];
      const activeSet = tr.ti;

      for (let set = 0; set < model.tlb.length; set++) {
        for (let way = 0; way < model.E; way++) {
          rows.push({
            set,
            way,
            line: model.tlb[set][way],
            selected: set === activeSet,
            matched:
              model.step >= 2 &&
              tr.tlbResult.hit &&
              set === activeSet &&
              way === tr.tlbResult.way,
            filled:
              model.step >= 4 &&
              tr.filledWay === way &&
              set === activeSet
          });
        }
      }

      return rows;
    }

    function drawTLBSection(tr) {
      sectionTitle("② Translation Lookaside Buffer (TLB)", 190);

      const x = 24;
      const y = 227;
      const width = 323;
      const headerH = 28;

      const columns = [
        { label: "set", x: 34 },
        { label: "way", x: 92 },
        { label: "V", x: 145 },
        { label: "TLB tag", x: 202 },
        { label: "PPN", x: 302 }
      ];

      rect(x, y, width, headerH, PALE, GRID, 4);

      columns.forEach(col => {
        text(col.label, col.x, y + 14, 10, INK, "center", 600);
      });

      const rows = displayTLBRows(tr);

      // The visible table shows up to 12 real lines.
      // If more exist, display all ways of the selected set plus
      // representative lines from other sets.
      let visible = rows;

      if (rows.length > 12) {
        const selectedRows = rows.filter(row => row.selected);

        const otherRows = rows.filter(row => !row.selected);

        visible = [
          ...selectedRows,
          ...otherRows.slice(0, Math.max(0, 12 - selectedRows.length))
        ];
      }

      const rowH = 24;

      visible.forEach((row, index) => {
        const yy = y + headerH + index * rowH;

        const active =
          model.step >= 2 &&
          row.selected;

        const stronglyHighlighted =
          row.matched || row.filled;

        rect(
          x,
          yy,
          width,
          rowH,
          stronglyHighlighted
            ? PALE_RED
            : active
              ? "#fcf5f4"
              : row.line.valid
                ? WHITE
                : PALE,
          stronglyHighlighted
            ? RED
            : active
              ? RED
              : GRID,
          0,
          stronglyHighlighted ? 1.6 : 0.7
        );

        mono(
          row.set,
          34,
          yy + 12,
          10,
          active ? RED : INK,
          "center",
          active ? 700 : 400
        );

        mono(row.way, 92, yy + 12, 10, INK, "center");

        mono(
          row.line.valid ? "1" : "0",
          145,
          yy + 12,
          11,
          row.line.valid ? INK : MUTED,
          "center"
        );

        fittedMono(
          row.line.valid ? hex(row.line.tag) : "—",
          202,
          yy + 12,
          85,
          10,
          8,
          stronglyHighlighted ? RED : INK
        );

        fittedMono(
          row.line.valid ? hex(row.line.ppn) : "—",
          302,
          yy + 12,
          70,
          10,
          8,
          stronglyHighlighted ? RED : INK
        );
      });

      const tableBottom = y + headerH + visible.length * rowH;

      if (rows.length > visible.length) {
        text(
          `나머지 ${rows.length - visible.length}개 TLB line 생략`,
          26,
          tableBottom + 15,
          10,
          MUTED
        );
      }

      const statusY = 580;

      if (model.step < 2) {
        text(
          "TLB 조회 대기",
          26,
          statusY,
          11,
          MUTED
        );
      } else {
        fittedMono(
          `TI=${tr.ti}, TLB tag=${hex(tr.tlbTag)}`,
          26,
          statusY,
          315,
          11,
          9,
          RED,
          "left",
          600
        );
      }

      if (model.step >= 2) {
        const kind = tr.tlbHit ? "hit" : "miss";

        badge(
          tr.tlbHit ? "TLB HIT" : "TLB MISS",
          219,
          605,
          kind,
          125
        );
      }
    }

    function pageTableRows(tr) {
      const keys = new Set();

      keys.add(tr.vpn);

      for (let delta = -2; delta <= 2; delta++) {
        const vpn = tr.vpn + delta;

        if (vpn >= 0 && vpn < vpnCount()) {
          keys.add(vpn);
        }
      }

      for (const vpn of model.pageTable.keys()) {
        if (keys.size >= 8) break;
        keys.add(vpn);
      }

      return [...keys]
        .sort((a, b) => a - b)
        .slice(0, 8);
    }

    function drawPageTableSection(tr) {
      sectionTitle("③ Page Table (일부 PTE)", 375);

      const x = 373;
      const y = 412;
      const width = 323;
      const headerH = 28;

      rect(x, y, width, headerH, PALE, GRID, 4);

      text("VPN", 418, y + 14, 10, INK, "center", 600);
      text("V", 514, y + 14, 10, INK, "center", 600);
      text("PPN", 622, y + 14, 10, INK, "center", 600);

      const rows = pageTableRows(tr);

      rows.forEach((vpn, i) => {
        const pte = model.pageTable.get(vpn) ||
          makePTE(false);

        const yy = y + headerH + i * 27;

        const selected =
          model.step >= 3 &&
          !tr.tlbHit &&
          vpn === tr.vpn;

        rect(
          x,
          yy,
          width,
          27,
          selected
            ? PALE_RED
            : pte.valid
              ? WHITE
              : PALE,
          selected ? RED : GRID,
          0,
          selected ? 1.7 : 0.7
        );

        fittedMono(
          hex(vpn),
          418,
          yy + 13.5,
          85,
          11,
          8,
          selected ? RED : INK,
          "center",
          selected ? 700 : 400
        );

        mono(
          pte.valid ? "1" : "0",
          514,
          yy + 13.5,
          11,
          selected && !pte.valid ? RED : INK,
          "center",
          selected ? 700 : 400
        );

        fittedMono(
          pte.valid ? hex(pte.ppn) : "—",
          622,
          yy + 13.5,
          110,
          11,
          8,
          selected ? RED : INK
        );
      });

      if (model.step < 3) {
        text(
          "page table 조회 전",
          378,
          675,
          11,
          MUTED
        );
      } else if (tr.tlbHit) {
        text(
          "TLB hit: PTE 조회 생략",
          378,
          675,
          11,
          INK
        );
      } else if (tr.pageFault) {
        badge(
          "PAGE FAULT",
          374,
          668,
          "fault",
          143
        );
      } else {
        badge(
          "PAGE HIT",
          374,
          668,
          "hit",
          143
        );
      }
    }

    function drawPhysicalAddress(tr) {
      sectionTitle("④ Physical Address (PA)", 704);

      if (model.step === 5) {
        rect(
          24,
          739,
          672,
          34,
          PALE_RED,
          RED,
          4,
          1.5
        );

        text(
          "PAGE FAULT — PA를 아직 만들 수 없습니다. OS가 disk에서 page를 가져와야 합니다.",
          360,
          756,
          11,
          RED,
          "center",
          600
        );

        return;
      }

      if (model.step < 4 || tr.ppn === null) {
        rect(24, 739, 672, 34, PALE, GRID, 4);

        text(
          "주소 변환이 완료되면 PPN | PPO 비트열이 표시됩니다.",
          360,
          756,
          11,
          MUTED,
          "center"
        );

        return;
      }

      const pa = composePA(tr.ppn, tr.vpo);
      const ppnBits = model.n - model.p;

      drawBits(
        pa,
        model.n,
        ppnBits,
        24,
        734,
        672,
        "first"
      );

      text(
        `PPN=${hex(tr.ppn)}  |  PPO=${hex(tr.vpo)}  →  PA=${hex(pa)}`,
        360,
        778,
        11,
        RED,
        "center",
        700
      );
    }

    function drawConnector(tr) {
      if (model.step < 2) return;

      line(356, 195, 356, 681, GRID, 1);

      if (model.step >= 3 && !tr.tlbHit) {
        line(356, 447, 365, 447, RED, 2);
        line(365, 447, 359, 442, RED, 2);
        line(365, 447, 359, 452, RED, 2);
      }
    }

    function drawCanvas() {
      if (!ctx) return;

      setupCanvas();

      const tr = model.translation ||
        inspectTranslation();

      drawAddressSection(tr);
      drawTLBSection(tr);
      drawPageTableSection(tr);
      drawConnector(tr);
      drawPhysicalAddress(tr);
    }

    // ------------------------------------------------------------
    // Status and explanations
    // ------------------------------------------------------------

    function makeBadge(label, kind) {
      const b = node("span", "vm-badge", label);
      b.dataset.kind = kind;
      return b;
    }

    function updateStatus() {
      statusRow.replaceChildren();

      if (model.step >= 2) {
        const tr = model.translation;

        statusRow.appendChild(
          makeBadge(
            tr.tlbHit ? "TLB HIT" : "TLB MISS",
            tr.tlbHit ? "hit" : "miss"
          )
        );

        if (!tr.tlbHit && model.step >= 3) {
          statusRow.appendChild(
            makeBadge(
              tr.pageFault ? "PAGE FAULT" : "PAGE HIT",
              tr.pageFault ? "fault" : "hit"
            )
          );
        }

        if (model.step === 4) {
          statusRow.appendChild(
            makeBadge("PA READY", "hit")
          );
        }
      }
    }

    function updateExplanation() {
      explanation.replaceChildren();

      const tr = model.translation ||
        inspectTranslation();

      let heading;
      let description;

      if (model.lastError) {
        heading = "입력 오류";
        description = model.lastError;
      } else if (model.step === 0) {
        heading = "변환 시작 전";
        description =
          `가상 주소 ${hex(model.address)}가 준비되었습니다. ` +
          "다음 단계를 누르면 VPN과 VPO로 분해합니다.";
      } else if (model.step === 1) {
        heading = "① VA → VPN | VPO";
        description =
          `페이지 크기는 ${pageSize()} bytes이므로 ` +
          `하위 ${model.p}비트가 VPO=${hex(tr.vpo)}, ` +
          `나머지가 VPN=${hex(tr.vpn)}입니다.`;
      } else if (model.step === 2) {
        heading = "② TLB 조회";

        if (tr.tlbHit) {
          description =
            `VPN ${hex(tr.vpn)}에서 TI=${tr.ti}, ` +
            `TLB tag=${hex(tr.tlbTag)}를 계산했습니다. ` +
            `TLB set ${tr.ti}의 way ${tr.tlbResult.way}에서 ` +
            `일치하는 valid entry를 찾아 PPN=${hex(tr.ppn)}를 얻었습니다. ` +
            "Page table 조회는 생략합니다.";
        } else {
          description =
            `VPN ${hex(tr.vpn)}의 TI=${tr.ti}, ` +
            `TLB tag=${hex(tr.tlbTag)}입니다. ` +
            `TLB set ${tr.ti}에 일치하는 valid entry가 없어 ` +
            "TLB miss가 발생했습니다. 다음 단계에서 PTE를 조회합니다.";
        }
      } else if (model.step === 3) {
        if (tr.pageFault) {
          heading = "③ Page table 조회 — Page fault";
          description =
            `VPN ${hex(tr.vpn)}의 PTE valid bit가 0입니다. ` +
            "해당 페이지는 이 모델에서 물리 메모리에 없으므로 " +
            "page fault가 발생하며, OS가 disk에서 페이지를 가져와야 합니다.";
        } else {
          heading = "③ Page table 조회 — Page hit";
          description =
            `VPN ${hex(tr.vpn)}의 PTE valid bit가 1이므로 ` +
            `PPN=${hex(tr.ppn)}를 얻었습니다. ` +
            "Page fault 없이 주소 변환을 계속할 수 있습니다.";
        }
      } else if (model.step === 4) {
        const pa = composePA(tr.ppn, tr.vpo);

        heading = "④ PA 조립 완료";
        description =
          `PPN=${hex(tr.ppn)}과 PPO=VPO=${hex(tr.vpo)}를 ` +
          `결합해 PA=${hex(pa)}를 얻었습니다. ` +
          (tr.tlbHit
            ? "TLB hit로 page table 조회를 생략했습니다."
            : "TLB miss 뒤 page hit가 발생해 변환을 완료했습니다.");
      } else {
        heading = "Page fault — 주소 변환 중단";
        description =
          `VPN ${hex(tr.vpn)}의 PTE가 invalid이므로 ` +
          "현재 PA를 만들 수 없습니다. OS의 page fault 처리가 " +
          "끝난 뒤 명령을 재시도해야 합니다.";
      }

      const title = node("div", "", heading);
      title.style.fontWeight = "700";
      title.style.marginBottom = "4px";

      append(
        explanation,
        title,
        node("div", "", description)
      );
    }

    function syncControls() {
      mInput.value = String(model.m);
      nInput.value = String(model.n);

      pControl.input.value = String(model.p);
      tControl.input.value = String(model.t);

      pControl.output.textContent =
        `${model.p} → P=${pageSize()}`;

      tControl.output.textContent =
        `${model.t} → T=${tlbSetCount()}`;

      eSelect.value = String(model.E);

      settingsHint.textContent =
        `VA=${model.m} bits · PA=${model.n} bits · ` +
        `P=${pageSize()} bytes · VPN=${model.m - model.p} bits · ` +
        `PPN=${model.n - model.p} bits · ` +
        `TLB=${tlbSetCount()} sets × ${model.E} ways`;

      for (const [key, b] of Object.entries(presetButtons)) {
        b.setAttribute(
          "aria-pressed",
          String(model.scenario === key)
        );
      }
    }

    function updateProgress() {
      const step = model.step;

      progressNodes.forEach((item, index) => {
        const stage = index + 1;

        let current = false;
        let done = false;

        if (step === 5) {
          current = stage === 3;
          done = stage < 3;
        } else if (step === 4 && model.translation?.tlbHit) {
          current = stage === 4;
          done = stage <= 2;
        } else {
          current = step === stage;
          done = step > stage && step <= 4;
        }

        if (
          model.translation?.tlbHit &&
          stage === 3 &&
          step >= 4
        ) {
          item.textContent = "③ PTE 생략";
          current = false;
          done = false;
        } else {
          item.textContent = progressLabels[index];
        }

        item.dataset.current = String(current);
        item.dataset.done = String(done);
      });

      nextButton.disabled =
        !!model.lastError ||
        model.step === 4 ||
        model.step === 5;

      resetButton.disabled = model.step === 0;
    }

    function render() {
      if (!model.active) return;

      syncControls();

      errorBox.hidden = !model.lastError;
      errorBox.textContent = model.lastError;

      updateProgress();
      updateStatus();
      updateExplanation();
      drawCanvas();
    }

    normalizeSettings();

    const initialScenario = String(
      readConfig(["scenario"], "hit")
    );

    loadScenario(
      scenarioNames[initialScenario]
        ? initialScenario
        : "hit"
    );

    const configuredAddress = readConfig(
      ["address", "va"],
      null
    );

    if (configuredAddress !== null) {
      const value =
        typeof configuredAddress === "number"
          ? hex(configuredAddress)
          : String(configuredAddress);

      addressInput.value = value;
      setCustomAddress(value);
    }
  });
})();
