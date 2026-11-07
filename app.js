"use strict";
/* Shadowing PWA — plays a model (TTS or audio file) into earphones while recording
   the mic and, optionally, running speech recognition; then scores word coverage. */

const EXAMPLES = [
  {title:"Weekend plans", level:"中級", sentences:[
    {en:"I'm thinking about going hiking this weekend.", ja:"今週末、ハイキングに行こうかなと思ってる。"},
    {en:"The forecast says it's going to be sunny on Saturday.", ja:"予報だと土曜日は晴れるらしい。"},
    {en:"If it rains, I'll probably just stay home and catch up on some reading.", ja:"雨なら、たぶん家でたまった本を読むよ。"},
    {en:"Do you want to come along?", ja:"一緒に来る？"},
    {en:"We could grab lunch at that little place near the station afterwards.", ja:"そのあと駅の近くの小さなお店でランチしてもいいね。"}
  ]},
  {title:"Ordering at a café", level:"初級", sentences:[
    {en:"Hi, can I get a medium latte, please?", ja:"こんにちは、ラテのMをお願いできますか？"},
    {en:"Could you make it with oat milk?", ja:"オーツミルクにしてもらえますか？"},
    {en:"For here, please.", ja:"店内で。"},
    {en:"Oh, and one of those blueberry muffins, too.", ja:"あ、あとそのブルーベリーマフィンも一つ。"}
  ]},
  {title:"Introducing yourself at work", level:"上級", sentences:[
    {en:"I've been working in sales for about five years now.", ja:"営業の仕事をして5年ほどになります。"},
    {en:"Most of my experience is in building long-term relationships with clients.", ja:"経験の多くは、顧客との長期的な関係づくりです。"},
    {en:"Recently, I've gotten more interested in using data to back up my decisions.", ja:"最近は、データで判断を裏付けることに関心が高まっています。"},
    {en:"That's a big part of why I'm looking for a new challenge.", ja:"それが新しい挑戦を探している大きな理由です。"}
  ]}
];

const CLAUDE_PROMPT = `シャドーイング用の英語教材を作ってください。
- レベル: 中級（日常会話）
- トピック: おまかせ
- 6文、自然な話し言葉のアメリカ英語（短縮形やよく使う句動詞を含める）
- 1行に1文、「英文 | 和訳」の形式で、それ以外は何も書かないでください。`;

const $ = id => document.getElementById(id);
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};

let current = store.get("script", null) || EXAMPLES[0];
let modelFile = null, modelUrl = null;

/* ---------- tabs ---------- */
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.p)));
function showTab(p){
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.p === p)));
  ["src","practice","log"].forEach(k => $("p-"+k).hidden = k !== p);
  window.scrollTo(0,0);
}

/* ---------- script ---------- */
function setScript(s){
  if (session) return;
  current = s; store.set("script", s);
  $("resultCard").hidden = true;
  render();
}
function render(){
  $("curTitle").textContent = current.title;
  const box = $("script"); box.innerHTML = "";
  current.sentences.forEach((s, i) => {
    const d = document.createElement("div");
    d.className = "sent"; d.id = "sent-" + i;
    d.innerHTML = `<span class="no">${String(i+1).padStart(2,"0")}</span><span><div class="en"></div><div class="ja"></div></span>`;
    d.querySelector(".en").textContent = s.en;
    d.querySelector(".ja").textContent = s.ja || "";
    box.appendChild(d);
  });
  const ex = $("examples"); ex.innerHTML = "";
  EXAMPLES.forEach(e => {
    const b = document.createElement("button");
    b.className = "ex" + (e.title === current.title ? " on" : "");
    b.innerHTML = "<span></span><span class='chip'></span>";
    b.children[0].textContent = `${e.title}（${e.sentences.length}文）`;
    b.children[1].textContent = e.level;
    b.addEventListener("click", () => { setScript(e); showTab("practice"); });
    ex.appendChild(b);
  });
}
function mark(i){ document.querySelectorAll(".sent").forEach((el,k) => el.classList.toggle("now", k === i)); }

$("blind").addEventListener("change", e => $("script").classList.toggle("blind", e.target.checked));
$("hideJa").addEventListener("change", e => $("script").classList.toggle("hideja", e.target.checked));

