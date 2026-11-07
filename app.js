"use strict";
/* Shadowing PWA
   練習: model audio in earphones + mic recording (own voice only, no scoring)
   提出: the chosen take is cut per sentence, sent to Azure pronunciation assessment,
         and turned into Japanese feedback on linking, weak forms, reductions and sounds (coach.js). */

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

const AZ_VOICES = [
  ["en-US-AvaMultilingualNeural","Ava（アメリカ・女性）"], ["en-US-AndrewMultilingualNeural","Andrew（アメリカ・男性）"],
  ["en-US-EmmaMultilingualNeural","Emma（アメリカ・女性）"], ["en-US-BrianMultilingualNeural","Brian（アメリカ・男性）"],
  ["en-US-JennyNeural","Jenny（アメリカ・女性）"], ["en-US-GuyNeural","Guy（アメリカ・男性）"],
  ["en-GB-SoniaNeural","Sonia（イギリス・女性）"], ["en-GB-RyanNeural","Ryan（イギリス・男性）"],
  ["en-AU-NatashaNeural","Natasha（オーストラリア・女性）"]
];

const $ = id => document.getElementById(id);
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));

let current = store.get("script", null) || EXAMPLES[0];
let modelFile = null, modelUrl = null;
const az = () => { const c = store.get("azure", null); return c && c.key && c.region ? c : null; };

/* ---------- tabs ---------- */
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.p)));
function showTab(p){
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.p === p)));
  ["src","practice","report","settings"].forEach(k => $("p-"+k).hidden = k !== p);
  window.scrollTo(0, 0);
}

/* ---------- annotated sentence rendering ---------- */
const LINKS = new Set(["link","flap","hdrop","double"]);
const GROUPS = new Set(["reduce","tyou","dyou"]);
/* judge: optional {tok:[{acc,err}], marks:{"i-j":status}} */
function sentenceEl(text, judge){
  const toks = Coach.tokenize(text), marks = Coach.annotate(toks);
  const el = document.createElement("div"); el.className = "en";
  const byStart = {}, linkAfter = {}, goneAt = {}, weakAt = {};
  marks.forEach(m => {
    if (GROUPS.has(m.type)) byStart[m.i] = m;
    else if (LINKS.has(m.type)) linkAfter[m.i] = m;
    else if (m.type === "elide" || m.type === "stopt") goneAt[m.i] = true;
    else if (m.type === "weak") weakAt[m.i] = m;
  });
  const tokHTML = i => {
    const t = toks[i]; let raw = esc(t.raw);
    if (goneAt[i]) raw = raw.replace(/([td])([^a-zA-Z]*)$/, '<span class="gone">$1</span>$2');
    let cls = "tk";
    if (weakAt[i]) cls += " weak";
    const j = judge && judge.tok[i];
    if (j) { if (!j.acc && j.acc !== 0 || j.err === "Omission") cls += " s-ng"; else if (j.acc < 50) cls += " s-ng"; else if (j.acc < 75) cls += " s-warn"; }
    return `<span class="${cls}">${raw}</span>`;
  };
  const sep = i => {
    const m = linkAfter[i];
    if (m) { const st = judge && judge.marks[`${m.i}-${m.j}`]; return `<span class="lk"${st === "ng" ? ' style="color:var(--miss)"' : ""}>‿</span>`; }
    return " ";
  };
  let html = "";
  for (let i = 0; i < toks.length; i++){
    const g = byStart[i];
    if (g){
      let inner = "";
      for (let k = g.i; k <= g.j; k++) inner += tokHTML(k) + (k < g.j ? '<span class="lk">‿</span>' : "");
      const st = judge && judge.marks[`${g.i}-${g.j}`];
      html += `<ruby class="tk red"${st === "ng" ? ' style="text-decoration-color:var(--miss)"' : ""}>${inner}<rt>${esc(g.reading)}</rt></ruby>`;
      i = g.j;
    } else if (weakAt[i]) {
      html += `<ruby>${tokHTML(i)}<rt>${esc(weakAt[i].reading)}</rt></ruby>`;
    } else html += tokHTML(i);
    if (i < toks.length - 1) html += sep(i);
  }
  el.innerHTML = html;
  return el;
}

/* ---------- script ---------- */
function setScript(s){
  if (session) return;
  current = s; store.set("script", s);
  render();
}
function render(){
  $("curTitle").textContent = current.title;
  if (typeof renderIssues === "function") try { renderIssues(); } catch(e){}
  const box = $("script"); box.innerHTML = "";
  current.sentences.forEach((s, i) => {
    const d = document.createElement("div");
    d.className = "sent"; d.id = "sent-" + i;
    d.innerHTML = `<span class="no">${String(i+1).padStart(2,"0")}</span><span></span>`;
    d.children[1].appendChild(sentenceEl(s.en));
    if (s.ja){ const j = document.createElement("div"); j.className = "ja"; j.textContent = s.ja; d.children[1].appendChild(j); }
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

const applyView = () => {
  $("script").classList.toggle("blind", $("blind").checked);
  $("script").classList.toggle("hideja", $("hideJa").checked);
  $("script").classList.toggle("plain", !$("marksOn").checked);
  $("legend").hidden = !$("marksOn").checked;
  store.set("view", {marks: $("marksOn").checked, blind: $("blind").checked, hideJa: $("hideJa").checked});
};
(() => { const v = store.get("view", null); if (v){ $("marksOn").checked = v.marks; $("blind").checked = v.blind; $("hideJa").checked = v.hideJa; } })();
["marksOn","blind","hideJa"].forEach(id => $(id).addEventListener("change", applyView));

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
  setScript({title: sentences[0].en.split(/\s+/).slice(0,4).join(" ") + "…", level:"", sentences});
  showTab("practice");
});
$("promptBtn").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(CLAUDE_PROMPT); $("promptMsg").textContent = "コピーしました。Claudeのチャットに貼って、返ってきた文をここに貼り付けてください。"; }
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
  $("audioName").textContent = "未選択（合成音声を使用）";
  $("audioClear").hidden = true; $("voiceField").hidden = false;
});

