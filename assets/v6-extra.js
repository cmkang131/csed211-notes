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
/* v6-extra-a.js — CSED211 Lec2(정수)·Lec3(부동소수점) 인터랙티브 위젯 4종.
   assets/v6.js 다음에 로드한다. 파일 전체가 IIFE 하나이며 V6.register 로 위젯을 등록한다.
   계산 코어(V6XA)는 DOM과 분리돼 있고, 브라우저에서는 window.V6XA, node에서는 module.exports 로 노출된다
   (verify/ 스크립트가 이 코어를 독립 구현과 교차 비교한다).

   ── 마크업 ─────────────────────────────────────────────────────────────
   <div class="v6-widget" data-widget="이름" data-config='{"...":...}'></div>
   모든 config 키는 생략 가능하다. 잘못된 값(NaN, 범위 밖, 형식 오류)은 기본값으로 바꾸고 위젯 아래에
   한 줄 경고를 띄운다. data-config JSON 자체가 깨졌으면 위젯 자리에 한 줄 오류 메시지를 띄운다.

   1) bit-ops — w비트 정수 A, B의 비트 연산
      title  : 제목 문자열
      w      : 4 | 8                         (기본 8)
      A, B   : 정수 또는 "0x..", "0b..", 10진 문자열. 음수는 w비트 2의 보수로 해석 (기본 A=0xB4, B=0x5C)
      op     : "not" | "lnot" | "and" | "or" | "xor" | "shl" | "lshr" | "ashr"   (기본 "and")
      k      : 시프트 양 0..w                (기본 2)
   2) int-rep — 같은 비트열의 B2U / B2T 해석
      title, w : 3..8 (기본 4), x : 비트 패턴(정수/"0x"/"0b", 기본 0b1011)
   3) float-lab — IEEE 754 binary32 디코더/인코더
      title, bits : 32비트 패턴 "0x3DCCCCCD" 또는 "0b..."(32자리) 또는 정수 (기본 0x3F800000 = 1.0)
      preset : 프리셋 이름 ("+0","-0","minDenorm","maxDenorm","minNorm","one","0.1","maxFinite","+inf","nan")
               — bits보다 우선
      input  : 인코더 입력창 초기 10진 문자열 (기본 "0.1"; 지정하면 시작 시 인코딩 결과도 표시)
   4) fp-round — 이진 소수를 소수점 아래 k비트로 반올림하는 네 가지 모드
      title, value : 이진 소수 문자열 "10.00110", "-1.101" (기본 "10.00110")
      k     : 0..8 (기본 2)
      preset: 프리셋 번호(0부터; value/k보다 우선)
*/
(function(){
"use strict";

/* ===================================================================== */
/*  계산 코어 (DOM 없음)                                                   */
/* ===================================================================== */
function mask(w){return (1<<w)-1;}                 /* w ≤ 16 에서만 사용 */
function bit(x,i){return (x>>i)&1;}
function b2u(x,w){var v=0;for(var i=0;i<w;i++)v+=bit(x,i)*Math.pow(2,i);return v;}
function b2t(x,w){var v=-bit(x,w-1)*Math.pow(2,w-1);for(var i=0;i<w-1;i++)v+=bit(x,i)*Math.pow(2,i);return v;}
/* 값(음수 허용) → w비트 패턴 */
function toPattern(v,w){var m=Math.pow(2,w);return ((v%m)+m)%m;}
function hex(x,w){var d=Math.ceil(w/4),s=x.toString(16).toUpperCase();while(s.length<d)s="0"+s;return "0x"+s;}
function binStrW(x,w){var s="";for(var i=w-1;i>=0;i--)s+=bit(x,i);return s;}

/* 비트 연산. src[i] = {from:[["A",j],...], fill:null|0|1, sign:bool}
   k===w 이면 C에서 UB이므로 ub=true, r 은 "비트를 끝까지 밀어낸" 수학적 연장값. */
function bitop(op,a,b,k,w){
  var r=0,src=[],i,ub=false,m=mask(w),sa=bit(a,w-1);
  a&=m;b&=m;
  if(op==="shl"||op==="lshr"||op==="ashr"){ if(k>=w||k<0)ub=true; k=Math.max(0,Math.min(k,w)); }
  for(i=0;i<w;i++){
    var s={from:[],fill:null,sign:false},v=0;
    switch(op){
      case "not": v=1-bit(a,i);s.from=[["A",i]];break;
      case "and": v=bit(a,i)&bit(b,i);s.from=[["A",i],["B",i]];break;
      case "or":  v=bit(a,i)|bit(b,i);s.from=[["A",i],["B",i]];break;
      case "xor": v=bit(a,i)^bit(b,i);s.from=[["A",i],["B",i]];break;
      case "lnot":
        if(i===0){v=a===0?1:0;for(var j=0;j<w;j++)s.from.push(["A",j]);}
        else{v=0;s.fill=0;}
        break;
      case "shl":
        if(i-k>=0){v=bit(a,i-k);s.from=[["A",i-k]];}else{v=0;s.fill=0;}
        break;
      case "lshr":
        if(i+k<w){v=bit(a,i+k);s.from=[["A",i+k]];}else{v=0;s.fill=0;}
        break;
      case "ashr":
        if(i+k<w){v=bit(a,i+k);s.from=[["A",i+k]];}else{v=sa;s.fill=sa;s.sign=true;s.from=[["A",w-1]];}
        break;
      default: throw new Error("알 수 없는 연산: "+op);
    }
    r|=v<<i;src.push(s);
  }
  return {r:r,ub:ub,src:src};
}
/* +1 : carries 는 위치 i 로 "들어가는" 캐리의 비트마스크 (i=0 은 +1 자체) */
function inc(x,w){
  var c=1,r=0,carries=0;
  for(var i=0;i<w;i++){ if(c)carries|=1<<i; var s=bit(x,i)+c; r|=(s&1)<<i; c=s>>1; }
  return {r:r,carryOut:c,carries:carries,uWrap:c===1,tOverflow:b2t(x,w)===Math.pow(2,w-1)-1};
}
function sext(x,w,w2){var s=bit(x,w-1),r=x&mask(w);for(var i=w;i<w2;i++)r|=s<<i;return r;}
function trunc(x,w,k){return x&mask(k);}

/* ---------- BigInt 유리수 ---------- */
var B0=BigInt(0),B1=BigInt(1),B2=BigInt(2),B5=BigInt(5),B10=BigInt(10);
function babs(a){return a<B0?-a:a;}
function bgcd(a,b){a=babs(a);b=babs(b);while(b){var t=a%b;a=b;b=t;}return a;}
function rat(n,d){ if(d===B0)throw new Error("0으로 나눔"); if(d<B0){n=-n;d=-d;} var g=bgcd(n,d); if(g>B1){n/=g;d/=g;} return {num:n,den:d}; }
function pow2(k){return B1<<BigInt(k);}
function blen(a){return a===B0?0:a.toString(2).length;}  /* a>0 의 비트 길이 */
/* 정확한 10진 전개. 분모가 2^a·5^b 꼴이면 exact=true, 아니면 maxFrac 자리에서 자르고 exact=false */
function ratToDecimal(num,den,maxFrac){
  var r=rat(num,den),neg=r.num<B0,n=babs(r.num),d=r.den,a=0,b=0,t=d;
  while(t%B2===B0){t/=B2;a++;} while(t%B5===B0){t/=B5;b++;}
  var exact=(t===B1),k=exact?Math.max(a,b):(maxFrac||60);
  var scaled=n*(B10**BigInt(k)), q=scaled/d, rem=scaled%d;
  var s=q.toString();
  if(k>0){ while(s.length<=k)s="0"+s; s=s.slice(0,s.length-k)+"."+s.slice(s.length-k); s=s.replace(/0+$/,"").replace(/\.$/,""); }
  if(neg&&(q!==B0||rem!==B0))s="-"+s;
  return {str:s,exact:exact&&rem===B0};
}
/* 정확한 10진값을 과학 표기로: "1.40129…(전부)×10^-45" 형태의 {mant, exp} */
function ratToSci(num,den){
  var d=ratToDecimal(num,den),s=d.str,neg=s[0]==="-";if(neg)s=s.slice(1);
  if(/^0(\.0*)?$/.test(s))return {mant:(neg?"-":"")+"0",exp:0,digits:1,exact:d.exact};
  var ip=s.split(".")[0],fp=s.split(".")[1]||"",all=ip+fp,lead=all.search(/[1-9]/);
  var exp=ip.length-1-lead,dg=all.slice(lead).replace(/0+$/,"");
  return {mant:(neg?"-":"")+dg[0]+(dg.length>1?"."+dg.slice(1):""),exp:exp,digits:dg.length,exact:d.exact};
}

/* ---------- binary32 ---------- */
function f32Decode(u){
  u=u>>>0;
  var s=u>>>31,e=(u>>>23)&255,f=u&0x7FFFFF,o={s:s,e:e,f:f,bits:u};
  if(e===255){o.cls=f===0?"inf":"nan";return o;}
  if(e===0){ o.cls=f===0?"zero":"denormal"; o.E=1-127; o.Mnum=BigInt(f); }
  else { o.cls="normal"; o.E=e-127; o.Mnum=BigInt(f)+pow2(23); }
  /* 값 = (-1)^s × (Mnum/2^23) × 2^E = (-1)^s × Mnum × 2^(E-23) */
  var p=o.E-23,n=o.Mnum*(p>=0?pow2(p):B1),d=p>=0?B1:pow2(-p);
  var r=rat(s?-n:n,d); o.num=r.num; o.den=r.den;
  return o;
}
/* 10진 문자열 → 정확한 유리수. "0.1", "-1.5e-3", "1E-45", ".5", "5.", "+0", "-0", "inf", "-infinity", "nan" */
function parseDecimal(str){
  if(typeof str!=="string")return null;
  var t=str.trim().replace(/_/g,"").replace(/−/g,"-");
  var sp=/^([+-]?)(inf|infinity|∞)$/i.exec(t);
  if(sp)return {special:"inf",neg:sp[1]==="-"};
  if(/^[+-]?nan$/i.test(t))return {special:"nan",neg:t[0]==="-"};
  var m=/^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(t);
  if(!m||(m[2]===""&&(m[3]===undefined||m[3]==="")))return null;
  var ip=m[2]||"",fp=m[3]||"",ex=m[4]?parseInt(m[4],10):0;
  if(Math.abs(ex)>100000)return null;          /* 터무니없는 지수는 거부 (BigInt 폭주 방지) */
  var digits=(ip+fp).replace(/^0+/,"")||"0",sc=ex-fp.length;
  var num=BigInt(digits),den=B1;
  if(sc>=0)num*=B10**BigInt(sc);else den=B10**BigInt(-sc);
  var r=rat(num,den);
  return {neg:m[1]==="-",num:r.num,den:r.den};
}
/* 양의 유리수 p/q (>0) 를 RNE 로 binary32 크기 비트(부호 제외)로. 오버플로 → 0x7F800000 */
function f32RoundMag(p,q){
  /* E = floor(log2(p/q)) */
  var E=blen(p)-blen(q);
  if(E>=0){ if(p<(q<<BigInt(E)))E--; } else { if((p<<BigInt(-E))<q)E--; }
  if(E>127)return {bits:0x7F800000,ovf:true};
  var Q=(E< -126)?-149:E-23;                 /* 양자(ulp) = 2^Q */
  var nn=p,dd=q; if(Q<0)nn=p<<BigInt(-Q); else dd=q<<BigInt(Q);
  var n=nn/dd,rem=nn-n*dd,twice=rem*B2;
  var dir="exact";
  if(rem!==B0){
    if(twice>dd||(twice===dd&&(n&B1)===B1)){n+=B1;dir="up";} else dir="down";
    if(twice===dd)dir+="-tie";
  }
  var bits;
  if(Q===-149)bits=Number(n);                         /* 비정규(→ n=2^23 이면 최소 정규로 자연스럽게 넘어감) */
  else bits=((E+127)*0x800000)+Number(n)-0x800000;    /* 정규 (n=2^24 이면 지수 +1 로 넘어감) */
  if(bits>=0x7F800000)return {bits:0x7F800000,ovf:true,dir:dir};
  return {bits:bits,ovf:false,dir:dir};
}
/* 10진 문자열 → binary32 (round-to-nearest-even), 오차까지 정확히 */
function f32Encode(str){
  var p=parseDecimal(str);
  if(!p)return {error:"10진수로 읽을 수 없는 입력입니다 (예: 0.1, -2.5e-3, 1e-45, inf, nan)"};
  if(p.special==="nan")return {bits:0x7FC00000,cls:"nan",special:true};
  if(p.special==="inf")return {bits:(p.neg?0x80000000:0)+0x7F800000,cls:"inf",special:true,neg:p.neg};
  var sgn=p.neg?0x80000000:0,o={neg:p.neg,exact:{num:p.neg?-p.num:p.num,den:p.den}};
  if(p.num===B0){o.bits=sgn;o.dir="exact";}
  else{ var r=f32RoundMag(p.num,p.den); o.bits=sgn+r.bits; o.ovf=r.ovf; o.dir=r.ovf?"overflow":r.dir; }
  o.bits=o.bits>>>0;
  var d=f32Decode(o.bits); o.cls=d.cls;
  if(d.cls!=="inf"){
    o.value={num:d.num,den:d.den};
    var e=rat(d.num*o.exact.den-o.exact.num*d.den,d.den*o.exact.den); o.err=e;
    /* 입력을 감싸는 두 이웃 float(크기 기준) */
    var mag=o.bits&0x7FFFFFFF, cmp=babs(d.num)*p.den-p.num*d.den; /* |float| - |x| */
    if(cmp===B0){o.lo=mag;o.hi=mag;}
    else if(cmp>B0){o.hi=mag;o.lo=mag-1;}
    else{o.lo=mag;o.hi=mag+1;}
    o.lo=(o.lo+sgn)>>>0;o.hi=(o.hi+sgn)>>>0;
  }
  return o;
}

/* ---------- 이진 소수 & 반올림 ---------- */
/* "10.0110", "-1.101", "0b1.1", "11", ".01" → {num, den=2^m, m} */
function parseBinary(str){
  if(typeof str!=="string")return null;
  var t=str.trim().replace(/[_\s]/g,"").replace(/−/g,"-").replace(/₂$/,"");
  var m=/^([+-]?)(?:0b)?([01]*)(?:\.([01]*))?$/i.exec(t);
  if(!m||((m[2]||"")===""&&(m[3]||"")===""))return null;
  var ip=m[2]||"",fp=m[3]||"";
  if(fp.length>40||ip.length>40)return null;
  var n=BigInt("0b"+((ip+fp)||"0"));
  return {num:m[1]==="-"?-n:n,den:pow2(fp.length),m:fp.length,neg:m[1]==="-"};
}
/* floor/ceil 나눗셈 (BigInt, d>0) */
function fdiv(n,d){var q=n/d;if((n%d!==B0)&&(n<B0))q-=B1;return q;}
/* num/den 을 2^-k 의 배수로 반올림. 결과 {num, den=2^k} (정수 분자 n: 값 = n/2^k) */
function roundBin(num,den,k,mode){
  var D=pow2(k),sn=num*D,lo=fdiv(sn,den),rem=sn-lo*den,n;  /* x·2^k = lo + rem/den, 0≤rem<den */
  if(rem===B0)n=lo;
  else switch(mode){
    case "down": n=lo;break;
    case "up": n=lo+B1;break;
    case "zero": n=(num<B0)?lo+B1:lo;break;
    case "even": var t=rem*B2; n=(t<den)?lo:(t>den)?lo+B1:((lo&B1)===B0?lo:lo+B1);break;
    default: throw new Error("알 수 없는 모드: "+mode);
  }
  return {num:n,den:D};
}
function roundInfo(num,den,k){
  var D=pow2(k),sn=num*D,lo=fdiv(sn,den),rem=sn-lo*den;
  var o={lo:lo,hi:rem===B0?lo:lo+B1,D:D,exact:rem===B0,halfway:rem*B2===den,above:rem*B2>den};
  ["even","zero","up","down"].forEach(function(md){o[md]=roundBin(num,den,k,md).num;});
  return o;
}
/* n/2^k 를 이진 문자열로 (소수점 아래 정확히 k자리) */
function fixBin(n,k){
  var neg=n<B0,a=babs(n),s=a.toString(2);
  while(s.length<=k)s="0"+s;
  var r=k>0?s.slice(0,s.length-k)+"."+s.slice(s.length-k):s;
  return (neg?"-":"")+r;
}

var core={b2u:b2u,b2t:b2t,toPattern:toPattern,hex:hex,binStrW:binStrW,bitop:bitop,inc:inc,sext:sext,trunc:trunc,
  rat:rat,ratToDecimal:ratToDecimal,ratToSci:ratToSci,f32Decode:f32Decode,parseDecimal:parseDecimal,
  f32RoundMag:f32RoundMag,f32Encode:f32Encode,parseBinary:parseBinary,roundBin:roundBin,roundInfo:roundInfo,fixBin:fixBin};
if(typeof module!=="undefined"&&module.exports)module.exports=core;
if(typeof window==="undefined")return;
window.V6XA=core;

var V6XA_core=core;
/* ===================================================================== */
/*  공통 UI 헬퍼                                                          */
/* ===================================================================== */
var NAMES=["bit-ops","int-rep","float-lab","fp-round"];
var V=window.V6;
var INK=V?V.INK:"#1a1a1a",RED=V?V.RED:"#9e2b25",GRID=V?V.GRID:"#e8e6e0",DIM="#a29e96",SOFT="#cfcbc2";
var SANS="'Noto Sans KR','Noto Sans CJK KR',sans-serif";
var MONO="ui-monospace,'SFMono-Regular',Menlo,Consolas,'DejaVu Sans Mono','Noto Sans KR',monospace";
var SUP={"-":"⁻","0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹"};
var SUB={"0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉"};
function sup(n){return String(n).split("").map(function(c){return SUP[c]||c;}).join("");}
function sub(n){return String(n).split("").map(function(c){return SUB[c]||c;}).join("");}
function mns(n){return String(n).replace(/-/g,"−");}               /* 표시용 마이너스 */
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];});}
function mk(tag,cls,txt,parent){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;if(parent)parent.appendChild(e);return e;}
function btn(txt,parent,fn,tip){var b=mk("button","v6-btn",txt,parent);b.type="button";if(tip)b.title=tip;b.onclick=fn;return b;}
function setActive(list,on){list.forEach(function(b){var a=(b===on);b.style.background=a?INK:"#fff";b.style.color=a?"#fff":INK;b.setAttribute("aria-pressed",a?"true":"false");});}
function errLine(msg){var d=document.createElement("div");d.className="v6xa-err";d.style.cssText="color:"+RED+";font-size:12.5px;margin:6px 0;font-family:"+SANS;d.textContent=msg;return d;}
/* 고해상도 캔버스: 논리 좌표 720×h, 실제 픽셀 2배 */
function hiCanvas(el,h){
  var c=V.canvas(el,h);c.width=1440;c.height=2*h;
  var ctx=c.getContext("2d");ctx.setTransform(2,0,0,2,0,0);
  return {c:c,ctx:ctx,W:720,H:h,
    pos:function(ev){var r=c.getBoundingClientRect();return {x:(ev.clientX-r.left)*720/r.width,y:(ev.clientY-r.top)*h/r.height};},
    clear:function(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.setTransform(2,0,0,2,0,0);ctx.setLineDash([]);ctx.textAlign="left";ctx.textBaseline="alphabetic";}};
}
function font(ctx,px,mono,bold){ctx.font=(bold?"700 ":"")+px+"px "+(mono?MONO:SANS);}
function text(ctx,s,x,y,o){o=o||{};ctx.fillStyle=o.color||INK;font(ctx,o.size||12,o.mono,o.bold);ctx.textAlign=o.align||"left";ctx.textBaseline=o.base||"middle";ctx.fillText(s,x,y);}
/* 최대 폭 maxW 안에 들어가도록 글자 크기를 줄여 그림 */
function fitText(ctx,s,x,y,maxW,o){o=o||{};var sz=o.size||12;font(ctx,sz,o.mono,o.bold);
  while(sz>8&&ctx.measureText(s).width>maxW){sz-=0.5;font(ctx,sz,o.mono,o.bold);}
  var oo={};for(var k in o)oo[k]=o[k];oo.size=sz;text(ctx,s,x,y,oo);}
function line(ctx,x1,y1,x2,y2,o){o=o||{};ctx.strokeStyle=o.color||INK;ctx.lineWidth=o.lw||1.2;ctx.setLineDash(o.dash||[]);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);}
function box(ctx,x,y,w,h,o){o=o||{};if(o.fill){ctx.fillStyle=o.fill;ctx.fillRect(x,y,w,h);}ctx.strokeStyle=o.color||INK;ctx.lineWidth=o.lw||1.2;ctx.setLineDash(o.dash||[]);ctx.strokeRect(x+.5,y+.5,w-1,h-1);ctx.setLineDash([]);}
function arrowHead(ctx,x,y,ang,color,sz){sz=sz||6;ctx.fillStyle=color||INK;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-sz*Math.cos(ang-0.4),y-sz*Math.sin(ang-0.4));ctx.lineTo(x-sz*Math.cos(ang+0.4),y-sz*Math.sin(ang+0.4));ctx.closePath();ctx.fill();}
/* 정수 config 값: number | "0x.." | "0b.." | "-12" → Number 또는 NaN */
function parseIntLike(v){
  if(typeof v==="number")return (isFinite(v)&&Math.floor(v)===v)?v:NaN;
  if(typeof v!=="string")return NaN;
  var t=v.trim().replace(/_/g,"").replace(/−/g,"-"),neg=false;
  if(t[0]==="-"||t[0]==="+"){neg=t[0]==="-";t=t.slice(1);}
  var n;
  if(/^0x[0-9a-f]+$/i.test(t))n=parseInt(t.slice(2),16);
  else if(/^0b[01]+$/i.test(t))n=parseInt(t.slice(2),2);
  else if(/^\d+$/.test(t))n=parseInt(t,10);
  else return NaN;
  return neg?-n:n;
}
/* 위젯 등록 래퍼: 마운트 표시 + 위젯 단위 try/catch */
function fail(el,e){
  try{ el.querySelectorAll(".v6xa-err").forEach(function(n){n.remove();}); }catch(_){}
  el.appendChild(errLine("위젯을 표시할 수 없습니다 — "+((e&&e.message)||e)));
  if(window.console)console.warn("[v6-extra-a]",e);
}
function guard(el,fn){return function(){try{return fn.apply(this,arguments);}catch(e){fail(el,e);}};}
var MOUNT={};
function reg(name,fn){
  var m=function(el,cfg){
    el.setAttribute("data-v6xa","mounted");
    if(!cfg||typeof cfg!=="object"||Array.isArray(cfg))cfg={};
    try{fn(el,cfg);}catch(e){fail(el,e);}
  };
  MOUNT[name]=m; if(V)V.register(name,m);
}
/* config 경고 모음 → 위젯 하단 한 줄 */
function Warn(){var list=[];return {add:function(s){list.push(s);},show:function(el){if(list.length)el.appendChild(errLine("config 경고: "+list.join(" / ")+" → 기본값 사용"));}};}
/* ===================================================================== */
/*  1) bit-ops                                                           */
/* ===================================================================== */
var OPS=[
  {id:"not",lab:"~A",tip:"bitwise NOT (비트별 부정)"},
  {id:"lnot",lab:"!A",tip:"logical NOT (논리 부정)"},
  {id:"and",lab:"A & B",tip:"bitwise AND"},
  {id:"or",lab:"A | B",tip:"bitwise OR"},
  {id:"xor",lab:"A ^ B",tip:"bitwise XOR"},
  {id:"shl",lab:"A << k",tip:"left shift (왼쪽 시프트)"},
  {id:"lshr",lab:"A >> k 논리",tip:"logical right shift (논리 오른쪽 시프트)"},
  {id:"ashr",lab:"A >> k 산술",tip:"arithmetic right shift (산술 오른쪽 시프트)"}];
function opById(id){for(var i=0;i<OPS.length;i++)if(OPS[i].id===id)return OPS[i];return null;}
function binaryOp(id){return id==="and"||id==="or"||id==="xor";}
function shiftOp(id){return id==="shl"||id==="lshr"||id==="ashr";}

