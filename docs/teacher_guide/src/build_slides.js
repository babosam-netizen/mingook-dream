const pptxgen = require("pptxgenjs");
const path = require("path");

const IMG = "/Volumes/web/class_democra/teacher_guide/img";
const OUT = "/Volumes/web/class_democra/teacher_guide/02_통합슬라이드_시민광장_선거.pptx";

const C = {
  indigo:"4338CA", indigo2:"6366F1", dark:"1E1B4B", darkPanel:"312E81",
  amber:"F59E0B", amberDk:"92400E", amberBg:"FEF3C7", amberSoft:"FFFBEB",
  rose:"E11D48", roseDk:"9F1239", roseBg:"FFE4E6", roseSoft:"FFF1F2",
  teal:"14B8A6", slate:"334155", gray:"64748B", lightGray:"E2E8F0", white:"FFFFFF",
  ink:"1E293B"
};
const F = "Malgun Gothic";

const pres = new pptxgen();
pres.defineLayout({ name:"W", width:13.333, height:7.5 });
pres.layout = "W";
pres.author = "민국이의 꿈";
pres.title = "교사 안내 — 시민광장·선거 여정";
const W = 13.333, H = 7.5;

const shadow = () => ({ type:"outer", color:"000000", blur:7, offset:3, angle:135, opacity:0.16 });

// ---------- Slide 1: Title (dark) ----------
(() => {
  const s = pres.addSlide();
  s.background = { color: C.dark };
  // motif: 4 journey dots top-right
  const dots = [[C.amber],[C.rose],[C.indigo2],[C.teal]];
  dots.forEach((c,i)=> s.addShape(pres.shapes.OVAL,{ x:10.2+i*0.62, y:0.55, w:0.42, h:0.42, fill:{color:c[0]} }));
  s.addText("민국이의 꿈", { x:0.9, y:2.0, w:11.5, h:1.3, fontFace:F, fontSize:60, bold:true, color:C.white });
  s.addText("교실을 ‘작은 대한민국’으로 — 주제통합(국어+사회) 시뮬레이션", { x:0.95, y:3.25, w:11, h:0.6, fontFace:F, fontSize:20, color:"C7D2FE" });
  s.addShape(pres.shapes.RECTANGLE,{ x:0.95, y:4.15, w:5.6, h:0.06, fill:{color:C.amber} });
  s.addText([
    { text:"교사 안내서  ", options:{ bold:true, color:C.white } },
    { text:"첫 번째 여정 ‘시민 광장’ · 두 번째 여정 ‘선거’  (1~9차시)", options:{ color:"A5B4FC" } },
  ], { x:0.95, y:4.4, w:11.5, h:0.7, fontFace:F, fontSize:22 });
  s.addText("문서 · 기능 설명서 · 인포그래픽 통합본", { x:0.95, y:6.6, w:8, h:0.4, fontFace:F, fontSize:13, color:"818CF8" });
})();