/* ---------- voices: Azure neural if configured, otherwise the device's natural voices ---------- */
const synth = window.speechSynthesis;
let deviceVoices = [];
const NATURAL = /\b(Samantha|Ava|Allison|Susan|Zoe|Nicky|Joelle|Noelle|Evan|Nathan|Tom|Aaron|Alex|Daniel|Kate|Serena|Arthur|Martha|Oliver|Karen|Lee|Catherine|Gordon|Moira|Tessa|Rishi|Fiona|Google|Aria|Jenny|Guy)\b/i;
const ROBOTIC = /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Junior|Kathy|Organ|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Victoria)\b/i;
function loadVoices(){
  const sel = $("voice"), keep = store.get("voice", "");
  sel.innerHTML = "";
  if (az()){
    AZ_VOICES.forEach(([id, name]) => { const o = document.createElement("option"); o.value = "az:" + id; o.textContent = name; sel.appendChild(o); });
    $("voiceHint").hidden = true;
  } else if (synth){
    const en = synth.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang) && !ROBOTIC.test(v.name));
    deviceVoices = en.filter(v => NATURAL.test(v.name)); if (!deviceVoices.length) deviceVoices = en;
    deviceVoices.sort((a,b) => (/en[-_]US/i.test(a.lang)?0:1) - (/en[-_]US/i.test(b.lang)?0:1));
    deviceVoices.forEach(v => { const o = document.createElement("option"); o.value = "dev:" + v.name; o.textContent = `${v.name}（${v.lang}）`; sel.appendChild(o); });
    if (!deviceVoices.length) sel.innerHTML = "<option value=''>標準の英語音声</option>";
    $("voiceHint").hidden = false;
  }
  if (keep && sel.querySelector(`option[value="${CSS.escape(keep)}"]`)) sel.value = keep;
}
if (synth) synth.onvoiceschanged = loadVoices;
$("voice").addEventListener("change", e => store.set("voice", e.target.value));
$("rate").value = store.get("rate", 0.9);
const showRate = () => $("rateOut").textContent = Number($("rate").value).toFixed(2) + "×";
showRate();
$("rate").addEventListener("input", () => { showRate(); store.set("rate", Number($("rate").value)); });

/* Azure TTS clips, cached per voice/rate/text */
const clipCache = new Map();
const xml = s => String(s).replace(/[<>&'"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[c]));
async function azClip(text, voice, rate){
  const k = `${voice}|${rate}|${text}`;
  if (clipCache.has(k)) return clipCache.get(k);
  const c = az(); if (!c) throw new Error("nokey");
  const pct = Math.round((rate - 1) * 100);
  const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${voice}"><prosody rate="${pct >= 0 ? "+" : ""}${pct}%">${xml(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${c.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {"Ocp-Apim-Subscription-Key": c.key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"},
    body: ssml
  });
  if (!res.ok) throw new Error("tts " + res.status);
  const url = URL.createObjectURL(await res.blob());
  clipCache.set(k, url);
  return url;
}
const usingAzureVoice = () => !modelUrl && $("voice").value.startsWith("az:");
async function prepareModel(){
  if (!usingAzureVoice()) return;
  const v = $("voice").value.slice(3), r = Number($("rate").value);
  let done = 0;
  await Promise.all(current.sentences.map(async s => { await azClip(s.en, v, r); $("status").textContent = `準備 ${++done}/${current.sentences.length}`; }));
}

function speakDevice(text, onStart){
  return new Promise((res, rej) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = Number($("rate").value);
    const v = deviceVoices.find(x => "dev:" + x.name === $("voice").value); if (v){ u.voice = v; u.lang = v.lang; }
    let started = false;
    u.onstart = () => { started = true; onStart && onStart(); };
    u.onend = () => started ? res() : rej(new Error("tts-device"));
    u.onerror = e => (e && e.error === "interrupted" || e && e.error === "canceled") ? res() : rej(new Error("tts-device"));
    synth.speak(u);
  });
}
/* Model playback goes through Web Audio. The AudioContext is created/resumed inside the tap,
   and once running it keeps playing even after the microphone starts (an <audio> element on
   iOS loses its permission when recording begins, which made takes stop after a few seconds). */
