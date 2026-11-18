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

  /* Part F: content words from the prompt that also appear in the answer (Pearson scores content by
     prompt-related words, so reusing the question's own words is a cheap, safe signal) */
  const STOP = new Set(("a an the and or but if so to of in on at for from by with about as is are was were be been being do does did " +
    "you your yours i me my we our they their them he she it its this that these those there here what which who whom why how when where " +
    "would could should will can may might must shall some others other people person prefer think better best rather than more most " +
    "while not no yes or either whether it's isn't don't doesn't why or why not one ones every each day a day year " +
    "have has had own take use out held several everyone everyday twenty four get make also just very really well much many like").split(/\s+/));
  const stem = w => w.replace(/'s$/, "").replace(/(ing|ers|er|ed|es|s)$/, "").slice(0, 6);
  function topicWords(prompt){
    const seen = new Set(), out = [];
    tok(prompt).forEach(w => { if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) return; const k = stem(w); if (!seen.has(k)){ seen.add(k); out.push(w); } });
    return out;
  }
  function topicCoverage(said, prompt){
    const words = topicWords(prompt), saidStems = new Set(tok(said).map(stem));
    const rows = words.map(w => ({w, ok: saidStems.has(stem(w))}));
    const hit = rows.filter(r => r.ok).length;
    return {rows, hit, total: rows.length, pct: rows.length ? Math.round(hit / rows.length * 100) : 0};
  }

  function speechStats(said, onset, lastVoice, pauses, elapsed){
    const all = tok(said);
    const fillers = all.filter(w => FILLERS.has(w)).length;
    const words = all.length - fillers;
    const span = onset != null && lastVoice != null ? Math.max(0.5, lastVoice - onset) : (words && elapsed ? elapsed : null);
    return {words, fillers, wpm: span ? Math.round(words / (span / 60)) : null, latency: onset, pauses};
  }

  return {tok, diffWords, checkAnswer, retellChecklist, opinionChecklist, topicWords, topicCoverage, speechStats, FILLERS};
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
    const label = p === "B" ? "一致率" : p === "E" ? "要素" : p === "F" ? "型＋お題" : "正解";
    return `直近${h.length}回：${label} ${s == null ? "–" : Math.round(s) + "%"}` + (lat != null ? `・話し始め ${lat.toFixed(1)}秒` : "");
  }
  async function renderHome(){
    $("vQ").hidden = true; const home = $("vHome"); home.hidden = false;
    home.innerHTML = `<div class="card"><h2>Versant 対策</h2><div class="sub">パートを選んで練習します。問題の音声が流れたあと、すぐに回答の録音が始まります。練習なので、聞き直しもできます。</div>
      <div class="note">イヤホンを使ってください。採点（文字起こし）には設定タブのAzureキーが必要です。本番はPCなので、Macのブラウザでも同じように練習できます。</div></div>
      <div class="card vmock"><h2>本番模擬テスト</h2>
        <div class="sub">全40問（A8・B16・C6・D6・E2・F2）を本番どおり通しで出題します。約17分。戻る・聞き直しはできず、6秒話さないと次の問題へ進みます。結果は最後にまとめて表示します。</div>
        <button class="btn" id="vMockBtn">模擬テストを始める</button>
        <div id="vMockHist"></div></div>
      <div class="vparts" id="vParts">読み込み中…</div>`;
    try { await loadBank(); } catch(e){ $("vParts").textContent = "問題データを読み込めませんでした。通信を確認して開き直してください。"; return; }
    $("vMockBtn").addEventListener("click", mockIntro);
    renderMockHist();
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
  async function playPrompt(token, p = part, it = item){
    for (const s of segments(p, it)){
      if (token !== run) return;
      if (s.pre) await wait(s.pre);
      if (az()) await playUrl(await azClip(s.t, VOICE[s.v], 1), 0);
      else if (synth) await speakWith(s.t, s.v);
      else throw new Error("tts");
      if (s.gap) await wait(s.gap);
    }
  }
  async function prefetch(p = part, it = item){
    if (!az()) return;
    await Promise.all(segments(p, it).map(s => azClip(s.t, VOICE[s.v], 1)));
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

  function recordAnswer(stream, meter, limit, token, opts = {}){
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
      if (onset == null && t >= 6 && opts.mock){ finish("noanswer"); return; }
      if (onset == null && t >= 6 && !warned){ warned = true; status("⚠ 6秒以内に話し始められませんでした（本番なら次の問題へ進みます）"); }
      if (t >= limit) finish("time");
      else if (SHORT.has(part) && onset != null && silenceStart != null && t - silenceStart >= 2.5) finish("silence");
      else if (opts.mock && onset != null && silenceStart != null && t - silenceStart >= 4) finish("silence");
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

  function evaluate(p, it, r, tr){
    const said = tr ? `${tr.lexical} ${tr.display}` : "";
    const lex = tr ? tr.lexical : "";
    const stats = VS.speechStats(lex, r.onset, r.lastVoice, r.pauses, r.elapsed);
    let score = null, judge = "";
    if (tr){
      if (p === "B"){
        const d = VS.diffWords(it.text, lex); score = d.pct;
        judge = `<div class="score"><span class="big">${d.pct}%</span><span class="sub">${d.total}語中 ${d.hit}語 一致</span></div>
          <p class="vdiff">${d.words.map(w => `<span class="w ${w.ok ? "ok" : "ng"}">${esc(w.w)}</span>`).join(" ")}</p>
          ${d.extra.length ? `<div class="sub">違う語・余計な語：${esc(d.extra.join(", "))}</div>` : ""}`;
      } else if (p === "A" || p === "C" || p === "D"){
        const ok = VS.checkAnswer(said, it.accept); score = ok ? 100 : 0;
        judge = `<div class="score"><span class="big" style="color:var(${ok ? "--hit" : "--miss"})">${ok ? "○" : "×"}</span><span class="sub">${ok ? "正解の語が含まれています" : "正解の語が聞き取れませんでした"}（自動判定・目安）</span></div>`;
      } else if (p === "E"){
        const c = VS.retellChecklist(said, it.keys); const n = Object.values(c).filter(Boolean).length; score = n * 25;
        judge = `<div class="score"><span class="big">${n}/4</span><span class="sub">話の要素（自動判定・目安）</span></div>` + checklist(Object.entries(c).map(([k, v]) => [E_LABEL[k], v]));
      } else if (p === "F"){
        const c = VS.opinionChecklist(said); const n = Object.values(c).filter(Boolean).length;
        const tc = VS.topicCoverage(said, it.q);
        score = Math.round(n / 5 * 50 + tc.pct / 2);          // template 50% + prompt words 50%
        judge = `<div class="score"><span class="big">${score}%</span><span class="sub">型 ${n}/5 ＋ お題の言葉 ${tc.hit}/${tc.total}（自動判定・目安）</span></div>
          <div class="field"><label>お題の言葉を使えたか</label><p class="vdiff">${tc.rows.map(r => `<span class="w ${r.ok ? "ok" : "ng"}">${esc(r.w)}</span>`).join(" ")}</p>
          <div class="sub">本番は「お題に関係する語」が出てくるかで内容が評価されます。質問に出てきた語を回答の中でも使いましょう。</div></div>`
          + checklist(Object.entries(c).map(([k, v]) => [F_LABEL[k], v]));
      }
    }
    return {score, judge, stats};
  }
  async function analyze(r, token){
    status("採点中…"); setFill(1);
    let tr = null, err = "";
    if (!az()) err = "設定タブでAzureのキーを入れると、文字起こしと自動採点ができます。";
    else {
      try { tr = await transcribe(r.blob); } catch(e){ err = "文字起こしできませんでした（" + e.message + "）。"; }
    }
    if (token !== run) return;
    const ev = evaluate(part, item, r, tr);
    const h = hist(); h.unshift({d: today(), part, id: item.id, score: ev.score, lat: r.onset, wpm: ev.stats.wpm});
    store.set("v-hist", h.slice(0, 800));
    renderResult(r, tr, ev.stats, ev.judge, err);
  }
  function checklist(rows){
    return `<ul class="finds">${rows.map(([l, v]) => `<li class="${v ? "ok" : "ng"}" style="display:grid"><span class="ic">${v ? "✓" : "✗"}</span><span>${esc(l)}</span></li>`).join("")}</ul>`;
  }
  function scriptHTML(p = part, it = item){
    const item_ = it;
    switch (p){
      case "A": return `<p>${esc(item_.q)}</p>`;
      case "B": return `<p>${esc(item_.text)}</p>`;
      case "C": return item_.lines.map(l => `<p><b>${l.s === "M" ? "男性" : "女性"}：</b>${esc(l.t)}</p>`).join("") + `<p><b>質問：</b>${esc(item_.q)}</p>`;
      case "D": return `<p>${esc(item_.passage)}</p><p><b>質問：</b>${esc(item_.q)}</p>`;
      case "E": return `<p>${esc(item_.passage)}</p>`;
      case "F": return `<p>${esc(item_.q)}</p>`;
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
    $("vNext").addEventListener("click", () => { showQuestion(nextItem(part)); begin(); });   // flows straight into the next prompt, like the real test
    $("vStart").hidden = true; $("vReplay").hidden = true;
    box.scrollIntoView({behavior: "smooth", block: "start"});
  }


  /* ================= 本番模擬モード ================= */
  const PLAN = [["A",8],["B",16],["C",6],["D",6],["E",2],["F",2]];
  const INSTR = {
    A: "Part A. Short answer questions. Please answer each question with a single word or a short phrase.",
    B: "Part B. Repeats. Please repeat each sentence that you hear, exactly as you hear it.",
    C: "Part C. Conversations. You will hear a conversation between two people, followed by a question. Please answer the question with a word or a short phrase.",
    D: "Part D. Passage comprehension. You will hear a short passage, followed by a question. Please answer the question.",
    E: "Part E. Story retelling. You will hear a short story. Please retell the story in your own words.",
    F: "Part F. Open questions. You will hear a question. Please give your opinion and explain your reasons."
  };
  let mock = null;
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  function renderMockHist(){
    const h = store.get("v-mock", []), box = $("vMockHist"); if (!box) return;
    if (!h.length){ box.innerHTML = ""; return; }
    box.innerHTML = `<div class="sub" style="margin-top:6px">これまでの模擬テスト</div><ul class="hist">` + h.slice(0, 5).map((m, k) =>
      `<li><button data-k="${k}">${esc(m.date)}</button><span class="s">${["A","B","C","D","E","F"].map(p => `${p} ${m.parts[p] && m.parts[p].pct != null ? m.parts[p].pct + "%" : "–"}`).join(" ")}</span></li>`).join("") + "</ul>";
    box.querySelectorAll("button[data-k]").forEach(b => b.addEventListener("click", () => showMockSummaryOnly(h[Number(b.dataset.k)])));
  }

  function mockIntro(){
    $("vHome").hidden = true; const q = $("vQ"); q.hidden = false;
    q.innerHTML = `<div class="card"><button class="btn ghost small" id="vBack" style="align-self:flex-start">← 戻る</button>
      <h2>本番模擬テスト（全40問・約17分）</h2>
      <ul class="finds">
        <li class="warn" style="display:grid"><span class="ic">1</span><span>イヤホンをつけ、静かな場所で受けてください。途中で止めると最初からになります。</span></li>
        <li class="warn" style="display:grid"><span class="ic">2</span><span>問題の音声は1回だけ。戻る・聞き直しはできません。</span></li>
        <li class="warn" style="display:grid"><span class="ic">3</span><span>音声が終わったらすぐ回答。6秒話さないと次の問題へ進みます。時間切れでも、途中まで話した分は採点されます。</span></li>
        <li class="warn" style="display:grid"><span class="ic">4</span><span>結果は最後にまとめて表示します（採点はテスト中に裏で進めます）。</span></li>
      </ul>
      ${az() ? "" : `<div class="err">設定タブでAzureのキーを入れてから始めてください（読み上げと採点に使います）。</div>`}
      <button class="btn" id="vMockGo"${az() ? "" : " disabled"}>テストを開始する</button></div>`;
    $("vBack").addEventListener("click", renderHome);
    $("vMockGo").addEventListener("click", startMock);
  }

  async function startMock(){
    cancel();
    const token = run;
    setAudioSession("play-and-record"); unlockAudio();
    const list = [];
    (window.__vPlan || PLAN).forEach(([p, n]) => shuffle(bank.parts[p].items).slice(0, n).forEach(it => list.push({p, it})));
    mock = {list, results: [], token, done: 0, queue: Promise.resolve()};
    state = "mock";
    $("vQ").innerHTML = `<div class="card vstage">
        <div class="row" style="justify-content:space-between"><span class="chip" id="vMPart">準備中</span><span class="sub" id="vMNum"></span></div>
        <div class="vstatus" id="vStatus">準備中…</div>
        <div class="vbar"><i id="vFill"></i></div>
        <div class="row" style="justify-content:space-between"><span class="sub" id="vTime"></span><span class="vlvl"><i id="vLvl"></i></span></div>
        <div class="vbar thin"><i id="vTotal"></i></div>
        <button class="btn ghost small" id="vQuit" style="align-self:flex-end">中断する</button>
        <div class="err" id="vErr"></div></div>`;
    let quitArmed = false;
    $("vQuit").addEventListener("click", () => {
      if (!quitArmed){ quitArmed = true; $("vQuit").textContent = "もう一度押すと中断（結果は残りません）"; setTimeout(() => { quitArmed = false; const b = $("vQuit"); if (b) b.textContent = "中断する"; }, 3000); return; }
      cancel(); mock = null; renderHome();
    });
    let stream;
    try { stream = await getMic(); }
    catch(e){ $("vErr").textContent = "マイクを使えませんでした。ブラウザのマイク許可を確認してください。"; return; }
    if (actx && actx.state !== "running"){ try { await actx.resume(); } catch(e){} }
    let prevPart = null;
    try {
      await prefetch(list[0].p, list[0].it);
      for (let k = 0; k < list.length; k++){
        if (token !== run) return;
        const q = list[k]; part = q.p; item = q.it;
        $("vMPart").textContent = `Part ${part}・${bank.parts[part].name}`;
        $("vMNum").textContent = `${k + 1} / ${list.length}`;
        $("vTotal").style.width = Math.round(k / list.length * 100) + "%";
        $("vTime").textContent = ""; setFill(0);
        if (part !== prevPart){
          prevPart = part;
          status("📢 " + hint(part));
          await playUrl(await azClip(INSTR[part], VOICE.N, 1), 0);
          if (token !== run) return;
          await wait(700);
        }
        const meter = makeMeter(stream);
        status("🔊 問題を聞いてください");
        const next = list[k + 1];
        if (next) prefetch(next.p, next.it).catch(() => {});
        await playPrompt(token);
        if (token !== run){ meter.stop(); return; }
        meter.freezeFloor();
        rec = recordAnswer(stream, meter, bank.parts[part].time, token, {mock: true});
        const r = await rec.done; rec = null;
        if (!r || token !== run) return;
        const entry = {p: part, it: item, r, tr: null, err: ""};
        mock.results.push(entry);
        mock.queue = mock.queue.then(async () => {
          if (r.why === "noanswer" || !r.blob) entry.tr = {display: "", lexical: ""};
          else { try { entry.tr = await transcribe(r.blob); } catch(e){ entry.err = e.message; } }
          mock.done++;
        });
        if (r.why === "noanswer") status("⏭ 6秒話さなかったので次へ");
        await wait(800);
      }
    } catch(e){
      if (token !== run) return;
      $("vErr").textContent = "途中で止まりました（" + (e.message || e) + "）。通信とAzureの設定を確認してください。";
      releaseMic(); setAudioSession("auto"); return;
    }
    releaseMic(); setAudioSession("auto"); state = "idle";
    $("vTotal").style.width = "100%";
    status("採点中…");
    const tick = setInterval(() => { $("vTime").textContent = `${mock.done} / ${mock.results.length} 問 採点済み`; setFill(mock.done / mock.results.length); }, 200);
    await mock.queue; clearInterval(tick);
    if (token !== run) return;
    finishMock();
  }

  function finishMock(){
    const res = mock.results.map(e => Object.assign(e, evaluate(e.p, e.it, e.r, e.tr)));
    const h = hist();
    res.forEach(e => h.unshift({d: today(), part: e.p, id: e.it.id, score: e.score, lat: e.r.onset, wpm: e.stats.wpm, mock: true}));
    store.set("v-hist", h.slice(0, 800));
    const summary = summarize(res);
    const mh = store.get("v-mock", []); mh.unshift(summary); store.set("v-mock", mh.slice(0, 30));
    renderMockResult(res, summary);
  }

  function summarize(res){
    const parts = {};
    ["A","B","C","D","E","F"].forEach(p => {
      const r = res.filter(e => e.p === p); if (!r.length) return;
      const sc = r.map(e => e.score).filter(x => typeof x === "number");
      const lat = r.map(e => e.r.onset).filter(x => typeof x === "number");
      const wpm = r.map(e => e.stats.wpm).filter(x => typeof x === "number");
      parts[p] = {n: r.length, pct: sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / r.length) : null,
        correct: (p === "A" || p === "C" || p === "D") ? r.filter(e => e.score === 100).length : null,
        noAnswer: r.filter(e => e.r.why === "noanswer").length,
        lat: lat.length ? +(lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(1) : null,
        wpm: wpm.length ? Math.round(wpm.reduce((a, b) => a + b, 0) / wpm.length) : null};
    });
    const lat = res.map(e => e.r.onset).filter(x => typeof x === "number");
    return {date: new Date().toLocaleString("ja-JP", {month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"}), parts,
      noAnswer: res.filter(e => e.r.why === "noanswer").length,
      lat: lat.length ? +(lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(1) : null};
  }

  function summaryTable(sm){
    const row = p => {
      const x = sm.parts[p]; if (!x) return "";
      const main = p === "B" ? `平均一致率 ${x.pct}%` : (p === "E" ? `要素 ${x.pct}%` : p === "F" ? `型＋お題 ${x.pct}%` : `${x.correct}/${x.n} 正解`);
      const weak = x.pct != null && x.pct < 60;
      return `<tr class="${weak ? "weak" : ""}"><td><b>${p}</b> ${esc(bank.parts[p].name)}</td><td>${main}</td><td>${x.lat == null ? "–" : x.lat + "秒"}</td><td>${x.noAnswer ? x.noAnswer + "問" : "0"}</td>${x.wpm != null && (p === "E" || p === "F") ? `<td>${x.wpm}</td>` : "<td>–</td>"}</tr>`;
    };
    const ranked = Object.entries(sm.parts).filter(([, x]) => x.pct != null).sort((a, b) => a[1].pct - b[1].pct);
    const weakest = ranked.length ? ranked[0][0] : null;
    return `<div class="tiles vtiles">
        <div class="tile main"><b>${sm.lat == null ? "–" : sm.lat + "秒"}</b><span>話し始め平均</span></div>
        <div class="tile${sm.noAnswer ? " warn" : ""}"><b>${sm.noAnswer}問</b><span>無回答（6秒）</span></div>
        <div class="tile"><b>${weakest || "–"}</b><span>いちばん弱いパート</span></div>
      </div>
      <div class="vtable"><table><thead><tr><th>パート</th><th>結果</th><th>話し始め</th><th>無回答</th><th>WPM</th></tr></thead>
      <tbody>${["A","B","C","D","E","F"].map(row).join("")}</tbody></table></div>
      <div class="sub">結果はこのアプリの自動判定による目安で、本番のスコアとは別物です。60%未満のパートは色付きで表示しています。</div>`;
  }

  function renderMockResult(res, sm){
    $("vHome").hidden = true; const q = $("vQ"); q.hidden = false;
    q.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>模擬テストの結果</h2><span class="sub">${esc(sm.date)}</span></div>
      ${summaryTable(sm)}
      <div class="row"><button class="btn ghost" id="vHome2">パート一覧へ</button><button class="btn" id="vRetry">もう一度受ける</button></div></div>
      <div class="card"><h2>問題ごとの結果</h2><div class="sub">タップすると、スクリプト・あなたの回答・録音・模範解答を確認できます。</div><div id="vItems"></div></div>`;
    $("vHome2").addEventListener("click", renderHome);
    $("vRetry").addEventListener("click", mockIntro);
    const box = $("vItems");
    res.forEach((e, k) => {
      const d = document.createElement("details"); d.className = "vitem";
      const tag = e.r.why === "noanswer" ? "無回答" : e.p === "B" ? `${e.score ?? "–"}%` : (e.p === "A" || e.p === "C" || e.p === "D") ? (e.score === 100 ? "○" : "×") : e.score != null ? `${e.score}%` : "–";
      const bad = e.r.why === "noanswer" || (e.score != null && e.score < 60);
      d.innerHTML = `<summary><span class="chip">${e.p}</span> <span class="vsumtxt"></span><span class="vtag${bad ? " bad" : ""}">${tag}</span></summary>
        <div class="vdet">
          ${e.judge || ""}
          <div class="sub">話し始め ${e.r.onset == null ? "–" : e.r.onset.toFixed(1) + "秒"}・フィラー ${e.stats.fillers}回・1秒以上の間 ${e.stats.pauses}回${e.stats.wpm ? "・WPM " + e.stats.wpm : ""}</div>
          ${e.r.blob ? `<audio controls playsinline preload="none" src="${URL.createObjectURL(e.r.blob)}"></audio>` : ""}
          <div class="field"><label>あなたの回答</label><div class="vbox">${e.tr ? esc(e.tr.display || "（なし）") : esc("文字起こしできませんでした " + e.err)}</div></div>
          <div class="field"><label>問題のスクリプト</label><div class="vbox">${scriptHTML(e.p, e.it)}</div></div>
          ${e.it.model ? `<div class="field"><label>模範解答</label><div class="vbox">${esc(e.it.model)}</div></div>` : ""}
        </div>`;
      d.querySelector(".vsumtxt").textContent = `${k + 1}. ${(e.it.q || e.it.text || e.it.passage || "").slice(0, 48)}…`;
      box.appendChild(d);
    });
    window.scrollTo(0, 0);
  }

  function showMockSummaryOnly(sm){
    $("vHome").hidden = true; const q = $("vQ"); q.hidden = false;
    q.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>模擬テストの結果</h2><span class="sub">${esc(sm.date)}</span></div>
      ${summaryTable(sm)}<button class="btn ghost" id="vHome2">パート一覧へ</button></div>`;
    $("vHome2").addEventListener("click", renderHome);
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  function status(t){ const s = $("vStatus"); if (s) s.textContent = t; }
  function setFill(f){ const el = $("vFill"); if (el) el.style.width = Math.round(f * 100) + "%"; }

  window.Versant = {show: renderHome, cancel};
})();
