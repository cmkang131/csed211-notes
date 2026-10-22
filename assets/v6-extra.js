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
        h="A << "+k+": 왼쪽으로 "+k+"칸, 오른쪽 빈자리는 0으로 채움. 값 = A·2"+sup(k)+" mod 2"+sup(w)+": "+ua+"·"+P+" mod "+Math.pow(2,w)+" = "+(res.ub?"? (UB)":ur)+(res.ub?"":" (unsigned)");
        if(!res.ub&&lost)h+="\n"+R+"1인 비트가 위로 밀려나 버려짐 → unsigned 오버플로(값이 2"+sup(w)+"로 나눈 나머지가 됨)"+E;
        if(!res.ub&&ta*P!==tr)h+="\n"+R+"signed로 보면 "+mns(ta)+"·"+P+" = "+mns(ta*P)+" 이지만 결과 비트열은 "+mns(tr)+" → signed 오버플로 (C에서 signed 오버플로·음수의 << 는 UB; 하드웨어는 보통 이 비트열을 낸다)"+E;
        break;
      case "lshr": h="A >> "+k+" (logical, 논리): 왼쪽 빈자리를 0으로 채움 → unsigned 나눗셈 ⌊U/2"+sup(k)+"⌋ = ⌊"+ua+"/"+P+"⌋ = "+(res.ub?"? (UB)":ur)+".\nC에서 unsigned 의 >> 는 항상 논리 시프트.";
        if(!res.ub&&(A>>(w-1))&1)h+="\n"+R+"A의 부호 비트가 1 → 산술 시프트였다면 "+C.hex(C.bitop("ashr",A,0,k,w).r,w)+" (왼쪽이 1로 채워짐)"+E;
        break;
      case "ashr": var sb=(A>>(w-1))&1,fl=Math.floor(ta/P),tz=Math.trunc(ta/P);
        h="A >> "+k+" (arithmetic, 산술): 왼쪽 빈자리를 부호 비트 a"+sub(w-1)+" = "+sb+" 로 채움 → signed 나눗셈 ⌊T/2"+sup(k)+"⌋ = ⌊"+mns(ta)+"/"+P+"⌋ = "+(res.ub?"? (UB)":mns(tr))+".";
        if(sb===0)h+="\n부호 비트가 0이면 산술 시프트 = 논리 시프트.";
        else if(!res.ub&&fl!==tz)h+="\n"+R+"C의 정수 나눗셈 "+mns(ta)+"/"+P+" 은 0 쪽으로 자르므로 "+mns(tz)+" ≠ "+mns(fl)+E+" → 같게 하려면 (A + 2"+sup(k)+" − 1) >> k (bias 더하기).";
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

