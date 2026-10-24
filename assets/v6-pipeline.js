(function () {
  "use strict";

  if (typeof window === "undefined" || !window.V6) return;

  var V6 = window.V6;
  var INK = V6.INK || "#1a1a1a";
  var RED = V6.RED || "#9e2b25";
  var GRID = V6.GRID || "#e8e6e0";
  var WHITE = "#ffffff";
  var MUTED = "#444";
  var SOFT = "#666";
  var FONT = '"Noto Sans KR", sans-serif';

  var STAGES = ["IF", "ID", "EX", "MEM", "WB"];

  var STAGE_ACTIONS = {
    IF: "Fetch",
    ID: "Decode/레지스터 읽기",
    EX: "Execute",
    MEM: "Memory 접근",
    WB: "Writeback"
  };

  function ensureStyles() {
    if (document.getElementById("v6pipe-style")) return;

    var style = document.createElement("style");
    style.id = "v6pipe-style";
    style.textContent = `
      .v6-widget .v6pipe-root {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        min-width: 0;
        color: #1a1a1a;
        background: #ffffff;
        font-family: 'Noto Sans KR', sans-serif;
        font-size: 14px;
        line-height: 1.6;
      }

      .v6-widget .v6pipe-title {
        margin: 0;
        color: #1a1a1a;
        font-family: 'Noto Sans KR', sans-serif;
        font-size: 18px;
        line-height: 1.5;
        font-weight: 700;
      }

      .v6-widget .v6pipe-subtitle {
        margin: -6px 0 0;
        color: #444444;
        font-size: 13px;
      }

      .v6-widget .v6pipe-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        width: 100%;
      }

      .v6-widget .v6pipe-control-group {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }

      .v6-widget .v6pipe-btn {
        box-sizing: border-box;
        min-width: 92px;
        min-height: 44px;
        padding: 7px 10px;
        font-family: 'Noto Sans KR', sans-serif;
        font-size: 13px;
        line-height: 1.4;
        cursor: pointer;
        white-space: nowrap;
      }

      .v6-widget .v6pipe-btn[aria-pressed="true"] {
        border-color: #9e2b25;
      }

      .v6-widget .v6pipe-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .v6-widget .v6pipe-canvas-wrap {
        width: 100%;
        min-width: 0;
        overflow-x: auto;
        overflow-y: hidden;
        background: #ffffff;
      }

      .v6-widget .v6pipe-canvas {
        display: block;
        width: 100%;
        height: auto;
        background: #ffffff;
      }

      .v6-widget .v6pipe-stage-line {
        box-sizing: border-box;
        width: 100%;
        padding: 9px 11px;
        border-left: 3px solid #9e2b25;
        background: #ffffff;
        color: #1a1a1a;
        font-size: 12px;
        line-height: 1.8;
        overflow-wrap: anywhere;
      }

      .v6-widget .v6pipe-metrics {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 20px;
        padding: 10px 0;
        border-top: 1px solid #e8e6e0;
        border-bottom: 1px solid #e8e6e0;
      }

      .v6-widget .v6pipe-metric {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 5px;
        font-size: 13px;
      }

      .v6-widget .v6pipe-metric-label {
        color: #444444;
      }

      .v6-widget .v6pipe-metric-value {
        color: #9e2b25;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }

      .v6-widget .v6pipe-note {
        margin: 0;
        color: #1a1a1a;
        font-size: 13px;
        line-height: 1.8;
        overflow-wrap: anywhere;
      }

      .v6-widget .v6pipe-legend {
        margin: -5px 0 0;
        color: #666666;
        font-size: 12px;
        line-height: 1.7;
      }

      .v6-widget .v6pipe-compare {
        box-sizing: border-box;
        padding: 10px 12px;
        border: 1px solid #e8e6e0;
        color: #1a1a1a;
        font-size: 13px;
        line-height: 1.8;
      }

      .v6-widget .v6pipe-caption {
        margin: 0;
        padding-top: 10px;
        border-top: 1px solid #e8e6e0;
        color: #444444;
        font-size: 12px;
        line-height: 1.8;
      }

      @media (max-width: 560px) {
        .v6-widget .v6pipe-title {
          font-size: 16px;
        }

        .v6-widget .v6pipe-controls {
          gap: 7px;
        }

        .v6-widget .v6pipe-control-group {
          gap: 5px;
        }

        .v6-widget .v6pipe-btn {
          padding: 7px 8px;
          font-size: 12px;
        }

        .v6-widget .v6pipe-metrics {
          gap: 7px 14px;
        }

        .v6-widget .v6pipe-stage-line {
          padding: 8px;
          font-size: 11px;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function createElement(tag, className, text) {
    var node = document.createElement(tag);

    if (className) node.className = className;
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }

    return node;
  }

  function createButton(parent, text, onClick, pressed) {
    var button = createElement("button", "v6pipe-btn", text);
    button.type = "button";

    if (pressed !== undefined) {
      button.setAttribute("aria-pressed", String(!!pressed));
    }

    button.addEventListener("click", onClick);
    parent.appendChild(button);

    return button;
  }

  function setPressed(button, pressed) {
    button.setAttribute("aria-pressed", String(!!pressed));
  }

  function createMetric(parent, label) {
    var item = createElement("span", "v6pipe-metric");
    var labelNode = createElement(
      "span",
      "v6pipe-metric-label",
      label + ":"
    );
    var valueNode = createElement("strong", "v6pipe-metric-value", "—");

    item.appendChild(labelNode);
    item.appendChild(valueNode);
    parent.appendChild(item);

    return valueNode;
  }

  function createRow(id, label, doneCycle, valid) {
    return {
      id: id,
      label: label,
      cells: Object.create(null),
      doneCycle: doneCycle,
      valid: valid !== false
    };
  }

  function putCell(row, cycle, type, stage, extra) {
    var cell = {
      type: type,
      stage: stage
    };

    if (extra) {
      Object.keys(extra).forEach(function (key) {
        cell[key] = extra[key];
      });
    }

    row.cells[cycle] = cell;
  }

  function addStages(row, startCycle, stages) {
    stages.forEach(function (stage, index) {
      putCell(row, startCycle + index, "stage", stage);
    });

    row.doneCycle = startCycle + stages.length - 1;
  }

  function buildTraceModel(preset) {
    var rows = [];
    var standardStages = ["IF", "ID", "EX", "MEM", "WB"];

    if (preset === "linear") {
      var specs = [
        ["I1", "add R2,R3 → R1"],
        ["I2", "xor R5,R6 → R7"],
        ["I3", "sub R8,R9 → R10"],
        ["I4", "add R11,R12 → R13"],
        ["I5", "and R14,R15 → R16"],
        ["I6", "or R17,R18 → R19"]
      ];

      specs.forEach(function (spec, index) {
        var row = createRow(
          spec[0],
          spec[0] + "  " + spec[1],
          null,
          true
        );

        addStages(row, index + 1, standardStages);
        rows.push(row);
      });

      return {
        rows: rows,
        totalCycles: 10,
        validCount: 6,
        wastedCycles: 0,
        arrows: [],
        detail:
          "IF → ID → EX → MEM → WB 순서로 진행합니다. 파이프라인이 채워진 뒤에는 steady state에서 매 사이클 한 명령어가 완료됩니다.",
        legend:
          "각 셀은 해당 사이클의 stage입니다. 현재 사이클은 회색 열과 빨간 테두리로 표시합니다."
      };
    }

    var i1 = createRow("I1", "I1  add R2,R3 → R1", 5, true);
    addStages(i1, 1, standardStages);

    var i2 = createRow("I2", "I2  sub R4,R5 → R6", 6, true);
    addStages(i2, 2, standardStages);

    var branch = createRow("I3", "I3  beq R6,R0,T", 5, true);
    addStages(branch, 3, ["IF", "ID", "EX"]);

    var wrong1 = createRow(
      "I4",
      "I4  xor R7,R8 → R9 (wrong path)",
      null,
      false
    );
    putCell(wrong1, 4, "stage", "IF");
    putCell(wrong1, 5, "flush", "ID");

    var wrong2 = createRow(
      "I5",
      "I5  add R10,R11 → R12 (wrong path)",
      null,
      false
    );
    putCell(wrong2, 5, "flush", "IF");

    var target = createRow("I6", "I6  T: load R13,0(R14)", 10, true);
    addStages(target, 6, standardStages);

    rows.push(i1, i2, branch, wrong1, wrong2, target);

    return {
      rows: rows,
      totalCycles: 10,
      validCount: 4,
      wastedCycles: 2,
      arrows: [],
      detail:
        "예측은 항상 not-taken입니다. I3가 C5의 EX에서 taken을 확인하면 I4의 ID와 I5의 IF를 flush하고, C6부터 target을 다시 Fetch합니다.",
      legend:
        "빨간 X는 flush된 wrong-path 명령어입니다. I3는 EX에서 분기 결과를 확정하며, 유효한 완료 명령어는 I1, I2, I3, I6입니다. I2 → I3의 데이터 의존은 forwarding이 있다고 가정합니다 (데이터 해저드는 아래 위젯 참조)."
    };
  }

  function buildHazardModel(preset, forwarding) {
    var i1Label =
      preset === "alu"
        ? "I1  add R2,R3 → R1"
        : "I1  load (R2) → R1";

    var i2Label = "I2  sub R1,R4 → R5";

    var i1 = createRow("I1", i1Label, 5, true);
    addStages(i1, 1, ["IF", "ID", "EX", "MEM", "WB"]);

    var i2 = createRow("I2", i2Label, null, true);
    var bubbleCycles = [];
    var arrows = [];
    var detail = "";
    var totalCycles;

    if (preset === "alu" && forwarding) {
      addStages(i2, 2, ["IF", "ID", "EX", "MEM", "WB"]);
      totalCycles = 6;

      arrows.push({
        from: { rowId: "I1", cycle: 3 },
        to: { rowId: "I2", cycle: 4 }
      });

      detail =
        "I2가 필요로 하는 R1을 I1의 EX 결과에서 바로 forwarding하므로 RAW 의존성 때문에 생기는 stall이 없습니다.";
    } else if (preset === "alu" && !forwarding) {
      putCell(i2, 2, "stage", "IF");
      putCell(i2, 3, "stage", "ID");
      putCell(i2, 4, "stall", "ID");
      putCell(i2, 5, "stall", "ID");
      putCell(i2, 6, "stage", "EX");
      putCell(i2, 7, "stage", "MEM");
      putCell(i2, 8, "stage", "WB");
      i2.doneCycle = 8;

      bubbleCycles = [4, 5];
      totalCycles = 8;

      detail =
        "I2는 R1을 읽기 위해 I1의 WB까지 기다립니다. ID가 두 사이클 멈추고 EX에 bubble 2개가 삽입됩니다.";
    } else if (preset === "load" && forwarding) {
      putCell(i2, 2, "stage", "IF");
      putCell(i2, 3, "stage", "ID");
      putCell(i2, 4, "stall", "ID");
      putCell(i2, 5, "stage", "EX");
      putCell(i2, 6, "stage", "MEM");
      putCell(i2, 7, "stage", "WB");
      i2.doneCycle = 7;

      bubbleCycles = [4];
      totalCycles = 7;

      arrows.push({
        from: { rowId: "I1", cycle: 4 },
        to: { rowId: "I2", cycle: 5 }
      });

      detail =
        "load 값은 MEM 단계가 끝나야 준비됩니다. forwarding을 사용해도 I2의 EX를 한 사이클 늦춰야 하므로 bubble 1개가 필요합니다.";
    } else {
      putCell(i2, 2, "stage", "IF");
      putCell(i2, 3, "stage", "ID");
      putCell(i2, 4, "stall", "ID");
      putCell(i2, 5, "stall", "ID");
      putCell(i2, 6, "stage", "EX");
      putCell(i2, 7, "stage", "MEM");
      putCell(i2, 8, "stage", "WB");
      i2.doneCycle = 8;

      bubbleCycles = [4, 5];
      totalCycles = 8;

      detail =
        "forwarding이 없으면 I2는 I1의 WB까지 기다려야 합니다. ID가 두 사이클 멈추고 EX에 bubble 2개가 삽입됩니다.";
    }

    var rows = [i1, i2];

    if (bubbleCycles.length > 0) {
      var bubbleRow = createRow(
        "BUBBLE",
        "EX bubble",
        null,
        false
      );

      bubbleCycles.forEach(function (cycle) {
        putCell(bubbleRow, cycle, "bubble", "EX");
      });

      rows.push(bubbleRow);
    }

    var forwardingCycles = preset === "alu" ? 6 : 7;
    var noForwardingCycles = 8;

    return {
      rows: rows,
      totalCycles: totalCycles,
      validCount: 2,
      wastedCycles: null,
      arrows: arrows,
      detail: detail,
      legend:
        "bubble은 EX에 삽입된 빈 단계입니다. ID의 stall은 의존 명령어가 대기 중임을 뜻합니다. 빨간 화살표는 forwarding 경로입니다.",
      comparison:
        "forwarding 있음: " +
        forwardingCycles +
        " cycles (CPI " +
        (forwardingCycles / 2).toFixed(2) +
        ")  ·  forwarding 없음: " +
        noForwardingCycles +
        " cycles (CPI " +
        (noForwardingCycles / 2).toFixed(2) +
        ")"
    };
  }

  function drawText(ctx, text, x, y, font, color, align) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "middle";
    ctx.fillText(String(text), x, y);
  }

  function drawTimeline(canvas, model, currentCycle) {
    var logicalWidth = 720;
    var headerHeight = 36;
    var rowHeight = 40;
    var left = 184;
    var right = 8;
    var bottom = 8;

    var rowCount = model.rows.length;
    var logicalHeight =
      headerHeight + rowCount * rowHeight + bottom;

    var dpr = Math.max(
      1,
      Number(window.devicePixelRatio) || 1
    );

    canvas.width = Math.round(logicalWidth * dpr);
    canvas.height = Math.round(logicalHeight * dpr);
    var availW =
      canvas.parentElement && canvas.parentElement.clientWidth
        ? canvas.parentElement.clientWidth
        : logicalWidth;
    canvas.style.width =
      availW < logicalWidth ? logicalWidth + "px" : "100%";
    canvas.style.height = "auto";

    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "파이프라인 타이밍 다이어그램. 현재 사이클 C" +
        currentCycle +
        " / " +
        model.totalCycles
    );

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    var cellWidth =
      (logicalWidth - left - right) / model.totalCycles;

    var tableBottom = headerHeight + rowCount * rowHeight;

    var activeColumnX =
      left + (currentCycle - 1) * cellWidth;

    ctx.globalAlpha = 0.42;
    ctx.fillStyle = GRID;
    ctx.fillRect(
      activeColumnX,
      0,
      cellWidth,
      tableBottom
    );
    ctx.globalAlpha = 1;

    drawText(
      ctx,
      "명령어",
      10,
      headerHeight / 2,
      '12px ' + FONT,
      INK
    );

    for (
      var cycle = 1;
      cycle <= model.totalCycles;
      cycle++
    ) {
      var columnX = left + (cycle - 1) * cellWidth;

      drawText(
        ctx,
        "C" + cycle,
        columnX + cellWidth / 2,
        headerHeight / 2,
        '11px ' + FONT,
        INK,
        "center"
      );
    }

    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(logicalWidth, headerHeight);

    for (
      var gridCycle = 0;
      gridCycle <= model.totalCycles;
      gridCycle++
    ) {
      var gridX = left + gridCycle * cellWidth;

      ctx.moveTo(gridX, headerHeight);
      ctx.lineTo(gridX, tableBottom);
    }

    for (var gridRow = 0; gridRow <= rowCount; gridRow++) {
      var gridY = headerHeight + gridRow * rowHeight;

      ctx.moveTo(0, gridY);
      ctx.lineTo(logicalWidth, gridY);
    }

    ctx.stroke();

    var rowIndexes = Object.create(null);

    model.rows.forEach(function (row, rowIndex) {
      rowIndexes[row.id] = rowIndex;

      var rowY = headerHeight + rowIndex * rowHeight;

      ctx.save();
      ctx.beginPath();
      ctx.rect(5, rowY, left - 12, rowHeight);
      ctx.clip();

      drawText(
        ctx,
        row.label,
        10,
        rowY + rowHeight / 2,
        '11px ' + FONT,
        row.valid ? INK : MUTED
      );

      ctx.restore();

      for (
        var cellCycle = 1;
        cellCycle <= model.totalCycles;
        cellCycle++
      ) {
        var cell = row.cells[cellCycle];
        if (!cell) continue;

        var x =
          left + (cellCycle - 1) * cellWidth + 3;
        var y = rowY + 5;
        var w = Math.max(1, cellWidth - 6);
        var h = rowHeight - 10;
        var active = cellCycle === currentCycle;

        ctx.fillStyle =
          cell.type === "bubble" ? GRID : WHITE;
        ctx.fillRect(x, y, w, h);

        if (cell.type === "flush") {
          ctx.strokeStyle = RED;
          ctx.lineWidth = active ? 2.2 : 1.5;
          ctx.strokeRect(x, y, w, h);

          var cx = x + w / 2;
          var cy = y + h / 2 - 3;
          var size = Math.min(7, w * 0.14);

          ctx.strokeStyle = RED;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - size, cy - size);
          ctx.lineTo(cx + size, cy + size);
          ctx.moveTo(cx + size, cy - size);
          ctx.lineTo(cx - size, cy + size);
          ctx.stroke();

          drawText(
            ctx,
            "flush",
            cx,
            y + h - 7,
            '9px ' + FONT,
            RED,
            "center"
          );

          continue;
        }

        ctx.strokeStyle = active ? RED : INK;
        ctx.lineWidth = active ? 2 : 1.2;
        ctx.strokeRect(x, y, w, h);

        if (cell.type === "bubble") {
          drawText(
            ctx,
            "bubble",
            x + w / 2,
            y + h / 2,
            '9px ' + FONT,
            INK,
            "center"
          );
        } else if (cell.type === "stall") {
          drawText(
            ctx,
            cell.stage,
            x + w / 2,
            y + h / 2 - 5,
            '11px ' + FONT,
            INK,
            "center"
          );

          drawText(
            ctx,
            "stall",
            x + w / 2,
            y + h / 2 + 7,
            '9px ' + FONT,
            MUTED,
            "center"
          );
        } else {
          drawText(
            ctx,
            cell.stage,
            x + w / 2,
            y + h / 2,
            '12px ' + FONT,
            INK,
            "center"
          );
        }
      }
    });

    model.arrows.forEach(function (arrow) {
      var fromIndex = rowIndexes[arrow.from.rowId];
      var toIndex = rowIndexes[arrow.to.rowId];

      if (
        fromIndex === undefined ||
        toIndex === undefined
      ) {
        return;
      }

      var fromCell = model.rows[fromIndex].cells[
        arrow.from.cycle
      ];

      var toCell = model.rows[toIndex].cells[
        arrow.to.cycle
      ];

      if (!fromCell || !toCell) return;

      var startX =
        left +
        (arrow.from.cycle - 1) * cellWidth +
        cellWidth * 0.78;

      var startY =
        headerHeight +
        fromIndex * rowHeight +
        rowHeight -
        3;

      var endX =
        left +
        (arrow.to.cycle - 1) * cellWidth +
        cellWidth * 0.22;

      var endY =
        headerHeight + toIndex * rowHeight + 3;

      var angle = Math.atan2(
        endY - startY,
        endX - startX
      );

      var headLength = 6;

      ctx.strokeStyle = RED;
      ctx.fillStyle = RED;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX -
          headLength * Math.cos(angle - Math.PI / 6),
        endY -
          headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX -
          headLength * Math.cos(angle + Math.PI / 6),
        endY -
          headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    });
  }

  function describeCycle(model, cycle) {
    var parts = [];

    STAGES.forEach(function (stage) {
      var events = [];

      model.rows.forEach(function (row) {
        var cell = row.cells[cycle];

        if (!cell || cell.stage !== stage) return;

        if (cell.type === "flush") {
          events.push(row.id + " flush");
        } else if (cell.type === "bubble") {
          events.push("bubble");
        } else if (cell.type === "stall") {
          events.push(row.id + " stall");
        } else {
          events.push(
            row.id + " " + STAGE_ACTIONS[stage]
          );
        }
      });

      parts.push(
        stage + ": " + (events.length ? events.join(" / ") : "—")
      );
    });

    return "현재 C" + cycle + " — " + parts.join(" · ");
  }

  function countCompleted(model, cycle) {
    return model.rows.filter(function (row) {
      return (
        row.valid &&
        typeof row.doneCycle === "number" &&
        row.doneCycle <= cycle
      );
    }).length;
  }

  function mountWidget(el, cfg, kind) {
    if (!el || typeof el.appendChild !== "function") return;

    if (typeof el.__v6pipeCleanup === "function") {
      el.__v6pipeCleanup();
    }

    el.innerHTML = "";

    var state = {
      kind: kind,
      preset: kind === "trace" ? "linear" : "alu",
      forwarding: true,
      cycle: 1,
      playing: false,
      timer: null
    };

    el.__v6pipeCleanup = function () {
      if (state.timer !== null) {
        window.clearInterval(state.timer);
      }

      state.timer = null;
      state.playing = false;
    };

    function stopPlayback() {
      if (state.timer !== null) {
        window.clearInterval(state.timer);
      }

      state.timer = null;
      state.playing = false;
    }

    function getModel() {
      if (state.kind === "trace") {
        return buildTraceModel(state.preset);
      }

      return buildHazardModel(
        state.preset,
        state.forwarding
      );
    }

    var root = createElement("div", "v6pipe-root");

    var defaultTitle =
      kind === "trace"
        ? "파이프라인 5단계 실행 트레이스"
        : "데이터 해저드: stall과 forwarding";

    var titleText =
      cfg && typeof cfg.title === "string" && cfg.title.trim()
        ? cfg.title.trim()
        : defaultTitle;

    root.appendChild(
      createElement("h3", "v6pipe-title", titleText)
    );

    root.appendChild(
      createElement(
        "p",
        "v6pipe-subtitle",
        kind === "trace"
          ? "5-stage pipeline · 사이클 단위 실행 추적"
          : "RAW 의존성 · forwarding 유무에 따른 파이프라인 비교"
      )
    );

    var controls = createElement("div", "v6pipe-controls");
    var presetGroup = createElement(
      "div",
      "v6pipe-control-group"
    );

    presetGroup.setAttribute("role", "group");
    presetGroup.setAttribute(
      "aria-label",
      "실행 프리셋 선택"
    );

    controls.appendChild(presetGroup);

    var linearButton = null;
    var branchButton = null;
    var aluButton = null;
    var loadButton = null;
    var forwardingButton = null;

    if (kind === "trace") {
      linearButton = createButton(
        presetGroup,
        "분기 없음",
        function () {
          stopPlayback();
          state.preset = "linear";
          state.cycle = 1;
          render();
        },
        true
      );

      branchButton = createButton(
        presetGroup,
        "조건 분기",
        function () {
          stopPlayback();
          state.preset = "branch";
          state.cycle = 1;
          render();
        },
        false
      );
    } else {
      aluButton = createButton(
        presetGroup,
        "ALU RAW",
        function () {
          stopPlayback();
          state.preset = "alu";
          state.cycle = 1;
          render();
        },
        true
      );

      loadButton = createButton(
        presetGroup,
        "load-use",
        function () {
          stopPlayback();
          state.preset = "load";
          state.cycle = 1;
          render();
        },
        false
      );

      forwardingButton = createButton(
        presetGroup,
        "forwarding: 있음",
        function () {
          stopPlayback();
          state.forwarding = !state.forwarding;
          state.cycle = 1;
          render();
        },
        true
      );

      forwardingButton.setAttribute(
        "aria-label",
        "forwarding 켜기 또는 끄기"
      );
    }

    var transportGroup = createElement(
      "div",
      "v6pipe-control-group"
    );

    transportGroup.setAttribute("role", "group");
    transportGroup.setAttribute(
      "aria-label",
      "사이클 재생 컨트롤"
    );

    controls.appendChild(transportGroup);

    var previousButton = createButton(
      transportGroup,
      "← 이전",
      function () {
        stopPlayback();
        state.cycle = Math.max(1, state.cycle - 1);
        render();
      }
    );

    var playButton = createButton(
      transportGroup,
      "재생",
      function () {
        if (state.playing) {
          stopPlayback();
          render();
          return;
        }

        var model = getModel();

        if (state.cycle >= model.totalCycles) {
          state.cycle = 1;
        }

        state.playing = true;

        state.timer = window.setInterval(function () {
          var currentModel = getModel();

          if (state.cycle >= currentModel.totalCycles) {
            stopPlayback();
            render();
            return;
          }

          state.cycle += 1;

          if (state.cycle >= currentModel.totalCycles) {
            stopPlayback();
          }

          render();
        }, 1000);

        render();
      },
      false
    );

    var nextButton = createButton(
      transportGroup,
      "다음 →",
      function () {
        stopPlayback();

        var model = getModel();

        state.cycle = Math.min(
          model.totalCycles,
          state.cycle + 1
        );

        render();
      }
    );

    var resetButton = createButton(
      transportGroup,
      "처음으로",
      function () {
        stopPlayback();
        state.cycle = 1;
        render();
      }
    );

    root.appendChild(controls);

    var canvasWrap = createElement(
      "div",
      "v6pipe-canvas-wrap"
    );

    var canvas = createElement(
      "canvas",
      "v6pipe-canvas"
    );

    canvasWrap.appendChild(canvas);
    root.appendChild(canvasWrap);

    var stageLine = createElement(
      "div",
      "v6pipe-stage-line"
    );

    stageLine.setAttribute("aria-live", "polite");
    stageLine.setAttribute("aria-atomic", "true");
    root.appendChild(stageLine);

    var metrics = createElement(
      "div",
      "v6pipe-metrics"
    );

    var cycleValue = createMetric(metrics, "누적 사이클");
    var completedValue = createMetric(
      metrics,
      "완료 명령어"
    );
    var cpiValue = createMetric(metrics, "누적 CPI");

    var wastedValue = null;

    if (kind === "trace") {
      wastedValue = createMetric(
        metrics,
        "오예측 페널티"
      );
    }

    root.appendChild(metrics);

    var comparison = createElement(
      "div",
      "v6pipe-compare"
    );

    if (kind === "trace") {
      comparison.hidden = true;
    }

    root.appendChild(comparison);

    var note = createElement("p", "v6pipe-note");
    root.appendChild(note);

    var legend = createElement("p", "v6pipe-legend");
    root.appendChild(legend);

    var caption = createElement(
      "p",
      "v6pipe-caption",
      kind === "trace"
        ? "분기 예측이 틀리면 이미 가져온 명령어를 버려야 하므로 분기 비용이 커질 수 있습니다. 따라서 조건에 따라 컴파일러는 분기 대신 cmov를 선택할 수 있습니다."
        : "RAW 해저드는 값을 생산하는 명령어와 그 값을 소비하는 명령어 사이의 데이터 의존성 때문에 발생합니다. forwarding은 대기를 줄이지만 load-use에서는 값이 준비되는 시점 때문에 bubble이 남을 수 있습니다."
    );

    root.appendChild(caption);
    el.appendChild(root);

    function renderControls(model) {
      previousButton.disabled = state.cycle <= 1;
      nextButton.disabled =
        state.cycle >= model.totalCycles;

      playButton.textContent = state.playing
        ? "일시정지"
        : "재생";

      setPressed(playButton, state.playing);

      if (kind === "trace") {
        setPressed(
          linearButton,
          state.preset === "linear"
        );

        setPressed(
          branchButton,
          state.preset === "branch"
        );
      } else {
        setPressed(
          aluButton,
          state.preset === "alu"
        );

        setPressed(
          loadButton,
          state.preset === "load"
        );

        forwardingButton.textContent = state.forwarding
          ? "forwarding: 있음"
          : "forwarding: 없음";

        setPressed(
          forwardingButton,
          state.forwarding
        );
      }
    }

    function render() {
      var model = getModel();

      if (state.cycle < 1) state.cycle = 1;

      if (state.cycle > model.totalCycles) {
        state.cycle = model.totalCycles;
      }

      drawTimeline(canvas, model, state.cycle);

      stageLine.textContent = describeCycle(
        model,
        state.cycle
      );

      var completed = countCompleted(
        model,
        state.cycle
      );

      cycleValue.textContent =
        state.cycle + " / " + model.totalCycles;

      completedValue.textContent =
        completed + " / " + model.validCount;

      cpiValue.textContent =
        completed > 0
          ? (state.cycle / completed).toFixed(2)
          : "—";

      if (wastedValue) {
        wastedValue.textContent =
          model.wastedCycles + " cycles";
      }

      if (kind === "hazard") {
        comparison.hidden = false;
        comparison.textContent = model.comparison;
      } else {
        comparison.hidden = state.cycle < model.totalCycles;
        if (!comparison.hidden) {
          comparison.textContent =
            "최종 CPI: " +
            model.totalCycles +
            "/" +
            model.validCount +
            " = " +
            (model.totalCycles / model.validCount).toFixed(2) +
            (state.preset === "branch"
              ? " · 오예측이 없었다면 유효 4개는 8사이클(CPI 2.00)에 완료 → 오예측 페널티는 2사이클"
              : " · 오예측 없이 6개 완료");
        }
      }

      note.textContent = model.detail;
      legend.textContent = model.legend;

      renderControls(model);
    }

    render();
  }

  ensureStyles();

  V6.register("pipe-trace", function (el, cfg) {
    mountWidget(el, cfg, "trace");
  });

  V6.register("pipe-hazard", function (el, cfg) {
    mountWidget(el, cfg, "hazard");
  });
})();