reg("bit-ops",function(el,cfg){
  var warn=Warn(),C=V6XA_core;
  var w=parseIntLike(cfg.w==null?8:cfg.w); if(w!==4&&w!==8){warn.add("w는 4 또는 8");w=8;}
  function initVal(key,def){
    if(cfg[key]==null)return def;
    var v=parseIntLike(cfg[key]);
    if(isNaN(v)||v< -Math.pow(2,w-1)||v>=Math.pow(2,w)){warn.add(key+"="+JSON.stringify(cfg[key])+"는 "+w+"비트 범위 밖/형식 오류");return def;}
    return C.toPattern(v,w);
  }
  var A=initVal("A",w===8?0xB4:0xB),B=initVal("B",w===8?0x5C:0x6);
  var op=cfg.op==null?"and":cfg.op; if(!opById(op)){warn.add("op 이름 오류");op="and";}
  var k=parseIntLike(cfg.k==null?2:cfg.k); if(isNaN(k)||k<0||k>w){warn.add("k는 0.."+w);k=Math.min(2,w);}
  var hover=null; /* {row:"A"|"B"|"R", i} */

  V.title(el,cfg.title||"비트 연산 — bitwise vs logical, 논리 vs 산술 시프트");
  var H=262,cv=hiCanvas(el,H),ctx=cv.ctx;
  var X0=96,CW=42,Y={idx:20,A:30,B:78,R:182},CH=34,COL={hex:470,u:556,s:640};
  function cx(i){return X0+(w-1-i)*CW+CW/2;}   /* 비트 i 의 중심 x */
  var state=mk("div","v6-state",null,el);
  /* 컨트롤 */
  var c1=mk("div","v6-controls",null,el);
  mk("span",null,"비트 폭 w:",c1);
  var wBtns=[4,8].map(function(v){return btn(String(v),c1,guard(el,function(){setW(v);}),v+"비트");});
  var lA=mk("label",null,"A =",c1),inA=mk("input",null,null,lA);inA.type="text";inA.size=7;inA.title="10진, 0x.., 0b.. 입력 후 Enter";
  var lB=mk("label",null,"B =",c1),inB=mk("input",null,null,lB);inB.type="text";inB.size=7;inB.title=inA.title;
  var c2=mk("div","v6-controls",null,el);mk("span",null,"연산:",c2);
  var opBtns=OPS.map(function(o){var b=btn(o.lab,c2,guard(el,function(){op=o.id;draw();}),o.tip);b.dataset.op=o.id;return b;});
  var c3=mk("div","v6-controls",null,el);
  var lk=mk("label",null,"시프트 양 k",c3),rk=mk("input",null,null,lk);rk.type="range";rk.min=0;rk.step=1;
  var vk=mk("span","v6-val",null,lk);
  rk.oninput=guard(el,function(){k=parseInt(rk.value,10);draw();});
  mk("span",null,"(비트 칸을 클릭해 0/1을 바꾸고, 결과 칸에 마우스를 올리면 그 비트가 어디서 왔는지 보입니다)",c3).style.color="#555";
  warn.show(el);

  function setW(v){
    if(v===w)return;
    /* 값(signed) 보존 시도: 8→4 는 하위 4비트로 절단 */
    A=C.toPattern(C.b2t(A,w),v)&((1<<v)-1);B=C.toPattern(C.b2t(B,w),v)&((1<<v)-1);
    w=v;k=Math.min(k,w);draw();
  }
  function commit(inp,which){
    var v=parseIntLike(inp.value);
    if(isNaN(v)||v< -Math.pow(2,w-1)||v>=Math.pow(2,w)){inp.style.outline="1.5px solid "+RED;return;}
    inp.style.outline="";
    if(which==="A")A=C.toPattern(v,w);else B=C.toPattern(v,w);draw();
  }
  inA.onchange=guard(el,function(){commit(inA,"A");});inB.onchange=guard(el,function(){commit(inB,"B");});

  function hit(p){
    for(var i=0;i<w;i++){var x0=cx(i)-CW/2;
      if(p.x>=x0&&p.x<x0+CW){
        if(p.y>=Y.A&&p.y<Y.A+CH)return {row:"A",i:i};
        if(binaryOp(op)&&p.y>=Y.B&&p.y<Y.B+CH)return {row:"B",i:i};
        if(p.y>=Y.R&&p.y<Y.R+CH)return {row:"R",i:i};
      }}
    return null;
  }
  cv.c.addEventListener("click",guard(el,function(ev){var h=hit(cv.pos(ev));if(!h)return;
    if(h.row==="A")A^=1<<h.i;else if(h.row==="B")B^=1<<h.i;else return;draw();}));
  cv.c.addEventListener("mousemove",guard(el,function(ev){var h=hit(cv.pos(ev));
    cv.c.style.cursor=(h&&h.row!=="R")?"pointer":"default";
    var key=h?h.row+h.i:"",old=hover?hover.row+hover.i:"";if(key!==old){hover=h;draw();}}));
  cv.c.addEventListener("mouseleave",guard(el,function(){if(hover){hover=null;draw();}}));

  function valCols(x,y,col){
    text(ctx,C.hex(x,w),COL.hex,y,{mono:true,size:13,color:col});
    text(ctx,String(C.b2u(x,w)),COL.u,y,{mono:true,size:13,color:col});
    text(ctx,mns(C.b2t(x,w)),COL.s,y,{mono:true,size:13,color:col});
  }
  function bitRow(x,y,label,opt){
    opt=opt||{};
    text(ctx,label,12,y+CH/2,{bold:true,size:13,color:opt.dim?DIM:INK});
    for(var i=0;i<w;i++){
      var x0=cx(i)-CW/2,st=(opt.style&&opt.style(i))||{};
      box(ctx,x0,y,CW,CH,{color:st.color||(opt.dim?SOFT:INK),lw:st.lw||1.2,dash:st.dash,fill:st.fill});
      text(ctx,st.txt!=null?st.txt:String((x>>i)&1),cx(i),y+CH/2+1,{mono:true,size:17,bold:!opt.dim,align:"center",color:st.tcolor||(opt.dim?DIM:INK)});
    }
    if(w===8)line(ctx,cx(3)+CW/2,y-3,cx(3)+CW/2,y+CH+3,{lw:2.4,color:opt.dim?SOFT:INK}); /* 니블 경계 */
  }
  function draw(){
    var res=C.bitop(op,A,B,k,w),un=!binaryOp(op),sh=shiftOp(op);
    cv.clear();
    /* 헤더 */
    for(var i=0;i<w;i++)text(ctx,String(i),cx(i),Y.idx-6,{size:10.5,align:"center",color:DIM});
    text(ctx,"bit",12,Y.idx-6,{size:10.5,color:DIM});
    text(ctx,"hex",COL.hex,Y.idx-6,{size:11,color:"#555"});
    text(ctx,"unsigned",COL.u,Y.idx-6,{size:11,color:"#555"});
    text(ctx,"signed",COL.s,Y.idx-6,{size:11,color:"#555"});
    /* 하이라이트 대상 */
    var hiR={},hiA={},hiB={};
    if(hover){
      if(hover.row==="R"){hiR[hover.i]=1;res.src[hover.i].from.forEach(function(f){(f[0]==="A"?hiA:hiB)[f[1]]=1;});}
      else{ (hover.row==="A"?hiA:hiB)[hover.i]=1;
        res.src.forEach(function(s,ri){s.from.forEach(function(f){if(f[0]===hover.row&&f[1]===hover.i)hiR[ri]=1;});}); }
    }
    /* A가 버려지는 비트 */
    var used={};res.src.forEach(function(s){s.from.forEach(function(f){if(f[0]==="A")used[f[1]]=1;});});
    bitRow(A,Y.A,"A",{style:function(i){return hiA[i]?{color:RED,lw:2.4}:null;}});
    valCols(A,Y.A+CH/2,INK);
    if(un){
      text(ctx,"B",12,Y.B+CH/2,{bold:true,size:13,color:SOFT});
      text(ctx,"(단항 연산 — B 사용 안 함)",COL.hex,Y.B+CH/2,{size:11,color:DIM});
    } else {
      bitRow(B,Y.B,"B",{style:function(i){return hiB[i]?{color:RED,lw:2.4}:null;}});
      valCols(B,Y.B+CH/2,INK);
    }
    /* 연결선 */
    var top=un?Y.A+CH:Y.B+CH,bot=Y.R;
    res.src.forEach(function(s,ri){
      var hl=!!hiR[ri],col=hl?RED:(s.sign?RED:SOFT),lw=hl?2:(s.sign?1.4:1.1);
      s.from.forEach(function(f){
        if(binaryOp(op)){ if(f[0]==="B")line(ctx,cx(f[1]),top,cx(ri),bot,{color:col,lw:lw});
          else line(ctx,cx(f[1]),Y.A+CH,cx(f[1]),Y.B,{color:col,lw:lw}); }
        else { line(ctx,cx(f[1]),top+2,cx(ri),bot-2,{color:col,lw:lw,dash:s.sign&&!hl?[4,3]:null}); arrowHead(ctx,cx(ri),bot-2,Math.atan2(bot-top-4,cx(ri)-cx(f[1])),col,5);}
      });
    });
    /* 밀려나 버려지는 A 비트 표시 */
    if(sh&&k>0) for(var j=0;j<w;j++) if(!used[j]){
      var yy=Y.A+CH+9;line(ctx,cx(j)-5,yy-4,cx(j)+5,yy+4,{color:RED,lw:1.5});line(ctx,cx(j)-5,yy+4,cx(j)+5,yy-4,{color:RED,lw:1.5});
    }
    if(sh&&k>0){var dl=[];for(j=0;j<w;j++)if(!used[j])dl.push(j);
      if(dl.length){var xm=(cx(dl[0])+cx(dl[dl.length-1]))/2;text(ctx,"× 밀려나 버려짐",xm,Y.A+CH+22,{size:10.5,color:RED,align:"center"});}}
    /* 결과 행 */
    var lab="= "+opById(op).lab.replace(" 논리","").replace(" 산술","");
    bitRow(res.r,Y.R,"",{style:function(i){
      var s=res.src[i],st={};
      if(res.ub)st.dash=[4,3];
      if(s.fill!==null&&op!=="lnot"){st.color=RED;st.tcolor=RED;st.lw=1.8;}
      if(hiR[i]){st.color=RED;st.lw=2.4;}
      return st;}});
    text(ctx,lab,12,Y.R+CH/2,{bold:true,size:13});
    if(res.ub){ text(ctx,"?",COL.hex,Y.R+CH/2,{mono:true,size:13,color:RED});text(ctx,"?",COL.u,Y.R+CH/2,{mono:true,size:13,color:RED});text(ctx,"?",COL.s,Y.R+CH/2,{mono:true,size:13,color:RED}); }
    else valCols(res.r,Y.R+CH/2,INK);
    /* 채움 비트 설명 */
    var fills=[];res.src.forEach(function(s,i){if(s.fill!==null&&op!=="lnot")fills.push(i);});
    if(fills.length){var fx=(cx(fills[0])+cx(fills[fills.length-1]))/2;
      text(ctx,op==="ashr"?"부호 비트 복사":"0으로 채움",fx,Y.R+CH+12,{size:10.5,color:RED,align:"center"});}
    if(op==="lnot")text(ctx,"상위 비트는 항상 0",(cx(w-1)+cx(1))/2,Y.R+CH+12,{size:10.5,color:DIM,align:"center"});
    if(res.ub)text(ctx,"k = w = "+w+" → w비트 타입에서 k ≥ w 시프트는 C에서 UB: 점선 칸은 '끝까지 밀어낸' 가상의 값일 뿐 보장 안 됨",12,Y.R+CH+30,{size:11.5,color:RED});
    else if(hover)text(ctx,hoverText(res),12,Y.R+CH+30,{size:11.5,color:INK});
    renderState(res);
    /* 컨트롤 동기화 */
    setActive(wBtns,wBtns[w===4?0:1]);
    setActive(opBtns,opBtns.filter(function(b){return b.dataset.op===op;})[0]);
    rk.max=w;rk.value=k;vk.textContent="k = "+k+(k===w?" (UB)":"");
    rk.disabled=!sh;lk.style.opacity=sh?1:0.45;
    if(document.activeElement!==inA)inA.value=mns(C.b2t(A,w));
    if(document.activeElement!==inB)inB.value=mns(C.b2t(B,w));
    lB.style.opacity=un?0.45:1;inB.disabled=un;
  }
  function hoverText(res){
    var h=hover,s;
    if(h.row==="R"){s=res.src[h.i];
      if(op==="lnot")return h.i===0?"결과 비트 0 = (A의 모든 비트가 0인가?) → A 전체 "+w+"비트를 본다":"결과 비트 "+h.i+"는 !A에서 항상 0";
      if(s.sign)return "결과 비트 "+h.i+" = A의 부호 비트 a"+(w-1)+" 복사 (= "+((A>>(w-1))&1)+")";
      if(s.fill!==null)return "결과 비트 "+h.i+" = 새로 채운 0 (어느 입력에서도 오지 않음)";
      return "결과 비트 "+h.i+" ← "+s.from.map(function(f){return f[0].toLowerCase()+f[1];}).join(", ")+(shiftOp(op)?"  (k = "+k+"칸 이동)":"");
    }
    var outs=[];res.src.forEach(function(s,ri){s.from.forEach(function(f){if(f[0]===h.row&&f[1]===h.i)outs.push(ri);});});
    return h.row+"의 비트 "+h.i+" → "+(outs.length?"결과 비트 "+outs.join(", "):"결과에 반영 안 됨 (밀려나 버려짐)");
  }
  function renderState(res){
    var ua=C.b2u(A,w),ta=C.b2t(A,w),ur=C.b2u(res.r,w),tr=C.b2t(res.r,w),P=Math.pow(2,k),h="";
    var R="<span style='color:"+RED+"'>",E="</span>";
    switch(op){
      case "not": h="~A (bitwise NOT): 모든 비트를 각각 뒤집는다. 2의 보수에서 항상 ~A = −A − 1 → ~("+mns(ta)+") = "+mns(tr)+".\n"+
        "비교: !A (logical NOT)였다면 결과는 "+(ua===0?1:0)+" — A가 0인지만 보고 0 또는 1을 낸다.";break;
      case "lnot": h="!A (logical NOT): A 전체가 0이면 1, 0이 아니면 0. 결과는 항상 0 또는 1.\n"+
        "비교: ~A (bitwise NOT)였다면 "+C.hex(~A&((1<<w)-1),w)+" — 비트를 하나하나 뒤집는다. !!A 는 'A≠0 이면 1'.";break;
      case "and": h="A & B: 같은 자리 비트끼리 AND. B를 마스크(mask)로 쓰면 B가 1인 자리의 A 비트만 남는다.\n"+
        "비교: A && B (논리 AND)는 "+((ua&&C.b2u(B,w))?1:0)+" — 둘 다 0이 아닌지만 본다 (단락 평가).";break;
      case "or": h="A | B: 같은 자리 비트끼리 OR. 특정 비트를 1로 '켤' 때 쓴다.\n"+
        "비교: A || B (논리 OR)는 "+((ua||C.b2u(B,w))?1:0)+".";break;
      case "xor": h="A ^ B: 같은 자리 비트가 다르면 1. x ^ x = 0, x ^ 0 = x, (A ^ B) ^ B = A.";break;
      case "shl": var lost=C.b2u(A,w)*P>=Math.pow(2,w);
        h="A << "+k+": 왼쪽으로 "+k+"칸, 오른쪽 빈자리는 0으로 채움. 값 = A·2^k mod 2^w: "+ua+"·"+P+" mod "+Math.pow(2,w)+" = "+(res.ub?"? (UB)":ur)+(res.ub?"":" (unsigned)");
        if(!res.ub&&lost)h+="\n"+R+"1인 비트가 위로 밀려나 버려짐 → unsigned 오버플로(값이 2^w로 나눈 나머지가 됨)"+E;
        if(!res.ub&&ta*P!==tr)h+="\n"+R+"signed로 보면 "+mns(ta)+"·"+P+" = "+mns(ta*P)+" 이지만 결과 비트열은 "+mns(tr)+" → signed 오버플로 (C에서 signed 오버플로·음수의 << 는 UB; 하드웨어는 보통 이 비트열을 낸다)"+E;
        break;
      case "lshr": h="A >> "+k+" (logical, 논리): 왼쪽 빈자리를 0으로 채움 → unsigned 나눗셈 ⌊U/2^k⌋ = ⌊"+ua+"/"+P+"⌋ = "+(res.ub?"? (UB)":ur)+".\nC에서 unsigned 의 >> 는 항상 논리 시프트.";
        if(!res.ub&&(A>>(w-1))&1)h+="\n"+R+"A의 부호 비트가 1 → 산술 시프트였다면 "+C.hex(C.bitop("ashr",A,0,k,w).r,w)+" (왼쪽이 1로 채워짐)"+E;
        break;
      case "ashr": var sb=(A>>(w-1))&1,fl=Math.floor(ta/P),tz=Math.trunc(ta/P);
        h="A >> "+k+" (arithmetic, 산술): 왼쪽 빈자리를 부호 비트 a"+(w-1)+" = "+sb+" 로 채움 → signed 나눗셈 ⌊T/2^k⌋ = ⌊"+mns(ta)+"/"+P+"⌋ = "+(res.ub?"? (UB)":mns(tr))+".";
        if(sb===0)h+="\n부호 비트가 0이면 산술 시프트 = 논리 시프트.";
        else if(!res.ub&&fl!==tz)h+="\n"+R+"C의 정수 나눗셈 "+mns(ta)+"/"+P+" 은 0 쪽으로 자르므로 "+mns(tz)+" ≠ "+mns(fl)+E+" → 같게 하려면 (A + 2^k − 1) >> k (bias 더하기).";
        h+="\nC에서 signed 의 >> 는 구현 정의(implementation-defined)지만 거의 모든 컴파일러가 산술 시프트를 쓴다.";
        break;
    }
    if(res.ub)h+="\n"+R+"C 표준: 시프트 양 k 가 (정수 승격 후) 피연산자 비트 폭 이상이면 UB. 이 위젯은 w비트 정수형을 가정한다 — 실제 C에서 char·int8_t 는 int(32비트)로 승격되므로 기준은 k ≥ 32. "+
      "예: x86-64의 shl/sar 는 32비트 피연산자의 시프트 양을 하위 5비트(k mod 32)만 쓰므로 int x 에 대해 x << 32 가 x 그대로 나올 수 있다 — 하지만 보장되지 않는다."+E;
    state.innerHTML=h.split("\n").map(function(s){return s;}).join("<br>");
  }
  draw();
});
/* ===================================================================== */
/*  2) int-rep                                                           */
/* ===================================================================== */
reg("int-rep",function(el,cfg){
  var warn=Warn(),C=V6XA_core;
  var w=parseIntLike(cfg.w==null?4:cfg.w); if(isNaN(w)||w<3||w>8){warn.add("w는 3..8");w=4;}
  var x=cfg.x==null?0xB&((1<<w)-1):parseIntLike(cfg.x);
  if(isNaN(x)||x< -Math.pow(2,w-1)||x>=Math.pow(2,w)){warn.add("x 범위 밖/형식 오류");x=0xB&((1<<w)-1);}
  x=C.toPattern(x,w);
  var panel={type:"none"};
  V.title(el,cfg.title||"정수 표현 — 같은 비트열, 두 가지 읽기 (B2U / B2T)");
  var H=318,cv=hiCanvas(el,H),ctx=cv.ctx,CW=46,CH=36,YB=26;
  function X0(){return 360-w*CW/2;}
  function cx(i){return X0()+(w-1-i)*CW+CW/2;}
  var form=mk("div","v6-state",null,el);
  var c1=mk("div","v6-controls",null,el);
  var lw=mk("label",null,"비트 수 w",c1),rw=mk("input",null,null,lw);rw.type="range";rw.min=3;rw.max=8;rw.step=1;
  var vw=mk("span","v6-val",null,lw);
  rw.oninput=guard(el,function(){var nw=parseInt(rw.value,10);x&=(1<<nw)-1;w=nw;panel={type:"none"};draw();});
  btn("+1",c1,guard(el,function(){var r=C.inc(x,w);panel={type:"inc",from:x,res:r};x=r.r;draw();}),"x+1 (w비트에서 자리올림 버림)");
  var bSext=btn("부호 확장 w→w+4",c1,guard(el,function(){panel={type:"sext",from:x};draw();}),"sign extension");
  var bTr=btn("절단 w→4",c1,guard(el,function(){if(w>4){panel={type:"trunc",from:x};draw();}}),"truncation: 하위 4비트만 남김");
  var c2=mk("div","v6-controls",null,el);mk("span",null,"바로 가기:",c2);
  [["TMin",function(){return 1<<(w-1);}],["TMax",function(){return (1<<(w-1))-1;}],["−1 (= UMax)",function(){return (1<<w)-1;}],["0",function(){return 0;}]].forEach(function(p){
    btn(p[0],c2,guard(el,function(){x=p[1]();panel={type:"none"};draw();}));});
  mk("span",null,"(비트 칸 클릭으로 토글)",c2).style.color="#555";
  warn.show(el);

  cv.c.addEventListener("click",guard(el,function(ev){var p=cv.pos(ev);
    if(p.y<YB||p.y>YB+CH)return;
    for(var i=0;i<w;i++)if(Math.abs(p.x-cx(i))<CW/2){x^=1<<i;panel={type:"none"};draw();return;}}));
  cv.c.addEventListener("mousemove",function(ev){var p=cv.pos(ev),on=false;
    if(p.y>=YB&&p.y<=YB+CH)for(var i=0;i<w;i++)if(Math.abs(p.x-cx(i))<CW/2)on=true;cv.c.style.cursor=on?"pointer":"default";});

  function draw(){
    cv.clear();
    var U=C.b2u(x,w),T=C.b2t(x,w),sb=(x>>(w-1))&1,TMin=-Math.pow(2,w-1),TMax=Math.pow(2,w-1)-1,UMax=Math.pow(2,w)-1;
    /* --- 비트 칸 + 가중치 --- */
    text(ctx,"비트",12,YB+CH/2,{bold:true,size:12});
    text(ctx,"U 가중치",12,YB+CH+14,{size:11,color:"#555"});
    text(ctx,"T 가중치",12,YB+CH+30,{size:11,color:"#555"});
    for(var i=0;i<w;i++){
      text(ctx,"x"+sub(i),cx(i),YB-9,{size:11,align:"center",color:DIM});
      box(ctx,cx(i)-CW/2,YB,CW,CH,{lw:i===w-1?2:1.2});
      text(ctx,String((x>>i)&1),cx(i),YB+CH/2+1,{mono:true,size:18,bold:true,align:"center"});
      text(ctx,String(Math.pow(2,i)),cx(i),YB+CH+14,{mono:true,size:11.5,align:"center"});
      text(ctx,i===w-1?mns(-Math.pow(2,i)):String(Math.pow(2,i)),cx(i),YB+CH+30,{mono:true,size:11.5,align:"center",color:i===w-1?RED:INK,bold:i===w-1});
    }
    text(ctx,"hex "+C.hex(x,w),cx(0)+CW/2+18,YB+CH/2,{mono:true,size:13});
    text(ctx,"← 부호 비트(sign bit) 가중치만 음수",cx(0)+CW/2+14,YB+CH+30,{size:10.5,color:RED});
    /* --- 숫자선 --- */
    var L=100,Rr=676,lo=TMin,hi=UMax,span=hi-lo;
    function px(v){return L+(v-lo)/span*(Rr-L);}
    var YT=128,YL=158,YU=212;
    var step=1;while((Rr-L)/(span/step)<5)step*=2;
    line(ctx,L-14,YL,Rr+14,YL,{lw:1.2});
    for(var v=lo;v<=hi;v++)if(((v%step)+step)%step===0)line(ctx,px(v),YL-3,px(v),YL+3,{lw:1,color:DIM});
    var marks=[[TMin,"TMin="+mns(TMin),0],[0,"0",0],[TMax,"TMax="+TMax,0],[UMax,"UMax="+UMax,0],[-1,"−1",1]];
    marks.forEach(function(m){line(ctx,px(m[0]),YL-7,px(m[0]),YL+7,{lw:1.4});
      var al=m[0]===TMin?"left":m[0]===UMax?"right":"center",dx=m[0]===TMin?-4:m[0]===UMax?4:0;
      if(m[2]){ /* −1 : 0 과 겹치지 않게 아래 줄, 왼쪽 */
        text(ctx,m[1],px(m[0])-3,YL+29,{size:11,mono:true,align:"right"});line(ctx,px(m[0]),YL+7,px(m[0])-2,YL+22,{lw:.8,color:DIM});
      } else text(ctx,m[1],px(m[0])+dx,YL+16,{size:11,mono:true,align:al});
    });
    if(step>1)text(ctx,"작은 눈금 = "+step,Rr+14,YL-12,{size:9.5,color:DIM,align:"right"});
    /* 범위 막대 */
    function bar(a,b,y,lab){line(ctx,px(a),y,px(b),y,{lw:2.2});line(ctx,px(a),y-5,px(a),y+5,{lw:1.5});line(ctx,px(b),y-5,px(b),y+5,{lw:1.5});
      text(ctx,lab,12,y,{size:11.5,bold:true});}
    bar(TMin,TMax,YT,"T 범위");bar(0,UMax,YU,"U 범위");
    /* 현재 값 점 */
    ctx.fillStyle=INK;ctx.beginPath();ctx.arc(px(U),YU,5.5,0,7);ctx.fill();
    ctx.strokeStyle=INK;ctx.lineWidth=2;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(px(T),YT,5.5,0,7);ctx.fill();ctx.stroke();
    function clampLab(s,xp,y){ctx.font="12px "+MONO;var tw=ctx.measureText(s).width;var xx=Math.max(4+tw/2,Math.min(716-tw/2,xp));text(ctx,s,xx,y,{mono:true,size:12,bold:true,align:"center"});}
    clampLab("B2T = "+mns(T),px(T),YT-15);clampLab("B2U = "+U,px(U),YU+16);
    line(ctx,px(T),YT+6,px(T),YL,{dash:[2,3],lw:1,color:DIM});line(ctx,px(U),YL,px(U),YU-6,{dash:[2,3],lw:1,color:DIM});
    if(sb){ /* U → T : −2^w */
      var x1=px(U),x2=px(T),ym=(YT+YU)/2;
      ctx.strokeStyle=RED;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x1-6,YU-4);ctx.bezierCurveTo(x1-60,ym+10,x2+60,ym-10,x2+7,YT+3);ctx.stroke();
      arrowHead(ctx,x2+7,YT+3,Math.atan2(YT+3-(ym-10),x2+7-(x2+60)),RED,7);
      text(ctx,"B2T = B2U − 2"+sup(w)+" = "+U+" − "+Math.pow(2,w),px(TMax)+14,YT,{size:11.5,color:RED});
    }
    /* --- 연산 패널 --- */
    var PY=244;line(ctx,10,PY-8,710,PY-8,{color:GRID,lw:1});
    drawPanel(PY);
    /* --- 공식 전개 (DOM) --- */
    var tU=[],tT=[],nU=[],nT=[];
    for(i=w-1;i>=0;i--){var b=(x>>i)&1;
      tU.push(b+"·2"+sup(i));nU.push(String(b*Math.pow(2,i)));
      if(i===w-1){tT.push("<span style='color:"+RED+"'>−"+b+"·2"+sup(i)+"</span>");nT.push("<span style='color:"+RED+"'>"+mns(-b*Math.pow(2,i))+"</span>");}
      else{tT.push(b+"·2"+sup(i));nT.push(String(b*Math.pow(2,i)));}}
    form.innerHTML="B2U(x) = Σ xᵢ·2ⁱ = "+tU.join(" + ")+"\n        = "+nU.join(" + ")+" = <b>"+U+"</b>\n"+
      "B2T(x) = −x"+sub(w-1)+"·2"+sup(w-1)+" + Σ<sub>i&lt;"+(w-1)+"</sub> xᵢ·2ⁱ = "+tT.join(" + ")+"\n        = "+nT.join(" + ")+" = <b>"+mns(T)+"</b>\n"+
      (sb?"부호 비트 = 1 → 같은 비트열이 U로는 "+U+", T로는 "+mns(T)+" (차이 2"+sup(w)+" = "+Math.pow(2,w)+")":"부호 비트 = 0 → U와 T가 같은 값 "+U+" (차이 없음)");
    form.style.fontFamily=MONO;form.style.fontSize="12.5px";
    rw.value=w;vw.textContent="w = "+w;
    bTr.disabled=w<=4;bTr.title=w<=4?"w ≤ 4 에서는 4비트로 절단할 게 없음":"하위 4비트만 남김";
  }
  function bitsAt(v,n,right,y,cw,o){ /* n비트 v 를 오른쪽 끝 right 에 맞춰 그림. o.style(i) */
    for(var i=0;i<n;i++){var xx=right-(i+1)*cw,st=(o&&o.style&&o.style(i))||{};
      if(!st.nobox)box(ctx,xx,y,cw,22,{color:st.color||INK,lw:st.lw||1,dash:st.dash});
      text(ctx,String((v>>i)&1),xx+cw/2,y+12,{mono:true,size:13,bold:true,align:"center",color:st.tcolor||st.color||INK});}
  }
  function drawPanel(PY){
    var C2=C,RIGHT=380,cw=24;
    if(panel.type==="none"){
      text(ctx,"버튼으로 연산을 해 보세요:",12,PY+8,{size:12,bold:true});
      text(ctx,"+1 — TMax+1 은 TMin 으로 (signed 오버플로), UMax+1 은 0 으로 (자리올림 버림)",22,PY+30,{size:11.5});
      text(ctx,"부호 확장 — 부호 비트를 복사해 T 값 보존   ·   절단 — 상위 비트를 버림: U는 mod 2⁴, T는 다시 해석",22,PY+50,{size:11.5});
      return;
    }
    var f=panel.from,w0=w;
    if(panel.type==="inc"){
      var r=panel.res,wf=w;
      text(ctx,"+1 (자리올림 계산)",12,PY+24,{size:12,bold:true});
      /* 캐리 행 */
      for(var i=0;i<wf;i++)if(i>0&&(r.carries>>i)&1)text(ctx,"1",RIGHT-(i+1)*cw+cw/2,PY+4,{mono:true,size:10.5,color:RED,align:"center"});
      if(r.carryOut){text(ctx,"1",RIGHT-(wf+1)*cw+cw/2,PY+4,{mono:true,size:10.5,color:RED,align:"center"});
        text(ctx,"버림",RIGHT-(wf+1)*cw-4,PY+4,{size:10.5,color:RED,align:"right"});}
      text(ctx,"carry",RIGHT+8,PY+4,{size:10,color:RED});
      bitsAt(f,wf,RIGHT,PY+12,cw,{style:function(){return {nobox:true};}});
      bitsAt(1,wf,RIGHT,PY+32,cw,{style:function(){return {nobox:true};}});
      text(ctx,"+",RIGHT-wf*cw-14,PY+44,{mono:true,size:14,bold:true});
      line(ctx,RIGHT-wf*cw-18,PY+56,RIGHT,PY+56,{lw:1.2});
      bitsAt(r.r,wf,RIGHT,PY+59,cw,{style:function(){return {nobox:true};}});
      var tx=RIGHT+60,uf=C2.b2u(f,wf),tf=C2.b2t(f,wf),ur=C2.b2u(r.r,wf),trr=C2.b2t(r.r,wf);
      text(ctx,"U: "+uf+" → "+ur+(r.uWrap?"   (UMax+1 → 0: 2"+sup(wf)+"을 넘어 감싸 돎)":""),tx,PY+22,{size:12,mono:false,color:r.uWrap?RED:INK});
      text(ctx,"T: "+mns(tf)+" → "+mns(trr)+(r.tOverflow?"   (TMax+1 → TMin: signed 오버플로)":""),tx,PY+44,{size:12,color:r.tOverflow?RED:INK});
      text(ctx,"비트 연산은 같다 — U/T는 읽는 방법만 다름",tx,PY+66,{size:11,color:"#555"});
      return;
    }
    if(panel.type==="sext"){
      var w2=w0+4,ex=C2.sext(f,w0,w2),sb=(f>>(w0-1))&1,R2=RIGHT;
      text(ctx,"부호 확장 (sign extension)  w = "+w0+" → "+w2,12,PY+4,{size:12,bold:true});
      bitsAt(f,w0,R2,PY+16,cw,{style:function(i){return i===w0-1?{lw:2}:null;}});
      text(ctx,w0+"비트",R2-w2*cw-8,PY+27,{size:11,align:"right"});
      bitsAt(ex,w2,R2,PY+50,cw,{style:function(i){return i>=w0?{color:RED,lw:1.6}:i===w0-1?{lw:2}:null;}});
      text(ctx,w2+"비트",R2-w2*cw-8,PY+61,{size:11,align:"right"});
      var sx=R2-w0*cw+cw/2;
      for(var j=w0;j<w2;j++){var tx2=R2-(j+1)*cw+cw/2;ctx.strokeStyle=RED;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx,PY+38);ctx.quadraticCurveTo((sx+tx2)/2,PY+44,tx2,PY+50);ctx.stroke();}
      var t1=C2.b2t(f,w0),t2=C2.b2t(ex,w2),u1=C2.b2u(f,w0),u2=C2.b2u(ex,w2),X=R2+40;
      text(ctx,"새 "+4+"비트 = 부호 비트("+sb+") 복사",X,PY+20,{size:11.5,color:RED});
      text(ctx,"T: "+mns(t1)+" → "+mns(t2)+(t1===t2?"  (값 보존 ✓)":""),X,PY+40,{size:12,bold:true});
      text(ctx,"U: "+u1+" → "+u2+(u1===u2?"  (같음)":"  (U 값은 바뀜 — unsigned는 0 확장)"),X,PY+60,{size:11.5,color:u1===u2?INK:"#555"});
      return;
    }
    if(panel.type==="trunc"){
      var tr=C2.trunc(f,w0,4),R3=RIGHT;
      text(ctx,"절단 (truncation)  w = "+w0+" → 4",12,PY+4,{size:12,bold:true});
      bitsAt(f,w0,R3,PY+16,cw,{style:function(i){return i>=4?{color:RED,tcolor:RED,dash:[3,2]}:null;}});
      for(var q=4;q<w0;q++){var xx=R3-(q+1)*cw;line(ctx,xx+4,PY+20,xx+cw-4,PY+34,{color:RED,lw:1.4});}
      text(ctx,w0+"비트",R3-w0*cw-8,PY+27,{size:11,align:"right"});
      bitsAt(tr,4,R3,PY+50,cw);
      text(ctx,"4비트",R3-4*cw-8,PY+61,{size:11,align:"right"});
      var uu=C2.b2u(f,w0),tt=C2.b2t(f,w0),u4=C2.b2u(tr,4),t4=C2.b2t(tr,4),X3=R3+40;
      text(ctx,"U: "+uu+" mod 16 = "+u4+"   (U2U: 2⁴으로 나눈 나머지)",X3,PY+22,{size:12});
      text(ctx,"T: "+mns(tt)+" → U2T₄("+u4+") = "+(u4>=8?u4+" − 16 = "+mns(t4):t4),X3,PY+42,{size:12,color:tt!==t4?RED:INK});
      text(ctx,tt!==t4?"T 값이 바뀜 (4비트 범위 −8..7 밖이었음)":"T 값 유지 (원래 −8..7 범위 안)",X3,PY+62,{size:11,color:"#555"});
    }
  }
  draw();
});
/* ===================================================================== */
/*  3) float-lab                                                         */
/* ===================================================================== */
var F_PRESETS=[
  ["+0","+0",0x00000000],["-0","−0",0x80000000],["minDenorm","최소 비정규",0x00000001],["maxDenorm","최대 비정규",0x007FFFFF],
  ["minNorm","최소 정규",0x00800000],["one","1.0",0x3F800000],["0.1","0.1",0x3DCCCCCD],["maxFinite","최대 finite",0x7F7FFFFF],
  ["+inf","+∞",0x7F800000],["nan","NaN",0x7FC00000]];
