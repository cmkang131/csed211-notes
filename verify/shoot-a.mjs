// 헤드리스 Chromium(CDP) 으로 demo-a.html 의 위젯 상태별 스크린샷을 찍고 콘솔 오류를 수집한다.
// 사용: node verify/shoot-a.mjs   (외부 패키지 없음: Node 22 내장 WebSocket + /usr/bin/chromium-browser)
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "verify", "screens");
mkdirSync(OUT, { recursive: true });
const PORT = 9333 + Math.floor(Math.random() * 500);
const prof = path.join(process.env.HOME, ".cache", "v6xa-chrome-" + PORT);
const chrome = spawn(process.env.CHROME || "/usr/bin/chromium-browser",
  ["--headless=new", "--remote-debugging-port=" + PORT, "--user-data-dir=" + prof, "--no-first-run",
   "--allow-file-access-from-files", "--hide-scrollbars", "--window-size=880,1000", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver;
for (let i = 0; i < 60; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (ver.find(t => t.type === "page")) break; } catch {} await sleep(250); }
const page = ver.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pend = new Map(); const logs = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  else if (m.method === "Runtime.consoleAPICalled") logs.push(`[console.${m.params.type}] ` + m.params.args.map(a => a.value ?? a.description).join(" "));
  else if (m.method === "Runtime.exceptionThrown") logs.push("[exception] " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  else if (m.method === "Log.entryAdded") logs.push(`[log.${m.params.entry.level}] ${m.params.entry.text} ${m.params.entry.url || ""}`);
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(expr + " → " + JSON.stringify(r.exceptionDetails)); return r.result.value; };
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 880, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "file://" + path.join(ROOT, "demo-a.html") });
await sleep(1500);
await ev(`window.W=i=>document.querySelectorAll('.v6-widget')[i];
window.B=(i,t)=>{const b=[...W(i).querySelectorAll('button')].find(b=>b.textContent.trim()===t);if(!b)throw new Error('no button '+t);b.click();};
window.IN=(i,n,v,enter)=>{const e=W(i).querySelectorAll('input[type=text]')[n];e.value=v;e.dispatchEvent(new Event('change'));if(enter)e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));};
window.RG=(i,n,v)=>{const e=W(i).querySelectorAll('input[type=range]')[n];e.value=v;e.dispatchEvent(new Event('input'));};
window.SEL=(i,v)=>{const e=W(i).querySelector('select');e.value=v;e.dispatchEvent(new Event('change'));};
window.CV=(i,n)=>W(i).querySelectorAll('canvas')[n||0];
true`);
async function hover(i, lx, ly, n = 0) {  // 캔버스 논리 좌표(720 기준)로 합성 mousemove 이벤트 (CDP 마우스는 캡처 시 viewport 변경으로 풀림)
  await ev(`(()=>{const c=CV(${i},${n});const r=c.getBoundingClientRect();c.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.left+${lx}*r.width/720,clientY:r.top+${ly}*r.height/(c.height/2)}));})()`);
}
async function shot(name, i, action, hov) {
  if (action) await ev(action + ";true");
  if (hov) await hover(i, ...hov);
  await sleep(120);
  const r = await ev(`(()=>{const r=W(${i}).getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height};})()`);
  const img = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: r.x - 4, y: r.y - 4, width: r.w + 8, height: r.h + 8, scale: 1 } });
  writeFileSync(path.join(OUT, name + ".png"), Buffer.from(img.data, "base64"));
  if (hov) await ev(`CV(${i},${hov[2] || 0}).dispatchEvent(new MouseEvent('mouseleave'));true`);
  console.log("shot", name, Math.round(r.w) + "x" + Math.round(r.h));
}
// 캔버스 밖 렌더/오버플로 점검: 위젯 내부 요소가 위젯 박스를 가로로 넘는지
async function overflowCheck() {
  return ev(`[...document.querySelectorAll('.v6-widget')].map((w,i)=>{const R=w.getBoundingClientRect();const bad=[...w.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>R.right+1||r.left<R.left-1);}).map(e=>e.tagName+'.'+e.className);return bad.length?i+':'+bad.slice(0,3).join(','):null;}).filter(Boolean)`);
}
const S = [
  ["bitops-1-default-and", 0], ["bitops-2-xor-hoverA3", 0, "B(0,'A ^ B')", [96 + 4 * 42 + 21, 47]],
  ["bitops-3-lnot-w4", 1], ["bitops-4-not-w4", 1, "B(1,'~A')"],
  ["bitops-5-ashr-neg", 2], ["bitops-6-ashr-hoverR7", 2, null, [96 + 21, 199]],
  ["bitops-7-lshr-neg", 2, "B(2,'A >> k 논리')"], ["bitops-8-shl-k3-overflow", 2, "B(2,'A << k');RG(2,0,3)"],
  ["bitops-9-shl-UB-k8", 3], ["bitops-10-ashr-UB-k4-w4", 3, "B(3,'4');B(3,'A >> k 산술');RG(3,0,4)"],
  ["intrep-1-default", 4], ["intrep-2-sext", 4, "B(4,'부호 확장 w→w+4')"],
  ["intrep-3-TMax", 5], ["intrep-4-TMax+1", 5, "B(5,'+1')"], ["intrep-5-trunc", 5, "B(5,'절단 w→4')"],
  ["intrep-6-UMax+1", 5, "B(5,'−1 (= UMax)');B(5,'+1')"], ["intrep-7-w3-TMin", 6], ["intrep-8-w7-sext-pos", 6, "RG(6,0,7);B(6,'TMax');B(6,'부호 확장 w→w+4')"],
  ["float-1-default-one", 7], ["float-2-preset-0.1", 7, "B(7,'0.1')"], ["float-3-maxDenorm", 7, "B(7,'최대 비정규')"],
  ["float-4-nan", 7, "B(7,'NaN')"], ["float-5-negzero", 7, "B(7,'−0')"],
  ["float-6-tie-16777217", 7, "IN(7,0,'16777217',true)"],
  ["float-7-double-rounding", 7, "IN(7,0,'1.0000000596046447753906250000001',true)"],
  ["float-8-neg-0.3", 7, "IN(7,0,'-0.3',true)"], ["float-9-underflow-tie", 7, "IN(7,0,'7.00649232162408535461864791644958065640130970938257885878534141944895541342930300743319094181060791015625e-46',true)"],
  ["float-10-minDenorm-enc", 8], ["float-11-overflow", 9], ["float-12-bad-input", 7, "IN(7,0,'1.2.3',true)"],
  ["float-13-FLT_MAX-print", 7, "IN(7,0,'3.4028235e38',true)"], ["float-14-neg-near-overflow", 7, "IN(7,0,'-3.4028236e38',true)"],
  ["round-1-default", 10], ["round-2-tie-preset3", 11], ["round-3-neg-tie", 12],
  ["round-4-fig237-neg1.5", 10, "SEL(10,'10')"], ["round-5-pp250B", 10, "SEL(10,'5')"], ["round-6-k6-exact", 10, "SEL(10,'1');RG(10,0,6)"],
  ["round-7-custom-input", 10, "IN(10,0,'-0.0110101',true);RG(10,0,3)"],
  ["round-8-wide-k8", 10, "IN(10,0,'-111.111111111',true);RG(10,0,8)"],
  ["round-9-long24", 10, "IN(10,0,'101010101010.101010101010',true);RG(10,0,5)"], ["round-10-too-long", 10, "IN(10,0,'1010101010101.101010101010',true)"],
  ["error-1-bad-json", 13], ["error-2-bad-values", 14], ["error-3-float-bad", 15], ["error-4-round-bad", 16],
];
for (const s of S) await shot(...s);
const ov = await overflowCheck();
const mountState = await ev(`[...document.querySelectorAll('.v6-widget')].map(w=>w.getAttribute('data-v6xa')).join(',')`);
await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }).then(r => writeFileSync(path.join(OUT, "_fullpage.png"), Buffer.from(r.data, "base64")));
const errs = logs;
// 위젯 안에 뜬 오류/경고 줄 (데모의 마지막 4개 위젯 = 의도된 잘못된 config 예시)
const errLines = await ev(`[...document.querySelectorAll('.v6-widget')].flatMap((w,i)=>[...w.querySelectorAll('.v6xa-err')].map(e=>i+': '+e.textContent))`);
const nW = await ev(`document.querySelectorAll('.v6-widget').length`);
const unexpectedErr = errLines.filter(l => parseInt(l) < nW - 4);
const report = [`screens: ${S.length}`, `mount states: ${mountState}`, `horizontal overflow: ${ov.length ? ov.join(" | ") : "none"}`,
  `console/exception messages (all): ${logs.length}`, ...logs.map(l => "  " + l),
  `in-widget error/warning lines: ${errLines.length}`, ...errLines.map(l => "  " + l),
  `unexpected in-widget errors (outside the 4 intentional bad-config widgets): ${unexpectedErr.length}`,
  `console errors/warnings/exceptions: ${errs.length}`].join("\n");
console.log(report);
writeFileSync(path.join(ROOT, "verify", "shoot-a.log"), report + "\n");
ws.close(); chrome.kill();