$("ownBtn").addEventListener("click", () => {
  const raw = $("own").value.trim(); if (!raw) return;
  let sentences = [];
  if (raw.includes("|")){
    raw.split(/\n+/).forEach(line => {
      const [en, ja] = line.split("|").map(x => (x || "").trim());
      if (en) sentences.push({en: en.replace(/^\d+[.)]\s*/, ""), ja: ja || ""});
    });
  } else {
    const parts = raw.replace(/\s+/g," ").match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [raw];
    sentences = parts.map(p => ({en: p.trim(), ja: ""})).filter(p => p.en);
  }
  if (!sentences.length) return;
  const title = sentences[0].en.split(/\s+/).slice(0,4).join(" ") + "…";
  setScript({title, level:"", sentences});
  showTab("practice");
});
$("promptBtn").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(CLAUDE_PROMPT); $("promptMsg").textContent = "コピーしました。Claudeのチャットに貼って、結果をここに貼り付けてください。"; }
  catch(e){ $("own").value = CLAUDE_PROMPT; $("promptMsg").textContent = "コピーできなかったので上の欄に入れました。選択してコピーしてください。"; }
});

/* ---------- model audio file ---------- */
$("audioFile").addEventListener("change", e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  if (modelUrl) URL.revokeObjectURL(modelUrl);
  modelFile = f; modelUrl = URL.createObjectURL(f);
  $("audioName").textContent = "お手本: " + f.name;
  $("audioClear").hidden = false; $("voiceField").hidden = true;
});
$("audioClear").addEventListener("click", () => {
  if (modelUrl) URL.revokeObjectURL(modelUrl);
  modelFile = null; modelUrl = null; $("audioFile").value = "";
  $("audioName").textContent = "未選択（読み上げ音声を使用）";
  $("audioClear").hidden = true; $("voiceField").hidden = false;
});

/* ---------- TTS ---------- */
const synth = window.speechSynthesis;
let voices = [];
/* Only natural-sounding voices: Apple's human voices, Google and Microsoft neural voices.
   Novelty voices (Bells, Zarvox…) and the robotic Eloquence set (Eddy, Flo, Grandma…) are dropped. */
const NATURAL = /\b(Samantha|Ava|Allison|Susan|Zoe|Nicky|Joelle|Noelle|Evan|Nathan|Tom|Aaron|Alex|Daniel|Kate|Serena|Arthur|Martha|Oliver|Stephanie|Jamie|Karen|Lee|Catherine|Gordon|Matilda|Moira|Tessa|Rishi|Veena|Fiona|Google|Aria|Jenny|Guy|Michelle|Ana|Christopher|Eric|Roger|Steffan|Sonia|Ryan|Libby|Natasha|William)\b/i;
const ROBOTIC = /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Junior|Kathy|Organ|Pipe Organ|Princess|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Victoria)\b/i;
const REGION = {US:"アメリカ", GB:"イギリス", AU:"オーストラリア", IE:"アイルランド", IN:"インド", ZA:"南アフリカ", CA:"カナダ", NZ:"ニュージーランド", SC:"スコットランド"};
const quality = v => /premium/i.test(v.name) ? 2 : /enhanced|neural|natural|online/i.test(v.name) ? 1 : 0;
function loadVoices(){
  if (!synth) return;
  const en = synth.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang) && !ROBOTIC.test(v.name));
  voices = en.filter(v => NATURAL.test(v.name));
  if (!voices.length) voices = en;          // unknown platform: keep everything except the robotic ones
  const rank = v => -quality(v) * 10 + (/en[-_]US/i.test(v.lang) ? 0 : 1);
  voices.sort((a,b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const sel = $("voice"), keep = store.get("voice", "");
  sel.innerHTML = voices.length ? "" : "<option value=''>標準の英語音声</option>";
  voices.forEach(v => {
    const o = document.createElement("option"); o.value = v.name;
    const region = REGION[(v.lang.split(/[-_]/)[1] || "").toUpperCase()] || v.lang;
    const name = v.name.replace(/\s*\((Premium|Enhanced|English.*?)\)/gi, "").replace(/^(Microsoft|Google)\s+/,"$1 ");
    o.textContent = `${name}（${region}${quality(v) === 2 ? "・最高音質" : quality(v) === 1 ? "・高音質" : ""}）`;
    sel.appendChild(o);
  });
  if (keep && voices.some(v => v.name === keep)) sel.value = keep;
  $("voiceHint").hidden = voices.some(v => quality(v) > 0);
}
if (synth){ loadVoices(); synth.onvoiceschanged = loadVoices; }
$("voice").addEventListener("change", e => store.set("voice", e.target.value));
$("rate").value = store.get("rate", 0.9);
const showRate = () => $("rateOut").textContent = Number($("rate").value).toFixed(2) + "×";
showRate();
$("rate").addEventListener("input", () => { showRate(); store.set("rate", Number($("rate").value)); });

function speak(text){
  return new Promise(res => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = Number($("rate").value);
    const v = voices.find(x => x.name === $("voice").value); if (v){ u.voice = v; u.lang = v.lang; }
    u.onend = res; u.onerror = res;
    synth.speak(u);
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* plays the model; resolves when finished or cancelled */
let modelEl = null, playToken = 0;
async function playModel(onSentence){
  const token = ++playToken;
  if (modelUrl){
    modelEl = new Audio(modelUrl);
    modelEl.playbackRate = Number($("rate").value);
    modelEl.preservesPitch = true;
    await new Promise(res => { modelEl.onended = res; modelEl.onerror = res; modelEl.play().catch(res); });
    return;
  }
  if (!synth) throw new Error("tts");
  for (let i = 0; i < current.sentences.length; i++){
    if (token !== playToken) return;
    onSentence && onSentence(i);
    await speak(current.sentences[i].en);
    if (token !== playToken) return;
    await wait(250);
  }
}
function stopModel(){
  playToken++;
  try { synth && synth.cancel(); } catch(e){}
  if (modelEl){ try { modelEl.pause(); } catch(e){} modelEl = null; }
}

/* preview without recording */
let previewing = false;
$("previewBtn").addEventListener("click", async () => {
  if (session) return;
  if (previewing){ stopModel(); return; }
  previewing = true; $("previewBtn").textContent = "■ 止める";
  try { await playModel(mark); } catch(e){ $("status").textContent = "再生できません"; }
  previewing = false; mark(-1); $("previewBtn").textContent = "お手本だけ聞く";
});

/* ---------- recording + recognition ---------- */
let session = null, micStream = null, lastRecUrl = null, wakeLock = null;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR){ $("useAsr").checked = false; $("useAsr").disabled = true; $("useAsr").parentElement.title = "このブラウザは音声認識に対応していません"; }

function pickMime(){
  if (!window.MediaRecorder) return null;
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/aac"])
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

async function getMic(){
  if (micStream && micStream.getAudioTracks().some(t => t.readyState === "live")) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}});
  return micStream;
}