function f32Num(u){var dv=new DataView(new ArrayBuffer(4));dv.setUint32(0,u>>>0);return dv.getFloat32(0);}
function f32Bits(x){var dv=new DataView(new ArrayBuffer(4));dv.setFloat32(0,x);return dv.getUint32(0);}
function hex32(u){var s=(u>>>0).toString(16).toUpperCase();while(s.length<8)s="0"+s;return "0x"+s;}
function bin32(u){var s=(u>>>0).toString(2);while(s.length<32)s="0"+s;return s[0]+" "+s.slice(1,9)+" "+s.slice(9);}
/* 정확한 10진값 표시: 짧으면 일반 표기, 아니면 과학 표기 (모든 자릿수 정확) */
function exactStr(num,den){
  var C=V6XA_core,sc=C.ratToSci(num,den);
  if(sc.mant==="0"||sc.mant==="-0")return mns(sc.mant);
  if(sc.exp>=-6&&sc.exp<=40)return mns(C.ratToDecimal(num,den).str);
  return mns(sc.mant)+" × 10"+sup(sc.exp);
}
function floorLog2(p,q){ /* p,q>0 BigInt: floor(log2(p/q)) */
  var E=p.toString(2).length-q.toString(2).length;
  if(E>=0){if(p<(q<<BigInt(E)))E--;}else{if((p<<BigInt(-E))<q)E--;}
  return E;
}
/* 인접 float 의 정확한 값. ±∞ 는 "다음 칸" 2^128 로 취급 (RNE 오버플로 경계 계산용) */
function nbVal(u){var d=V6XA_core.f32Decode(u);if(d.cls==="inf")return {num:(d.s?-BigInt(1):BigInt(1))<<BigInt(128),den:BigInt(1),inf:true};return {num:d.num,den:d.den};}
function nbLab(u){return (u&0x7FFFFFFF)===0x7F800000?"2¹²⁸ (→"+(u>>>31?"−∞":"+∞")+")":hex32(u);}
function rsub(a,b){return V6XA_core.rat(a.num*b.den-b.num*a.den,a.den*b.den);}
function rcmpNum(a){return a.num;} /* 부호 */
function rToNumber(r){var sc=V6XA_core.ratToSci(r.num,r.den);return parseFloat(sc.mant)*Math.pow(10,sc.exp);}

reg("float-lab",function(el,cfg){
  var warn=Warn(),C=V6XA_core,u=0x3F800000,last=-1;
  if(cfg.bits!=null){var b=parseIntLike(cfg.bits);if(isNaN(b)||b<0||b>0xFFFFFFFF)warn.add("bits 형식 오류");else u=b>>>0;}
  if(cfg.preset!=null){var pr=F_PRESETS.filter(function(p){return p[0]===cfg.preset;})[0];if(pr)u=pr[2];else warn.add("preset 이름 오류");}
  V.title(el,cfg.title||"IEEE 754 binary32 (float) — 비트 ↔ 값");
  var H=120,cv=hiCanvas(el,H),ctx=cv.ctx,CW=18,CHh=26,YC=24;
  var X0=50,XE=X0+CW+10,XG=XE+8*CW+6,XF=XG+28;   /* XG: 숨은 비트(implicit) 자리 */
  function bx(i){ if(i===31)return X0; if(i>=23)return XE+(30-i)*CW; return XF+(22-i)*CW; }
  var dec=mk("div","v6-state",null,el);
  var c1=mk("div","v6-controls",null,el);mk("span",null,"프리셋:",c1);
  F_PRESETS.forEach(function(p){btn(p[1],c1,guard(el,function(){u=p[2]>>>0;last=-1;
    if(p[0]==="0.1"){inp.value="0.1";encode();}else clearEnc();draw();}));});
  /* 인코더 */
  var encBox=mk("div",null,null,el);encBox.style.cssText="border-top:1px dashed "+INK+";margin-top:10px;padding-top:6px";
  var c2=mk("div","v6-controls",null,encBox);
  var li=mk("label",null,"인코더 — 10진 입력 x =",c2),inp=mk("input",null,null,li);inp.type="text";inp.size=26;inp.value=cfg.input!=null?String(cfg.input):"0.1";
  inp.style.fontFamily=MONO;
  btn("가장 가까운 float로 (round-to-nearest-even)",c2,guard(el,function(){encode();}));
  inp.addEventListener("keydown",guard(el,function(e){if(e.key==="Enter")encode();}));
  var encOut=mk("div","v6-state",null,encBox),strip=null;
  warn.show(el);

  cv.c.addEventListener("click",guard(el,function(ev){var p=cv.pos(ev);if(p.y<YC||p.y>YC+CHh)return;
    for(var i=0;i<32;i++){var x=bx(i);if(p.x>=x&&p.x<x+CW){u=(u^(1<<i))>>>0;last=i;clearEnc();draw();return;}}}));
  cv.c.addEventListener("mousemove",function(ev){var p=cv.pos(ev),on=false;if(p.y>=YC&&p.y<=YC+CHh)for(var i=0;i<32;i++){var x=bx(i);if(p.x>=x&&p.x<x+CW)on=true;}cv.c.style.cursor=on?"pointer":"default";});

  function clearEnc(){encOut.innerHTML="";if(strip){strip.c.remove();strip=null;}}
  function draw(){
    var d=C.f32Decode(u);cv.clear();
    /* 필드 라벨 */
    text(ctx,"s",X0+CW/2,YC-10,{size:11,bold:true,align:"center"});
    text(ctx,"exponent e (8비트)",XE+4*CW,YC-10,{size:11,bold:true,align:"center"});
    text(ctx,"fraction f (23비트)",XF+11.5*CW,YC-10,{size:11,bold:true,align:"center"});
    for(var i=31;i>=0;i--){var x=bx(i),bt=(u>>>i)&1;
      box(ctx,x,YC,CW,CHh,{lw:i===last?2.2:1,color:i===last?RED:INK});
      text(ctx,String(bt),x+CW/2,YC+CHh/2+1,{mono:true,size:13,bold:true,align:"center",color:i===last?RED:INK});}
    /* 필드 테두리 */
    box(ctx,X0-2,YC-2,CW+4,CHh+4,{lw:1.8});box(ctx,XE-2,YC-2,8*CW+4,CHh+4,{lw:1.8});box(ctx,XF-2,YC-2,23*CW+4,CHh+4,{lw:1.8});
    /* 숨은 비트 */
    var hid=d.cls==="normal"?"1.":(d.cls==="denormal"||d.cls==="zero")?"0.":"";
    if(hid){box(ctx,XG,YC+2,24,CHh-4,{color:RED,dash:[3,2],lw:1.2});text(ctx,hid,XG+12,YC+CHh/2+1,{mono:true,size:13,bold:true,align:"center",color:RED});
      text(ctx,"숨은 비트",XG+12,YC+CHh+10,{size:9.5,align:"center",color:RED});}
    [[31,X0],[30,XE],[23,XE+7*CW],[22,XF],[0,XF+22*CW]].forEach(function(p){text(ctx,String(p[0]),p[1]+CW/2,YC+CHh+10,{size:9.5,align:"center",color:DIM});});
    /* 필드 값 */
    var y1=YC+CHh+34,y2=y1+22;
    text(ctx,d.s?"−":"+",X0+CW/2,y1,{size:15,bold:true,align:"center"});
    var eb=((u>>>23)&255).toString(2);while(eb.length<8)eb="0"+eb;
    text(ctx,"e = "+d.e,XE,y1,{mono:true,size:12});
    var fh=d.f.toString(16).toUpperCase();while(fh.length<6)fh="0"+fh;
    text(ctx,"f = 0x"+fh+" = "+d.f+" / 2²³",XF,y1,{mono:true,size:12});
    if(d.cls==="normal"){text(ctx,"E = e − 127 = "+mns(d.E),XE,y2,{mono:true,size:12});
      text(ctx,"M = 1 + f ≈ "+(1+d.f/8388608).toPrecision(9),XF,y2,{mono:true,size:12});}
    else if(d.cls==="denormal"||d.cls==="zero"){text(ctx,"E = 1 − 127 = −126",XE,y2,{mono:true,size:12,color:RED});
      text(ctx,"M = f ≈ "+(d.f/8388608).toPrecision(9)+"  (숨은 1 없음)",XF,y2,{mono:true,size:12});}
    else text(ctx,"e = 255 (모두 1) → 특수값",XE,y2,{mono:true,size:12,color:RED});
    renderDecode(d);
  }
  function renderDecode(d){
    var L=[],R="<span style='color:"+RED+"'>",E="</span>",X="<span style='word-break:break-all'>";
    var clsName={zero:(d.s?"−0":"+0")+" (zero)",denormal:"비정규화 수 (denormalized)",normal:"정규화 수 (normalized)",inf:(d.s?"−∞":"+∞")+" (infinity)",nan:"NaN (Not a Number)"}[d.cls];
    L.push("<b>분류: "+clsName+"</b>   비트: "+bin32(u)+" = "+hex32(u));
    if(d.cls==="normal"||d.cls==="denormal"||d.cls==="zero"){
      var fb=d.f.toString(2);while(fb.length<23)fb="0"+fb;fb=fb.replace(/0+$/,"")||"0";
      var Mb=(d.cls==="normal"?"1.":"0.")+fb+"₂";
      if(d.cls==="normal")L.push("bias = 2⁷ − 1 = 127,  E = e − bias = "+d.e+" − 127 = "+mns(d.E)+",  M = 1 + f = "+Mb+"  (implicit leading 1: 저장 안 해도 되는 맨 앞 1)");
      else L.push(R+"e = 0 → E = 1 − bias = −126"+E+" (e − bias = −127 이 아님!),  M = f = "+Mb+"  (숨은 1 없음)");
      var p=d.E-23,pw=p>=0?"2"+sup(p):"2"+sup(p);
      L.push("값 = (−1)"+sup(d.s)+" × M × 2"+sup(d.E)+" = "+(d.s?"−":"")+d.Mnum.toString()+" × "+pw+(d.cls==="zero"?" = "+(d.s?"−0":"0"):""));
      var approx=f32Num(u);
      L.push("10진 근사 ≈ "+(approx===0?(d.s?"−0":"0"):mns(approx.toPrecision(9)))+"   (유효숫자 9자리면 float를 정확히 되찾을 수 있음)");
      if(d.cls!=="zero")L.push("정확한 10진값 = "+X+exactStr(d.num,d.den)+E+"   ← 분모가 2의 거듭제곱이라 10진으로 유한하게 끝난다");
      var ulpE=d.cls==="normal"?d.E-23:-149;
      L.push("이 지수에서 인접 float 간격(ulp) = 2"+sup(ulpE)+" ≈ "+mns(Math.pow(2,ulpE).toPrecision(4)));
    }
    var note={
      zero:"e = 0, f = 0. 부호 비트만 다른 +0 과 −0 이 있다 (+0 == −0 은 참, 하지만 1/(+0)=+∞, 1/(−0)=−∞).",
      denormal:"비정규화 수: 0 과 최소 정규 2⁻¹²⁶ 사이를 같은 간격 2⁻¹⁴⁹ 로 메운다 (gradual underflow). 이 칸들이 없으면(flush-to-zero) 2⁻¹²⁶ 바로 아래가 곧장 0 이라, x ≠ y 인데 x − y = 0 이 되는 일이 생긴다.",
      normal:"정규화 수: 0 < e < 255. 맨 앞 1 을 생략하므로 frac 23비트로 유효숫자 24비트를 얻는다. e 가 1 늘 때마다 표현 간격(ulp)이 2배.",
      inf:"e = 255, f = 0 → ±∞. 오버플로나 1.0/0.0 의 결과. ∞ − ∞ 는 NaN.",
      nan:"e = 255, f ≠ 0 → NaN. 0/0, ∞ − ∞, sqrt(−1) 등. NaN 은 자기 자신과도 같지 않다 (x != x)."}[d.cls];
    if(d.cls==="normal"&&d.e===1)note+=" "+R+"이 값이 최소 정규 지수: 한 칸 더 작아지면 비정규로 넘어가고, 간격 2⁻¹⁴⁹ 는 그대로 이어진다."+E;
    L.push("· "+note);
    dec.innerHTML=L.join("<br>");
  }
  function encode(){
    var s=inp.value,r=C.f32Encode(s),L=[],R="<span style='color:"+RED+"'>",E="</span>",X="<span style='word-break:break-all'>";
    if(strip){strip.c.remove();strip=null;}
    if(r.error){encOut.innerHTML=R+esc(r.error)+E;return;}
    u=r.bits>>>0;last=-1;draw();
    if(r.special){encOut.innerHTML="입력 = "+esc(s.trim())+" → "+hex32(u)+" ("+(r.cls==="nan"?"NaN: e = 255, f ≠ 0 (quiet NaN 0x7FC00000)":"∞: e = 255, f = 0")+")";return;}
    var ex=r.exact,xs=exactStr(ex.num,ex.den);
    L.push("x = "+X+(ex.num===BigInt(0)?(r.neg?"−0":"0"):xs)+E+"  (입력을 정확한 유리수로 읽음)");
    var mid=null,pn=ex.num<BigInt(0)?-ex.num:ex.num,pd=ex.den;
    if(pn!==BigInt(0)&&r.dir!=="overflow"){
      var Ef=floorLog2(pn,pd),t2=pd;while(t2%BigInt(2)===BigInt(0))t2/=BigInt(2);
      if(Ef>=-126&&Ef<=127){
        var sh=BigInt(29-Ef),nn=sh>=0?pn<<sh:pn,dd=sh>=0?pd:pd<<(-sh),q=nn/dd,more=(nn%dd)!==BigInt(0),bs=q.toString(2);
        L.push("x 의 이진 전개 = "+(r.neg?"−":"")+bs[0]+"."+bs.slice(1,24)+"<span style='color:"+RED+"'>|"+bs.slice(24)+(more?"…":"")+"</span>₂ × 2"+sup(Ef)+
          "  ← frac 23비트(|) 뒤가 반올림으로 잘리는 부분"+(t2!==BigInt(1)?"; 분모에 2 이외의 소인수가 있어 이진 전개가 끝나지 않는다(무한 반복)":""));
      }
    }
    if(r.dir==="exact")L.push("<b>x 는 float 로 정확히 표현된다 → "+hex32(u)+", 오차 0</b>");
    else if(r.dir==="overflow"){
      L.push(R+"<b>오버플로: |x| ≥ 2¹²⁸ − 2¹⁰³ (최대 finite 와 2¹²⁸ 의 중간점) → "+(r.neg?"−∞":"+∞")+" = "+hex32(u)+"</b>"+E);
      L.push("최대 finite = (2 − 2⁻²³)·2¹²⁷ ≈ 3.40282347 × 10³⁸ 보다 ulp/2 이상 크면 round-to-nearest 에서도 ∞ 가 된다.");
    } else {
      var lo=nbVal(r.lo),hi=nbVal(r.hi);
      mid=C.rat(lo.num*hi.den+hi.num*lo.den,BigInt(2)*lo.den*hi.den);
      L.push("x 를 감싸는 두 인접 float (크기 기준):");
      L.push("  아래(0 쪽): "+hex32(r.lo)+" = "+X+exactStr(lo.num,lo.den)+E);
      L.push("  위(바깥쪽): "+nbLab(r.hi)+" = "+X+exactStr(hi.num,hi.den)+E+(hi.inf?"  ← 최대 finite 다음 칸은 ∞ 이지만, 반올림 경계는 2¹²⁸ 을 '다음 값'으로 보고 계산":""));
      L.push("  중간점(halfway) = "+X+exactStr(mid.num,mid.den)+E);
      var tie=/tie/.test(r.dir),up=/^up/.test(r.dir);
      if(tie)L.push(R+"<b>x 가 정확히 중간점 → round-to-even: f 의 마지막 비트가 0 인 쪽("+(up?"위":"아래")+") 선택 → "+hex32(u)+"</b>"+E);
      else L.push("<b>x 는 중간점보다 "+(up?"바깥쪽":"0 쪽")+"에 있음 → 더 가까운 "+(up?"위":"아래")+" float 선택 → "+hex32(u)+"</b>");
      if((u&0x7FFFFFFF)===0)L.push(R+"언더플로: 결과가 0 ("+(tie?"정확히 2⁻¹⁵⁰ = 0 과 최소 비정규의 중간 → 짝수인 0":"|x| < 2⁻¹⁵⁰ = 최소 비정규의 절반")+")"+E);
      else if(r.cls==="denormal")L.push("결과가 비정규 범위 — 간격 2⁻¹⁴⁹ 로 반올림 (gradual underflow 덕분에 0 으로 사라지지 않음)");
      var err=r.err,es=exactStr(err.num,err.den),rel=Math.abs(rToNumber(err)/rToNumber(ex));
      L.push("반올림 오차 = float − x = "+X+(err.num>BigInt(0)?"+":"")+es+E+"  (정확값)"+(isFinite(rel)?",  상대오차 ≈ "+rel.toPrecision(3):""));
    }
    /* 이중 반올림 비교 */
    var n=Number(s.trim().replace(/_/g,"").replace(/−/g,"-"));
    if(!isNaN(n)){var fb=f32Bits(Math.fround(n));
      if(fb!==u)L.push(R+"참고: JS 의 Math.fround(Number(\""+esc(s.trim())+"\")) 는 "+hex32(fb)+" — 10진→double→float 로 두 번 반올림(double rounding)해서 틀린다. 이 위젯은 BigInt 유리수로 한 번만 반올림."+E);}
    encOut.innerHTML=L.join("<br>");
    if(r.dir!=="exact")drawStrip(r,mid);
  }
  function drawStrip(r,mid){
    strip=hiCanvas(encBox,92);var c=strip.ctx,Lx=150,Rx=570,Y=46;
    var lo,hi,x=r.exact,lv,hv,labL,labH;
    if(r.dir==="overflow"){lo=C.f32Decode((r.neg?0x80000000:0)+0x7F7FFFFF);hi={num:(r.neg?-BigInt(1):BigInt(1))<<BigInt(128),den:BigInt(1)};labL="최대 finite";labH="2¹²⁸ → "+(r.neg?"−∞":"+∞");}
    else{lo=nbVal(r.lo);hi=nbVal(r.hi);labL=nbLab(r.lo);labH=nbLab(r.hi);}
    lo={num:lo.num,den:lo.den};
    if(mid==null)mid=C.rat(lo.num*hi.den+hi.num*lo.den,BigInt(2)*lo.den*hi.den);
    /* 값 순서대로 왼쪽/오른쪽 (음수면 뒤집힘) */
    var flip=r.neg,A=flip?hi:lo,Bv=flip?lo:hi,la=flip?labH:labL,lb=flip?labL:labH;
    function t(v){var a=rsub(v,A),b=rsub(Bv,A);var q=(a.num*b.den*BigInt(1000000))/(a.den*b.num);return Number(q)/1e6;}
    function px(v){var tt=t(v);return Lx+Math.max(-0.12,Math.min(1.12,tt))*(Rx-Lx);}
    line(c,Lx-60,Y,Rx+60,Y,{lw:1.2});
    var chosen=f32Num(u);
    [[A,la],[Bv,lb]].forEach(function(p,ix){var xp=ix?Rx:Lx,isC=(ix?(flip?false:true):(flip?true:false))===(/^up|overflow/.test(r.dir));
      line(c,xp,Y-10,xp,Y+10,{lw:1.6});text(c,p[1],xp,Y+22,{mono:true,size:11.5,align:"center",bold:isC});
      if(isC){c.fillStyle=INK;c.beginPath();c.arc(xp,Y,5,0,7);c.fill();text(c,"선택",xp,Y-18,{size:11,align:"center",bold:true});}});
    var mx=px(mid);line(c,mx,Y-8,mx,Y+8,{dash:[3,2],lw:1.2});text(c,"중간점",mx,Y+22,{size:11,align:"center",color:"#555"});
    var xx=px(x);c.fillStyle=RED;c.beginPath();c.moveTo(xx,Y-4);c.lineTo(xx-5,Y-13);c.lineTo(xx+5,Y-13);c.closePath();c.fill();
    text(c,"x",xx,Y-20,{size:12,bold:true,align:"center",color:RED});
    text(c,"x 위치는 두 이웃 사이 비율로 정확히 계산 (BigInt)",8,84,{size:10,color:DIM});
  }
  if(cfg.input!=null)encode(); else draw();
});
/* ===================================================================== */
/*  4) fp-round                                                          */
/* ===================================================================== */
var R_PRESETS=[
  ["10.00011",2,"교재 2.4.4: 10.00011₂ (2 3/32), k=2"],
  ["10.00110",2,"교재 2.4.4: 10.00110₂ (2 3/16), k=2"],
  ["10.11100",2,"교재 2.4.4: 10.11100₂ (2 7/8), k=2 — halfway"],
  ["10.10100",2,"교재 2.4.4: 10.10100₂ (2 5/8), k=2 — halfway"],
  ["10.010",1,"연습문제 2.50 A: 10.010₂, k=1"],
  ["10.011",1,"연습문제 2.50 B: 10.011₂, k=1"],
  ["10.110",1,"연습문제 2.50 C: 10.110₂, k=1"],
  ["11.001",1,"연습문제 2.50 D: 11.001₂, k=1"],
  ["1.1",0,"그림 2.37의 $1.50 을 이진으로: 1.1₂ → 정수 (k=0)"],
  ["10.1",0,"그림 2.37의 $2.50 을 이진으로: 10.1₂ → 정수 (k=0)"],
  ["-1.1",0,"그림 2.37의 −$1.50 을 이진으로: −1.1₂ → 정수 (k=0)"],
  ["-10.0110",2,"음수: −10.0110₂ (−2 3/8), k=2 — halfway"],
  ["-1.101",1,"음수: −1.101₂ (−1 5/8), k=1"]];