// ---------- Slide 2: 프로젝트 한눈에 (4 journey flow) ----------
(() => {
  const s = pres.addSlide();
  s.background = { color:"F8FAFC" };
  s.addText("프로젝트 한눈에 — 네 번의 여정", { x:0.7, y:0.45, w:12, h:0.7, fontFace:F, fontSize:32, bold:true, color:C.indigo });
  s.addText("모든 여정은 첫 여정에서 정한 ‘최우선 과제’ 하나를 중심으로 이어집니다.", { x:0.72, y:1.18, w:12, h:0.5, fontFace:F, fontSize:17, color:C.gray });

  const cards = [
    { n:"①", t:"시민 광장", s:"1~5차시 · 의제 설정", d:"문제 발굴 → 시민단체 → 최우선 과제 선정", c:C.amber, bg:C.amberSoft, dk:C.amberDk, on:true },
    { n:"②", t:"선거", s:"6~9차시 · 대표 선출", d:"공약·토론·검증 → 1인 1표 투표", c:C.rose, bg:C.roseSoft, dk:C.roseDk, on:true },
    { n:"③", t:"국정 포털", s:"10~18차시 · 국정 운영", d:"입법 · 행정 · 사법 활동", c:C.indigo2, bg:"EEF2FF", dk:C.indigo, on:false },
    { n:"④", t:"시사회", s:"19~20차시 · 정리", d:"정리글 · 갤러리 워크 · 디브리핑", c:C.teal, bg:"F0FDFA", dk:"0F766E", on:false },
  ];
  const cw=2.78, gap=0.34, x0=0.7, y0=2.1, ch=3.7;
  cards.forEach((cd,i)=>{
    const x = x0 + i*(cw+gap);
    s.addShape(pres.shapes.RECTANGLE,{ x, y:y0, w:cw, h:ch, fill:{color:cd.bg}, line:{color:cd.c,width:2}, shadow:shadow() });
    s.addShape(pres.shapes.RECTANGLE,{ x, y:y0, w:cw, h:0.7, fill:{color:cd.c} });
    s.addText(cd.n+"  "+cd.t, { x:x, y:y0, w:cw, h:0.7, fontFace:F, fontSize:21, bold:true, color:C.white, align:"center", valign:"middle", margin:0 });
    s.addText(cd.s, { x:x+0.2, y:y0+0.95, w:cw-0.4, h:0.5, fontFace:F, fontSize:14, bold:true, color:cd.dk });
    s.addText(cd.d, { x:x+0.2, y:y0+1.55, w:cw-0.4, h:1.6, fontFace:F, fontSize:15, color:C.ink, valign:"top" });
    if(cd.on) s.addText("본 안내 대상", { x:x+0.2, y:y0+ch-0.55, w:cw-0.4, h:0.4, fontFace:F, fontSize:12, bold:true, color:cd.dk });
    if(i<3) s.addText("→", { x:x+cw-0.02, y:y0+ch/2-0.35, w:gap+0.04, h:0.7, fontFace:F, fontSize:26, bold:true, color:C.gray, align:"center", valign:"middle" });
  });
  s.addText("큰 흐름:  문제를 찾고(①)  →  해결할 대표를 뽑는다(②)", { x:0.7, y:6.35, w:12, h:0.6, fontFace:F, fontSize:18, bold:true, color:C.slate });
})();

// ---------- Journey overview slide (infographic + side panel) ----------
function journeySlide(opts){
  const s = pres.addSlide();
  s.background = { color: opts.soft };
  // side panel left
  s.addText(opts.badge, { x:0.55, y:0.55, w:5.0, h:0.5, fontFace:F, fontSize:18, bold:true, color:C.white,
    fill:{color:opts.c}, align:"center", valign:"middle" });
  s.addText(opts.title, { x:0.5, y:1.2, w:5.4, h:1.0, fontFace:F, fontSize:44, bold:true, color:opts.dk });
  s.addText(opts.sess, { x:0.55, y:2.15, w:5.4, h:0.45, fontFace:F, fontSize:17, bold:true, color:opts.c });
  s.addShape(pres.shapes.RECTANGLE,{ x:0.55, y:2.75, w:5.0, h:1.7, fill:{color:C.white}, line:{color:opts.c,width:1.5}, shadow:shadow() });
  s.addText("🧭 이 여정의 의미", { x:0.75, y:2.9, w:4.7, h:0.4, fontFace:F, fontSize:15, bold:true, color:opts.dk, margin:0 });
  s.addText(opts.meaning, { x:0.75, y:3.32, w:4.6, h:1.05, fontFace:F, fontSize:14.5, color:C.ink, valign:"top", margin:0 });
  // 산출물 / 다음
  s.addShape(pres.shapes.RECTANGLE,{ x:0.55, y:4.65, w:5.0, h:0.95, fill:{color:C.white}, line:{color:opts.c,width:1} });
  s.addText([{text:"📌 산출물  ",options:{bold:true,color:opts.dk}},{text:opts.out,options:{color:C.ink}}],
    { x:0.72, y:4.72, w:4.7, h:0.8, fontFace:F, fontSize:13.5, valign:"middle", margin:0 });
  s.addText("자세한 단계는 오른쪽 인포그래픽 →", { x:0.55, y:5.8, w:5.0, h:0.4, fontFace:F, fontSize:12, italic:true, color:C.gray });
  // infographic image (fit height)
  const ratio = opts.imgW/opts.imgH;
  const ih = 7.1, iw = ih*ratio;
  s.addImage({ path: path.join(IMG, opts.img), x: W - iw - 0.5, y:(H-ih)/2, w:iw, h:ih });
  return s;
}