let actx = null, currentSrc = null;
const bufCache = new Map();
function unlockAudio(){
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!actx) actx = new AC();
    if (actx.state !== "running") actx.resume();
    const b = actx.createBuffer(1, 1, 22050), src = actx.createBufferSource();
    src.buffer = b; src.connect(actx.destination); src.start(0);
  } catch(e){}
  if (synth && $("voice").value.startsWith("dev:")){ try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch(e){} }
}
async function getBuf(url){
  if (bufCache.has(url)) return bufCache.get(url);
  const ab = await (await fetch(url)).arrayBuffer();
  const buf = await new Promise((res, rej) => actx.decodeAudioData(ab, res, rej));
  bufCache.set(url, buf);
  return buf;
}
async function playUrl(url, rate, onStart){
  if (!actx) unlockAudio();
  if (actx.state !== "running"){ try { await actx.resume(); } catch(e){} }
  if (actx.state !== "running") throw new Error("play");
  const buf = await getBuf(url);
  return new Promise(res => {
    const src = actx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = rate || 1;
    src.connect(actx.destination);
    src.onended = () => { if (currentSrc === src) currentSrc = null; res(); };
    currentSrc = src; src.start();
    onStart && onStart();
  });
}

/* plays the model; onSentence(i) fires as each sentence actually starts */
let playToken = 0;
async function playModel(onSentence){
  const token = ++playToken;
  if (modelUrl){ await playUrl(modelUrl, Number($("rate").value), () => onSentence && onSentence(0)); return; }
  const v = $("voice").value, r = Number($("rate").value);
  for (let i = 0; i < current.sentences.length; i++){
    if (token !== playToken) return;
    const text = current.sentences[i].en, start = () => onSentence && onSentence(i);
    if (v.startsWith("az:")) await playUrl(await azClip(text, v.slice(3), r), 0, start);
    else if (synth) await speakDevice(text, start);
    else throw new Error("tts");
    if (token !== playToken) return;
    await wait(300);
  }
}
function stopModel(){
  playToken++;
  try { synth && synth.cancel(); } catch(e){}
  if (currentSrc){ try { currentSrc.stop(); } catch(e){} currentSrc = null; }
}

let previewing = false;
$("previewBtn").addEventListener("click", async () => {
  if (session) return;
  if (!previewing) unlockAudio();
  if (previewing){ stopModel(); return; }
  previewing = true; $("previewBtn").textContent = "■ 止める";
  try { await prepareModel(); await playModel(mark); }
  catch(e){ $("status").textContent = "再生できません"; azError(e); }
  previewing = false; mark(-1); $("previewBtn").textContent = "お手本だけ聞く"; $("status").textContent = "待機中";
});

/* ---------- recording (own voice only) ---------- */
let session = null, micStream = null, wakeLock = null;
const takes = [];
function pickMime(){
  if (!window.MediaRecorder) return null;
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/aac"])
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  return "";
}
/* turn the mic fully off after each take so iOS's orange recording indicator goes away */
function releaseMic(){
  if (micStream){ micStream.getTracks().forEach(t => { try { t.stop(); } catch(e){} }); micStream = null; }
}
document.addEventListener("visibilitychange", () => { if (document.hidden && !session) releaseMic(); });
window.addEventListener("pagehide", () => releaseMic());
async function getMic(){
  if (micStream && micStream.getAudioTracks().some(t => t.readyState === "live")) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}});
  return micStream;
}

async function startSession(){
  if (session) return;
  stopModel(); previewing = false;
  $("recBtn").disabled = true;
  try { $("status").textContent = "準備中"; await prepareModel(); }
  catch(e){ $("recBtn").disabled = false; $("status").textContent = "待機中"; azError(e); return; }
  let stream;
  try { stream = await getMic(); }
  catch(e){ $("recBtn").disabled = false; $("status").textContent = "マイク不可"; toast("マイクを使えませんでした。iPhoneの 設定 → Safari → マイク を「許可」にして、もう一度試してください。"); return; }
  if (actx && actx.state !== "running"){ try { await actx.resume(); } catch(e){} }
  const mime = pickMime();
  if (mime === null){ $("recBtn").disabled = false; toast("このブラウザは録音に対応していません。"); return; }

  const s = {chunks: [], starts: [], stopping: false, script: JSON.parse(JSON.stringify(current)), rate: Number($("rate").value), file: !!modelUrl, voice: $("voice").value};
  session = s; $("recBtn").disabled = false; setRecUI(true);
  try { wakeLock = await navigator.wakeLock?.request("screen"); } catch(e){}
  s.rec = mime ? new MediaRecorder(stream, {mimeType: mime}) : new MediaRecorder(stream);
  s.rec.ondataavailable = e => { if (e.data && e.data.size) s.chunks.push(e.data); };
  s.rec.start(250); s.t0 = performance.now();
  $("status").textContent = "録音中";
  await wait(600);
  try {
    await playModel(i => { s.starts[i] = (performance.now() - s.t0) / 1000; mark(i); $("status").textContent = `${i+1}/${current.sentences.length}文`; });
  } catch(e){
    if (session === s){ await finishSession(); alertInline(String(e && e.message) === "tts-device"
      ? "iPhoneの読み上げ音声は録音中に鳴らせないことがあります。設定タブでAzureのキーを入れて、Azureの声で試してください。"
      : "お手本を再生できませんでした。イヤホンの接続と音量を確認して、もう一度赤いボタンを押してください。"); }
    return;
  }
  if (session !== s) return;
  $("status").textContent = "まとめ中";
  await wait(1500);
  if (session === s) finishSession();
}
async function finishSession(){
  const s = session; if (!s || s.stopping) return;
  s.stopping = true; stopModel(); mark(-1);
  s.end = (performance.now() - s.t0) / 1000;
  if (s.rec && s.rec.state !== "inactive") await new Promise(res => { s.rec.onstop = res; try { s.rec.stop(); } catch(e){ res(); } });
  try { wakeLock && wakeLock.release(); } catch(e){} wakeLock = null;
  releaseMic();
  session = null; setRecUI(false);
  if (!s.chunks.length){ toast("録音できませんでした。マイクの許可を確認してください。"); return; }
  const blob = new Blob(s.chunks, {type: s.chunks[0].type || "audio/mp4"});
  takes.unshift({id: Date.now(), blob, url: URL.createObjectURL(blob), starts: s.starts, end: s.end, script: s.script, rate: s.rate, file: s.file,
    when: new Date().toLocaleTimeString("ja-JP", {hour:"2-digit", minute:"2-digit"})});
  while (takes.length > 5){ const t = takes.pop(); URL.revokeObjectURL(t.url); }
  renderTakes();
  setTimeout(() => $("takesCard").scrollIntoView({behavior:"smooth", block:"start"}), 50);
}
function setRecUI(on){
  $("recBtn").classList.toggle("on", on);
  $("recLabel").textContent = on ? "停止" : "シャドーイング開始";
  if (!on) $("status").textContent = "待機中";
  ["previewBtn","ownBtn"].forEach(id => $(id).disabled = on);
}
$("recBtn").addEventListener("click", () => { if (session) finishSession(); else { unlockAudio(); startSession(); } });
function toast(msg){ $("status").textContent = "エラー"; alertInline(msg); }
function alertInline(msg){
  let n = $("inlineMsg");
  if (!n){ n = document.createElement("div"); n.id = "inlineMsg"; n.className = "card err"; $("p-practice").prepend(n); }
  n.textContent = msg; n.hidden = false; showTab("practice");
  setTimeout(() => { n.hidden = true; }, 8000);
}
function azError(e){
  const m = String(e && e.message || e);
  if (m === "nokey") return;
  if (/401|403/.test(m)) alertInline("Azureのキーかリージョンが違うようです。設定タブで確認してください。");
  else if (/tts|Failed to fetch|Load failed|NetworkError/.test(m)) alertInline("Azureに接続できませんでした。通信状況と、設定タブのキー・リージョンを確認してください。");
}