var MODES=[["even","round-to-even (짝수로, 기본)"],["zero","toward zero (0 쪽, 버림)"],["up","toward +∞ (올림, ceiling)"],["down","toward −∞ (내림, floor)"]];
function mixedFrac(num,den){ /* "2 3/16", "−(1 5/8)" */
  var C=V6XA_core,r=C.rat(num,den),neg=r.num<BigInt(0),n=neg?-r.num:r.num,d=r.den,wh=n/d,rm=n%d,s;
  if(rm===BigInt(0))s=wh.toString();else if(wh===BigInt(0))s=rm+"/"+d;else s=wh+" "+rm+"/"+d;
  return neg?(wh!==BigInt(0)&&rm!==BigInt(0)?"−("+s+")":"−"+s):s;
}
reg("fp-round",function(el,cfg){
  var warn=Warn(),C=V6XA_core;
  var val=cfg.value==null?"10.00110":String(cfg.value),k=parseIntLike(cfg.k==null?2:cfg.k);
  if(!C.parseBinary(val)||val.replace(/[^01]/g,"").length>24){warn.add("value는 이진 소수, 비트 24개까지 (예: 10.0110, −1.101)");val="10.00110";}
  if(isNaN(k)||k<0||k>8){warn.add("k는 0..8");k=2;}
  if(cfg.preset!=null){var pi=parseIntLike(cfg.preset);if(isNaN(pi)||!R_PRESETS[pi])warn.add("preset 번호는 0.."+(R_PRESETS.length-1));else{val=R_PRESETS[pi][0];k=R_PRESETS[pi][1];}}
  V.title(el,cfg.title||"반올림 모드 — 소수점 아래 k비트로 자르기");
  var H=292,cv=hiCanvas(el,H),ctx=cv.ctx;
  var st=mk("div","v6-state",null,el);
  var c1=mk("div","v6-controls",null,el);
  var ls=mk("label",null,"프리셋",c1),sel=mk("select",null,null,ls);
  mk("option",null,"(직접 입력)",sel).value="-1";
  R_PRESETS.forEach(function(p,i){mk("option",null,p[2],sel).value=String(i);});
  sel.onchange=guard(el,function(){var i=parseInt(sel.value,10);if(i>=0){val=R_PRESETS[i][0];k=R_PRESETS[i][1];inp.value=val;inp.style.outline="";draw();}});
  var c2=mk("div","v6-controls",null,el);
  var li=mk("label",null,"x (이진) =",c2),inp=mk("input",null,null,li);inp.type="text";inp.size=16;inp.value=val;inp.style.fontFamily=MONO;
  var bAp=btn("적용",c2,guard(el,function(){apply();}));
  inp.addEventListener("keydown",guard(el,function(e){if(e.key==="Enter")apply();}));
  var lk=mk("label",null,"남길 소수 비트 k",c2),rk=mk("input",null,null,lk);rk.type="range";rk.min=0;rk.max=8;rk.step=1;
  var vk=mk("span","v6-val",null,lk);
  rk.oninput=guard(el,function(){k=parseInt(rk.value,10);sel.value="-1";draw();});
  var msg=mk("span",null,"",c2);msg.style.color=RED;
  warn.show(el);
  function okLen(v){var p=C.parseBinary(v);return !!p&&v.replace(/[^01]/g,"").length<=24;}
  function apply(){if(!okLen(inp.value)){inp.style.outline="1.5px solid "+RED;msg.textContent="이진 소수만 (0, 1, 소수점, 부호; 비트 24개까지)";return;}
    inp.style.outline="";msg.textContent="";val=inp.value.trim();sel.value="-1";draw();}

  function draw(){
    var x=C.parseBinary(val),info=C.roundInfo(x.num,x.den,k),D=info.D,q={num:BigInt(1),den:D};
    cv.clear();
    /* --- 1. 비트열: 남는 부분 | 버려지는 부분 --- */
    var mm=Math.max(x.m,k),s=C.fixBin(x.num*(BigInt(1)<<BigInt(mm-x.m)),mm),dot=s.indexOf("."),cut=dot<0?s.length:dot+1+k;
    if(dot<0){dot=s.length;cut=s.length;}
    var fs=20;font(ctx,fs,true,true);var cw=ctx.measureText("0").width,X=50,Y=30;
    while(fs>11&&X+s.length*cw>460){fs--;font(ctx,fs,true,true);cw=ctx.measureText("0").width;}
    text(ctx,"x =",12,Y,{size:14,bold:true});
    for(var i=0;i<s.length;i++){var ch=s[i],dropped=i>=cut&&ch!==".",pad=dot>=0&&i>dot+x.m&&ch!=="."&&x.m<mm;
      text(ctx,ch==="-"?"−":ch,X+i*cw,Y,{mono:true,size:fs,bold:true,color:dropped?RED:pad?DIM:INK});}
    var xe=X+s.length*cw;
    text(ctx,"₂",xe+1,Y+5,{size:13});
    line(ctx,X+cut*cw-1,Y-15,X+cut*cw-1,Y+15,{color:RED,lw:1.6,dash:[3,2]});
    if(cut<s.length)text(ctx,"└ 버려지는 비트",X+cut*cw+1,Y+21,{size:10.5,color:RED});
    text(ctx,"남기는 부분: 소수점 아래 "+k+"비트"+(k===0?" (정수로 반올림)":""),X,Y+36,{size:10.5,color:"#555"});
    fitText(ctx,"= "+mixedFrac(x.num,x.den)+" = "+mns(C.ratToDecimal(x.num,x.den).str),xe+20,Y,714-xe-20,{size:14});
    /* --- 2. 숫자선 --- */
    var YL=104,Lx=200,Rx=440;
    function px(n){ /* n: 값 = n / den (rational {num,den}) → px */
      var a=n.num*D-info.lo*n.den; /* (v - lo/D)·D·den */
      return Lx+(Number(a*BigInt(100000)/n.den)/100000)*(Rx-Lx);
    }
    line(ctx,Lx-95,YL,Rx+95,YL,{lw:1.2});
    var sd=Math.min(Math.max(x.m-k,1),5),nsub=Math.pow(2,sd);
    for(var j=-nsub;j<=2*nsub;j++){var xx=Lx+j/nsub*(Rx-Lx);if(xx<Lx-95||xx>Rx+95)continue;line(ctx,xx,YL-3,xx,YL+3,{lw:1,color:DIM});}
    [[info.lo,Lx],[info.lo+BigInt(1),Rx]].forEach(function(p){line(ctx,p[1],YL-11,p[1],YL+11,{lw:1.8});
      text(ctx,mns(C.fixBin(p[0],k))+"₂",p[1],YL+22,{mono:true,size:12.5,bold:true,align:"center"});
      text(ctx,"= "+mns(C.ratToDecimal(p[0],D).str),p[1],YL+38,{mono:true,size:11.5,align:"center",color:"#555"});});
    var mx=(Lx+Rx)/2;line(ctx,mx,YL-8,mx,YL+8,{lw:1.2,dash:[3,2],color:info.halfway?RED:INK});
    text(ctx,"중간점",mx,YL+22,{size:11,align:"center",color:info.halfway?RED:"#555",bold:info.halfway});
    text(ctx,"표현 가능한 값 (간격 2"+sup(-k)+" = "+C.ratToDecimal(BigInt(1),D).str+")",Rx+95,YL-26,{size:10.5,align:"right",color:"#555"});
    var xp=px(x);
    ctx.fillStyle=RED;ctx.beginPath();ctx.moveTo(xp,YL-3);ctx.lineTo(xp-6,YL-14);ctx.lineTo(xp+6,YL-14);ctx.closePath();ctx.fill();
    text(ctx,"x",xp,YL-22,{size:13,bold:true,align:"center",color:RED});
    /* --- 3. 모드별 결과 --- */
    var Y0=166,DY=30;line(ctx,xp,YL+46,xp,Y0+3*DY+10,{dash:[2,3],lw:1,color:SOFT});
    MODES.forEach(function(md,ix){
      var y=Y0+ix*DY,n=info[md[0]],rp=n===info.lo?Lx:Rx,tieRow=info.halfway&&md[0]==="even";
      text(ctx,md[1],12,y,{size:12,bold:ix===0,color:tieRow?RED:INK});
      if(info.exact){ctx.fillStyle=INK;ctx.beginPath();ctx.arc(xp,y,4.5,0,7);ctx.fill();}
      else{line(ctx,xp,y,rp+(rp>xp?-5:5),y,{lw:1.6,color:tieRow?RED:INK});arrowHead(ctx,rp+(rp>xp?-2:2),y,rp>xp?0:Math.PI,tieRow?RED:INK,7);
        ctx.fillStyle=tieRow?RED:INK;ctx.beginPath();ctx.arc(rp,y,4,0,7);ctx.fill();}
      var dir=info.exact?"(그대로)":(n===info.lo?"(아래로)":"(위로)");
      fitText(ctx,"→ "+mns(C.fixBin(n,k))+"₂ = "+mns(C.ratToDecimal(n,D).str)+" "+dir,Rx+18,y,720-Rx-24,{mono:true,size:11.5,color:tieRow?RED:INK});
    });
    renderState(x,info,s,cut);
    rk.value=k;vk.textContent="k = "+k;
  }
  function renderState(x,info,s,cut){
    var R="<span style='color:"+RED+"'>",E="</span>",L=[],neg=x.num<BigInt(0);
    L.push("x = "+mns(C.fixBin(x.num,x.m))+"₂ = "+mixedFrac(x.num,x.den)+" = "+mns(C.ratToDecimal(x.num,x.den).str)+",  k = "+k+" → 2"+sup(-k)+" = "+C.ratToDecimal(BigInt(1),info.D).str+" 단위로 반올림");
    var tail=s.slice(cut).replace(/[^01]/g,"");
    if(info.exact)L.push("버려지는 비트가 모두 0 → x 는 이미 표현 가능 → 모든 모드에서 그대로.");
    else{
      var half="1"+Array(tail.length).join("0"),cmp=info.halfway?"= "+half+" (정확히 절반)":(tail>half?"> ":"< ")+half+" (절반)";
      L.push("|x| 의 버려지는 비트 "+R+tail+E+" "+cmp+" → "+(info.halfway?R+"<b>halfway: 가까운 쪽이 없다. round-to-even 은 마지막 남는 비트가 0(짝수)인 쪽을 고른다 → "+mns(C.fixBin(info.even,k))+"₂</b>"+E:
        "가장 가까운 값은 "+(((tail>half)!==neg)?"위쪽":"아래쪽")+" "+mns(C.fixBin(info.even,k))+"₂ (round-to-even 은 halfway 가 아니면 그냥 가까운 쪽)"));
    }
    L.push("왜 짝수? halfway 를 항상 올리면 평균이 위로 치우친다(편향). 짝수 쪽으로 보내면 halfway 의 약 절반은 올라가고 절반은 내려가 평균 오차가 0 에 가깝다.");
    var negLine="음수에서는 toward zero(크기 줄임) = 위쪽(+∞ 방향), toward −∞ = 아래쪽 → 양수일 때와 달리 둘이 다르다.";
    if(neg&&!info.exact&&info.zero!==info.down)L.push(R+negLine+" (지금: "+mns(C.fixBin(info.zero,k))+"₂ vs "+mns(C.fixBin(info.down,k))+"₂)"+E);
    else L.push(neg?negLine:"양수에서는 toward zero = toward −∞ (둘 다 내림). 음수 프리셋으로 차이를 확인해 보세요.");
    st.innerHTML=L.join("<br>");
  }
  draw();
});

/* ===================================================================== */
/*  보조 부트: (1) data-config JSON 이 깨져 v6.js 가 건너뛴 위젯에 오류 한 줄 표시                */
/*            (2) v6.js 의 boot 가 이 파일보다 먼저 끝난 경우(동적 로드 등) 직접 마운트                 */
/* ===================================================================== */
function fallbackBoot(){
  document.querySelectorAll(".v6-widget[data-widget]").forEach(function(el){
    var name=el.getAttribute("data-widget");
    if(NAMES.indexOf(name)<0||el.getAttribute("data-v6xa"))return;
    var raw=el.getAttribute("data-config"),cfg;
    try{cfg=JSON.parse(raw||"{}");}catch(e){
      el.setAttribute("data-v6xa","error");
      el.appendChild(errLine("위젯 '"+name+"': data-config 가 올바른 JSON 이 아닙니다 ("+e.message+")"));return;}
    if(!V){el.setAttribute("data-v6xa","error");el.appendChild(errLine("위젯 '"+name+"': assets/v6.js 를 v6-extra-a.js 보다 먼저 로드해야 합니다"));return;}
    try{ /* V6 에는 등록된 위젯을 직접 부르는 API 가 없으므로 여기서 같은 함수를 호출 */
      MOUNT[name](el,cfg);}catch(e){fail(el,e);}
  });
}
function later(){setTimeout(fallbackBoot,0);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",later);else later();
})();

/* ===== Batch 2: Lec4-5 (addr-modes, asm-sim, asm-encode) ===== */