journeySlide({
  badge:"🌱 첫 번째 여정", title:"시민 광장", sess:"1~5차시", c:C.amber, dk:C.amberDk, soft:C.amberSoft,
  meaning:"시민(학생)이 직접 문제를 발굴하고, 시민단체로 목소리를 모아 우리 반의 ‘최우선 과제’를 정하는 의제 설정의 단계.",
  out:"최우선 과제 1개 + 시민단체 + 캠페인 자료 + 기사",
  img:"info_journey1.png", imgW:2480, imgH:3720,
});
journeySlide({
  badge:"🗳️ 두 번째 여정", title:"선거", sess:"6~9차시", c:C.rose, dk:C.roseDk, soft:C.roseSoft,
  meaning:"최우선 과제를 해결할 대표(대통령)를 공약·검증·토론으로 가려 뽑는 대의 민주주의 체험. 선거 4원칙을 배운다.",
  out:"당선 대표 + 공약·지지문 + 토론·결과 기사",
  img:"info_journey2.png", imgW:2480, imgH:3800,
});

// ---------- Prep slide (알아야 할 내용 + 교사 준비물) ----------
function prepSlide(opts){
  const s = pres.addSlide();
  s.background = { color:"F8FAFC" };
  s.addText(opts.badge, { x:0.7, y:0.5, w:3.4, h:0.5, fontFace:F, fontSize:16, bold:true, color:C.white, fill:{color:opts.c}, align:"center", valign:"middle" });
  s.addText(opts.heading, { x:4.3, y:0.5, w:8.3, h:0.6, fontFace:F, fontSize:28, bold:true, color:opts.dk, valign:"middle" });

  const colW=5.9, x1=0.7, x2=0.7+colW+0.5, y0=1.6, ch=5.0;
  // know
  s.addShape(pres.shapes.RECTANGLE,{ x:x1, y:y0, w:colW, h:ch, fill:{color:"EFF6FF"}, line:{color:"BFDBFE",width:1.5}, shadow:shadow() });
  s.addText("📖  진행 전 알아야 할 내용", { x:x1+0.3, y:y0+0.25, w:colW-0.6, h:0.5, fontFace:F, fontSize:18, bold:true, color:"1D4ED8", margin:0 });
  s.addText(opts.know.map((t,i)=>({ text:t, options:{ bullet:{code:"2022"}, breakLine:true, paraSpaceAfter:10, color:C.ink } })),
    { x:x1+0.35, y:y0+0.95, w:colW-0.7, h:ch-1.2, fontFace:F, fontSize:15.5, valign:"top" });
  // prep
  s.addShape(pres.shapes.RECTANGLE,{ x:x2, y:y0, w:colW, h:ch, fill:{color:"F0FDF4"}, line:{color:"BBF7D0",width:1.5}, shadow:shadow() });
  s.addText("🧰  교사가 준비할 것", { x:x2+0.3, y:y0+0.25, w:colW-0.6, h:0.5, fontFace:F, fontSize:18, bold:true, color:"15803D", margin:0 });
  s.addText(opts.prep.map((t,i)=>({ text:t, options:{ bullet:{code:"2022"}, breakLine:true, paraSpaceAfter:10, color:C.ink } })),
    { x:x2+0.35, y:y0+0.95, w:colW-0.7, h:ch-1.2, fontFace:F, fontSize:15.5, valign:"top" });
  return s;
}

prepSlide({
  badge:"🌱 시민 광장", heading:"진행 전 체크 & 교사 준비", c:C.amber, dk:C.amberDk,
  know:[
    "‘최우선 과제’는 잠그면 이후 모든 여정의 중심 주제 — 충분한 논의 후 확정",
    "평가는 ‘좋아요’가 아닌 3축 별점(논리·실현·주제)으로 비판적 보기 연습",
    "기사는 학생 작성 후 ‘교사 승인’을 거쳐 여론판에 게시",
  ],
  prep:[
    "방 만들기 → 학생에게 반 코드 / 입장 QR 공유",
    "⚙️ 학급 설정에서 인원·모둠 수 확인",
    "포스터 이미지 업로드 사전 점검(인터넷·기기)",
    "‘우리 동네 문제’ 예시 1~2개를 오프닝 마중물로 준비",
  ],
});
prepSlide({
  badge:"🗳️ 선거", heading:"진행 전 체크 & 교사 준비", c:C.rose, dk:C.roseDk,
  know:[
    "아고라·토론은 투표가 아님 — 후보를 ‘검증’하는 단계임을 안내",
    "본 투표는 1인 1표, 선거 4원칙(보통·평등·직접·비밀) 준수",
    "선거 토론은 자동으로 안 열림 — ‘선거토론 빠른제어’에서 세션 생성",
  ],
  prep:[
    "① 여정의 최우선 과제가 잠겨 있는지 확인(공약 기준)",
    "후보 수·캠프 구성 방식 안내(모둠 → 후보)",
    "📖 토론 도구로 진행할 토론 형식(시간·순서) 결정",
    "투표·개표용 TV/전광판 화면 준비(교실 송출)",
  ],
});