function startAsr(s){
  if (!SR || !$("useAsr").checked) return;
  const r = new SR();
  r.lang = "en-US"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
  s.finals = []; s.interim = "";
  r.onresult = ev => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++){
      const res = ev.results[i];
      if (res.isFinal) s.finals.push(res[0].transcript); else interim += res[0].transcript;
    }
    s.interim = interim;
  };
  r.onerror = ev => { if (ev.error !== "no-speech" && ev.error !== "aborted") s.asrError = ev.error; };
  r.onend = () => {                       // iOS/Chrome end recognition on pauses: restart while recording
    if (s.interim){ s.finals.push(s.interim); s.interim = ""; }
    if (session === s && !s.stopping && !s.asrError){ try { r.start(); } catch(e){} }
  };
  try { r.start(); s.asr = r; } catch(e){ s.asrError = "start"; }
}

async function startSession(){
  if (session) return;
  stopModel(); previewing = false;
  let stream;
  try { stream = await getMic(); }
  catch(e){ $("status").textContent = "マイク不可"; alertBox("マイクを使えませんでした。設定 → Safari → マイク を「許可」にして、もう一度試してください。"); return; }

  const s = {chunks: [], start: Date.now(), stopping: false};
  session = s; setRecUI(true);
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch(e){}

  const mime = pickMime();
  if (mime !== null){
    try {
      s.rec = mime ? new MediaRecorder(stream, {mimeType: mime}) : new MediaRecorder(stream);
      s.rec.ondataavailable = e => { if (e.data && e.data.size) s.chunks.push(e.data); };
      s.rec.start(250);
    } catch(e){ s.rec = null; }
  }
  startAsr(s);
  $("status").textContent = "録音中";
  await wait(500);                         // let the mic and recognizer warm up

  try { await playModel(i => { mark(i); $("status").textContent = `${i+1}/${current.sentences.length}文`; }); }
  catch(e){ $("status").textContent = "再生できません"; }
  if (session !== s) return;               // stopped manually
  $("status").textContent = "まとめ中";
  await wait(1500);                        // catch the tail of the user's last words
  if (session === s) finishSession();
}

async function finishSession(){
  const s = session; if (!s || s.stopping) return;
  s.stopping = true;
  stopModel(); mark(-1);
  if (s.asr){ try { s.asr.stop(); } catch(e){} await wait(700); }
  if (s.rec && s.rec.state !== "inactive"){
    await new Promise(res => { s.rec.onstop = res; try { s.rec.stop(); } catch(e){ res(); } });
  }
  try { wakeLock && wakeLock.release(); } catch(e){} wakeLock = null;
  session = null; setRecUI(false);
  showResult(s);
}

function setRecUI(on){
  $("recBtn").classList.toggle("on", on);
  $("recLabel").textContent = on ? "停止" : "シャドーイング開始";
  if (!on) $("status").textContent = "待機中";
  ["previewBtn","ownBtn"].forEach(id => $(id).disabled = on);
}
$("recBtn").addEventListener("click", () => session ? finishSession() : startSession());