(function () {
  "use strict";

  const V6 = window.V6;
  if (!V6 || typeof V6.register !== "function") return;

  const INK = V6.INK || "#1a1a1a";
  const RED = V6.RED || "#9e2b25";
  const GRID = V6.GRID || "#e8e6e0";
  const FONT = '"Noto Sans KR", sans-serif';

  const U64 = 1n << 64n;
  const MASK64 = U64 - 1n;
  const SIGN64 = 1n << 63n;
  const MASK32 = (1n << 32n) - 1n;
  const SIGN32 = 1n << 31n;

  const REGISTERS = [
    "rax", "rbx", "rcx", "rdx",
    "rsi", "rdi", "rsp", "rbp"
  ];

  const REG_CODE = [
    "rax", "rcx", "rdx", "rbx",
    "rsp", "rbp", "rsi", "rdi"
  ];

  function el(tag, parent, text, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) {
      e.textContent = String(text);
    }
    if (parent) parent.appendChild(e);
    return e;
  }

  function button(parent, text, handler) {
    const b = el("button", parent, text, "v6-btn");
    b.type = "button";
    b.addEventListener("click", handler);
    return b;
  }

  function controls(parent) {
    return el("div", parent, "", "v6-controls");
  }

  function output(parent) {
    const e = el("div", parent, "", "v6-state");
    e.style.whiteSpace = "pre-wrap";
    e.style.overflowWrap = "anywhere";
    e.setAttribute("role", "status");
    return e;
  }

  function title(parent, text) {
    if (typeof V6.title === "function") {
      V6.title(parent, text);
    } else {
      el("h3", parent, text);
    }
  }

  function label(parent, text, control) {
    const l = el("label", parent);
    el("span", l, text + " ");
    l.appendChild(control);
    return l;
  }

  function slider(parent, name, min, max, value, callback) {
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    input.value = String(value);

    const l = label(parent, name, input);
    const current = el("span", l, "", "v6-val");

    function show() {
      current.textContent = "0x" +
        Number(input.value).toString(16).toUpperCase();
    }

    show();

    input.addEventListener("input", () => {
      show();
      callback(Number(input.value));
    });

    return { input, current };
  }

  function setError(target, error) {
    target.textContent = "안내: " +
      (error instanceof Error ? error.message : String(error));
  }

  function hex(value, width) {
    const v = BigInt(value);
    const digits = width === undefined ? 16 : width;
    return "0x" +
      v.toString(16).toUpperCase().padStart(digits, "0");
  }

  function u64(v) {
    return BigInt.asUintN(64, BigInt(v));
  }

  function s64(v) {
    return BigInt.asIntN(64, BigInt(v));
  }

  function u32(v) {
    return BigInt.asUintN(32, BigInt(v));
  }

  function s32(v) {
    return BigInt.asIntN(32, BigInt(v));
  }

  function parseInteger(value) {
    const s = String(value).trim();

    if (/^[+-]?0x[0-9a-f]+$/i.test(s)) {
      const negative = s.startsWith("-");
      const unsigned = s.replace(/^[+-]/, "");
      const n = BigInt(unsigned);
      return negative ? -n : n;
    }

    if (/^[+-]?\d+$/.test(s)) {
      return BigInt(s);
    }

    throw new Error(
      "정수는 10진수 또는 0x로 시작하는 16진수로 입력하세요."
    );
  }

  function byteHex(v) {
    return Number(v).toString(16).padStart(2, "0");
  }

  function signedDisp(n) {
    const x = BigInt(n);
    if (x === 0n) return "";
    return x.toString();
  }

  function littleEndian(value, count) {
    const bits = BigInt(count * 8);
    let v = BigInt.asUintN(Number(bits), BigInt(value));
    const result = [];

    for (let i = 0; i < count; i++) {
      result.push(Number(v & 255n));
      v >>= 8n;
    }

    return result;
  }

  function readLittle(bytes, offset, size) {
    if (offset < 0 || offset + size > bytes.length) {
      throw new Error("바이트열이 잘렸습니다.");
    }

    let value = 0n;

    for (let i = 0; i < size; i++) {
      value |= BigInt(bytes[offset + i]) << BigInt(i * 8);
    }

    return value;
  }

  function signExtend(v, bits) {
    return BigInt.asIntN(bits, BigInt(v));
  }

  function formatBytes(bytes) {
    return bytes.map(byteHex).join(" ");
  }

  function clear(parent) {
    parent.replaceChildren();
  }

  function makeTable(parent, headers) {
    const table = el("table", parent);

    table.style.borderCollapse = "collapse";
    table.style.fontSize = "12px";
    table.style.width = "100%";

    const head = el("thead", table);
    const row = el("tr", head);

    headers.forEach(h => {
      const th = el("th", row, h);
      th.style.border = "1px solid " + INK;
      th.style.padding = "5px";
      th.style.textAlign = "left";
    });

    const body = el("tbody", table);

    return {
      table,
      body,
      add(values, highlighted) {
        const tr = el("tr", body);

        values.forEach((value, index) => {
          const td = el("td", tr, value);
          td.style.border = "1px solid " + INK;
          td.style.padding = "5px";
          td.style.fontFamily = "monospace, 'Noto Sans KR', sans-serif";

          if (highlighted && highlighted.includes(index)) {
            td.style.color = RED;
          }
        });

        return tr;
      }
    };
  }

  // ============================================================
  // Widget 1 — Effective address calculator
  // ============================================================

  V6.register("addr-modes", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    title(root, "유효주소(effective address) 계산기");

    const state = {
      rbx: 0x40n,
      rcx: 0x10n,
      scale: 2n,
      disp: 0n,
      mode: "lea",
      error: ""
    };

    try {
      if (cfg.rbx !== undefined) {
        const n = parseInteger(cfg.rbx);
        if (n < 0n || n > 0x200n) throw new Error("rbx 범위 초과");
        state.rbx = n;
      }
      if (cfg.rcx !== undefined) {
        const n = parseInteger(cfg.rcx);
        if (n < 0n || n > 0x200n) throw new Error("rcx 범위 초과");
        state.rcx = n;
      }
      if (cfg.scale !== undefined) {
        const n = parseInteger(cfg.scale);
        if (![1n, 2n, 4n, 8n].includes(n)) {
          throw new Error("scale은 1, 2, 4, 8 중 하나여야 합니다.");
        }
        state.scale = n;
      }
      if (cfg.disp !== undefined) {
        state.disp = parseInteger(cfg.disp);
      }
    } catch (e) {
      state.error = e.message + " — 기본값을 사용합니다.";
    }

    // Pre-filled byte-addressed little-endian example memory.
    // This is a teaching memory, not actual process memory.
    const memory = new Map();

    function writeQ(addr, value) {
      const bytes = littleEndian(value, 8);

      bytes.forEach((b, i) => {
        memory.set(addr + BigInt(i), b);
      });
    }

    for (let a = 0n; a <= 0x1200n; a += 8n) {
      writeQ(
        a,
        u64(0x1122334455660000n + a)
      );
    }

    function readQ(addr) {
      let result = 0n;

      for (let i = 0n; i < 8n; i++) {
        const b = memory.get(addr + i);

        if (b === undefined) {
          return null;
        }

        result |= BigInt(b) << (8n * i);
      }

      return result;
    }

    const top = controls(root);

    slider(
      top,
      "%rbx",
      0,
      0x200,
      Number(state.rbx),
      v => {
        state.rbx = BigInt(v);
        render();
      }
    );

    slider(
      top,
      "%rcx",
      0,
      0x200,
      Number(state.rcx),
      v => {
        state.rcx = BigInt(v);
        render();
      }
    );

    const scaleControls = controls(root);
    el("span", scaleControls, "배율(scale) S:");

    const scaleButtons = [];

    [1, 2, 4, 8].forEach(s => {
      const b = button(scaleControls, String(s), () => {
        state.scale = BigInt(s);
        render();
      });
      scaleButtons.push([s, b]);
    });

    const dispControls = controls(root);
    const dispInput = document.createElement("input");
    dispInput.type = "text";
    dispInput.value = state.disp.toString();
    dispInput.style.width = "130px";

    label(
      dispControls,
      "변위(displacement, 10진/16진)",
      dispInput
    );

    const dispValue = el("span", dispControls, "", "v6-val");

    dispInput.addEventListener("input", () => {
      try {
        const v = parseInteger(dispInput.value);

        if (v < -(1n << 31n) || v > (1n << 31n) - 1n) {
          throw new Error("변위는 signed 32비트 범위여야 합니다.");
        }

        state.disp = v;
        state.error = "";
      } catch (e) {
        state.error = e.message;
      }

      render();
    });

    const modeControls = controls(root);

    button(modeControls, "leaq — 주소 계산", () => {
      state.mode = "lea";
      render();
    });

    button(modeControls, "movq — 메모리 읽기", () => {
      state.mode = "mov";
      render();
    });

    const calculation = output(root);
    const memoryHost = el("div", root);
    const formsHost = el("div", root);
    const note = output(root);

    function render() {
      scaleButtons.forEach(([s, b]) => {
        b.style.borderColor =
          BigInt(s) === state.scale ? RED : INK;
      });

      if (state.error) {
        calculation.textContent = "안내: " + state.error;
        return;
      }

      const index = state.rcx * state.scale;
      const eaSigned = state.disp + state.rbx + index;
      const ea = u64(eaSigned);

      const operand =
        signedDisp(state.disp) +
        "(%rbx,%rcx," + state.scale + ")";

      const memValue = readQ(ea);

      dispValue.textContent =
        state.disp.toString() +
        " (" +
        (state.disp < 0n ? "-" + hex(-state.disp) : hex(state.disp)) +
        ")";

      const lines = [
        "어셈블리 피연산자: " + operand,
        "",
        "EA = Imm + R[%rbx] + R[%rcx] × S",
        "   = " + state.disp +
          " + " + state.rbx +
          " + " + state.rcx +
          " × " + state.scale,
        "   = " + state.disp +
          " + " + state.rbx +
          " + " + index,
        "   = " + eaSigned,
        "   = " + hex(ea) + " (64비트 유효주소)",
        ""
      ];

      if (state.mode === "lea") {
        lines.push(
          "leaq " + operand + ", %rax",
          "결과: %rax = EA = " + hex(ea),
          "메모리 참조 없음(no memory access)."
        );
      } else {
        lines.push("movq " + operand + ", %rax");

        if (memValue === null) {
          lines.push(
            "결과: 예시 메모리의 매핑 범위 밖입니다.",
            "실제 CPU라면 유효한 메모리 접근인지 추가 확인이 필요합니다."
          );
        } else {
          lines.push(
            "결과: %rax = M[EA] = " + hex(memValue),
            "주소 EA에서 8바이트를 리틀 엔디안으로 읽습니다."
          );
        }
      }

      calculation.textContent = lines.join("\n");

      clear(memoryHost);
      el("h4", memoryHost, "예시 메모리(memory)");

      const table = makeTable(memoryHost, [
        "주소(address)",
        "바이트 0..7 (낮은 주소부터)",
        "64비트 값"
      ]);

      const base = ea & ~7n;

      for (let offset = -16n; offset <= 16n; offset += 8n) {
        const address = base + offset;
        if (address < 0n) continue;

        const bytes = [];

        for (let i = 0n; i < 8n; i++) {
          const b = memory.get(address + i);
          bytes.push(b === undefined ? "??" : byteHex(b));
        }

        const value = readQ(address);

        table.add(
          [
            hex(address),
            bytes.join(" "),
            value === null ? "미매핑" : hex(value)
          ],
          address <= ea && ea < address + 8n ? [0, 1] : []
        );
      }

      if (ea % 8n !== 0n && memValue !== null) {
        el(
          "div",
          memoryHost,
          "현재 EA는 8바이트 경계에 정렬되지 않았습니다. " +
          "movq는 해당 주소부터 연속된 8바이트를 읽습니다."
        );
      }

      clear(formsHost);
      el("h4", formsHost, "다른 주소 지정 형태(addressing forms)");

      const forms = makeTable(formsHost, [
        "피연산자",
        "유효주소 계산"
      ]);

      forms.add(["(%rbx)", "R[%rbx]"]);
      forms.add(["(%rbx,%rcx)", "R[%rbx] + R[%rcx]"]);
      forms.add(["16(%rbx)", "16 + R[%rbx]"]);
      forms.add([
        "16(%rbx,%rcx,4)",
        "16 + R[%rbx] + 4×R[%rcx]"
      ]);
      forms.add([
        "16(,%rcx,4)",
        "16 + 4×R[%rcx]"
      ]);
      forms.add([
        "16",
        "변위(displacement)만 사용하는 주소 형태"
      ]);

      note.textContent =
        "핵심: leaq는 메모리 값을 읽지 않고 주소 계산 결과를 저장합니다.\n" +
        "movq는 계산한 주소에서 8바이트를 읽습니다.\n" +
        "AT&T 문법에서는 source가 먼저, destination이 뒤에 옵니다.\n" +
        "실제 x86-64의 일반적인 주소 계산은 64비트 모듈러 연산입니다.";
    }

    render();
  });

  // ============================================================
  // Widget 2 — Mini x86-64 simulator
  // ============================================================

  V6.register("asm-sim", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    title(root, "x86-64 한 단계 실행기");

    const STACK_BASE = 0x1000n;
    const STACK_SIZE = 256;
    const STACK_END = STACK_BASE + BigInt(STACK_SIZE);

    const PROGRAMS = [
      {
        name: "산술: OF / CF",
        code: [
          "movq $0x7fffffffffffffff, %rax",
          "addq $1, %rax",
          "movq $0xffffffffffffffff, %rbx",
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
        name: "조건문: 분기 버전",
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
        name: "조건문: cmov 버전",
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
        name: "swap: 스택과 레지스터",
        code: [
          "movq $17, %rax",
          "movq $42, %rbx",
          "pushq %rax",
          "movq %rbx, %rax",
          "popq %rbx",
          "nop"
        ]
      }
    ];

    let selectedProgram = Number.isInteger(cfg.preset)
      ? cfg.preset : 0;

    if (
      selectedProgram < 0 ||
      selectedProgram >= PROGRAMS.length
    ) {
      selectedProgram = 0;
    }

    let program = [];
    let labels = new Map();
    let timer = null;
    let history = [];
    let machine = null;
    let lastChanges = null;
    let lastExplanation = "";

    function initialState() {
      const regs = {};

      REGISTERS.forEach(r => {
        regs[r] = 0n;
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
        pc: 0,
        memory: new Uint8Array(STACK_SIZE),
        halted: false,
        steps: 0
      };
    }

    function cloneMachine(m) {
      return {
        regs: { ...m.regs },
        flags: { ...m.flags },
        pc: m.pc,
        memory: new Uint8Array(m.memory),
        halted: m.halted,
        steps: m.steps
      };
    }

    function compile(lines) {
      const instructions = [];
      const labelMap = new Map();

      lines.forEach((line, lineNumber) => {
        const cleaned = line
          .split("#")[0]
          .trim();

        if (!cleaned) return;

        if (/^[A-Za-z_]\w*:$/.test(cleaned)) {
          labelMap.set(cleaned.slice(0, -1), instructions.length);
          return;
        }

        instructions.push({
          text: cleaned,
          sourceLine: lineNumber
        });
      });

      return { instructions, labels: labelMap };
    }

    function splitOperands(text) {
      const result = [];
      let depth = 0;
      let start = 0;

      for (let i = 0; i < text.length; i++) {
        if (text[i] === "(") depth++;
        if (text[i] === ")") depth--;

        if (depth < 0) {
          throw new Error("메모리 피연산자의 괄호가 잘못되었습니다.");
        }

        if (text[i] === "," && depth === 0) {
          result.push(text.slice(start, i).trim());
          start = i + 1;
        }
      }

      if (depth !== 0) {
        throw new Error("메모리 피연산자의 괄호가 잘못되었습니다.");
      }

      const remaining = text.slice(start).trim();
      if (remaining) result.push(remaining);

      return result;
    }

    function parseOperand(text) {
      const s = text.trim();

      if (s.startsWith("$")) {
        return { type: "imm", value: parseInteger(s.slice(1)) };
      }

      if (/^%[a-z0-9]+$/.test(s)) {
        return { type: "reg", name: s.slice(1) };
      }

      const m = /^([^()]*)\((%[a-z0-9]+)(?:,(%[a-z0-9]+)(?:,([1248]))?)?\)$/.exec(s);

      if (m) {
        return {
          type: "mem",
          disp: m[1] ? parseInteger(m[1]) : 0n,
          base: m[2].slice(1),
          index: m[3] ? m[3].slice(1) : null,
          scale: m[4] ? BigInt(m[4]) : 1n
        };
      }

      if (/^[A-Za-z_]\w*$/.test(s)) {
        // Branch targets are bare labels, not arithmetic operands.
        return { type: "label", name: s };
      }

      throw new Error("지원하지 않는 피연산자: " + s);
    }

    function resolveRegName(name, bits) {
      if (bits === 64 && REGISTERS.includes(name)) return name;

      const map32 = {
        eax: "rax", ebx: "rbx", ecx: "rcx", edx: "rdx",
        esi: "rsi", edi: "rdi", esp: "rsp", ebp: "rbp"
      };

      if (bits === 32 && map32[name]) return map32[name];

      return null;
    }

    function readRegister(name, bits) {
      const full = resolveRegName(name, bits);

      if (!full) {
        throw new Error("지원하지 않는 레지스터: %" + name);
      }

      return bits === 32
        ? u32(machine.regs[full])
        : u64(machine.regs[full]);
    }

    function writeRegister(name, value, bits) {
      const full = resolveRegName(name, bits);

      if (!full) {
        throw new Error("지원하지 않는 레지스터: %" + name);
      }

      // Writing a 32-bit general-purpose register zero-extends to 64 bits.
      machine.regs[full] = bits === 32
        ? u32(value)
        : u64(value);
    }

    function address(op) {
      if (op.type !== "mem") {
        throw new Error("메모리 피연산자가 아닙니다.");
      }

      const base = readRegister(op.base, 64);
      const index = op.index
        ? readRegister(op.index, 64)
        : 0n;

      return u64(base + op.disp + index * op.scale);
    }

    function memOffset(addr, size) {
      const offset = addr - STACK_BASE;

      if (
        offset < 0n ||
        offset + BigInt(size) > BigInt(STACK_SIZE)
      ) {
        throw new Error(
          "메모리 접근 범위 초과: " +
          hex(addr) +
          " (스택 창 " +
          hex(STACK_BASE) +
          "–" +
          hex(STACK_END - 1n) +
          ")"
        );
      }

      return Number(offset);
    }

    function readMemory(addr, size) {
      const offset = memOffset(addr, size);
      let value = 0n;

      for (let i = 0; i < size; i++) {
        value |=
          BigInt(machine.memory[offset + i]) <<
          BigInt(i * 8);
      }

      return value;
    }

    function writeMemory(addr, value, size) {
      const offset = memOffset(addr, size);
      const bytes = littleEndian(value, size);

      bytes.forEach((b, i) => {
        machine.memory[offset + i] = b;
      });
    }

    function readOperand(op, bits) {
      if (op.type === "imm") {
        return BigInt.asUintN(bits, op.value);
      }

      if (op.type === "reg") {
        return readRegister(op.name, bits);
      }

      if (op.type === "mem") {
        return readMemory(address(op), bits / 8);
      }

      throw new Error("잘못된 피연산자입니다.");
    }

    function writeOperand(op, value, bits) {
      if (op.type === "reg") {
        writeRegister(op.name, value, bits);
      } else if (op.type === "mem") {
        writeMemory(address(op), value, bits / 8);
      } else {
        throw new Error("즉시값(immediate)은 목적지가 될 수 없습니다.");
      }
    }

    function signBit(v, bits) {
      return Number(
        (BigInt.asUintN(bits, v) >> BigInt(bits - 1)) & 1n
      );
    }

    function updateZS(result, bits) {
      const r = BigInt.asUintN(bits, result);
      machine.flags.ZF = r === 0n ? 1 : 0;
      machine.flags.SF = signBit(r, bits);
    }

    function flagsAdd(a, b, bits) {
      const A = BigInt.asUintN(bits, a);
      const B = BigInt.asUintN(bits, b);
      const full = A + B;
      const result = BigInt.asUintN(bits, full);

      const sa = signBit(A, bits);
      const sb = signBit(B, bits);
      const sr = signBit(result, bits);

      updateZS(result, bits);

      machine.flags.CF =
        full >> BigInt(bits) ? 1 : 0;

      machine.flags.OF =
        sa === sb && sr !== sa ? 1 : 0;

      return result;
    }

    function flagsSub(a, b, bits) {
      const A = BigInt.asUintN(bits, a);
      const B = BigInt.asUintN(bits, b);
      const result = BigInt.asUintN(bits, A - B);

      const sa = signBit(A, bits);
      const sb = signBit(B, bits);
      const sr = signBit(result, bits);

      updateZS(result, bits);

      machine.flags.CF = A < B ? 1 : 0;
      machine.flags.OF =
        sa !== sb && sr !== sa ? 1 : 0;

      return result;
    }

    function flagsLogic(result, bits) {
      updateZS(result, bits);
      machine.flags.CF = 0;
      machine.flags.OF = 0;
    }

    function condition(suffix) {
      const f = machine.flags;
      const Z = f.ZF, S = f.SF, C = f.CF, O = f.OF;

      if ([Z, S, C, O].some(v => v === null)) {
        throw new Error("조건 평가에 미정의 플래그가 포함되어 있습니다.");
      }

      switch (suffix) {
        case "e":
        case "z": return Z === 1;
        case "ne":
        case "nz": return Z === 0;
        case "s": return S === 1;
        case "ns": return S === 0;
        case "g": return Z === 0 && S === O;
        case "ge": return S === O;
        case "l": return S !== O;
        case "le": return Z === 1 || S !== O;
        case "a": return C === 0 && Z === 0;
        case "ae": return C === 0;
        case "b": return C === 1;
        case "be": return C === 1 || Z === 1;
        default:
          throw new Error("지원하지 않는 조건 코드: " + suffix);
      }
    }

    function instructionStep() {
      if (machine.halted || machine.pc >= program.length) {
        machine.halted = true;
        return;
      }

      const instruction = program[machine.pc];
      const match = /^([a-z][a-z0-9]*)\s*(.*)$/i.exec(instruction.text);

      if (!match) {
        throw new Error("명령어 구문 오류");
      }

      const op = match[1].toLowerCase();
      const args = splitOperands(match[2]).map(parseOperand);

      const beforePC = machine.pc;
      let explanation = "";
      let nextPC = machine.pc + 1;

      const need = n => {
        if (args.length !== n) {
          throw new Error(op + "에는 피연산자 " + n + "개가 필요합니다.");
        }
      };

      const bin = fn => {
        need(2);
        const source = readOperand(args[0], 64);
        const dest = readOperand(args[1], 64);
        const result = fn(dest, source);
        writeOperand(args[1], result, 64);
        return result;
      };

      if (op === "nop") {
        need(0);
        explanation = "nop: 상태를 변경하지 않습니다.";
      }

      else if (op === "movq" || op === "movl") {
        need(2);
        const bits = op === "movq" ? 64 : 32;

        if (args[0].type === "mem" && args[1].type === "mem") {
          throw new Error("mov는 메모리→메모리 직접 이동을 지원하지 않습니다.");
        }

        const value = readOperand(args[0], bits);
        writeOperand(args[1], value, bits);

        explanation = op === "movl"
          ? "movl: 32비트를 기록하며 레지스터 목적지의 상위 32비트는 0으로 클리어됩니다."
          : "movq: 64비트 값을 이동합니다. 플래그는 변경되지 않습니다.";
      }

      else if (op === "movzbl") {
        need(2);

        let byteValue;

        if (args[0].type === "mem") {
          byteValue = readMemory(address(args[0]), 1);
        } else if (args[0].type === "reg") {
          const low8 = {
            al: "rax", bl: "rbx", cl: "rcx", dl: "rdx",
            sil: "rsi", dil: "rdi", spl: "rsp", bpl: "rbp"
          };
          const reg = low8[args[0].name];

          if (!reg) throw new Error("지원하지 않는 8비트 레지스터");
          byteValue = machine.regs[reg] & 255n;
        } else {
          throw new Error("movzbl의 source는 8비트 레지스터 또는 메모리입니다.");
        }

        writeOperand(args[1], byteValue, 32);
        explanation = "movzbl: 8비트를 unsigned로 확장해 32비트 목적지에 기록합니다.";
      }

      else if (op === "leaq") {
        need(2);

        if (args[0].type !== "mem" || args[1].type !== "reg") {
          throw new Error("leaq는 메모리 주소식과 목적지 레지스터가 필요합니다.");
        }

        const ea = address(args[0]);
        writeOperand(args[1], ea, 64);

        explanation =
          "leaq: 메모리 읽기 없이 유효주소 " +
          hex(ea) +
          "를 계산했습니다.";
      }

      else if (op === "addq") {
        const result = bin((a, b) => flagsAdd(a, b, 64));
        explanation =
          "addq: 결과 " + hex(result) +
          "; OF=" + machine.flags.OF +
          ", CF=" + machine.flags.CF +
          ". OF는 signed overflow, CF는 unsigned carry-out입니다.";
      }

      else if (op === "subq") {
        const result = bin((a, b) => flagsSub(a, b, 64));
        explanation =
          "subq: destination − source = " + hex(result) +
          "; CF=" + machine.flags.CF +
          "는 unsigned borrow를 나타냅니다.";
      }

      else if (op === "imulq") {
        need(2);
        const a = s64(readOperand(args[0], 64));
        const b = s64(readOperand(args[1], 64));
        const product = a * b;
        const truncated = s64(product);

        writeOperand(args[1], truncated, 64);

        const overflow = product !== truncated ? 1 : 0;

        machine.flags.CF = overflow;
        machine.flags.OF = overflow;
        machine.flags.SF = null;
        machine.flags.ZF = null;

        explanation =
          "imulq: signed 128비트 곱의 하위 64비트만 저장합니다. " +
          "상위 절반이 부호 확장과 다르면 CF=OF=1. " +
          "SF/ZF는 미정의입니다.";
      }

      else if (["xorq", "andq", "orq"].includes(op)) {
        const result = bin((a, b) => {
          const r =
            op === "xorq" ? a ^ b :
            op === "andq" ? a & b :
            a | b;

          flagsLogic(r, 64);
          return r;
        });

        explanation =
          op + ": 결과 " + hex(result) +
          "; CF=OF=0, ZF/SF는 결과에서 결정됩니다.";
      }

      else if (["salq", "sarq", "shrq"].includes(op)) {
        need(2);

        const sourceCount = readOperand(args[0], 64);
        const count = Number(sourceCount & 63n);
        const old = readOperand(args[1], 64);

        if (count !== 0) {
          let result;
          let cf;

          if (op === "salq") {
            cf = Number((old >> BigInt(64 - count)) & 1n);
            result = u64(old << BigInt(count));
          } else if (op === "shrq") {
            cf = Number((old >> BigInt(count - 1)) & 1n);
            result = old >> BigInt(count);
          } else {
            cf = Number((old >> BigInt(count - 1)) & 1n);
            result = u64(s64(old) >> BigInt(count));
          }

          writeOperand(args[1], result, 64);
          updateZS(result, 64);
          machine.flags.CF = cf;

          if (count === 1) {
            if (op === "salq") {
              machine.flags.OF =
                signBit(result, 64) ^ cf;
            } else if (op === "shrq") {
              machine.flags.OF = signBit(old, 64);
            } else {
              machine.flags.OF = 0;
            }
          } else {
            machine.flags.OF = null;
          }

          explanation =
            op + ": 실효 이동 횟수 " + count +
            "; CF는 마지막 밀려난 비트입니다. " +
            (count === 1
              ? "OF를 정의된 규칙으로 계산했습니다."
              : "여러 비트 이동의 OF는 미정의입니다.");
        } else {
          explanation =
            op + ": 64비트 피연산자의 이동 횟수는 하위 6비트만 사용합니다. " +
            "실효 횟수 0이므로 값과 플래그가 유지됩니다.";
        }
      }

      else if (op === "incq" || op === "decq") {
        need(1);

        const oldCF = machine.flags.CF;
        const value = readOperand(args[0], 64);

        const result = op === "incq"
          ? flagsAdd(value, 1n, 64)
          : flagsSub(value, 1n, 64);

        machine.flags.CF = oldCF;
        writeOperand(args[0], result, 64);

        explanation =
          op + ": 1을 " +
          (op === "incq" ? "더했습니다." : "뺐습니다.") +
          " CF는 변경하지 않습니다.";
      }

      else if (op === "negq") {
        need(1);

        const old = readOperand(args[0], 64);
        const result = flagsSub(0n, old, 64);

        machine.flags.CF = old === 0n ? 0 : 1;
        writeOperand(args[0], result, 64);

        explanation =
          "negq: 0 − 값. 0이 아닌 피연산자는 CF=1입니다. " +
          "TMin의 부호 반전은 OF=1입니다.";
      }

      else if (op === "notq") {
        need(1);
        const result = u64(~readOperand(args[0], 64));
        writeOperand(args[0], result, 64);

        explanation =
          "notq: 모든 비트를 반전합니다. 조건 플래그는 변경하지 않습니다.";
      }

      else if (op === "cmpq") {
        need(2);

        const source = readOperand(args[0], 64);
        const dest = readOperand(args[1], 64);

        flagsSub(dest, source, 64);

        explanation =
          "cmpq b,a: a−b를 계산해 플래그만 갱신합니다. " +
          "레지스터와 메모리 값은 바뀌지 않습니다.";
      }

      else if (op === "testq") {
        need(2);

        const a = readOperand(args[0], 64);
        const b = readOperand(args[1], 64);

        flagsLogic(a & b, 64);

        explanation =
          "testq: a & b의 결과로 플래그만 갱신합니다. CF=OF=0.";
      }

      else if (op === "pushq") {
        need(1);

        const value = readOperand(args[0], 64);
        const newSP = u64(machine.regs.rsp - 8n);

        writeMemory(newSP, value, 8);
        machine.regs.rsp = newSP;

        explanation =
          "pushq: %rsp를 8 감소시킨 후 8바이트를 저장합니다.";
      }

      else if (op === "popq") {
        need(1);

        const oldSP = machine.regs.rsp;
        const value = readMemory(oldSP, 8);

        machine.regs.rsp = u64(oldSP + 8n);
        writeOperand(args[0], value, 64);

        explanation =
          "popq: 스택에서 8바이트를 읽고 %rsp를 8 증가시킵니다.";
      }

      else if (op === "jmp" || /^j(e|ne|s|ns|g|ge|l|le|a|b)$/.test(op)) {
        if (args.length !== 1) {
          // Branch targets are labels, not arithmetic operands.
          throw new Error("분기 명령에는 레이블 하나가 필요합니다.");
        }
      }

      else if (/^cmov(e|ne|s|ns|g|ge|l|le|a|b)q?$/.test(op)) {
        need(2);

        const suffix = op
          .replace(/^cmov/, "")
          .replace(/q$/, "");

        const take = condition(suffix);

        if (args[1].type !== "reg") {
          throw new Error("cmov 목적지는 레지스터여야 합니다.");
        }

        // x86 CMOV reads its source even if the condition is false.
        const value = readOperand(args[0], 64);

        if (take) {
          writeOperand(args[1], value, 64);
        }

        explanation =
          "cmov" + suffix +
          ": 조건 " + (take ? "참" : "거짓") +
          ". " + (take ? "값을 이동했습니다." : "목적지 값을 유지했습니다.") +
          " 분기 없이 조건부 이동합니다.";
      }

      else {
        throw new Error("지원하지 않는 명령어: " + op);
      }

      // Jump labels are parsed independently from arithmetic operands.
      if (op === "jmp" || /^j(e|ne|s|ns|g|ge|l|le|a|b)$/.test(op)) {
        const targetName = match[2].trim();

        if (!labels.has(targetName)) {
          throw new Error("존재하지 않는 레이블: " + targetName);
        }

        const take = op === "jmp"
          ? true
          : condition(op.slice(1));

        if (take) nextPC = labels.get(targetName);

        explanation =
          op + ": " +
          (take ? "분기합니다." : "분기하지 않습니다.") +
          " 다음 PC=" + nextPC;
      }

      machine.pc = nextPC;
      machine.steps++;

      if (machine.pc >= program.length) {
        machine.halted = true;
      }

      lastExplanation = explanation;
    }

    const top = controls(root);

    const selector = document.createElement("select");

    PROGRAMS.forEach((p, i) => {
      const option = el("option", selector, p.name);
      option.value = String(i);
    });

    selector.value = String(selectedProgram);
    label(top, "예제 프로그램(preset)", selector);

    selector.addEventListener("change", () => {
      selectedProgram = Number(selector.value);
      reset();
    });

    const actions = controls(root);

    button(actions, "한 단계(step)", () => step());
    button(actions, "되돌리기(undo)", () => undo());
    button(actions, "자동 재생(auto)", () => toggleAuto());
    button(actions, "리셋(reset)", () => reset());

    const status = output(root);
    const codeHost = el("div", root);
    const registersHost = el("div", root);
    const flagsHost = el("div", root);
    const stackHost = el("div", root);
    const explanationHost = output(root);

    function stopAuto() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }

    function reset() {
      stopAuto();

      const result = compile(PROGRAMS[selectedProgram].code);
      program = result.instructions;
      labels = result.labels;
      machine = initialState();
      history = [];

      lastChanges = null;
      lastExplanation =
        "명령어를 한 단계씩 실행하면서 레지스터, 플래그, 스택의 변화를 관찰하세요.";

      render();
    }

    function step() {
      stopAuto();

      if (machine.halted) return;

      const before = cloneMachine(machine);

      try {
        instructionStep();
        history.push(before);
        findChanges(before, machine);
      } catch (e) {
        machine = before;
        lastExplanation = "실행 오류: " + e.message;
        lastChanges = null;
      }

      render();
    }

    function undo() {
      stopAuto();

      if (history.length === 0) {
        lastExplanation = "되돌릴 실행 기록이 없습니다.";
        render();
        return;
      }

      machine = history.pop();
      lastChanges = null;
      lastExplanation = "이전 상태로 되돌렸습니다.";
      render();
    }

    function toggleAuto() {
      if (timer !== null) {
        stopAuto();
        return;
      }

      if (machine.halted) return;

      timer = setInterval(() => {
        if (machine.halted || machine.steps >= 200) {
          stopAuto();

          if (machine.steps >= 200 && !machine.halted) {
            lastExplanation =
              "자동 재생 안전 제한: 200단계에서 중지했습니다.";
          }

          render();
          return;
        }

        const before = cloneMachine(machine);

        try {
          instructionStep();
          history.push(before);
          findChanges(before, machine);
        } catch (e) {
          machine = before;
          lastExplanation = "실행 오류: " + e.message;
          stopAuto();
        }

        render();
      }, 550);
    }

    function findChanges(before, after) {
      const regs = new Set();
      const flags = new Set();
      const bytes = new Set();

      REGISTERS.forEach(r => {
        if (before.regs[r] !== after.regs[r]) {
          regs.add(r);
        }
      });

      ["ZF", "SF", "CF", "OF"].forEach(f => {
        if (before.flags[f] !== after.flags[f]) {
          flags.add(f);
        }
      });

      for (let i = 0; i < STACK_SIZE; i++) {
        if (before.memory[i] !== after.memory[i]) {
          bytes.add(i);
        }
      }

      lastChanges = { regs, flags, bytes };
    }

    function render() {
      status.textContent =
        "PC=" + machine.pc +
        " · 실행 단계=" + machine.steps +
        " · 상태=" + (machine.halted ? "종료" : "실행 가능");

      clear(codeHost);
      el("h4", codeHost, "명령어(instructions)");

      const code = el("div", codeHost);
      code.style.fontFamily = "monospace, 'Noto Sans KR', sans-serif";
      code.style.fontSize = "12px";

      program.forEach((ins, i) => {
        const row = el(
          "div",
          code,
          String(i).padStart(2, "0") + "  " + ins.text
        );

        row.style.padding = "3px 6px";

        if (i === machine.pc && !machine.halted) {
          row.style.borderLeft = "3px solid " + RED;
          row.style.background = GRID;
        }
      });

      clear(registersHost);
      el("h4", registersHost, "레지스터(registers)");

      const regTable = makeTable(registersHost, [
        "레지스터", "64비트 hex", "signed 10진"
      ]);

      REGISTERS.forEach(r => {
        const value = machine.regs[r];
        const changed =
          lastChanges && lastChanges.regs.has(r);

        regTable.add(
          ["%" + r, hex(value), s64(value).toString()],
          changed ? [0, 1, 2] : []
        );
      });

      clear(flagsHost);
      el("h4", flagsHost, "조건 코드(condition codes)");

      const flagTable = makeTable(flagsHost, [
        "ZF", "SF", "CF", "OF"
      ]);

      const tr = el("tr", flagTable.body);

      ["ZF", "SF", "CF", "OF"].forEach(f => {
        const v = machine.flags[f];
        const td = el("td", tr, v === null ? "미정의" : v);

        td.style.border = "1px solid " + INK;
        td.style.padding = "8px";
        td.style.textAlign = "center";

        if (lastChanges && lastChanges.flags.has(f)) {
          td.style.color = RED;
        }
      });

      clear(stackHost);
      el("h4", stackHost, "스택 메모리(stack, 256 bytes)");

      const memoryTable = makeTable(stackHost, [
        "주소", "8바이트 (낮은 주소 → 높은 주소)"
      ]);

      for (let i = 0; i < STACK_SIZE; i += 8) {
        const address = STACK_BASE + BigInt(i);
        const chunks = [];

        for (let j = 0; j < 8; j++) {
          const byte = machine.memory[i + j];

          chunks.push({
            text: byteHex(byte),
            changed:
              lastChanges &&
              lastChanges.bytes.has(i + j)
          });
        }

        const row = memoryTable.add(
          [hex(address), ""],
          address === machine.regs.rsp ? [0] : []
        );

        const cell = row.children[1];

        chunks.forEach((part, j) => {
          const span = el("span", cell, part.text);

          if (part.changed) span.style.color = RED;

          if (j !== 7) el("span", cell, " ");
        });
      }

      explanationHost.textContent =
        lastExplanation +
        "\n\n주의: 이 실행기는 교육용 x86-64 부분집합입니다. " +
        "일반적인 프로세스 메모리·시스템 호출·전체 ISA는 구현하지 않습니다. " +
        "OF 등 미정의 플래그는 '미정의'로 표시합니다.";
    }

    // Branch operands are labels, so they must not go through parseOperand.
    // Wrap instructionStep to use the original raw label in branch cases.
    // The ordinary dispatch already checks the branch opcode before updating PC.
    const originalStep = instructionStep;

    // Replace the step function's branch parsing using a small source wrapper
    // by preprocessing branch operand strings as symbolic operands.
    // The branch dispatcher only examines their count, not their numeric value.
    const rawCompile = compile;

    // Provide parseOperand-compatible symbolic labels.
    const originalParseOperand = parseOperand;

    // Branch labels are accepted as symbolic operands.
    // This is handled in parseOperand below by the fallback definition.
    // The execution dispatcher uses match[2] to resolve the label.
    // For JavaScript function declarations, the declaration below is hoisted.
    // (See parseOperand definition above.)

    reset();
  });

  // ============================================================
  // Widget 3 — x86-64 encoding / decoding classroom
  // ============================================================

  V6.register("asm-encode", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};

    title(root, "x86-64 인코딩·디코딩 교실");

    const COVERAGE = [
      "pushq %rbp / popq %rbp",
      "retq / nop / leaveq",
      "movq %rsp,%rbp / movq %rbp,%rsp",
      "movq reg↔mem (REX.W + 89/8B + ModRM + 필요 시 SIB/disp)",
      "subq $imm8,%rsp (48 83 EC ib)",
      "movq $imm32,%r64 (REX.W + C7 /0 id, sign extension)",
      "movabsq $imm64,%r64 (REX.W + B8+r io)",
      "call rel32 (E8 cd)"
    ];

    const coverage = output(root);

    coverage.textContent =
      "지원 범위(coverage)\n" +
      COVERAGE.map(x => "• " + x).join("\n") +
      "\n\n지원하지 않는 명령어·주소 지정 방식은 추측하지 않고 오류로 표시합니다.";

    const modeControls = controls(root);
    const encodeButton = button(modeControls, "인코드(encode)", () => {
      state.mode = "encode";
      render();
    });
    const decodeButton = button(modeControls, "디코드(decode)", () => {
      state.mode = "decode";
      render();
    });

    const state = {
      mode: "encode",
      selected: "push",
      bytes: [],
      fields: [],
      asm: "",
      error: ""
    };

    const selectors = controls(root);
    const select = document.createElement("select");

    const OPTIONS = [
      ["push", "pushq %rbp"],
      ["pop", "popq %rbp"],
      ["ret", "retq"],
      ["nop", "nop"],
      ["leave", "leaveq"],
      ["mov-rsp-rbp", "movq %rsp,%rbp"],
      ["mov-rbp-rsp", "movq %rbp,%rsp"],
      ["mov-mem-store", "movq %rax,disp(%rbx,%rcx,4)"],
      ["mov-mem-load", "movq disp(%rbx,%rcx,4),%rax"],
      ["sub-rsp", "subq $imm8,%rsp"],
      ["mov-imm32", "movq $imm32,%r64"],
      ["movabs", "movabsq $imm64,%r64"],
      ["call", "call rel32"]
    ];

    OPTIONS.forEach(([value, text]) => {
      const option = el("option", select, text);
      option.value = value;
    });

    label(selectors, "명령 선택", select);

    const registerSelect = document.createElement("select");

    REG_CODE.forEach(r => {
      const option = el("option", registerSelect, "%" + r);
      option.value = r;
    });

    label(selectors, "레지스터", registerSelect);

    const memoryBase = document.createElement("select");
    const memoryIndex = document.createElement("select");
    const memoryScale = document.createElement("select");

    REG_CODE.forEach(r => {
      const option = el("option", memoryBase, "%" + r);
      option.value = r;

      const indexOption = el("option", memoryIndex, "%" + r);
      indexOption.value = r;
    });

    memoryBase.value = "rbx";
    memoryIndex.value = "rcx";

    [1, 2, 4, 8].forEach(s => {
      const option = el("option", memoryScale, String(s));
      option.value = String(s);
    });

    memoryScale.value = "4";

    label(selectors, "메모리 base", memoryBase);
    label(selectors, "메모리 index", memoryIndex);
    label(selectors, "SIB scale", memoryScale);

    const values = controls(root);

    const immediate = document.createElement("input");
    immediate.type = "text";
    immediate.value = "8";
    immediate.style.width = "145px";
    label(values, "즉시값(imm)", immediate);

    const displacement = document.createElement("input");
    displacement.type = "text";
    displacement.value = "16";
    displacement.style.width = "120px";
    label(values, "변위(disp)", displacement);

    const hexInput = document.createElement("input");
    hexInput.type = "text";
    hexInput.value = "48 89 e5";
    hexInput.style.width = "280px";
    label(values, "hex 바이트열", hexInput);

    const actions = controls(root);
    button(actions, "실행 / 분석", () => render());

    const byteHost = el("div", root);
    const details = output(root);
    const example = output(root);

    select.addEventListener("change", () => {
      state.selected = select.value;
      render();
    });

    [
      registerSelect,
      memoryBase,
      memoryIndex,
      memoryScale,
      immediate,
      displacement
    ].forEach(e => {
      e.addEventListener("change", render);
    });

    state.selected = OPTIONS.some(
      x => x[0] === cfg.preset
    ) ? cfg.preset : "push";

    select.value = state.selected;

    function regCode(name) {
      const index = REG_CODE.indexOf(name);

      if (index < 0) {
        throw new Error("지원하지 않는 레지스터: " + name);
      }

      return index;
    }

    function modrm(mod, reg, rm) {
      return (mod << 6) | (reg << 3) | rm;
    }

    function sib(scale, index, base) {
      const shift =
        scale === 1 ? 0 :
        scale === 2 ? 1 :
        scale === 4 ? 2 : 3;

      return (shift << 6) | (index << 3) | base;
    }

    function makeField(text, meaning, bytes) {
      return {
        text,
        meaning,
        bytes: bytes || []
      };
    }

    function encode() {
      const type = state.selected;
      const reg = registerSelect.value;
      const imm = parseInteger(immediate.value);
      const disp = parseInteger(displacement.value);

      const bytes = [];
      const fields = [];
      let asm = "";

      function put(byte, labelText, meaning) {
        const index = bytes.length;
        bytes.push(byte & 255);

        fields.push(makeField(
          labelText,
          meaning,
          [index]
        ));
      }

      function putLE(value, count, name, meaning) {
        const start = bytes.length;
        const encoded = littleEndian(value, count);
        bytes.push(...encoded);

        fields.push(makeField(
          name,
          meaning,
          Array.from({ length: count }, (_, i) => start + i)
        ));
      }

      if (type === "push") {
        put(0x55, "55", "pushq %rbp: opcode 50+r, r=5");
        asm = "pushq %rbp";
      }

      else if (type === "pop") {
        put(0x5d, "5D", "popq %rbp: opcode 58+r, r=5");
        asm = "popq %rbp";
      }

      else if (type === "ret") {
        put(0xc3, "C3", "retq: 스택에서 반환 주소를 꺼냅니다.");
        asm = "retq";
      }

      else if (type === "nop") {
        put(0x90, "90", "nop: 1바이트 no-operation");
        asm = "nop";
      }

      else if (type === "leave") {
        put(0xc9, "C9", "leaveq: movq %rbp,%rsp; popq %rbp");
        asm = "leaveq";
      }

      else if (type === "mov-rsp-rbp") {
        put(0x48, "REX.W", "01001000: W=1 → 64비트 피연산자");
        put(0x89, "opcode 89", "mov r64 → r/m64");
        put(0xe5, "ModRM E5",
          "mod=11(레지스터), reg=100(%rsp), r/m=101(%rbp)");
        asm = "movq %rsp,%rbp";
      }

      else if (type === "mov-rbp-rsp") {
        put(0x48, "REX.W", "W=1 → 64비트 피연산자");
        put(0x89, "opcode 89", "mov r64 → r/m64");
        put(0xec, "ModRM EC",
          "mod=11, reg=101(%rbp), r/m=100(%rsp)");
        asm = "movq %rbp,%rsp";
      }

      else if (
        type === "mov-mem-store" ||
        type === "mov-mem-load"
      ) {
        const base = memoryBase.value;
        const index = memoryIndex.value;
        const scale = Number(memoryScale.value);
        const baseCode = regCode(base);
        const indexCode = regCode(index);
        const dataCode = regCode(reg);

        if (indexCode === 4) {
          throw new Error("%rsp는 SIB index로 사용할 수 없습니다.");
        }

        if (disp < -(1n << 31n) || disp > (1n << 31n) - 1n) {
          throw new Error("disp32 범위를 초과했습니다.");
        }

        let mod;
        let displacementSize;

        if (disp === 0n && baseCode !== 5) {
          mod = 0;
          displacementSize = 0;
        } else if (disp >= -128n && disp <= 127n) {
          mod = 1;
          displacementSize = 1;
        } else {
          mod = 2;
          displacementSize = 4;
        }

        if (baseCode === 5 && mod === 0) {
          mod = 1;
          displacementSize = 1;
        }

        const store = type === "mov-mem-store";

        put(0x48, "REX.W", "W=1, R=X=B=0");
        put(
          store ? 0x89 : 0x8b,
          "opcode",
          store
            ? "89: 레지스터 → 메모리"
            : "8B: 메모리 → 레지스터"
        );

        put(
          modrm(mod, dataCode, 4),
          "ModRM",
          "mod=" + mod.toString(2).padStart(2, "0") +
          ", reg=" + dataCode.toString(2).padStart(3, "0") +
          ", r/m=100 → SIB 사용"
        );

        put(
          sib(scale, indexCode, baseCode),
          "SIB",
          "scale=" + scale +
          ", index=%" + index +
          ", base=%" + base
        );

        if (displacementSize > 0) {
          putLE(
            disp,
            displacementSize,
            "disp" + displacementSize * 8,
            "signed displacement, 리틀 엔디안"
          );
        }

        const addressText =
          signedDisp(disp) +
          "(%" + base + ",%" + index + "," + scale + ")";

        asm = store
          ? "movq %" + reg + "," + addressText
          : "movq " + addressText + ",%" + reg;
      }

      else if (type === "sub-rsp") {
        if (imm < -128n || imm > 127n) {
          throw new Error("imm8은 -128..127 범위여야 합니다.");
        }

        put(0x48, "REX.W", "64비트 피연산자");
        put(0x83, "opcode 83", "Group 1 연산, sign-extended imm8");
        put(0xec, "ModRM EC", "mod=11, /5=sub, r/m=100(%rsp)");
        putLE(imm, 1, "imm8", "signed imm8을 64비트로 부호 확장");

        asm = "subq $" + imm + ",%rsp";
      }

      else if (type === "mov-imm32") {
        if (imm < -(1n << 31n) || imm > (1n << 31n) - 1n) {
          throw new Error(
            "C7 /0 id는 signed imm32를 64비트로 부호 확장합니다."
          );
        }

        const r = regCode(reg);

        put(0x48, "REX.W", "64비트 목적지");
        put(0xc7, "opcode C7", "r/m64 ← sign_extend(imm32)");
        put(
          modrm(3, 0, r),
          "ModRM",
          "mod=11, /0, r/m=" + r + "(%" + reg + ")"
        );

        putLE(
          imm,
          4,
          "imm32",
          "signed 32비트 즉시값, 리틀 엔디안"
        );

        asm = "movq $" + imm + ",%" + reg;
      }

      else if (type === "movabs") {
        if (imm < -(1n << 63n) || imm > MASK64) {
          throw new Error("imm64 범위를 초과했습니다.");
        }

        const r = regCode(reg);

        put(0x48, "REX.W", "W=1 → 64비트 피연산자");
        put(
          0xb8 + r,
          "B8+r",
          "레지스터 번호 r=" + r + " (%" + reg + ")"
        );

        putLE(
          imm,
          8,
          "imm64",
          "64비트 즉시값을 리틀 엔디안으로 저장"
        );

        asm = "movabsq $" + hex(u64(imm)) + ",%" + reg;
      }

      else if (type === "call") {
        if (imm < -(1n << 31n) || imm > (1n << 31n) - 1n) {
          throw new Error("call rel32 범위를 초과했습니다.");
        }

        put(0xe8, "E8", "call rel32: 다음 RIP 기준 상대 호출");
        putLE(
          imm,
          4,
          "rel32",
          "signed rel32, 리틀 엔디안. target=next RIP+rel32"
        );

        asm = "call " + (imm >= 0n ? "+" : "") + imm;
      }

      return { bytes, fields, asm };
    }

    function parseHexBytes(text) {
      const clean = String(text).trim();

      if (!clean) {
        throw new Error("hex 바이트열을 입력하세요.");
      }

      const normalized = clean
        .replace(/0x/gi, "")
        .replace(/[,:\s]/g, "");

      if (!/^[0-9a-f]+$/i.test(normalized)) {
        throw new Error("16진수 문자만 입력하세요.");
      }

      if (normalized.length % 2 !== 0) {
        throw new Error("hex 자릿수는 짝수여야 합니다.");
      }

      if (normalized.length > 30) {
        throw new Error("x86 명령어의 최대 길이는 15바이트입니다.");
      }

      const bytes = [];

      for (let i = 0; i < normalized.length; i += 2) {
        bytes.push(parseInt(normalized.slice(i, i + 2), 16));
      }

      return bytes;
    }

    function decode(bytes) {
      const fields = [];
      let pos = 0;

      function take(name, meaning) {
        if (pos >= bytes.length) {
          throw new Error("바이트열이 잘렸습니다.");
        }

        const index = pos++;
        fields.push(makeField(name, meaning, [index]));
        return bytes[index];
      }

      function takeLE(count, name, meaning) {
        const start = pos;
        const value = readLittle(bytes, pos, count);
        pos += count;

        fields.push(makeField(
          name,
          meaning,
          Array.from({ length: count }, (_, i) => start + i)
        ));

        return value;
      }

      let asm = "";
      const first = bytes[0];

      if ([0x55, 0x5d, 0xc3, 0x90, 0xc9].includes(first)) {
        const names = {
          0x55: "pushq %rbp",
          0x5d: "popq %rbp",
          0xc3: "retq",
          0x90: "nop",
          0xc9: "leaveq"
        };

        take("opcode", names[first]);
        asm = names[first];
      }

      else if (first === 0xe8) {
        take("E8", "call rel32");
        const relative = signExtend(
          takeLE(4, "rel32", "signed 상대변위, little-endian"),
          32
        );

        asm = "call " +
          (relative >= 0n ? "+" : "") +
          relative;
      }

      else if (first === 0x48) {
        take("REX.W", "W=1, R=X=B=0 → 64비트 피연산자");

        const opcode = take("opcode", "명령어 opcode");

        if (opcode >= 0xb8 && opcode <= 0xbf) {
          const r = opcode - 0xb8;
          const imm = takeLE(
            8, "imm64", "64비트 즉시값, little-endian"
          );

          asm = "movabsq $" +
            hex(imm) + ",%" + REG_CODE[r];
        }

        else if (opcode === 0x83) {
          const modrmByte = take("ModRM", "mod/reg/r-m 필드");

          if (modrmByte !== 0xec) {
            throw new Error("83 인코딩은 subq imm8,%rsp만 지원합니다.");
          }

          const imm = signExtend(
            takeLE(1, "imm8", "signed 8비트 즉시값"),
            8
          );

          asm = "subq $" + imm + ",%rsp";
        }

        else if (opcode === 0xc7) {
          const m = take("ModRM", "mod=11, /0, r/m=register");

          const mod = (m >> 6) & 3;
          const extension = (m >> 3) & 7;
          const rm = m & 7;

          if (mod !== 3 || extension !== 0) {
            throw new Error("C7은 레지스터 목적지 /0만 지원합니다.");
          }

          const imm = signExtend(
            takeLE(4, "imm32", "signed 32비트 즉시값"),
            32
          );

          asm = "movq $" + imm + ",%" + REG_CODE[rm];
        }

        else if (opcode === 0x89 || opcode === 0x8b) {
          const m = take(
            "ModRM",
            "mod(2비트) | reg(3비트) | r/m(3비트)"
          );

          const mod = (m >> 6) & 3;
          const reg = (m >> 3) & 7;
          const rm = m & 7;

          let location = "";

          if (mod === 3) {
            location = "%" + REG_CODE[rm];
          } else {
            let base = rm;
            let index = null;
            let scale = 1;

            if (rm === 4) {
              const s = take(
                "SIB",
                "scale(2) | index(3) | base(3)"
              );

              scale = 1 << ((s >> 6) & 3);
              const indexCode = (s >> 3) & 7;
              base = s & 7;

              if (indexCode !== 4) {
                index = REG_CODE[indexCode];
              }
            }

            let disp = 0n;
            let hasBase = true;

            if (mod === 0 && base === 5) {
              // mod=00, base=101:
              // SIB case: no base + disp32
              // non-SIB case: RIP-relative disp32
              disp = signExtend(
                takeLE(4, "disp32", "signed displacement"),
                32
              );

              hasBase = false;
            } else if (mod === 1) {
              disp = signExtend(
                takeLE(1, "disp8", "signed displacement"),
                8
              );
            } else if (mod === 2) {
              disp = signExtend(
                takeLE(4, "disp32", "signed displacement"),
                32
              );
            }

            if (mod === 0 && rm === 5) {
              location = disp + "(%rip)";
            } else {
              const prefix = disp === 0n ? "" : disp.toString();

              if (index !== null) {
                location =
                  prefix +
                  "(" +
                  (hasBase ? "%" + REG_CODE[base] : "") +
                  ",%" + index +
                  "," + scale + ")";
              } else if (hasBase) {
                location =
                  prefix + "(%" + REG_CODE[base] + ")";
              } else {
                location = disp.toString();
              }
            }
          }

          if (opcode === 0x89) {
            asm = "movq %" + REG_CODE[reg] + "," + location;
          } else {
            asm = "movq " + location + ",%" + REG_CODE[reg];
          }
        }

        else {
          throw new Error(
            "REX.W 뒤의 opcode " +
            byteHex(opcode) +
            "는 지원 범위 밖입니다."
          );
        }
      }

      else {
        throw new Error(
          "지원하지 않는 opcode: 0x" +
          byteHex(first)
        );
      }

      if (pos !== bytes.length) {
        throw new Error(
          "하나의 명령어 뒤에 추가 바이트가 있습니다. " +
          "이 교실은 한 번에 명령어 하나만 디코딩합니다."
        );
      }

      return { bytes, fields, asm };
    }

    function show(result) {
      clear(byteHost);

      el("h4", byteHost, "명령어 바이트(command bytes)");

      const row = el("div", byteHost);

      row.style.display = "flex";
      row.style.flexWrap = "wrap";
      row.style.gap = "4px";
      row.style.margin = "10px 0";

      const description = output(byteHost);

      result.bytes.forEach((byte, i) => {
        const b = button(row, byteHex(byte));

        b.style.fontFamily = "monospace, 'Noto Sans KR', sans-serif";
        b.style.fontSize = "16px";
        b.style.minWidth = "45px";

        b.addEventListener("click", () => {
          const field = result.fields.find(
            f => f.bytes.includes(i)
          );

          if (field) {
            description.textContent =
              "바이트 " + i + ": " +
              field.text + "\n" +
              field.meaning;
          }
        });
      });

      const fieldTable = makeTable(byteHost, [
        "필드(field)",
        "바이트",
        "의미"
      ]);

      result.fields.forEach(f => {
        fieldTable.add([
          f.text,
          f.bytes.map(i => byteHex(result.bytes[i])).join(" "),
          f.meaning
        ]);
      });

      details.textContent =
        "어셈블리(disassembly)\n" +
        result.asm +
        "\n\n" +
        "인코딩 바이트\n" +
        formatBytes(result.bytes);

      const address = 0x401000n;

      example.textContent =
        "objdump 스타일 예시\n" +
        hex(address, 8).slice(2) +
        ":  " +
        formatBytes(result.bytes).padEnd(44, " ") +
        result.asm +
        "\n\n" +
        "Bomb Lab 포인트:\n" +
        "왼쪽은 명령 주소, 가운데는 기계어 바이트, 오른쪽은 디스어셈블입니다.\n" +
        "REX.W는 64비트 피연산자 크기, ModRM은 레지스터·주소 지정 방식, " +
        "SIB는 scale/index/base, immediate와 displacement는 little-endian입니다.\n" +
        "call rel32의 목표 주소는 현재 명령 주소가 아니라 다음 RIP에 상대적입니다.";
    }

    function render() {
      state.error = "";

      encodeButton.style.borderColor =
        state.mode === "encode" ? RED : INK;

      decodeButton.style.borderColor =
        state.mode === "decode" ? RED : INK;

      try {
        const result = state.mode === "encode"
          ? encode()
          : decode(parseHexBytes(hexInput.value));

        state.bytes = result.bytes;
        state.fields = result.fields;
        state.asm = result.asm;

        if (state.mode === "encode") {
          hexInput.value = formatBytes(result.bytes);
        }

        show(result);
      } catch (e) {
        clear(byteHost);
        setError(details, e);
        example.textContent =
          "지원 범위에 해당하는 명령어 또는 유효한 바이트열을 입력하세요.";
      }
    }

    render();
  });

})();