function renderTakes(){
  $("takesCard").hidden = !takes.length;
  const box = $("takes"); box.innerHTML = "";
  takes.forEach((t, k) => {
    const d = document.createElement("div"); d.className = "take";
    d.innerHTML = `<div class="hd"><b></b><span class="sub"></span></div><audio controls playsinline preload="metadata"></audio>
      <div class="row"><button class="btn small" data-a="submit">提出して添削</button><button class="btn ghost small" data-a="overlay">お手本と重ねて聞く</button></div>`;
    d.querySelector("b").textContent = `録音 ${takes.length - k}`;
    d.querySelector(".sub").textContent = `${t.when}・${t.script.title}・${t.rate.toFixed(2)}×`;
    d.querySelector("audio").src = t.url;
    d.querySelector('[data-a="submit"]').addEventListener("click", () => submit(t));
    d.querySelector('[data-a="overlay"]').addEventListener("click", async () => {
      if (session) return;
      const a = d.querySelector("audio"); stopModel(); unlockAudio();
      a.currentTime = 0; a.play().catch(() => {});          // own voice starts now (the take began 0.6 s before the model)
      await wait(600); await playModel(mark).catch(() => {}); mark(-1);
    });
    box.appendChild(d);
  });
}

/* ---------- submission: audio → 16 kHz WAV per sentence → Azure pronunciation assessment ---------- */
async function decode16k(blob){
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = actx || new AC();
  const buf = await new Promise((res, rej) => { blob.arrayBuffer().then(ab => ctx.decodeAudioData(ab, res, rej)).catch(rej); });
  if (ctx !== actx){ try { ctx.close(); } catch(e){} }
  const len = Math.ceil(buf.duration * 16000);
  const off = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, len, 16000);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}
function wav(samples){
  const b = new ArrayBuffer(44 + samples.length * 2), v = new DataView(b);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0,"RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8,"WAVE"); w(12,"fmt ");
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,16000,true);
  v.setUint32(28,32000,true); v.setUint16(32,2,true); v.setUint16(34,16,true); w(36,"data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++){ const x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i*2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([b], {type: "audio/wav"});
}
const b64 = s => btoa(unescape(encodeURIComponent(s)));
async function assess(wavBlob, refText){
  const c = az();
  const call = async params => fetch(`https://${c.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`, {
    method: "POST",
    headers: {"Ocp-Apim-Subscription-Key": c.key, "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000", "Accept": "application/json",
      "Pronunciation-Assessment": b64(JSON.stringify(params))},
    body: wavBlob
  });
  const base = {ReferenceText: refText, GradingSystem: "HundredMark", Granularity: "Phoneme", Dimension: "Comprehensive", EnableMiscue: "True"};
  let res = await call(Object.assign({EnableProsodyAssessment: "True", PhonemeAlphabet: "IPA"}, base));
  if (res.status === 400) res = await call(base);                 // older regions/params: fall back to the basics
  if (!res.ok) throw new Error("stt " + res.status);
  return Coach.parseAzure(await res.json());
}