function alertBox(msg){ $("resultCard").hidden = false; $("scoreBox").hidden = true; $("legend").hidden = true; $("diff").innerHTML = ""; $("asrErr").textContent = msg; }

/* ---------- scoring ---------- */
const NUM = {"0":"zero","1":"one","2":"two","3":"three","4":"four","5":"five","6":"six","7":"seven","8":"eight","9":"nine","10":"ten","11":"eleven","12":"twelve","20":"twenty"};
const norm = w => { const x = w.toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9']/g,""); return NUM[x] || x; };
function scoreIt(script, said){
  const sw = [];
  script.forEach((s,si) => s.en.split(/\s+/).filter(Boolean).forEach(w => { const n = norm(w); if (n) sw.push({w, n, si}); }));
  const tw = said.split(/[\s-]+/).map(norm).filter(Boolean);
  const A = sw.length, B = tw.length;
  const dp = Array.from({length:A+1}, () => new Uint16Array(B+1));
  for (let i=A-1;i>=0;i--) for (let j=B-1;j>=0;j--)
    dp[i][j] = sw[i].n === tw[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j], dp[i][j+1]);
  let i=0, j=0;
  while (i<A && j<B){ if (sw[i].n === tw[j]){ sw[i].ok = true; i++; j++; } else if (dp[i+1][j] >= dp[i][j+1]) i++; else j++; }
  const hit = sw.filter(x => x.ok).length;
  return {words: sw, hit, total: A, extra: Math.max(0, B - hit)};
}

function showResult(s){
  $("resultCard").hidden = false; $("asrErr").textContent = "";
  if (lastRecUrl) URL.revokeObjectURL(lastRecUrl);
  if (s.chunks.length){
    const blob = new Blob(s.chunks, {type: s.chunks[0].type || "audio/mp4"});
    lastRecUrl = URL.createObjectURL(blob);
    $("myAudio").src = lastRecUrl; $("overlayBtn").hidden = false;
  } else {
    $("myAudio").removeAttribute("src"); $("overlayBtn").hidden = true;
  }

  const said = (s.finals || []).join(" ").trim();
  $("heard").textContent = said || "（なし）";
  const usedAsr = !!s.asr || !!s.asrError;
  let pct = null;
  if (usedAsr && said){
    const r = scoreIt(current.sentences, said);
    pct = r.total ? Math.round(r.hit / r.total * 100) : 0;
    $("pct").textContent = pct + "%";
    $("pctNote").textContent = `${r.total}語中 ${r.hit}語 言えた`;
    $("barFill").style.width = pct + "%";
    const d = $("diff"); d.innerHTML = "";
    current.sentences.forEach((_, si) => {
      const p = document.createElement("p");
      r.words.filter(x => x.si === si).forEach(x => { const sp = document.createElement("span"); sp.className = "w " + (x.ok ? "ok" : "ng"); sp.textContent = x.w; p.append(sp, " "); });
      d.appendChild(p);
    });
    $("scoreBox").hidden = false; $("legend").hidden = false;
  } else {
    $("scoreBox").hidden = true; $("legend").hidden = true; $("diff").innerHTML = "";
    if (usedAsr){
      $("asrErr").textContent = s.asrError
        ? `録音中に音声認識が使えませんでした（${s.asrError}）。録音の聞き返しはできます。`
        : "音声認識が何も聞き取れませんでした。マイクに向かって少し大きめの声で話してみてください。";
    }
  }
  if (!s.chunks.length && !said) $("asrErr").textContent = "録音できませんでした。マイクの許可を確認してください。";

  const h = store.get("hist", []);
  h.unshift({d: new Date().toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}), t: current.title, s: pct});
  store.set("hist", h.slice(0, 100)); renderHist();
  setTimeout(() => $("resultCard").scrollIntoView({behavior:"smooth", block:"start"}), 50);
}

/* listen to model and own recording together, to compare timing */
$("overlayBtn").addEventListener("click", async () => {
  if (session) return;
  const me = $("myAudio"); me.currentTime = 0;
  stopModel();
  const p = playModel(mark);
  await wait(500);                         // same lead-in as recording
  me.play().catch(() => {});
  await p; mark(-1);
});

function renderHist(){
  const h = store.get("hist", []), ul = $("hist"); ul.innerHTML = "";
  if (!h.length){ ul.innerHTML = "<li><span class='sub'>まだ記録がありません。</span></li>"; return; }
  h.slice(0, 30).forEach(r => {
    const li = document.createElement("li"); li.innerHTML = "<span></span><span class='s'></span>";
    li.children[0].textContent = `${r.d}　${r.t}`; li.children[1].textContent = r.s == null ? "録音のみ" : r.s + "%";
    ul.appendChild(li);
  });
}

render(); renderHist();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