/* ===== Batch 3: Lec6-8 (stack-frames, struct-layout, array-index, buf-overflow, byte-order, mem-layout) ===== */

(function () {
  "use strict";

  if (!window.V6 || typeof window.V6.register !== "function") return;

  const V6 = window.V6;
  const INK = V6.INK;
  const RED = V6.RED;
  const GRID = V6.GRID;
  const FONT = '"Noto Sans KR", sans-serif';

  const U64 = 1n << 64n;
  const MASK64 = U64 - 1n;

  function E(tag, parent, text, cls) {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined) x.textContent = String(text);
    if (parent) parent.appendChild(x);
    return x;
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
    x.style.whiteSpace = "pre-wrap";
    x.style.overflowWrap = "anywhere";
    x.setAttribute("role", "status");
    return x;
  }

  function T(parent, text) {
    V6.title(parent, text);
  }

  function H(parent, text) {
    return E("h4", parent, text);
  }

  function L(parent, text, input) {
    const l = E("label", parent);
    E("span", l, text + " ");
    l.appendChild(input);
    return l;
  }

  function inputText(parent, text, value, fn) {
    const x = document.createElement("input");
    x.type = "text";
    x.value = String(value);
    x.style.width = "150px";
    L(parent, text, x);
    if (fn) x.addEventListener("input", fn);
    return x;
  }

  function range(parent, text, min, max, value, fn) {
    const x = document.createElement("input");
    x.type = "range";
    x.min = min;
    x.max = max;
    x.step = 1;
    x.value = value;

    const l = L(parent, text, x);
    const current = E("span", l, String(value), "v6-val");

    x.addEventListener("input", () => {
      current.textContent = x.value;
      fn(Number(x.value));
    });

    return { input: x, current };
  }

  function table(parent, heads) {
    const t = E("table", parent);
    t.style.borderCollapse = "collapse";
    t.style.width = "100%";
    t.style.fontSize = "12px";

    const h = E("tr", E("thead", t));
    heads.forEach(v => {
      const c = E("th", h, v);
      c.style.border = "1px solid " + INK;
      c.style.padding = "5px";
      c.style.textAlign = "left";
    });

    const body = E("tbody", t);

    return {
      table: t,
      row(values, redColumns = []) {
        const tr = E("tr", body);
        values.forEach((v, i) => {
          const td = E("td", tr, v);
          td.style.border = "1px solid " + INK;
          td.style.padding = "5px";
          if (redColumns.includes(i)) td.style.color = RED;
        });
        return tr;
      }
    };
  }

  function hex(v, digits = 16) {
    return "0x" +
      BigInt(v).toString(16).toUpperCase().padStart(digits, "0");
  }

  function u64(v) {
    return BigInt.asUintN(64, BigInt(v));
  }

  function signed64(v) {
    return BigInt.asIntN(64, BigInt(v));
  }

  function parseIntExact(text) {
    const s = String(text).trim();
    if (/^[+-]?0x[0-9a-f]+$/i.test(s)) {
      const neg = s.startsWith("-");
      const value = BigInt(s.replace(/^[+-]/, ""));
      return neg ? -value : value;
    }
    if (/^[+-]?\d+$/.test(s)) return BigInt(s);
    throw new Error("10진수 또는 0x 형식의 16진수를 입력하세요.");
  }

  function goodInteger(value, fallback, lo, hi) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= lo && n <= hi
      ? n : fallback;
  }

  function clear(parent) {
    parent.replaceChildren();
  }

  function notice(parent, message) {
    parent.textContent = "안내: " + message;
  }

  function box(parent, text, red = false) {
    const x = E("div", parent, text);
    x.style.border = "1px solid " + INK;
    x.style.padding = "7px";
    x.style.background = "white";
    x.style.color = red ? RED : INK;
    x.style.fontFamily = FONT;
    x.style.fontSize = "12px";
    return x;
  }

  function line(parent) {
    const x = E("div", parent);
    x.style.borderTop = "1px solid " + GRID;
    x.style.margin = "12px 0";
    return x;
  }

  function drawArrow(ctx, x1, y1, x2, y2, color) {
    ctx.strokeStyle = color || INK;
    ctx.fillStyle = color || INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = 7;

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - size * Math.cos(angle - Math.PI / 6),
      y2 - size * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - size * Math.cos(angle + Math.PI / 6),
      y2 - size * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }

  // ============================================================
  // 1. Stack Frames
  // ============================================================

  V6.register("stack-frames", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    T(root, "프로시저 호출과 스택 프레임(stack frames)");

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
      changed: null
    };

    function fresh() {
      return {
        rsp: TOP,
        rbp: TOP,
        rax: 0n,
        rbx: 0n,
        registers: Object.fromEntries(argRegs.map(x => [x, 0n])),
        slots: new Map(),
        frames: [{ name: "main", rbp: TOP, entry: TOP }],
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
      m.slots.set(m.rsp, { value: u64(value), label });
      return m.rsp;
    }

    function pop(m) {
      const slot = m.slots.get(m.rsp);
      if (!slot) throw new Error("스택 아래에 읽을 값이 없습니다.");
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
          argRegs.forEach((r, i) => m.registers[r] = args[i]);
          return "System V AMD64: 정수·포인터 인자 1~6은 %rdi, %rsi, %rdx, %rcx, %r8, %r9입니다.";
        }],
        ["subq $16,%rsp — outgoing args 공간", m => {
          reserve(m, 16, "인자 전달 공간");
          return "7·8번째 인자를 위해 호출자가 16바이트 공간을 마련합니다. call 직전 %rsp는 16바이트 정렬됩니다.";
        }],
        ["movq $7,0(%rsp); movq $8,8(%rsp)", m => {
          m.slots.set(m.rsp, { value: 7n, label: "foo arg7" });
          m.slots.set(m.rsp + 8n, { value: 8n, label: "foo arg8" });
          return "foo의 arg7은 호출 전 0(%rsp), arg8은 8(%rsp)에 위치합니다.";
        }],
        ["call foo", m => {
          push(m, 0x401020n, "main → 복귀 주소(return address)");
          m.frames.push({ name: "foo", rbp: null, entry: m.rsp });
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
          m.frames.push({ name: "bar", rbp: null, entry: m.rsp });
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
          return "ret은 복귀 주소 " + hex(address) + "를 pop한 뒤 그 주소로 점프합니다.";
        }],
        ["foo: addq $8,%rsp", m => {
          drop(m, 8);
          return "bar 호출 전 마련한 8바이트 정렬 패딩을 제거합니다.";
        }],
        ["foo: %rbx 복원", m => {
          const slot = m.slots.get(m.rsp);
          if (!slot) throw new Error("saved %rbx가 없습니다.");
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

    // Recursive factorial simulation with genuine push/pop nesting.
    // Educational trace uses 16-byte local allocation to preserve
    // 16-byte stack alignment at recursive call sites.
    function buildRecursive() {
      const ops = [];
      const n0 = 4;
      const returns = [];

      ops.push(["main: movq $4,%rdi", m => {
        m.registers.rdi = 4n;
        return "팩토리얼 factorial(4)을 호출합니다.";
      }]);

      ops.push(["main: call fact", m => {
        push(m, 0x402000n, "main 복귀 주소");
        m.frames.push({ name: "fact(4)", rbp: null, entry: m.rsp });
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
          return "재귀 호출 뒤 곱할 n=" + n + "을 로컬 슬롯에 저장합니다.";
        }]);

        if (n > 1) {
          ops.push(["fact(" + n + "): call fact(" + (n - 1) + ")", m => {
            push(m, BigInt(0x402100 + n * 16), "fact(" + n + ") 복귀 주소");
            m.frames.push({
              name: "fact(" + (n - 1) + ")",
              rbp: null,
              entry: m.rsp
            });
            return "재귀 호출로 프레임 깊이가 증가합니다. 현재 %rsp mod 16 = 8 (callee 진입).";
          }]);
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
            if (!slot) throw new Error("로컬 n이 없습니다.");
            m.rax = u64(m.rax * slot.value);
            return "factorial(" + n + ") = " + n +
              " × factorial(" + (n - 1) + ") = " + m.rax;
          }]);
        }

        ops.push(["fact(" + n + "): leave", m => {
          m.rsp = m.rbp;
          m.rbp = pop(m);
          return "fact(" + n + ")의 로컬 공간을 반환합니다.";
        }]);

        ops.push(["fact(" + n + "): ret", m => {
          const a = pop(m);
          m.frames.pop();
          return "복귀 주소 " + hex(a) + "로 돌아갑니다.";
        }]);
      }

      return ops;
    }

    const controls = C(root);
    const selector = document.createElement("select");

    [
      ["normal", "main → foo(8인자) → bar"],
      ["recursive", "재귀(recursion): factorial(4)"]
    ].forEach(([v, text]) => {
      const o = E("option", selector, text);
      o.value = v;
    });

    selector.value = state.mode;
    L(controls, "프로그램", selector);

    selector.addEventListener("change", () => {
      state.mode = selector.value;
      reset();
    });

    B(controls, "한 단계(step)", step);
    B(controls, "뒤로(undo)", undo);
    B(controls, "자동 재생", auto);
    B(controls, "리셋", reset);

    const info = S(root);
    const registerHost = E("div", root);
    const codeHost = E("div", root);
    const stackHost = E("div", root);
    const note = S(root);

    function stop() {
      if (state.timer !== null) {
        clearInterval(state.timer);
        state.timer = null;
      }
    }

    function reset() {
      stop();
      state.machine = fresh();
      state.instructions =
        state.mode === "normal" ? buildNormal() : buildRecursive();
      state.index = 0;
      state.snapshots = [];
      state.changed = null;
      state.explanation = "첫 명령을 실행해 호출 규약을 관찰하세요.";
      render();
    }

    function execute() {
      if (state.index >= state.instructions.length) return false;

      const previous = clone(state.machine);
      const beforeIndex = state.index;

      try {
        const [name, action] = state.instructions[state.index];
        const description = action(state.machine);

        state.snapshots.push({
          machine: previous,
          index: beforeIndex
        });

        state.index++;
        state.explanation = description;

        state.changed = {
          rsp: previous.rsp !== state.machine.rsp,
          rbp: previous.rbp !== state.machine.rbp,
          rax: previous.rax !== state.machine.rax,
          rbx: previous.rbx !== state.machine.rbx,
          slots: new Set(
            [...new Set([
              ...previous.slots.keys(),
              ...state.machine.slots.keys()
            ])].filter(k => {
              const a = previous.slots.get(k);
              const b = state.machine.slots.get(k);
              return !a || !b || a.value !== b.value || a.label !== b.label;
            })
          )
        };

        return true;
      } catch (e) {
        state.machine = previous;
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
        state.explanation = "이전 단계로 되돌렸습니다.";
      }
      render();
    }

    function auto() {
      if (state.timer !== null) {
        stop();
        render();
        return;
      }

      state.timer = setInterval(() => {
        const ok = execute();
        render();
        if (!ok || state.index >= state.instructions.length) stop();
      }, 550);
    }

    function render() {
      const m = state.machine;

      info.textContent =
        "단계 " + state.index + "/" + state.instructions.length +
        " · 현재 프레임: " +
        m.frames.map(f => f.name).join(" → ") +
        "\n" + state.explanation;

      clear(registerHost);
      H(registerHost, "레지스터와 스택 정렬");

      const rt = table(registerHost, ["레지스터", "현재 값", "설명"]);
      rt.row(["%rsp", hex(m.rsp), "스택 최상단(top)"],
        state.changed && state.changed.rsp ? [0, 1] : []);
      rt.row(["%rbp", hex(m.rbp), "현재 프레임 기준점"],
        state.changed && state.changed.rbp ? [0, 1] : []);
      rt.row(["%rax", hex(m.rax), "반환값(return value)"],
        state.changed && state.changed.rax ? [0, 1] : []);
      rt.row(["%rbx", hex(m.rbx), "callee-saved"],
        state.changed && state.changed.rbx ? [0, 1] : []);

      argRegs.forEach((r, i) => {
        rt.row(["%" + r, hex(m.registers[r]), "인자 " + (i + 1)]);
      });

      const aligned = m.rsp % 16n;
      E(
        "div",
        registerHost,
        "%rsp mod 16 = " + aligned +
        (aligned === 0n
          ? " · call 직전 요구 정렬과 일치"
          : " · 함수 진입 직후에는 보통 8")
      );

      clear(codeHost);
      H(codeHost, "실행 순서(assembly trace)");

      const stepbar = E("div", codeHost, "", "v6-stepbar");

      state.instructions.forEach(([name], i) => {
        const row = E("div", stepbar, String(i).padStart(2, "0") + "  " + name);
        row.style.fontFamily = "monospace, 'Noto Sans KR', sans-serif";
        row.style.fontSize = "12px";
        row.style.padding = "3px 6px";

        if (i === state.index) {
          row.style.borderLeft = "3px solid " + RED;
          row.style.background = GRID;
        }
      });

      clear(stackHost);
      H(stackHost, "스택 지도(stack grows downward ↓)");

      const slots = [...m.slots.entries()]
        .sort((a, b) => a[0] < b[0] ? 1 : -1);

      const grid = E("div", stackHost);
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "140px minmax(0,1fr) 120px";
      grid.style.gap = "2px";

      if (!slots.length) {
        box(stackHost, "현재 사용 중인 스택 슬롯이 없습니다.");
      }

      slots.forEach(([address, slot]) => {
        const changed =
          state.changed && state.changed.slots.has(address);

        box(grid, hex(address), changed);
        box(grid, slot.label, changed);
        box(grid, hex(slot.value), changed);

        if (address === m.rsp) {
          const pointer = E("div", grid, "← %rsp");
          pointer.style.color = RED;
        } else if (address === m.rbp) {
          const pointer = E("div", grid, "← %rbp");
          pointer.style.color = INK;
        } else {
          E("div", grid);
        }
      });

      note.textContent =
        "System V AMD64 기준:\n" +
        "• 정수·포인터 인자 1~6 → rdi, rsi, rdx, rcx, r8, r9.\n" +
        "• 7번째부터는 caller가 스택에 배치합니다.\n" +
        "• caller-saved: rax, rcx, rdx, rsi, rdi, r8–r11.\n" +
        "• callee-saved: rbx, rbp, r12–r15 (rsp도 복구).\n" +
        "• call 직전 %rsp는 16바이트 정렬, 함수 진입 시 %rsp mod 16=8.\n" +
        "• 고정 단계별 교육용 추적이며 실제 프로그램 카운터는 실행하지 않습니다.";
    }

    reset();
  });

  // ============================================================
  // 2. Struct Layout
  // ============================================================

  V6.register("struct-layout", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    T(root, "구조체 메모리 배치(struct layout)");

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
    let previousSize = null;
    let message = "";

    const controls = C(root);
    const arrayInput = inputText(controls, "char[n]의 n", "5");
    arrayInput.setAttribute("aria-label", "char 배열 길이");

    TYPES.forEach(([type, size, align]) => {
      B(controls, "+ " + type, () => {
        try {
          let actualSize = size;

          if (type === "char[n]") {
            const n = Number(arrayInput.value);
            if (!Number.isSafeInteger(n) || n < 1 || n > 64) {
              throw new Error("char[n] 길이는 1~64의 정수여야 합니다.");
            }
            actualSize = n;
          }

          if (fields.length >= 24) {
            throw new Error("필드는 최대 24개까지 추가할 수 있습니다.");
          }

          fields.push({
            id: nextId++,
            type: type === "char[n]" ? "char[" + actualSize + "]" : type,
            size: actualSize,
            align,
            label: "f" + nextId
          });

          message = type + " 필드를 추가했습니다.";
          render();
        } catch (e) {
          notice(info, e.message);
        }
      });
    });

    B(controls, "정렬 최적화", () => {
      const before = layout(fields).size;

      fields.sort((a, b) =>
        b.align - a.align || b.size - a.size || a.id - b.id
      );

      const after = layout(fields).size;
      message =
        "정렬 요구 K가 큰 필드부터 배치했습니다. " +
        "sizeof " + before + " → " + after +
        " B; 절약 " + (before - after) + " B.";
      render();
    });

    B(controls, "초기화", () => {
      fields = [
        { id: 1, type: "char", size: 1, align: 1, label: "a" },
        { id: 2, type: "long", size: 8, align: 8, label: "b" },
        { id: 3, type: "char", size: 1, align: 1, label: "c" }
      ];
      nextId = 4;
      message = "";
      render();
    });

    const listHost = E("div", root);
    const gridHost = E("div", root);
    const info = S(root);

    function roundUp(value, alignment) {
      return Math.ceil(value / alignment) * alignment;
    }

    function layout(items) {
      let cursor = 0;
      let maximumAlignment = 1;
      const positioned = [];
      const padding = [];

      items.forEach(f => {
        const offset = roundUp(cursor, f.align);

        for (let b = cursor; b < offset; b++) {
          padding.push({ offset: b, type: "internal" });
        }

        positioned.push({ ...f, offset });

        cursor = offset + f.size;
        maximumAlignment = Math.max(maximumAlignment, f.align);
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
        internal: padding.filter(p => p.type === "internal").length,
        external: padding.filter(p => p.type === "external").length
      };
    }

    function render() {
      const result = layout(fields);

      clear(listHost);
      H(listHost, "필드 순서(field order)");

      const tb = table(listHost, [
        "필드", "타입", "크기", "정렬 K", "offset", "작업"
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

        B(cell, "↑", () => {
          if (index > 0) {
            [fields[index - 1], fields[index]] =
              [fields[index], fields[index - 1]];
          }
          render();
        });

        B(cell, "↓", () => {
          if (index < fields.length - 1) {
            [fields[index + 1], fields[index]] =
              [fields[index], fields[index + 1]];
          }
          render();
        });

        B(cell, "삭제", () => {
          fields = fields.filter(x => x.id !== f.id);
          render();
        });
      });

      clear(gridHost);
      H(gridHost, "바이트 지도(byte map, 한 줄 8바이트)");

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

      const wrap = E("div", gridHost);
      wrap.style.display = "grid";
      wrap.style.gridTemplateColumns = "repeat(8, minmax(0,1fr))";
      wrap.style.gap = "3px";

      cells.forEach((c, i) => {
        const x = E(
          "div",
          wrap,
          c.padding ? "PAD" : c.text
        );

        x.style.border = "1px solid " + INK;
        x.style.minHeight = "43px";
        x.style.padding = "4px";
        x.style.textAlign = "center";
        x.style.fontSize = "11px";
        x.style.color = c.padding ? RED : INK;

        E("div", x, "+" + i).style.fontSize = "10px";
        x.title = c.padding
          ? (c.type === "internal" ? "내부 패딩" : "끝 패딩")
          : ("offset " + i);
      });

      if (!result.size) {
        box(gridHost, "필드가 없습니다.");
      }

      info.textContent =
        (message ? message + "\n\n" : "") +
        "sizeof(struct) = " + result.size + " B\n" +
        "최대 정렬 요구(max alignment) = " + result.maxAlign + " B\n" +
        "내부 패딩(internal padding) = " + result.internal + " B\n" +
        "끝 패딩(tail padding) = " + result.external + " B\n" +
        "실제 데이터 = " +
        result.fields.reduce((sum, f) => sum + f.size, 0) + " B\n\n" +
        "규칙: 각 field offset은 alignof(T)의 배수여야 합니다.\n" +
        "sizeof(struct)는 최대 정렬 요구의 배수로 올림합니다.\n" +
        "모델: 일반적인 x86-64 System V ABI, long/포인터/double=8B.";
    }

    render();
  });

  // ============================================================
  // 3. Array Indexing
  // ============================================================

  V6.register("array-index", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    T(root, "2차원 배열과 포인터 산술(array indexing)");

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
      0x3000n, 0x4100n, 0x3500n, 0x5000n
    ];

    const controls = C(root);

    B(controls, "중첩 배열(nested)", () => {
      state.mode = "nested";
      render();
    });

    B(controls, "다단계 배열(multi-level)", () => {
      state.mode = "multi";
      render();
    });

    const matrixHost = E("div", root);
    const memoryHost = E("div", root);
    const info = S(root);

    function render() {
      clear(matrixHost);
      H(matrixHost, "int A[4][5] — 셀을 클릭하세요");

      const grid = E("div", matrixHost);
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(5, minmax(0,1fr))";
      grid.style.gap = "4px";

      for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
          const selected = state.i === i && state.j === j;

          const b = B(grid, "A[" + i + "][" + j + "]", () => {
            state.i = i;
            state.j = j;
            render();
          });

          b.style.color = selected ? RED : INK;
          b.style.borderColor = selected ? RED : INK;
          b.style.fontSize = "12px";
        }
      }

      clear(memoryHost);

      const i = state.i;
      const j = state.j;

      if (state.mode === "nested") {
        H(memoryHost, "연속 메모리(row-major, 80바이트)");

        const strip = E("div", memoryHost);
        strip.style.display = "grid";
        strip.style.gridTemplateColumns = "repeat(20, minmax(0,1fr))";
        strip.style.gap = "2px";

        const selectedOffset = (i * COLS + j) * 4;

        for (let offset = 0; offset < 80; offset++) {
          const active =
            offset >= selectedOffset &&
            offset < selectedOffset + 4;

          const cell = E(
            "div",
            strip,
            String(offset)
          );

          cell.style.border = "1px solid " + INK;
          cell.style.padding = "5px 1px";
          cell.style.fontSize = "10px";
          cell.style.textAlign = "center";
          cell.style.color = active ? RED : INK;
          cell.title = hex(BASE + BigInt(offset));
        }

        const linear = i * COLS + j;
        const offset = linear * 4;
        const address = BASE + BigInt(offset);

        info.textContent =
          "선택: A[" + i + "][" + j + "]\n\n" +
          "주소 = base + (i·C + j)·sizeof(int)\n" +
          "     = " + hex(BASE) +
          " + (" + i + "·5 + " + j + ")·4\n" +
          "     = " + hex(BASE) + " + " + offset + "\n" +
          "     = " + hex(address) + "\n\n" +
          "sizeof(A) = 4·5·4 = 80 B\n" +
          "int* p라면 p+1은 4바이트 전진합니다.\n" +
          "int (*)[5] p라면 p+1은 20바이트 전진합니다.\n" +
          "모든 행은 끊김 없이 연속 저장됩니다.";
      } else {
        H(memoryHost, "포인터 배열 → 행 데이터(2단계 역참조)");

        const pointers = table(memoryHost, [
          "A[i] 포인터 슬롯",
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

        line(memoryHost);

        const rows = table(memoryHost, [
          "행", "시작 주소", "5개 int 요소"
        ]);

        for (let r = 0; r < ROWS; r++) {
          rows.row(
            [
              "row " + r,
              hex(rowAddresses[r]),
              Array.from({ length: 5 }, (_, c) =>
                hex(rowAddresses[r] + BigInt(c * 4))
              ).join("  ")
            ],
            r === i ? [0, 1, 2] : []
          );
        }

        const pointerSlot = POINTER_BASE + BigInt(i * 8);
        const rowAddress = rowAddresses[i];
        const target = rowAddress + BigInt(j * 4);

        info.textContent =
          "모델: int *A[4] (행 포인터 4개)\n\n" +
          "1단계: &(A[" + i + "]) = " +
          hex(POINTER_BASE) + " + " + i + "·8 = " +
          hex(pointerSlot) + "\n" +
          "2단계: A[" + i + "] = *(" +
          hex(pointerSlot) + ") = " + hex(rowAddress) + "\n" +
          "3단계: &A[" + i + "][" + j + "] = " +
          hex(rowAddress) + " + " + j + "·4 = " +
          hex(target) + "\n\n" +
          "행마다 별도 위치에 저장될 수 있습니다.\n" +
          "int *A[4]의 포인터 배열 자체 크기는 4·8=32B이며\n" +
          "각 행 데이터 20B는 별도로 할당된 예시입니다.\n" +
          "중첩 배열 int A[4][5]와 저장 구조가 다릅니다.";
      }
    }

    render();
  });

  // ============================================================
  // 4. Buffer Overflow
  // ============================================================

  V6.register("buf-overflow", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    T(root, "스택 버퍼 오버플로(stack buffer overflow)");

    let N = goodInteger(cfg.n, 8, 4, 16);
    let input = "HELLO";
    let canary = false;
    let aslr = true;
    let nx = true;
    let retResult = "";

    const controls = C(root);

    range(controls, "buf 크기 N", 4, 16, N, v => {
      N = v;
      retResult = "";
      render();
    });

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

    text.style.width = "240px";

    const defenses = C(root);

    const protector = document.createElement("input");
    protector.type = "checkbox";
    L(defenses, "Stack protector(canary)", protector);

    protector.addEventListener("change", () => {
      canary = protector.checked;
      retResult = "";
      render();
    });

    const aslrInput = document.createElement("input");
    aslrInput.type = "checkbox";
    aslrInput.checked = true;
    L(defenses, "ASLR", aslrInput);

    aslrInput.addEventListener("change", () => {
      aslr = aslrInput.checked;
      render();
    });

    const nxInput = document.createElement("input");
    nxInput.type = "checkbox";
    nxInput.checked = true;
    L(defenses, "NX", nxInput);

    nxInput.addEventListener("change", () => {
      nx = nxInput.checked;
      render();
    });

    B(defenses, "ret 실행", () => {
      const model = calculate();

      if (canary && model.canaryCorrupt) {
        retResult =
          "__stack_chk_fail: canary 값이 변경되어 반환 전 프로그램을 중단합니다.";
      } else if (model.returnCorrupt) {
        retResult =
          "반환 주소(return address)가 오염되었습니다. ret은 변조된 주소를 읽습니다.\n" +
          "실제 결과는 주소·메모리 권한·시스템 방어에 따라 달라집니다. " +
          "유효하지 않은 주소라면 segmentation fault가 발생할 수 있습니다.";
      } else if (model.rbpCorrupt) {
        retResult =
          "saved %rbp가 손상되었지만 반환 주소 자체는 이 모델에서 보존되었습니다. " +
          "이후 실행의 동작은 손상된 프레임 포인터 사용 여부에 따라 달라집니다.";
      } else {
        retResult =
          "반환 주소와 saved %rbp가 보존되어 있습니다. 정상 복귀를 시뮬레이션합니다.";
      }

      render();
    });

    const diagram = E("div", root);
    const info = S(root);

    function utf8Bytes(s) {
      return Array.from(new TextEncoder().encode(s));
    }

    function calculate() {
      const bytes = utf8Bytes(input);
      const writeLength = bytes.length + 1; // gets() writes terminating NUL.

      // Teaching layout:
      // buf[N], optional canary[8], saved rbp[8], return address[8].
      const canaryStart = N;
      const rbpStart = N + (canary ? 8 : 0);
      const retStart = rbpStart + 8;

      return {
        bytes,
        writeLength,
        canaryStart,
        rbpStart,
        retStart,
        canaryCorrupt: canary && writeLength > canaryStart,
        rbpCorrupt: writeLength > rbpStart,
        returnCorrupt: writeLength > retStart
      };
    }

    function render() {
      const m = calculate();
      clear(diagram);

      H(diagram, "스택 슬롯(낮은 주소 → 높은 주소)");

      const base = 0x7fffffffe000n;
      const total = m.retStart + 8;

      const grid = E("div", diagram);
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "150px minmax(0,1fr)";
      grid.style.gap = "2px";

      function region(offset) {
        if (offset < N) return "buf[" + offset + "]";
        if (canary && offset < m.rbpStart) return "canary";
        if (offset < m.retStart) return "saved %rbp";
        return "return address";
      }

      for (let offset = 0; offset < total; offset++) {
        const overwritten = offset < m.writeLength;
        const corrupted = overwritten && offset >= N;

        const address = base + BigInt(offset);

        box(grid, hex(address), corrupted);

        let value = "—";

        if (offset < m.bytes.length) {
          value = "0x" +
            m.bytes[offset].toString(16).padStart(2, "0");
        } else if (offset === m.bytes.length) {
          value = "0x00 (NUL)";
        }

        box(
          grid,
          region(offset) +
          " · " +
          (overwritten ? "쓰기: " + value : "기존 값 유지"),
          corrupted
        );
      }

      const overflowCount = Math.max(0, m.writeLength - N);

      info.textContent =
        "buf 크기 = " + N + "바이트\n" +
        "입력 UTF-8 길이 = " + m.bytes.length + "바이트\n" +
        "gets()가 쓰는 크기 = " + m.writeLength +
        "바이트 (끝 NUL 포함)\n" +
        "buf 경계 초과 = " + overflowCount + "바이트\n\n" +
        "saved %rbp 침범: " + (m.rbpCorrupt ? "예" : "아니오") + "\n" +
        "return address 침범: " +
        (m.returnCorrupt ? "예" : "아니오") + "\n" +
        (canary
          ? "canary 변경: " + (m.canaryCorrupt ? "예" : "아니오") + "\n"
          : "") +
        "\n" +
        (retResult ? retResult + "\n\n" : "") +
        "ASLR: " + (aslr ? "활성" : "비활성") +
        " — 주소 배치를 예측하기 어렵게 합니다.\n" +
        "NX: " + (nx ? "활성" : "비활성") +
        " — 비실행 메모리의 코드 실행을 제한합니다.\n\n" +
        "가장 중요한 방어는 애초에 버퍼 길이를 검사하는 안전한 입력 처리입니다.\n" +
        "이 그림은 취약한 스택 배치를 단순화한 모델입니다. 실제 컴파일러는 패딩, canary 위치, 프레임 생략 등을 다르게 구성할 수 있습니다.";
    }

    render();
  });

  // ============================================================
  // 5. Byte Ordering
  // ============================================================

  V6.register("byte-order", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    T(root, "바이트 순서(endianness)");

    let value = 0x01234567n;
    let width = 4;
    let mode = "number";
    let ascii = "0123";

    if (cfg.value !== undefined) {
      try {
        const parsed = parseIntExact(cfg.value);
        if (parsed < 0n || parsed > 0xffffffffn) {
          throw new Error("32비트 범위를 초과했습니다.");
        }
        value = parsed;
      } catch (_) {}
    }

    const controls = C(root);
    const text = inputText(
      controls,
      "32비트 값(hex/decimal)",
      hex(value, 8),
      update
    );

    B(controls, "32비트(int)", () => {
      width = 4;
      mode = "number";
      update();
    });

    B(controls, "16비트(short)", () => {
      width = 2;
      mode = "number";
      update();
    });

    B(controls, "문자열 ASCII", () => {
      mode = "ascii";
      render();
    });

    const diagram = E("div", root);
    const info = S(root);

    function update() {
      try {
        const n = parseIntExact(text.value);

        if (n < 0n || n > 0xffffffffn) {
          throw new Error("0..0xFFFFFFFF 범위여야 합니다.");
        }

        value = n;
        mode = "number";
        render();
      } catch (e) {
        notice(info, e.message);
      }
    }

    function drawRow(parent, name, bytes, indices) {
      H(parent, name);

      const grid = E("div", parent);
      grid.style.display = "grid";
      grid.style.gridTemplateColumns =
        "repeat(" + bytes.length + ", minmax(0,1fr))";
      grid.style.gap = "5px";

      bytes.forEach((b, i) => {
        const cell = box(grid, "주소 +" + i + "\n0x" + b.toString(16).padStart(2, "0"));
        cell.style.whiteSpace = "pre-wrap";
        cell.style.textAlign = "center";
        cell.title = "원래 값의 byte " + indices[i];
      });
    }

    function render() {
      clear(diagram);

      if (mode === "ascii") {
        const encoded = Array.from(new TextEncoder().encode(ascii));

        H(diagram, '문자열 "0123" — 문자별 1바이트');

        drawRow(
          diagram,
          "메모리 주소 증가 방향",
          [...encoded, 0],
          [0, 1, 2, 3, "NUL"]
        );

        info.textContent =
          '문자열 "0123\\0"의 바이트:\n' +
          "0x30 0x31 0x32 0x33 0x00\n\n" +
          "문자열은 바이트 배열이므로 endianness 자체가 문자 순서를 바꾸지 않습니다.\n" +
          "다만 이 바이트들을 하나의 다바이트 정수로 해석하면 값이 바뀔 수 있습니다.";
        return;
      }

      const mask = (1n << BigInt(width * 8)) - 1n;
      const v = value & mask;

      const little = [];
      const big = [];

      for (let i = 0; i < width; i++) {
        little.push(Number((v >> BigInt(i * 8)) & 255n));
      }

      for (let i = width - 1; i >= 0; i--) {
        big.push(little[i]);
      }

      drawRow(
        diagram,
        "Little-endian (x86-64)",
        little,
        Array.from({ length: width }, (_, i) => i)
      );

      drawRow(
        diagram,
        "Big-endian",
        big,
        Array.from({ length: width }, (_, i) => width - 1 - i)
      );

      info.textContent =
        "값: " + hex(v, width * 2) + "\n" +
        "크기: " + width + "바이트\n\n" +
        "Little-endian: " +
        little.map(x => "0x" + x.toString(16).padStart(2, "0")).join(" ") +
        "\nBig-endian: " +
        big.map(x => "0x" + x.toString(16).padStart(2, "0")).join(" ") +
        "\n\n" +
        "Little-endian은 최하위 바이트(LSB)를 낮은 주소에 저장합니다.\n" +
        "Big-endian은 최상위 바이트(MSB)를 낮은 주소에 저장합니다.\n" +
        "바이트 순서는 다르지만, 해당 endian 규칙으로 읽으면 같은 정수 값입니다.";
    }

    render();
  });

  // ============================================================
  // 6. Virtual Memory Layout
  // ============================================================

  V6.register("mem-layout", function (root, cfg) {
    cfg = cfg && typeof cfg === "object" ? cfg : {};
    T(root, "프로세스 가상주소 공간(virtual address space)");

    // Illustrative Linux x86-64 process, 4-level paging (48-bit
    // canonical addresses, 47-bit lower-half user range).
    // Not an actual /proc/<pid>/maps representation.
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
    let message = "";

    const controls = C(root);

    const addressInput = inputText(
      controls,
      "가상주소(hex)",
      hex(selected),
      () => {
        try {
          selected = parseIntExact(addressInput.value);
          if (selected < 0n || selected > MASK64) {
            throw new Error("64비트 주소 범위를 초과했습니다.");
          }
          message = "";
          render();
        } catch (e) {
          notice(info, e.message);
        }
      }
    );

    addressInput.style.width = "225px";

    B(controls, "malloc(+4KiB)", () => {
      if (heapSize + 0x1000n > 0x100000n) {
        notice(info, "교육용 heap 크기 상한(1MiB)에 도달했습니다.");
        return;
      }

      heapSize += 0x1000n;
      message = "malloc 시뮬레이션: heap의 높은 주소 방향으로 4KiB 증가.";
      render();
    });

    B(controls, "함수 호출(stack −256B)", () => {
      if (stackUsed + 256n > 0x10000n) {
        notice(info, "교육용 stack 사용량 상한(64KiB)에 도달했습니다.");
        return;
      }

      stackUsed += 256n;
      message = "함수 호출 시뮬레이션: %rsp가 낮은 주소로 256B 이동.";
      render();
    });

    B(controls, "반환(stack +256B)", () => {
      stackUsed = stackUsed > 0x1000n
        ? stackUsed - 256n
        : 0x1000n;
      message = "함수 반환으로 스택 사용량이 감소했습니다.";
      render();
    });

    B(controls, "리셋", () => {
      heapSize = 0x1000n;
      stackUsed = 0x1000n;
      message = "";
      render();
    });

    const diagram = E("div", root);
    const info = S(root);

    function classify(addr) {
      if (addr < 0n || addr > MASK64) {
        return "잘못된 주소";
      }

      if (addr >= KERNEL_START) {
        return "커널 영역(kernel canonical half) — 사용자 모드 접근 불가";
      }

      if (addr > 0x00007ffffffffffen) {
        return "비정규 주소(non-canonical gap)";
      }

      if (addr >= BASES.stack - stackUsed &&
          addr < BASES.stack) {
        return "스택(stack) — 아래로 성장";
      }

      if (addr >= BASES.mmap &&
          addr < BASES.mmap + 0x100000n) {
        return "mmap/공유 라이브러리 영역(예시)";
      }

      if (addr >= BASES.heap &&
          addr < BASES.heap + heapSize) {
        return "힙(heap) — 위로 성장";
      }

      if (addr >= BASES.data &&
          addr < BASES.data + 0x10000n) {
        return "data/bss 영역(예시)";
      }

      if (addr >= BASES.text &&
          addr < BASES.text + 0x10000n) {
        return "text 코드 영역(예시, 읽기+실행)";
      }

      return "교육용 지도에서 매핑되지 않은 영역";
    }

    function render() {
      clear(diagram);
      H(diagram, "높은 주소 ↑ / 낮은 주소 ↓");

      const regions = [
        ["커널 영역(kernel)", "0xFFFF800000000000 ~", "사용자 접근 불가"],
        ["비정규 주소 간격", "canonical hole", "접근 불가"],
        ["스택(stack)", "0x00007FFFFFFFE000 부근", "↓ 낮은 주소 방향"],
        ["mmap / 공유 라이브러리", "0x00007F0000000000 부근", "매핑 기반"],
        ["미매핑 간격", "주소 범위는 실행마다 다름", ""],
        ["힙(heap)", "0x0000000000800000 부근", "↑ 높은 주소 방향"],
        ["data / bss", "0x0000000000600000 부근", "전역·정적 데이터"],
        ["text", "0x0000000000400000 부근", "읽기 + 실행"],
        ["낮은 주소 / 보호 영역", "0x0000000000000000 부근", "NULL 등"]
      ];

      const stack = E("div", diagram);
      stack.style.display = "grid";
      stack.style.gap = "3px";
      stack.style.maxWidth = "650px";

      regions.forEach(([name, address, explanation], index) => {
        const region = E("div", stack);
        region.style.border = "1px solid " + INK;
        region.style.padding = "10px";
        region.style.background = "white";

        const heading = E("div", region, name);
        heading.style.fontWeight = "bold";

        E("div", region, address).style.fontFamily = "monospace, 'Noto Sans KR', sans-serif";
        E("div", region, explanation).style.fontSize = "12px";

        if (index === 2 || index === 5) {
          const bar = E("div", region);
          bar.style.height = "5px";
          bar.style.border = "1px solid " + GRID;
          bar.style.marginTop = "7px";

          const fill = E("div", bar);
          fill.style.height = "100%";
          fill.style.background = RED;

          const amount = index === 2
            ? Number(stackUsed) / 65536
            : Number(heapSize) / 1048576;

          fill.style.width = Math.max(2, Math.min(100, amount * 100)) + "%";
          fill.style.transition = "width 250ms ease";
        }
      });

      const category = classify(selected);

      info.textContent =
        (message ? message + "\n\n" : "") +
        "선택 주소: " + hex(selected) + "\n" +
        "판정: " + category + "\n\n" +
        "현재 heap 시뮬레이션 크기: " + heapSize + " B\n" +
        "현재 stack 시뮬레이션 사용량: " + stackUsed + " B\n\n" +
        "Linux x86-64의 전형적인 4단계 페이지 테이블(48비트 canonical 주소) 설명용 지도입니다.\n" +
        "실제 매핑 주소·권한은 운영체제, ASLR, PIE, 프로세스 설정에 따라 달라집니다.\n" +
        "특히 스택은 높은 주소에서 낮은 주소로, 전형적인 brk 기반 heap은 낮은 주소에서 높은 주소로 확장됩니다.\n" +
        "Stack overflow 위젯에서는 스택 영역 안의 return address가 왜 중요한지 확인할 수 있습니다.";
    }

    render();
  });

})();
