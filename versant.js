"use strict";
/* Versant English Speaking & Listening test practice.
   Reuses app.js helpers: $, store, esc, az, azClip, playUrl, unlockAudio, setAudioSession,
   getMic, releaseMic, pickMime, decode16k, wav, actx, synth.
   Practice flow per question: play the prompt (TTS) → answer window opens right away with a
   countdown → recording stops at the limit / on 回答終了 / after silence (short parts) →
   Azure transcription → part-specific scoring and speaking metrics. */

/* ---------- pure scoring helpers (also exported for Node tests) ---------- */
const VS = (() => {
  const NUM = {"0":"zero","1":"one","2":"two","3":"three","4":"four","5":"five","6":"six","7":"seven","8":"eight","9":"nine","10":"ten","11":"eleven","12":"twelve","15":"fifteen","20":"twenty","24":"twenty four","30":"thirty","40":"forty","70":"seventy"};
  const FILLERS = new Set(["um","uh","er","ah","erm","hmm","mm","uhm","umm","eh"]);
  const tok = s => String(s || "").toLowerCase().replace(/[’‘]/g, "'").replace(/-/g, " ")
    .split(/\s+/).map(w => w.replace(/[^a-z0-9']/g, "")).filter(Boolean)
    .flatMap(w => (NUM[w] || w).split(" "));
  const joined = s => " " + tok(s).join(" ") + " ";

  /* Part B: word-level LCS between the sentence and what was said */
  function diffWords(ref, said){
    const R = String(ref).split(/\s+/).filter(Boolean).map(raw => ({raw, n: tok(raw).join(" ")})).filter(x => x.n);
    const S = tok(said).filter(w => !FILLERS.has(w));
    const A = R.length, B = S.length;
    const dp = Array.from({length: A+1}, () => new Uint16Array(B+1));
    for (let i = A-1; i >= 0; i--) for (let j = B-1; j >= 0; j--)
      dp[i][j] = R[i].n === S[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
    const usedS = new Array(B).fill(false);
    let i = 0, j = 0;
    while (i < A && j < B){
      if (R[i].n === S[j]){ R[i].ok = true; usedS[j] = true; i++; j++; }
      else if (dp[i+1][j] >= dp[i][j+1]) i++; else j++;
    }
    const hit = R.filter(r => r.ok).length;
    return {words: R.map(r => ({w: r.raw, ok: !!r.ok})), hit, total: A, pct: A ? Math.round(hit / A * 100) : 0,
            extra: S.filter((_, k) => !usedS[k])};
  }

  /* Parts A/C/D: any accepted answer appears in what was said */
  function checkAnswer(said, accept){
    const t = joined(said), toks = tok(said);
    return accept.some(a => {
      const at = tok(a);
      if (at.length > 1) return t.includes(" " + at.join(" ") + " ");
      const w = at[0]; if (!w) return false;
      return w.length <= 3 ? toks.includes(w) : toks.some(x => x.startsWith(w));
    });
  }

  /* Part E: person / problem / action / result keyword groups */
  function retellChecklist(said, keys){
    const t = joined(said), out = {};
    Object.entries(keys).forEach(([k, list]) => { out[k] = list.some(w => t.includes(" " + tok(w).join(" "))); });
    return out;
  }

  /* Part F: did the answer follow the template? */
  function opinionChecklist(said){
    const t = joined(said);
    const has = re => re.test(t);
    return {
      stance: has(/ (i think|i believe|i prefer|in my opinion|i'd say|i would say) /),
      first: has(/ (first|firstly|first of all|one reason) /),
      example: has(/ (for example|for instance|such as) /),
      second: has(/ (second|secondly|another reason|also) /),
      conclusion: has(/ (overall|in conclusion|that's why|to sum up|so i prefer) /)
    };
  }

  function speechStats(said, onset, lastVoice, pauses, elapsed){
    const all = tok(said);
    const fillers = all.filter(w => FILLERS.has(w)).length;
    const words = all.length - fillers;
    const span = onset != null && lastVoice != null ? Math.max(0.5, lastVoice - onset) : (words && elapsed ? elapsed : null);
    return {words, fillers, wpm: span ? Math.round(words / (span / 60)) : null, latency: onset, pauses};
  }

  return {tok, diffWords, checkAnswer, retellChecklist, opinionChecklist, speechStats, FILLERS};
})();
if (typeof module !== "undefined" && module.exports){ module.exports = VS; }

/* ---------- UI (browser only) ---------- */
if (typeof window !== "undefined") (function(){
  const ORDER = ["A","B","C","D","E","F"];
  const PRIORITY = new Set(["B","E","F"]);
  const VOICE = {N: "en-US-JennyNeural", M: "en-US-AndrewMultilingualNeural", W: "en-US-AvaMultilingualNeural"};
  const SHORT = new Set(["A","B","C","D"]);
  const E_LABEL = {person: "人物", problem: "問題", action: "行動", result: "結果"};
  const F_LABEL = {stance: "立場（I think … is better）", first: "理由1（First, …）", example: "例（For example, …）", second: "理由2（Second, …）", conclusion: "まとめ（So overall, …）"};
  const TEMPLATE = {
    E: "This story is about [人物]. [問題]. Then [行動]. In the end, [結果].",
    F: "I think [立場] is better, for two reasons. First, … For example, … Second, … So overall, I prefer [立場]."
  };
  let bank = null, part = null, item = null, run = 0, state = "idle", rec = null;
  const today = () => new Date().toLocaleDateString("sv-SE", {timeZone: "Asia/Tokyo"});

  const panel = document.getElementById("p-versant");
  panel.innerHTML = `<div id="vHome"></div><div id="vQ" hidden></div>`;

  async function loadBank(){
    if (bank) return bank;
    const r = await fetch("versant.json?t=" + Date.now(), {cache: "no-store"});
    bank = await r.json();
    return bank;
  }

  /* ---------- home: part picker with recent results ---------- */
  function hist(){ return store.get("v-hist", []); }
  function partSummary(p){
    const h = hist().filter(x => x.part === p).slice(0, 10);
    if (!h.length) return "まだ記録なし";
    const avg = k => { const v = h.map(x => x[k]).filter(x => typeof x === "number"); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const s = avg("score"), lat = avg("lat");
    const label = p === "B" ? "一致率" : p === "E" ? "要素" : p === "F" ? "型" : "正解";
    return `直近${h.length}回：${label} ${s == null ? "–" : Math.round(s) + "%"}` + (lat != null ? `・話し始め ${lat.toFixed(1)}秒` : "");
  }
  async function renderHome(){
    $("vQ").hidden = true; const home = $("vHome"); home.hidden = false;
    home.innerHTML = `<div class="card"><h2>Versant 対策</h2><div class="sub">パートを選んで練習します。問題の音声が流れたあと、すぐに回答の録音が始まります。練習なので、聞き直しもできます。</div>
      <div class="note">イヤホンを使ってください。採点（文字起こし）には設定タブのAzureキーが必要です。本番はPCなので、Macのブラウザでも同じように練習できます。</div></div>
      <div class="vparts" id="vParts">読み込み中…</div>`;
    try { await loadBank(); } catch(e){ $("vParts").textContent = "問題データを読み込めませんでした。通信を確認して開き直してください。"; return; }
    const box = $("vParts"); box.innerHTML = "";
    ORDER.forEach(p => {
      const P = bank.parts[p];
      const b = document.createElement("button"); b.className = "vpart" + (PRIORITY.has(p) ? " pri" : "");
      b.innerHTML = `<span class="vl">${p}</span><span class="vt"><b></b><span class="sub"></span><span class="sub vs"></span></span>${PRIORITY.has(p) ? '<span class="chip">優先</span>' : ""}`;
      b.querySelector("b").textContent = P.name;
      b.querySelector(".sub").textContent = `本番 ${P.count}問・回答 ${P.time}秒・収録 ${P.items.length}問`;
      b.querySelector(".vs").textContent = partSummary(p);
      b.addEventListener("click", () => openPart(p));
      box.appendChild(b);
    });
  }

  /* ---------- question screen ---------- */
  function nextItem(p){
    const P = bank.parts[p], k = "v-pos-" + p;
    const pos = store.get(k, 0) % P.items.length;
    store.set(k, pos + 1);
    return {it: P.items[pos], n: pos + 1, total: P.items.length};
  }
  function openPart(p){ part = p; showQuestion(nextItem(p)); }

  function showQuestion({it, n, total}){
    item = it; state = "idle";
    const P = bank.parts[part];
    $("vHome").hidden = true; const q = $("vQ"); q.hidden = false;
    q.innerHTML = `<div class="card">
        <div class="row" style="justify-content:space-between"><button class="btn ghost small" id="vBack">← パート一覧</button><span class="chip">Part ${part}・${n}/${total}</span></div>
        <h2>${esc(P.name)}<span class="sub">（${esc(P.en)}）</span></h2>
        <div class="sub">${hint(part)}</div>
        ${TEMPLATE[part] ? `<div class="vtpl"><b>型</b>${esc(TEMPLATE[part])}</div>` : ""}
      </div>
      <div class="card vstage">
        <div class="vstatus" id="vStatus">準備ができたらスタート</div>
        <div class="vbar"><i id="vFill"></i></div>
        <div class="row" style="justify-content:space-between"><span class="sub" id="vTime">回答時間 ${P.time}秒</span><span class="vlvl"><i id="vLvl"></i></span></div>
        <div class="row">
          <button class="btn" id="vStart">▶ スタート</button>
          <button class="btn ghost" id="vReplay" hidden>もう一度聞く</button>
          <button class="btn ghost" id="vDone" hidden>回答終了</button>
        </div>
        <div class="err" id="vErr"></div>
      </div>
      <div class="card" id="vResult" hidden></div>`;
    $("vBack").addEventListener("click", () => { cancel(); renderHome(); });
    $("vStart").addEventListener("click", () => begin());
    $("vReplay").addEventListener("click", () => begin());
    $("vDone").addEventListener("click", () => { if (rec) rec.finish("button"); });
  }
  function hint(p){
    return {
      A: "質問に、単語か短いフレーズで答えます。",
      B: "聞いた文を、そのまま正確にくり返します。",
      C: "2人の会話のあとに質問が流れます。決まった内容（時間・場所・数など）を短く答えます。",
      D: "短い文章のあとに質問が流れます。人物・出来事・理由・結果を短く答えます。",
      E: "聞いた話を自分の言葉で言い直します。下の型を使いましょう。",
      F: "身近なテーマについて意見を言います。下の型を使いましょう。"
    }[p];
  }

  /* ---------- prompt playback ---------- */
  function segments(p, it){
    switch (p){
      case "A": return [{v:"N", t: it.q}];
      case "B": return [{v:"N", t: it.text}];
      case "C": return [...it.lines.map(l => ({v: l.s, t: l.t, gap: 350})), {v:"N", t: it.q, pre: 500}];
      case "D": return [{v:"N", t: it.passage}, {v:"N", t: it.q, pre: 700}];
      case "E": return [{v:"N", t: it.passage}];
      case "F": return [{v:"N", t: it.q}];
    }
  }
  function deviceVoiceFor(v){
    const en = (synth ? synth.getVoices() : []).filter(x => /^en[-_]US/i.test(x.lang));
    const pick = re => en.find(x => re.test(x.name));
    if (v === "M") return pick(/(Aaron|Alex|Evan|Nathan|Tom|Daniel|Guy|Google US English Male)/) || en[1] || en[0];
    if (v === "W") return pick(/(Samantha|Ava|Allison|Susan|Zoe|Nicky|Jenny|Aria)/) || en[0];
    return pick(/(Samantha|Ava|Allison|Jenny|Google US English)/) || en[0];
  }
  function speakWith(text, v){
    return new Promise((res, rej) => {
      const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = 1;
      const voice = deviceVoiceFor(v); if (voice) u.voice = voice;
      let started = false; u.onstart = () => { started = true; };
      u.onend = () => started ? res() : rej(new Error("tts-device")); u.onerror = () => rej(new Error("tts-device"));
      synth.speak(u);
    });
  }
  async function playPrompt(token){
    for (const s of segments(part, item)){
      if (token !== run) return;
      if (s.pre) await wait(s.pre);
      if (az()) await playUrl(await azClip(s.t, VOICE[s.v], 1), 0);
      else if (synth) await speakWith(s.t, s.v);
      else throw new Error("tts");
      if (s.gap) await wait(s.gap);
    }
  }
  async function prefetch(){
    if (!az()) return;
    await Promise.all(segments(part, item).map(s => azClip(s.t, VOICE[s.v], 1)));
  }

  /* ---------- one attempt: prompt → answer window → analysis ---------- */
  function cancel(){
    run++;
    const busy = state !== "idle" || rec;
    try { stopModel(); } catch(e){}
    if (rec){ rec.abort(); rec = null; }
    if (busy){ releaseMic(); setAudioSession("auto"); }
    state = "idle";
  }
  async function begin(){
    cancel();
    const token = run;
    setAudioSession("play-and-record"); unlockAudio();
    $("vResult").hidden = true; $("vErr").textContent = "";
    $("vStart").hidden = true; $("vReplay").hidden = true; $("vDone").hidden = true;
    setFill(0); status("準備中…");
    let stream;
    try { stream = await getMic(); }
    catch(e){ $("vErr").textContent = "マイクを使えませんでした。ブラウザのマイク許可を確認してください。"; $("vStart").hidden = false; return; }
    if (actx && actx.state !== "running"){ try { await actx.resume(); } catch(e){} }
    try { await prefetch(); } catch(e){ $("vErr").textContent = "Azureに接続できませんでした。設定タブのキーと通信を確認してください。"; $("vStart").hidden = false; releaseMic(); return; }
    if (token !== run) return;

    const meter = makeMeter(stream);
    state = "prompt"; status("🔊 問題を聞いてください"); $("vReplay").hidden = false;
    try { await playPrompt(token); }
    catch(e){
      meter.stop();
      if (token !== run) return;
      $("vErr").textContent = e.message === "tts-device" ? "この端末の読み上げ音声は録音中に使えないことがあります。設定タブでAzureのキーを入れてください。" : "問題の音声を再生できませんでした。";
      $("vStart").hidden = false; releaseMic(); return;
    }
    if (token !== run){ meter.stop(); return; }
    meter.freezeFloor();
    state = "answer";
    rec = recordAnswer(stream, meter, bank.parts[part].time, token);
    $("vDone").hidden = false;
    const result = await rec.done;
    if (token !== run || !result) return;
    rec = null; state = "idle"; releaseMic(); setAudioSession("auto");
    $("vDone").hidden = true; $("vReplay").hidden = true;
    await analyze(result, token);
  }

  /* level meter on the mic: noise floor while the prompt plays, then voice onset / pauses */
  function makeMeter(stream){
    const ctx = actx;
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const floorSamples = [];
    let floor = 0.004, frozen = false, listener = null;
    const timer = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const rms = Math.sqrt(s / buf.length);
      if (!frozen) floorSamples.push(rms);
      const lvl = $("vLvl"); if (lvl) lvl.style.width = Math.min(100, rms * 900) + "%";
      if (listener) listener(rms);
    }, 50);
    return {
      freezeFloor(){ frozen = true; const v = floorSamples.slice().sort((a, b) => a - b); floor = v.length ? v[Math.floor(v.length * 0.2)] : 0.004; },
      threshold(){ return Math.max(0.012, floor * 3); },
      onLevel(fn){ listener = fn; },
      stop(){ clearInterval(timer); try { src.disconnect(); } catch(e){} }
    };
  }

  function recordAnswer(stream, meter, limit, token){
    const mime = pickMime();
    const chunks = []; let mr = null;
    try { mr = mime ? new MediaRecorder(stream, {mimeType: mime}) : new MediaRecorder(stream); } catch(e){}
    if (mr){ mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); }; mr.start(250); }
    const t0 = performance.now(), thr = meter.threshold();
    let voiced = 0, onset = null, lastVoice = null, silenceStart = null, pauses = 0, warned = false, finished = false;
    status("🎙 回答してください"); setFill(0);
    let resolve; const done = new Promise(r => resolve = r);
    meter.onLevel(rms => {
      const t = (performance.now() - t0) / 1000;
      if (rms > thr){
        voiced++;
        if (voiced >= 3 && onset == null) onset = Math.max(0, t - 0.1);
        if (onset != null){
          if (silenceStart != null && t - silenceStart >= 1.0 && lastVoice != null) pauses++;
          silenceStart = null; lastVoice = t;
        }
      } else {
        voiced = 0;
        if (onset != null && silenceStart == null) silenceStart = t;
      }
    });
    const tick = setInterval(() => {
      if (token !== run) return;
      const t = (performance.now() - t0) / 1000;
      setFill(Math.min(1, t / limit));
      $("vTime").textContent = `残り ${Math.max(0, Math.ceil(limit - t))}秒` + (onset != null ? `・話し始め ${onset.toFixed(1)}秒` : "");
      if (onset == null && t >= 6 && !warned){ warned = true; status("⚠ 6秒以内に話し始められませんでした（本番なら次の問題へ進みます）"); }
      if (t >= limit) finish("time");
      else if (SHORT.has(part) && onset != null && silenceStart != null && t - silenceStart >= 2.5) finish("silence");
    }, 100);
    async function finish(why){
      if (finished) return; finished = true;
      clearInterval(tick); meter.stop();
      const elapsed = (performance.now() - t0) / 1000;
      if (mr && mr.state !== "inactive") await new Promise(r => { mr.onstop = r; try { mr.stop(); } catch(e){ r(); } });
      resolve({blob: chunks.length ? new Blob(chunks, {type: chunks[0].type || "audio/mp4"}) : null, onset, lastVoice, pauses, elapsed, why});
    }
    return {
      done, finish,
      abort(){ finished = true; clearInterval(tick); meter.stop(); try { mr && mr.state !== "inactive" && mr.stop(); } catch(e){} resolve(null); }
    };
  }

  /* ---------- transcription (Azure plain speech-to-text, up to 60 s) ---------- */
  async function transcribe(blob){
    const c = az(); if (!c || !blob) return null;
    const pcm = await decode16k(blob);
    const res = await fetch(`https://${c.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`, {
      method: "POST",
      headers: {"Ocp-Apim-Subscription-Key": c.key, "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000", "Accept": "application/json"},
      body: wav(pcm.subarray(0, Math.min(pcm.length, 16000 * 59)))
    });
    if (!res.ok) throw new Error("stt " + res.status);
    const j = await res.json();
    const nb = j.NBest && j.NBest[0];
    return {display: nb ? nb.Display : (j.DisplayText || ""), lexical: nb ? (nb.Lexical || nb.Display) : ""};
  }

  async function analyze(r, token){
    status("採点中…"); setFill(1);
    let tr = null, err = "";
    if (!az()) err = "設定タブでAzureのキーを入れると、文字起こしと自動採点ができます。";
    else {
      try { tr = await transcribe(r.blob); } catch(e){ err = "文字起こしできませんでした（" + e.message + "）。"; }
    }
    if (token !== run) return;
    const said = tr ? `${tr.lexical} ${tr.display}` : "";
    const lex = tr ? tr.lexical : "";
    const stats = VS.speechStats(tr ? tr.lexical : "", r.onset, r.lastVoice, r.pauses, r.elapsed);
    let score = null, judge = "";
    if (tr){
      if (part === "B"){
        const d = VS.diffWords(item.text, lex); score = d.pct;
        judge = `<div class="score"><span class="big">${d.pct}%</span><span class="sub">${d.total}語中 ${d.hit}語 一致</span></div>
          <p class="vdiff">${d.words.map(w => `<span class="w ${w.ok ? "ok" : "ng"}">${esc(w.w)}</span>`).join(" ")}</p>
          ${d.extra.length ? `<div class="sub">違う語・余計な語：${esc(d.extra.join(", "))}</div>` : ""}`;
      } else if (part === "A" || part === "C" || part === "D"){
        const ok = VS.checkAnswer(said, item.accept); score = ok ? 100 : 0;
        judge = `<div class="score"><span class="big" style="color:var(${ok ? "--hit" : "--miss"})">${ok ? "○" : "×"}</span><span class="sub">${ok ? "正解の語が含まれています" : "正解の語が聞き取れませんでした"}（自動判定・目安）</span></div>`;
      } else if (part === "E"){
        const c = VS.retellChecklist(said, item.keys); const n = Object.values(c).filter(Boolean).length; score = n * 25;
        judge = `<div class="score"><span class="big">${n}/4</span><span class="sub">話の要素（自動判定・目安）</span></div>` + checklist(Object.entries(c).map(([k, v]) => [E_LABEL[k], v]));
      } else if (part === "F"){
        const c = VS.opinionChecklist(said); const n = Object.values(c).filter(Boolean).length; score = n * 20;
        judge = `<div class="score"><span class="big">${n}/5</span><span class="sub">型を使えたか（自動判定・目安）</span></div>` + checklist(Object.entries(c).map(([k, v]) => [F_LABEL[k], v]));
      }
    }
    const h = hist(); h.unshift({d: today(), part, id: item.id, score, lat: r.onset, wpm: stats.wpm});
    store.set("v-hist", h.slice(0, 800));
    renderResult(r, tr, stats, judge, err);
  }
  function checklist(rows){
    return `<ul class="finds">${rows.map(([l, v]) => `<li class="${v ? "ok" : "ng"}" style="display:grid"><span class="ic">${v ? "✓" : "✗"}</span><span>${esc(l)}</span></li>`).join("")}</ul>`;
  }
  function scriptHTML(){
    switch (part){
      case "A": return `<p>${esc(item.q)}</p>`;
      case "B": return `<p>${esc(item.text)}</p>`;
      case "C": return item.lines.map(l => `<p><b>${l.s === "M" ? "男性" : "女性"}：</b>${esc(l.t)}</p>`).join("") + `<p><b>質問：</b>${esc(item.q)}</p>`;
      case "D": return `<p>${esc(item.passage)}</p><p><b>質問：</b>${esc(item.q)}</p>`;
      case "E": return `<p>${esc(item.passage)}</p>`;
      case "F": return `<p>${esc(item.q)}</p>`;
    }
  }
  function renderResult(r, tr, st, judge, err){
    status(r.why === "time" ? "時間切れ（途中まででも採点されます）" : "回答終了");
    $("vTime").textContent = `回答時間 ${bank.parts[part].time}秒`;
    const box = $("vResult"); box.hidden = false;
    const lat = st.latency;
    const metric = (label, val, warn) => `<div class="tile${warn ? " warn" : ""}"><b>${val}</b><span>${label}</span></div>`;
    const long = part === "E" || part === "F";
    box.innerHTML = `<h2>結果</h2>
      ${err ? `<div class="err">${esc(err)}</div>` : ""}
      ${judge}
      <div class="tiles vtiles">
        ${metric("話し始め", lat != null ? lat.toFixed(1) + "秒" : st.words ? "検出できず" : "なし", lat != null ? lat > 6 : !st.words)}
        ${long ? metric("語数", st.words, false) : ""}
        ${long ? metric("WPM", st.wpm == null ? "–" : st.wpm, st.wpm != null && (st.wpm < 90)) : ""}
        ${metric("フィラー", st.fillers + "回", st.fillers > 2)}
        ${metric("1秒以上の間", st.pauses + "回", st.pauses > (long ? 3 : 0))}
      </div>
      <div class="sub">${long ? "WPMは1分あたりの語数（目安 110〜150）。" : ""}フィラー（um, uh など）は音声認識で消えることがあるので少なめに出ます。</div>
      ${r.blob ? `<div class="field"><label>自分の録音</label><audio controls playsinline src="${URL.createObjectURL(r.blob)}"></audio></div>` : ""}
      <div class="field"><label>あなたの回答（文字起こし）</label><div class="vbox">${tr ? esc(tr.display || "（聞き取れませんでした）") : "–"}</div></div>
      <div class="field"><label>問題のスクリプト</label><div class="vbox">${scriptHTML()}</div></div>
      ${item.model ? `<div class="field"><label>模範解答</label><div class="vbox">${esc(item.model)}</div></div>` : ""}
      <div class="row"><button class="btn ghost" id="vAgain">もう一度この問題</button><button class="btn" id="vNext">次の問題 →</button></div>`;
    $("vAgain").addEventListener("click", () => { $("vResult").hidden = true; begin(); });
    $("vNext").addEventListener("click", () => showQuestion(nextItem(part)));
    $("vStart").hidden = true; $("vReplay").hidden = true;
    box.scrollIntoView({behavior: "smooth", block: "start"});
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  function status(t){ const s = $("vStatus"); if (s) s.textContent = t; }
  function setFill(f){ const el = $("vFill"); if (el) el.style.width = Math.round(f * 100) + "%"; }

  window.Versant = {show: renderHome, cancel};
})();