// ---------- Feature manual slide (embed PNG) ----------
(() => {
  const s = pres.addSlide();
  s.background = { color:"F8FAFC" };
  s.addText("기능 설명서 — 상단 버튼 & 도구", { x:0.7, y:0.4, w:12, h:0.7, fontFace:F, fontSize:30, bold:true, color:C.indigo });
  // feature_manual.png 2480x2640 ratio 0.939
  const ratio = 2480/2640, ih=6.2, iw=ih*ratio;
  s.addImage({ path: path.join(IMG,"feature_manual.png"), x:(W-iw)/2 - 2.3, y:1.15, w:iw, h:ih, shadow:shadow() });
  // side notes
  const nx = (W-iw)/2 - 2.3 + iw + 0.4;
  s.addText("핵심 요약", { x:nx, y:1.3, w:W-nx-0.5, h:0.5, fontFace:F, fontSize:19, bold:true, color:C.slate });
  s.addText([
    { text:"여정 탭(시민광장·선거·국정포털)", options:{ bold:true, color:C.ink, breakLine:true } },
    { text:"교사가 누르면 학생 화면도 함께 이동", options:{ color:C.gray, breakLine:true, paraSpaceAfter:12 } },
    { text:"⚡ 여론조사", options:{ bold:true, color:C.ink, breakLine:true } },
    { text:"어느 화면에서나 바로 실시", options:{ color:C.gray, breakLine:true, paraSpaceAfter:12 } },
    { text:"👩‍🏫 교사실", options:{ bold:true, color:C.ink, breakLine:true } },
    { text:"단계 진행·승인·실시간 모니터링", options:{ color:C.gray, breakLine:true, paraSpaceAfter:12 } },
    { text:"도구 바", options:{ bold:true, color:C.ink, breakLine:true } },
    { text:"링크·청원·토론도구·제출물·학급설정·QR·갤러리·분석", options:{ color:C.gray } },
  ], { x:nx, y:1.85, w:W-nx-0.5, h:5.0, fontFace:F, fontSize:14, valign:"top" });
})();

// ---------- Closing (dark) ----------
(() => {
  const s = pres.addSlide();
  s.background = { color: C.dark };
  s.addText("운영 팁", { x:0.9, y:0.7, w:11, h:0.8, fontFace:F, fontSize:34, bold:true, color:C.white });
  const tips = [
    { i:"🧭", t:"여론조사가 분기점", d:"①은 최우선 과제 선정, ②는 지지도 확인. 상단 ⚡여론조사로 즉시 실시." },
    { i:"🧩", t:"단계는 교사실을 따라", d:"👩‍🏫교사실의 단계 가이드대로 진행하면 차시 흐름이 자동 안내됩니다." },
    { i:"🔒", t:"최우선 과제는 한 번만", d:"①에서 정한 과제가 선거·국정의 공통 주제 — 신중히 확정·잠금." },
    { i:"📰", t:"기사·승인 루틴", d:"학생 기사 작성 → 교사 승인 → 여론판 게시로 모든 여정을 기록." },
  ];
  const cw=5.7, ch=1.95, gx=0.9, gy=1.9, gap=0.5;
  tips.forEach((tp,idx)=>{
    const col=idx%2, row=Math.floor(idx/2);
    const x=gx+col*(cw+gap), y=gy+row*(ch+0.45);
    s.addShape(pres.shapes.RECTANGLE,{ x, y, w:cw, h:ch, fill:{color:C.darkPanel} });
    s.addShape(pres.shapes.RECTANGLE,{ x, y, w:0.1, h:ch, fill:{color:C.amber} });
    s.addText(tp.i+"  "+tp.t, { x:x+0.35, y:y+0.2, w:cw-0.6, h:0.5, fontFace:F, fontSize:19, bold:true, color:C.white, margin:0 });
    s.addText(tp.d, { x:x+0.35, y:y+0.78, w:cw-0.65, h:1.0, fontFace:F, fontSize:14.5, color:"C7D2FE", valign:"top", margin:0 });
  });
  s.addText("민국이의 꿈 · 교사 안내서 — 시민 광장 · 선거 여정", { x:0.9, y:6.95, w:11, h:0.4, fontFace:F, fontSize:12, color:"818CF8" });
})();

pres.writeFile({ fileName: OUT }).then(()=>console.log("SAVED:", OUT));