async function submit(take){
  if (!az()){ showTab("settings"); $("azMsg").textContent = "添削にはAzureのキーが必要です。先に設定してください。"; $("azMsg").className = "err"; return; }
  if (busy) return; busy = true;
  showTab("report"); $("reportCard").hidden = true; $("progressCard").hidden = false;
  const prog = (p, t) => { $("progFill").style.width = Math.round(p * 100) + "%"; $("progText").textContent = t; };
  try {
    prog(0.05, "録音を読み込み中…");
    const pcm = await decode16k(take.blob);
    const dur = pcm.length / 16000, sents = take.script.sentences;
    let segs;
    if (!take.file && take.starts.length === sents.length && take.starts.every(x => typeof x === "number")){
      segs = sents.map((s, i) => {
        const a = Math.max(0, take.starts[i] - 0.15);
        const b = Math.min(dur, i < sents.length - 1 ? take.starts[i+1] + 0.7 : dur, a + 29.5);
        return {text: s.en, ja: s.ja, a, b};
      });
    } else {
      if (dur > 30) throw new Error("long");
      segs = [{text: sents.map(s => s.en).join(" "), ja: "", a: 0, b: dur}];
    }
    const out = [];
    for (let i = 0; i < segs.length; i++){
      const g = segs[i];
      prog(0.1 + 0.85 * i / segs.length, `${i+1}/${segs.length}文目を評価中…`);
      const clip = pcm.subarray(Math.floor(g.a * 16000), Math.floor(g.b * 16000));
      const res = await assess(wav(clip), g.text);
      const j = Coach.judgeSentence(g.text, res, take.rate);
      out.push({en: g.text, ja: g.ja, a: g.a, b: g.b, scores: res.scores, heard: res.display,
        tok: j.map.map(w => w ? {acc: w.acc, err: w.err} : {acc: null, err: "Omission"}),
        findings: j.findings.map(f => ({type: f.type, i: f.i, j: f.j, status: f.status, label: f.label, msg: f.msg, tip: f.tip,
          metric: typeof f.metric === "number" ? +f.metric.toFixed(2) : null, target: f.target, unit: f.unit, better: f.better}))});
    }
    prog(1, "まとめ中…");
    const report = {id: take.id + "-" + Date.now(), date: new Date().toLocaleString("ja-JP", {month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit"}),
      title: take.script.title, rate: take.rate, sentences: out, total: totalScores(out)};
    report.progress = trackProgress(report, take.script);
    takeAudio.set(report.id, take.url);
    const hist = store.get("reports", []); hist.unshift(report);
    while (hist.length && !store.set("reports", hist.slice(0, 30))) hist.pop();
    renderReport(report); renderHist(); renderIssues();
  } catch(e){
    const m = String(e && e.message || e);
    $("reportCard").hidden = false;
    $("reportCard").innerHTML = `<h2>添削できませんでした</h2><div class="err">${esc(
      m === "long" ? "音声ファイル教材は30秒以内のものだけ添削できます。短く切った音声で試してください。" :
      /401|403/.test(m) ? "Azureのキーかリージョンが違うようです。設定タブで確認してください。" :
      /429/.test(m) ? "Azureの利用制限に達しました。少し待ってからもう一度提出してください。" :
      /decode|EncodingError/i.test(m) ? "録音を読み込めませんでした。もう一度録音して提出してください。" :
      "Azureに接続できませんでした（" + m + "）。通信状況と設定を確認してください。")}</div>`;
  }
  $("progressCard").hidden = true; busy = false;
}
let busy = false;
const takeAudio = new Map();

function totalScores(sents){
  const keys = ["pron","acc","flu","comp","pros"], t = {};
  keys.forEach(k => {
    let sum = 0, w = 0;
    sents.forEach(s => { const v = s.scores && s.scores[k]; if (typeof v === "number"){ const n = s.tok.length || 1; sum += v * n; w += n; } });
    t[k] = w ? Math.round(sum / w) : null;
  });
  return t;
}


/* ---------- progress tracking: the same script remembers its open issues until they are fixed ---------- */
const scriptKey = sc => { let h = 0; const t = sc.sentences.map(x => x.en).join("\n"); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return "s" + (h >>> 0).toString(36); };
const LINKISH = new Set(["link","flap","hdrop","double","tyou","dyou"]);
const STEPS = {
  link: ["2語をくっつけて1語のつもりで言う（check it → チェキッ）。その文だけお手本を3回聞いてからシャドーイング",
         "スピードを0.8×に下げ、その2語だけ5回 → 文全体を3回。途中で止まらないことを最優先に"],
  weak: ["名詞・動詞だけを強く読み、それ以外は小さく早口に。まず強い語だけで言ってから戻す",
         "この語を小さな「ア」に置き換えるつもりで、0.8×で5回"],
  reduce: ["ふりがなのカタカナをそのまままねして言う", "その部分だけ5回 → 文全体を3回"],
  pron: ["単語だけをお手本のあとに3回 → 文の中で", "鏡で口の形を見ながら、単語 → 文の順で5回ずつ"],
  omit: ["英文を表示したまま（ブラインドをオフ）で、遅れないようについていく", "スピードを0.8×に下げて、まずついていくことを優先"],
  insert: ["言い直さずに最後まで止めずに言い切る", "0.8×で、間違えても止まらずに続ける練習"],
  tone: ["大事な語（名詞・動詞）を高く長く、それ以外を低く短く", "お手本の高低を手で上下に描きながらまねする"]
};
function advice(issue){
  const steps = STEPS[LINKISH.has(issue.type) ? "link" : issue.type] || [];
  if (issue.streak <= 1 || !steps.length) return issue.tip || "";
  return steps[Math.min(issue.streak - 2, steps.length - 1)];
}
const fmtMetric = (v, unit) => v == null ? "–" : unit === "点" ? `${Math.round(v)}点` : `${v.toFixed(2)}秒`;

function trackProgress(report, script){
  const all = store.get("tracker", {}), key = scriptKey(script);
  const t = all[key] || {title: script.title, attempts: 0, issues: {}};
  t.title = script.title; t.attempts++; t.updated = report.date;
  const cur = {};
  report.sentences.forEach((s, k) => s.findings.forEach(f => { cur[`${k}|${f.type}|${f.type === "insert" ? "" : f.label}`] = Object.assign({k}, f); }));
  const out = {attempt: t.attempts, fixed: [], still: [], fresh: []};
  Object.entries(t.issues).forEach(([id, is]) => {
    if (is.resolved) return;
    const c = cur[id];
    let st = "ok", metric = null;
    if (c){ st = c.status; metric = c.metric; }
    else if (is.type === "pron" || is.type === "omit"){
      const tk = report.sentences[is.k] && report.sentences[is.k].tok[is.i];
      const good = tk && tk.err !== "Omission" && typeof tk.acc === "number" && tk.acc >= 70;
      st = good ? "ok" : "ng"; metric = tk && typeof tk.acc === "number" ? tk.acc : null;
    }
    const prev = is.last;
    is.last = metric;
    if (st === "ng" || st === "warn"){
      is.streak++; is.okRun = 0;
      out.still.push({label: is.label, k: is.k, count: is.streak, prev, now: metric, unit: is.unit, target: is.target, advice: advice(is)});
    } else {
      is.okRun = (is.okRun || 0) + 1;
      if (is.okRun >= 2) is.resolved = true;
      out.fixed.push({label: is.label, k: is.k, prev, now: metric, unit: is.unit, mastered: is.resolved});
    }
  });
  Object.entries(cur).forEach(([id, f]) => {
    if (f.status !== "ng" && f.status !== "warn") return;
    const is = t.issues[id];
    if (is && !is.resolved) return;
    t.issues[id] = {type: f.type, label: f.label, k: f.k, i: f.i, tip: f.tip, unit: f.unit, target: f.target, streak: 1, okRun: 0, last: f.metric, first: report.date, resolved: false};
    out.fresh.push({label: f.label, k: f.k, again: !!is});
  });
  all[key] = t;
  const keys = Object.keys(all);                       // keep storage small: newest 40 scripts
  if (keys.length > 40) keys.sort((a, b) => String(all[a].updated).localeCompare(String(all[b].updated))).slice(0, keys.length - 40).forEach(k => delete all[k]);
  store.set("tracker", all);
  return out;
}

/* practice screen: what to work on for the selected script */
function renderIssues(){
  let card = $("issuesCard");
  if (!card){ card = document.createElement("div"); card.id = "issuesCard"; card.className = "card"; $("p-practice").insertBefore(card, $("p-practice").children[1]); }
  const t = store.get("tracker", {})[scriptKey(current)];
  const open = t ? Object.values(t.issues).filter(i => !i.resolved) : [];
  if (!open.length){ card.hidden = true; return; }
  card.hidden = false;
  open.sort((a, b) => b.streak - a.streak || a.k - b.k);
  card.innerHTML = `<h2>この英文の課題（${open.length}）</h2><div class="sub">前回までの添削で残っているものです。ここを意識して録音しましょう。</div><ul class="finds"></ul>`;
  const ul = card.querySelector("ul");
  open.slice(0, 8).forEach(is => {
    const li = document.createElement("li"); li.className = is.streak >= 2 ? "ng" : "warn"; li.style.display = "grid";
    li.innerHTML = `<span class="ic">${is.streak >= 2 ? "✗" : "△"}</span><span><span class="lb"></span> <span class="ms"></span><div class="tp"></div></span>`;
    li.querySelector(".lb").textContent = `${is.k + 1}文目 ${is.label}`;
    li.querySelector(".ms").textContent = (is.streak >= 2 ? `${is.streak}回連続` : "前回") + (is.last != null ? `・前回 ${fmtMetric(is.last, is.unit)}` : "") + (is.target != null ? `（目標 ${fmtMetric(is.target, is.unit)}${is.unit === "点" ? "以上" : "以下"}）` : "");
    li.querySelector(".tp").textContent = advice(is);
    ul.appendChild(li);
  });
}

function progressHTML(p){
  if (!p || p.attempt < 2) return "";
  const line = (ic, cls, label, msg, tip) => `<li class="${cls}" style="display:grid"><span class="ic">${ic}</span><span><span class="lb">${esc(label)}</span> <span class="ms">${esc(msg)}</span>${tip ? `<div class="tp">${esc(tip)}</div>` : ""}</span></li>`;
  let h = `<div class="rsent"><h2>前回からの変化（${p.attempt}回目）</h2><ul class="finds">`;
  p.fixed.forEach(f => { h += line(f.mastered ? "◎" : "✓", "ok", `${f.k + 1}文目 ${f.label}`, (f.mastered ? "克服！2回続けてできました" : "改善しました") + (f.prev != null && f.now != null ? `（${fmtMetric(f.prev, f.unit)} → ${fmtMetric(f.now, f.unit)}）` : ""), f.mastered ? "" : "次も同じようにできたら克服です"); });
  p.still.forEach(f => { h += line("✗", "ng", `${f.k + 1}文目 ${f.label}`, `まだ（${f.count}回連続）` + (f.prev != null && f.now != null ? `${fmtMetric(f.prev, f.unit)} → ${fmtMetric(f.now, f.unit)}` : "") + (f.target != null ? `・目標 ${fmtMetric(f.target, f.unit)}${f.unit === "点" ? "以上" : "以下"}` : ""), "次はこう練習：" + f.advice); });
  if (p.fresh.length) h += line("△", "warn", "新しい課題", `${p.fresh.length}件（下の各文に表示）`, "");
  if (!p.fixed.length && !p.still.length && !p.fresh.length) h += line("✓", "ok", "課題なし", "前回の課題はすべて解決済みです", "");
  return h + "</ul></div>";
}

/* ---------- report ---------- */
const ICON = {ng:"✗", warn:"△", ok:"✓", info:"i"};
function renderReport(r){
  const card = $("reportCard"); card.hidden = false; card.innerHTML = "";
  const t = r.total, tile = (v, l, main) => `<div class="tile${main ? " main" : ""}"><b>${v == null ? "–" : v}</b><span>${l}</span></div>`;
  const ng = r.sentences.reduce((n, s) => n + s.findings.filter(f => f.status === "ng").length, 0);
  card.insertAdjacentHTML("beforeend", `<div class="hd row" style="justify-content:space-between"><h2>${esc(r.title)}</h2><span class="sub">${esc(r.date)}・${r.rate.toFixed(2)}×</span></div>
    <div class="tiles">${tile(t.pron,"総合",true)}${tile(t.acc,"正確さ")}${tile(t.flu,"流暢さ")}${tile(t.pros,"抑揚")}${tile(t.comp,"完全さ")}</div>
    <div class="sub">直したいところ ${ng}か所。赤い ‿ はつながっていない所、色の付いた語は発音が崩れた語です。</div>
    <label class="toggle"><input type="checkbox" id="showAll"> できている所も表示</label>${progressHTML(r.progress)}`);
  const audioUrl = takeAudio.get(r.id);
  let player = null;
  if (audioUrl){ player = new Audio(audioUrl); }
  r.sentences.forEach((s, k) => {
    const sec = document.createElement("div"); sec.className = "rsent";
    const markStatus = {}; s.findings.forEach(f => { if (f.i >= 0) markStatus[`${f.i}-${f.j}`] = f.status; });
    const sc = s.scores ? Math.round(s.scores.pron) : "–";
    sec.innerHTML = `<div class="hd"><span class="no">${String(k+1).padStart(2,"0")}・${sc}点</span><span class="row"></span></div>`;
    if (player){
      const b = document.createElement("button"); b.className = "btn ghost small"; b.textContent = "▶ 自分の声";
      b.addEventListener("click", () => { player.pause(); player.currentTime = s.a; player.play().catch(() => {}); const stopAt = s.b; player.ontimeupdate = () => { if (player.currentTime >= stopAt) player.pause(); }; });
      sec.querySelector(".hd .row").appendChild(b);
    }
    const sb = document.createElement("button"); sb.className = "btn ghost small"; sb.textContent = "▶ お手本";
    sb.addEventListener("click", async () => {
      stopModel(); unlockAudio();
      try {
        const v = $("voice").value;
        if (v.startsWith("az:")) await playUrl(await azClip(s.en, v.slice(3), r.rate), 0);
        else if (synth) await speakDevice(s.en);
      } catch(e){ azError(e); }
    });
    sec.querySelector(".hd .row").appendChild(sb);
    sec.appendChild(sentenceEl(s.en, {tok: s.tok, marks: markStatus}));
    if (s.ja){ const j = document.createElement("div"); j.className = "ja"; j.textContent = s.ja; sec.appendChild(j); }
    const ul = document.createElement("ul"); ul.className = "finds";
    s.findings.forEach(f => {
      const li = document.createElement("li"); li.className = f.status;
      li.innerHTML = `<span class="ic">${ICON[f.status]}</span><span><span class="lb"></span> <span class="ms"></span><div class="tp"></div></span>`;
      li.querySelector(".lb").textContent = f.label; li.querySelector(".ms").textContent = f.msg;
      li.querySelector(".tp").textContent = f.status === "ok" ? "" : f.tip || "";
      ul.appendChild(li);
    });
    if (!s.findings.some(f => f.status === "ng" || f.status === "warn")){
      const li = document.createElement("li"); li.className = "ok"; li.style.display = "grid";
      li.innerHTML = `<span class="ic">✓</span><span>この文はよく言えています</span>`; ul.appendChild(li);
    }
    sec.appendChild(ul);
    if (s.heard){ const h = document.createElement("div"); h.className = "sub"; h.textContent = "聞き取り: " + s.heard; sec.appendChild(h); }
    card.appendChild(sec);
  });
  const cb = document.createElement("button"); cb.className = "btn ghost"; cb.textContent = "Claudeにもっと詳しく聞く（コピー）";
  const cm = document.createElement("div"); cm.className = "sub";
  cb.addEventListener("click", async () => {
    const text = claudePrompt(r);
    try { await navigator.clipboard.writeText(text); cm.textContent = "コピーしました。Claudeのチャットに貼ってください。"; }
    catch(e){ cm.textContent = "コピーできませんでした。"; }
  });
  card.append(cb, cm);
  $("showAll").addEventListener("change", e => card.classList.toggle("showall", e.target.checked));
  card.scrollIntoView({behavior:"smooth", block:"start"});
}

function claudePrompt(r){
  const lines = r.sentences.map((s, k) => {
    const f = s.findings.filter(x => x.status !== "ok").map(x => `  - [${x.status}] ${x.label}: ${x.msg}`).join("\n");
    return `${k+1}. ${s.en}\n  スコア: ${s.scores ? Math.round(s.scores.pron) : "–"} / 聞き取り: ${s.heard || "-"}\n${f || "  - 問題なし"}`;
  }).join("\n");
  return `英語のシャドーイングの発音評価結果です（Azureの発音評価による実測）。日本人学習者向けに、カタカナや口の動きなど感覚的にわかる言葉で、優先度の高い順に3〜5つ、具体的な直し方と練習法を教えてください。リンキング・弱形・脱落など音の変化に特に注目してください。

${r.progress && r.progress.attempt > 1 ? `同じ英文の${r.progress.attempt}回目の提出です。何度やっても直らない課題: ${r.progress.still.map(x => `${x.k + 1}文目「${x.label}」(${x.count}回連続)`).join("、") || "なし"}。直らない課題は特に、これまでと違う角度の練習法を提案してください。

` : ""}総合 ${r.total.pron} / 正確さ ${r.total.acc} / 流暢さ ${r.total.flu} / 抑揚 ${r.total.pros} / 完全さ ${r.total.comp}（スピード ${r.rate}×）

${lines}`;
}

function renderHist(){
  const h = store.get("reports", []), ul = $("hist"); ul.innerHTML = "";
  if (!h.length){ ul.innerHTML = "<li><span class='sub'>まだ添削がありません。練習タブで録音して「提出して添削」を押してください。</span></li>"; return; }
  h.forEach(r => {
    const li = document.createElement("li"); li.innerHTML = "<button></button><span class='s'></span>";
    li.children[0].textContent = `${r.date}　${r.title}`; li.children[1].textContent = r.total.pron == null ? "–" : r.total.pron + "点";
    li.children[0].addEventListener("click", () => renderReport(r));
    ul.appendChild(li);
  });
}

/* ---------- settings ---------- */
(() => { const c = store.get("azure", null); if (c){ $("azKey").value = c.key || ""; $("azRegion").value = c.region || "eastus"; } })();
$("azSave").addEventListener("click", async () => {
  const key = $("azKey").value.trim(), region = $("azRegion").value;
  const msg = $("azMsg");
  if (!key){ store.set("azure", null); msg.className = "sub"; msg.textContent = "キーを削除しました。"; loadVoices(); return; }
  unlockAudio();
  store.set("azure", {key, region}); clipCache.clear();
  msg.className = "sub"; msg.textContent = "接続テスト中…";
  try {
    const url = await azClip("Hello! Let's practice shadowing.", AZ_VOICES[0][0], 1);
    msg.className = "okmsg"; msg.textContent = "接続できました。お手本の声がAzureの声になり、添削が使えます。";
    loadVoices(); playUrl(url, 1).catch(() => {});
  } catch(e){
    msg.className = "err";
    msg.textContent = /401|403/.test(String(e.message)) ? "キーかリージョンが違います。Azureの「キーとエンドポイント」画面の KEY 1 と「場所/リージョン」を確認してください。" : "接続できませんでした（" + e.message + "）。";
  }
});

/* ---------- daily materials (daily.json is updated every morning by a scheduled Claude task) ---------- */
const todayJST = () => new Date().toLocaleDateString("sv-SE", {timeZone: "Asia/Tokyo"});
async function loadDaily(){
  let data;
  try { const r = await fetch("daily.json?t=" + Date.now(), {cache: "no-store"}); if (!r.ok) return; data = await r.json(); } catch(e){ return; }
  const list = (data && data.entries || []).filter(e => e && e.date && Array.isArray(e.sentences) && e.sentences.length).slice(0, 14);
  if (!list.length) return;
  const today = todayJST(), box = $("daily"); box.innerHTML = ""; $("dailyCard").hidden = false;
  const asScript = e => ({title: `${e.date.slice(5).replace("-", "/")} ${e.title}`, level: "毎日", sentences: e.sentences.map(x => ({en: String(x.en), ja: String(x.ja || "")}))});
  list.forEach(e => {
    const b = document.createElement("button");
    b.className = "ex" + (asScript(e).title === current.title ? " on" : "");
    b.innerHTML = "<span><span class='t'></span><div class='sub'></div></span><span class='chip'></span>";
    b.querySelector(".t").textContent = e.title;
    b.querySelector(".sub").textContent = e.focus || "";
    b.querySelector(".chip").textContent = e.date === today ? "本日" : e.date.slice(5).replace("-", "/");
    b.addEventListener("click", () => { setScript(asScript(e)); showTab("practice"); });
    box.appendChild(b);
  });
  const t = list.find(e => e.date === today);
  if (t && store.get("dailySeen", "") !== today && !session){ store.set("dailySeen", today); setScript(asScript(t)); }
}

render(); applyView(); loadVoices(); renderHist(); loadDaily();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
