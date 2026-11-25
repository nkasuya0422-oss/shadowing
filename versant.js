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


  /* Part B: explain what went missing, by kind of word (for Japanese learners these are the usual
     suspects: articles, prepositions, auxiliaries, endings and tense) */
  const W_ART = new Set(["a","an","the"]);
  const W_PREP = new Set(["to","in","on","at","for","of","with","from","by","about","into","before","after","since","until","during","over","under","near","through","than"]);
  const W_AUX = new Set(["is","are","was","were","am","be","been","being","has","have","had","will","would","can","could","should","do","does","did","must","might","may"]);
  const W_PRON = new Set(["i","you","he","she","it","we","they","me","him","her","us","them","my","your","his","its","our","their"]);
  const W_CONJ = new Set(["and","but","or","so","because","although","if","when","while","though","even","that"]);
  const IRREG = {went:"go",came:"come",left:"leave",took:"take",got:"get",had:"have",made:"make",said:"say",found:"find",bought:"buy",thought:"think",
    told:"tell",ran:"run",saw:"see",gave:"give",knew:"know",wrote:"write",forgot:"forget",began:"begin",spent:"spend",sent:"send",felt:"feel",kept:"keep",
    lost:"lose",met:"meet",paid:"pay",sold:"sell",stood:"stand",woke:"wake",wore:"wear",won:"win",drove:"drive",ate:"eat",drank:"drink",broke:"break",
    chose:"choose",fell:"fall",flew:"fly",grew:"grow",heard:"hear",held:"hold",meant:"mean",was:"is",were:"are",did:"do",has:"have",been:"be"};
  const base = w => IRREG[w] || (w.length <= 3 ? w : w.replace(/'s$/, "").replace(/(ies)$/, "y").replace(/(ing|ed|es|s)$/, "").replace(/e$/, ""));
  function explainB(d){
    const missed = d.words.filter(w => !w.ok).map(w => tok(w.w).join(" ")).filter(Boolean);
    const extra = d.extra.slice();
    const cats = {}, put = (k, w) => (cats[k] = cats[k] || []).push(w);
    missed.forEach(w => {
      const k = extra.findIndex(e => e !== w && base(e) === base(w));
      if (k >= 0){
        const e = extra.splice(k, 1)[0];
        put(IRREG[w] || IRREG[e] ? "時制・形が違う" : "語尾（-s / -ed / -ing）が違う", `${w} → ${e}`);
        return;
      }
      if (w.includes("'")) put("短縮形（I'm / didn't など）", w);
      else if (W_ART.has(w)) put("冠詞（a / an / the）", w);
      else if (W_PREP.has(w)) put("前置詞（to / at / for など）", w);
      else if (W_AUX.has(w)) put("be動詞・助動詞", w);
      else if (W_PRON.has(w)) put("代名詞", w);
      else if (W_CONJ.has(w)) put("接続詞（because / although など）", w);
      else put("内容語（名詞・動詞・形容詞）", w);
    });
    if (extra.length) cats["違う語・余計な語"] = extra;
    return cats;
  }
  /* self-corrections: the same word twice in a row ("I I"), or a repeated two-word phrase ("I went I went") */
  function restarts(said){
    const t = tok(said).filter(w => !FILLERS.has(w));
    let n = 0;
    for (let i = 0; i < t.length - 1; i++){
      if (t[i] === t[i + 1] && !["that","had","very","so"].includes(t[i])){ n++; continue; }
      if (i < t.length - 3 && t[i] === t[i + 2] && t[i + 1] === t[i + 3]){ n++; i += 1; }
    }
    return n;
  }

  function speechStats(said, onset, lastVoice, pauses, elapsed){
    const all = tok(said);
    const fillers = all.filter(w => FILLERS.has(w)).length;
    const words = all.length - fillers;
    const span = onset != null && lastVoice != null ? Math.max(0.5, lastVoice - onset) : (words && elapsed ? elapsed : null);
    return {words, fillers, restarts: restarts(said), wpm: span ? Math.round(words / (span / 60)) : null, latency: onset, pauses};
  }

  return {tok, diffWords, checkAnswer, retellChecklist, opinionChecklist, topicWords, topicCoverage, speechStats, explainB, restarts, FILLERS};
})();
if (typeof module !== "undefined" && module.exports){ module.exports = VS; }

/* ---------- UI (browser only) ---------- */
if (typeof window !== "undefined") (function(){
  const ORDER = ["A","B","C","D","E","F"];
  const PRIORITY = new Set(["B","E","F"]);
  /* part info; "S" (unscored speech sample) only exists in generated 本番レベル tests */
  const PEXTRA = {S: {name: "スピーチサンプル（採点外）", en: "Speech sample", count: 1, time: 30, items: []}};
  const pinfo = p => (bank && bank.parts[p]) || PEXTRA[p];
  /* question level for generated items: hard = 本番レベル (default), basic = 基礎 */
  const level = () => store.get("v-level", "hard") === "basic" ? "basic" : "hard";
  const LEVEL_NAME = {hard: "本番レベル", basic: "基礎"};
  function levelSeg(onChange){
    const d = document.createElement("div");
    d.innerHTML = `<label>問題の難しさ（自動生成）</label><div class="seg vlevel"><button data-l="hard">本番レベル</button><button data-l="basic">基礎</button></div>
      <div class="sub vlevelnote"></div>`;
    const paint = () => {
      d.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.l === level())));
      d.querySelector(".vlevelnote").textContent = level() === "hard"
        ? "本番に近い難しさ：Aは語彙の意味、Bは否定・完了形・似た音、Cは4〜6ターンの会話とイディオム、D/Eは6〜8文の話。最初に採点外のスピーチサンプルがあります。"
        : "やさしめ：Aは常識・計算、短い会話と文章。慣れるまでの練習向けです。";
    };
    d.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { store.set("v-level", b.dataset.l); paint(); if (onChange) onChange(); }));
    paint();
    return d;
  }
  const VOICE = {N: "en-US-JennyNeural", M: "en-US-AndrewMultilingualNeural", W: "en-US-AvaMultilingualNeural", M2: "en-US-BrianMultilingualNeural", W2: "en-US-EmmaMultilingualNeural"};
  const SHORT = new Set(["A","B","C","D"]);
  const E_LABEL = {person: "人物", problem: "問題", action: "行動", result: "結果"};
  const F_LABEL = {stance: "立場（I think … is better）", first: "理由1（First, …）", example: "例（For example, …）", second: "理由2（Second, …）", conclusion: "まとめ（So overall, …）"};
  const TEMPLATE = {
    E: "This story is about [人物]. [問題]. Then [行動]. In the end, [結果].",
    F: "I think [立場] is better, for two reasons. First, … For example, … Second, … So overall, I prefer [立場]."
  };
  let bank = null, part = null, item = null, run = 0, state = "idle", rec = null, lastScore = null;
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
      <div class="card"><div id="vLevelHome"></div><label style="margin-top:8px">パート別練習の出題</label>
        <div class="seg" id="vSrc"><button data-s="gen">自動生成（毎回新しい）</button><button data-s="bank">問題バンクから（基礎）</button></div></div>
      <div class="vparts" id="vParts">読み込み中…</div>`;
    try { await loadBank(); } catch(e){ $("vParts").textContent = "問題データを読み込めませんでした。通信を確認して開き直してください。"; return; }
    $("vMockBtn").addEventListener("click", mockIntro);
    const paintSrc = () => document.querySelectorAll("#vSrc button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.s === practiceSrc())));
    document.querySelectorAll("#vSrc button").forEach(b => b.addEventListener("click", () => { store.set("v-src", b.dataset.s); paintSrc(); }));
    paintSrc();
    $("vLevelHome").appendChild(levelSeg());
    renderMockHist();
    const box = $("vParts"); box.innerHTML = "";
    ORDER.forEach(p => {
      const P = bank.parts[p];
      const b = document.createElement("button"); b.className = "vpart" + (PRIORITY.has(p) ? " pri" : "");
      b.innerHTML = `<span class="vl">${p}</span><span class="vt"><b></b><span class="sub"></span><span class="sub vs"></span></span>${PRIORITY.has(p) ? '<span class="chip">優先</span>' : ""}`;
      b.querySelector("b").textContent = P.name;
      b.querySelector(".sub").textContent = `本番 ${P.count}問・回答 ${P.time}秒・収録 ${P.items.length}問＋自動生成`;
      b.querySelector(".vs").textContent = partSummary(p);
      b.addEventListener("click", () => openPart(p));
      box.appendChild(b);
    });
  }

  /* ---------- seen history (30 days) and a cache of generated items for later review ---------- */
  const SEEN_DAYS = 30;
  function seenMap(){
    const m = store.get("v-seen", {}), cut = Date.now() - SEEN_DAYS * 864e5;
    let changed = false;
    for (const k in m) if (m[k] < cut){ delete m[k]; changed = true; }
    if (changed) store.set("v-seen", m);
    return m;
  }
  function markSeen(list){
    const m = seenMap(), now = Date.now(), cache = store.get("v-gencache", {});
    list.forEach(({p, it}) => {
      m[it.seenKey || it.id] = now;
      if (it.generated){ cache[it.id] = {p, it, t: now}; }
    });
    const ids = Object.keys(cache);
    if (ids.length > 300) ids.sort((a, b) => cache[a].t - cache[b].t).slice(0, ids.length - 300).forEach(k => delete cache[k]);
    store.set("v-seen", m); store.set("v-gencache", cache);
  }
  const practiceSrc = () => store.get("v-src", "gen");

  /* ---------- question screen ---------- */
  /* random order without repeats: each part keeps a shuffled deck of item ids; when it runs out
     (or new questions are added) it is reshuffled, never starting with the item just answered */
  function nextItem(p){
    if (practiceSrc() === "gen" && window.VGen){
      const recent = store.get("v-recent-" + p, []);
      const it = VGen.one(p, seenMap(), recent, level());
      if (it){
        markSeen([{p, it}]);
        store.set("v-recent-" + p, [it.tpl, ...recent].slice(0, p === "B" ? 8 : 3));
        return {it, n: "自動生成・" + LEVEL_NAME[level()], total: null};
      }
    }
    const P = bank.parts[p], k = "v-deck-" + p, ids = P.items.map(x => x.id);
    let d = store.get(k, null);
    if (!d || !Array.isArray(d.order) || d.order.length !== ids.length || d.order.some(id => !ids.includes(id)) || d.pos >= d.order.length){
      const last = d && d.order ? d.order[d.pos - 1] : null;
      let order = shuffle(ids);
      if (order.length > 1 && order[0] === last) order.push(order.shift());
      d = {order, pos: 0};
    }
    const id = d.order[d.pos]; d.pos++;
    store.set(k, d);
    return {it: P.items.find(x => x.id === id), n: d.pos, total: ids.length};
  }
  function openPart(p){ part = p; showQuestion(nextItem(p)); }

  function showQuestion({it, n, total}){
    item = it; state = "idle";
    const P = pinfo(part);
    $("vHome").hidden = true; const q = $("vQ"); q.hidden = false;
    q.innerHTML = `<div class="card">
        <div class="row" style="justify-content:space-between"><button class="btn ghost small" id="vBack">← パート一覧</button><span class="chip">Part ${part}・${total ? `${n}/${total}` : n}</span></div>
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
      F: "身近なテーマについて意見を言います。下の型を使いましょう。",
      S: "採点外のスピーチサンプルです。テーマについて30秒ほど自由に話して、声と話す感覚を整えましょう。"
    }[p];
  }

  /* ---------- prompt playback ---------- */
  function segments(p, it){
    switch (p){
      case "A": return [{v:"N", t: it.q}];
      case "B": return [{v:"N", t: it.text}];
      case "C": return [...it.lines.map(l => ({v: l.s, t: l.t, gap: 350})), {v:"N", t: it.q, pre: 500}];
      case "D": return it.samePassage ? [{v:"N", t: it.q, pre: 300}] : [{v:"N", t: it.passage}, {v:"N", t: it.q, pre: 700}];
      case "E": return [{v:"N", t: it.passage}];
      case "F": return [{v:"N", t: it.q}];
      case "S": return [{v:"N", t: it.q}];
    }
  }
  function deviceVoiceFor(v){
    const en = (synth ? synth.getVoices() : []).filter(x => /^en[-_]US/i.test(x.lang));
    const pick = re => en.find(x => re.test(x.name));
    if (v === "M2") return pick(/(Daniel|Tom|Nathan|Evan|Fred)/) || en[2] || en[0];
    if (v === "W2") return pick(/(Allison|Susan|Zoe|Nicky|Karen)/) || en[3] || en[0];
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
    return playSegments(() => token === run, p, it);
  }
  async function playSegments(alive, p, it){
    for (const s of segments(p, it)){
      if (!alive()) return;
      if (s.pre){ await wait(s.pre); if (!alive()) return; }
      if (az()) await playUrl(await azClip(s.t, VOICE[s.v], 1), 0);
      else if (synth) await speakWith(s.t, s.v);
      else throw new Error("tts");
      if (s.gap) await wait(s.gap);
    }
  }

  /* listen-only replay of the prompt after the answer has been checked (no recording) */
  const LISTEN = "🔊 問題の音声をもう一度聞く";
  let lrun = 0, listenBtn = null;
  function stopListen(){
    if (!listenBtn) return;
    lrun++; try { stopModel(); } catch(e){}
    listenBtn.textContent = LISTEN; listenBtn = null;
  }
  function listenButton(p, it){
    const wrap = document.createElement("div"); wrap.className = "row";
    wrap.innerHTML = `<button class="btn ghost small"></button><span class="sub"></span>`;
    const b = wrap.querySelector("button"), msg = wrap.querySelector(".sub");
    b.textContent = LISTEN;
    b.addEventListener("click", async () => {
      if (listenBtn === b){ stopListen(); return; }
      stopListen();
      const my = ++lrun; listenBtn = b; b.textContent = "■ 止める"; msg.textContent = "";
      unlockAudio();
      try { await playSegments(() => my === lrun, p, it); }
      catch(e){ if (my === lrun) msg.textContent = "音声を再生できませんでした。"; }
      if (my === lrun){ listenBtn = null; b.textContent = LISTEN; }
    });
    return wrap;
  }
  async function prefetch(p = part, it = item){
    if (!az()) return;
    await Promise.all(segments(p, it).map(s => azClip(s.t, VOICE[s.v], 1)));
  }

  /* ---------- one attempt: prompt → answer window → analysis ---------- */
  function cancel(){
    stopListen();
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
    rec = recordAnswer(stream, meter, pinfo(part).time, token);
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
    let score = null, judge = "", bx = null;
    if (tr){
      if (p === "B"){
        const d = VS.diffWords(it.text, lex); score = d.pct; bx = VS.explainB(d);
        judge = `<div class="score"><span class="big">${d.pct}%</span><span class="sub">${d.total}語中 ${d.hit}語 一致</span></div>
          <p class="vdiff">${d.words.map(w => `<span class="w ${w.ok ? "ok" : "ng"}">${esc(w.w)}</span>`).join(" ")}</p>
          ${Object.keys(bx).length ? `<ul class="finds">${Object.entries(bx).map(([k, v]) => `<li class="warn" style="display:grid"><span class="ic">△</span><span><b>${esc(k)}</b>：${esc(v.join(", "))}</span></li>`).join("")}</ul>` : ""}`;
      } else if (p === "A" || p === "C" || p === "D"){
        const ok = VS.checkAnswer(said, it.accept); score = ok ? 100 : 0;
        const nums = VS.tok(said).filter(w => /^\d+$/.test(w) || ["one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","fifteen","twenty","thirty","forty","fifty","sixty"].includes(w));
        const why = ok ? "" : !lex.trim() ? "回答が聞き取れませんでした。短くてもいいので答えを言い切りましょう。"
          : nums.length && it.accept.some(a => /\d|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty/.test(a)) ? `数字が違います（あなた：${nums.join(" ")}）。${it.explain ? "計算：" + it.explain : "数字は最後に言われたものが答えになることが多いです。"}`
          : p === "C" ? "会話の途中で予定や答えが変わっています。最後に決まったことを答えましょう。"
          : p === "D" ? "質問の疑問詞（who / why / how many / what happened）に合う部分を答えましょう。"
          : / or /.test(it.q || "") ? "質問の最後の部分（A or B のどちらか）をよく聞いて答えましょう。"
          : "語の意味を問う問題です。正解の語をまとめて覚えておくと次に答えられます。";
        judge = `<div class="score"><span class="big" style="color:var(${ok ? "--hit" : "--miss"})">${ok ? "○" : "×"}</span><span class="sub">${ok ? "正解の語が含まれています" : "正解の語が聞き取れませんでした"}（自動判定・目安）</span></div>
          <div class="vbox"><b>正解：</b>${esc(it.model || it.accept[0])}${it.explain && ok ? `（${esc(it.explain)}）` : ""}${why ? `<div class="sub" style="margin-top:4px">${esc(why)}</div>` : ""}</div>`;
      } else if (p === "E"){
        const c = VS.retellChecklist(said, it.keys); const n = Object.values(c).filter(Boolean).length; score = n * 25;
        judge = `<div class="score"><span class="big">${n}/4</span><span class="sub">話の要素（自動判定・目安）</span></div>` + checklist(Object.entries(c).map(([k, v]) => [E_LABEL[k] || k, v]));
      } else if (p === "S"){
        const tc = VS.topicCoverage(said, it.q);
        judge = `<div class="score"><span class="big">採点外</span><span class="sub">スピーチサンプル（本番でも点数には入りません）</span></div>
          <div class="field"><label>お題の言葉を使えたか（参考）</label><p class="vdiff">${tc.rows.map(r => `<span class="w ${r.ok ? "ok" : "ng"}">${esc(r.w)}</span>`).join(" ")}</p></div>`;
      } else if (p === "F"){
        const c = it.checks ? Object.fromEntries(it.checks.map(ch => [ch.label, VS.checkAnswer(said, ch.any)])) : VS.opinionChecklist(said);
        const n = Object.values(c).filter(Boolean).length, nMax = Object.keys(c).length;
        const tc = VS.topicCoverage(said, it.q);
        score = Math.round(n / nMax * 50 + tc.pct / 2);          // template 50% + prompt words 50%
        judge = `<div class="score"><span class="big">${score}%</span><span class="sub">型 ${n}/${nMax} ＋ お題の言葉 ${tc.hit}/${tc.total}（自動判定・目安）</span></div>
          <div class="field"><label>お題の言葉を使えたか</label><p class="vdiff">${tc.rows.map(r => `<span class="w ${r.ok ? "ok" : "ng"}">${esc(r.w)}</span>`).join(" ")}</p>
          <div class="sub">本番は「お題に関係する語」が出てくるかで内容が評価されます。質問に出てきた語を回答の中でも使いましょう。</div></div>`
          + checklist(Object.entries(c).map(([k, v]) => [F_LABEL[k] || k, v]));
      }
    }
    return {score, judge, stats, bx};
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
    lastScore = ev.score;
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
      case "C": return item_.lines.map(l => `<p><b>${{M: "男性", W: "女性", M2: "男性2", W2: "女性2"}[l.s] || l.s}：</b>${esc(l.t)}</p>`).join("") + `<p><b>質問：</b>${esc(item_.q)}</p>`;
      case "D": return `<p>${esc(item_.passage)}</p><p><b>質問：</b>${esc(item_.q)}</p>`;
      case "E": return `<p>${esc(item_.passage)}</p>`;
      case "F": return `<p>${esc(item_.q)}</p>`;
      case "S": return `<p>${esc(item_.q)}</p>`;
    }
  }
  function renderResult(r, tr, st, judge, err){
    status(r.why === "time" ? "時間切れ（途中まででも採点されます）" : "回答終了");
    $("vTime").textContent = `回答時間 ${pinfo(part).time}秒`;
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
        ${metric("言い直し", st.restarts + "回", st.restarts > 1)}
        ${metric("1秒以上の間", st.pauses + "回", st.pauses > (long ? 3 : 0))}
      </div>
      <div class="sub">${long ? "WPMは1分あたりの語数（目安 110〜150）。" : ""}フィラー（um, uh など）と言い直しは、音声認識で消えることがあるので少なめに出ます。</div>
      ${r.blob ? `<div class="field"><label>自分の録音</label><audio controls playsinline src="${URL.createObjectURL(r.blob)}"></audio></div>` : ""}
      <div class="field"><label>あなたの回答（文字起こし）</label><div class="vbox">${tr ? esc(tr.display || "（聞き取れませんでした）") : "–"}</div></div>
      <div class="field"><label>問題のスクリプト</label><div class="vlisten"></div><div class="vbox">${scriptHTML()}</div></div>
      ${long && tr ? grammarBlock() : ""}
      ${item.model ? `<div class="field"><label>模範解答</label><div class="vbox">${esc(item.model)}</div></div>` : ""}
      <div id="vAsk"></div>
      <div class="row"><button class="btn ghost" id="vAgain">もう一度この問題</button><button class="btn" id="vNext">次の問題 →</button></div>`;
    const grammar = [], p0 = part, it0 = item;
    box.querySelector(".vlisten").appendChild(listenButton(p0, it0));
    if (long && tr) fillGrammar(box, tr.display, grammar);
    $("vAsk").appendChild(claudeButton(() => claudePrompt(p0, it0, tr, st, lastScore, grammar)));
    $("vAsk").firstChild.appendChild(shadowButton(p0, it0));
    $("vAgain").addEventListener("click", () => { $("vResult").hidden = true; begin(); });
    $("vNext").addEventListener("click", () => { showQuestion(nextItem(part)); begin(); });   // flows straight into the next prompt, like the real test
    $("vStart").hidden = true; $("vReplay").hidden = true;
    box.scrollIntoView({behavior: "smooth", block: "start"});
  }



  /* ================= 文法チェック（LanguageTool）と「Claudeに聞く」 ================= */
  /* One request per finished answer (user-initiated), well inside the public API's 20 req/min.
     Only grammar-type rules are shown: spelling, casing and punctuation come from the speech
     recognizer, not from the speaker, so they are dropped. */
  const LT_KEEP = new Set(["GRAMMAR", "CONFUSED_WORDS", "COLLOCATIONS", "NONSTANDARD_PHRASES", "MISC"]);
  const LT_DROP = /UPPERCASE|PUNCT|COMMA|WHITESPACE|QUOTE|SENTENCE_FRAGMENT|EN_UNPAIRED|DOUBLE_PUNCT|ENGLISH_WORD_REPEAT_BEGINNING/;
  async function grammarCheck(text){
    const body = new URLSearchParams({text, language: "en-US", motherTongue: "ja"});
    const r = await fetch("https://api.languagetool.org/v2/check", {method: "POST", body});
    if (!r.ok) throw new Error("lt " + r.status);
    const j = await r.json();
    return (j.matches || []).filter(m => m.rule && m.rule.category && LT_KEEP.has(m.rule.category.id) && !LT_DROP.test(m.rule.id))
      .map(m => ({off: m.offset, len: m.length, msg: m.message, fix: (m.replacements || []).slice(0, 2).map(x => x.value)}));
  }
  function grammarBlock(){
    return `<div class="field vgram"><label>文法チェック（自動・目安）</label><div class="vgbody sub">回答を文法チェックしています…</div>
      <div class="sub">文字起こしの文章をLanguageToolに送ってチェックします。音声認識が文法を自動で直してしまうことがあるため、見つからなくてもミスがないとは限りません。</div></div>`;
  }
  async function fillGrammar(root, text, sink){
    const body = root.querySelector(".vgbody"); if (!body) return;
    if (!text || !text.trim()){ body.textContent = "回答がないのでチェックしていません。"; return; }
    try {
      const ms = await grammarCheck(text);
      if (sink) sink.splice(0, sink.length, ...ms);
      if (!ms.length){ body.textContent = "目立つ文法ミスは見つかりませんでした。"; return; }
      body.className = "vgbody";
      body.innerHTML = `<ul class="finds">${ms.map(m => {
        const a = Math.max(0, m.off - 28), pre = text.slice(a, m.off), bad = text.slice(m.off, m.off + m.len), post = text.slice(m.off + m.len, m.off + m.len + 28);
        return `<li class="ng" style="display:grid"><span class="ic">✗</span><span><span class="vctx">${a > 0 ? "…" : ""}${esc(pre)}<mark>${esc(bad)}</mark>${esc(post)}…</span>
          ${m.fix.length ? `<div><b>→ ${m.fix.map(esc).join(" / ")}</b></div>` : ""}<div class="tp">${esc(m.msg)}</div></span></li>`;
      }).join("")}</ul>`;
    } catch(e){
      body.textContent = /429/.test(e.message) ? "文法チェックの回数制限にかかりました。1分ほど待ってからもう一度開いてください。" : "文法チェックに接続できませんでした（" + e.message + "）。";
    }
  }

  function claudePrompt(p, it, tr, st, score, grammar){
    const P = pinfo(p);
    const script = p === "C" ? it.lines.map(l => `${l.s === "M" ? "Man" : "Woman"}: ${l.t}`).join("\n") + `\nQuestion: ${it.q}`
      : p === "D" ? `${it.passage}\nQuestion: ${it.q}` : p === "B" ? it.text : (it.q || it.passage || "");
    const g = grammar && grammar.length ? grammar.map(m => `- "${(tr && tr.display || "").slice(m.off, m.off + m.len)}" → ${m.fix.join(" / ") || "?"}（${m.msg}）`).join("\n") : "（自動チェックでは見つからず）";
    return `Versant English Speaking and Listening Test の練習をしています。Part ${p}（${P.name} / ${P.en}、回答時間${P.time}秒）の私の回答を添削してください。

【問題】
${script}

【私の回答（音声認識による文字起こし）】
${tr && tr.display ? tr.display : "（回答なし）"}
${it.model ? `\n【模範解答の例】\n${it.model}\n` : ""}
【計測値】話し始め ${st.latency == null ? "–" : st.latency.toFixed(1) + "秒"}／語数 ${st.words}／WPM ${st.wpm ?? "–"}／フィラー ${st.fillers}回／1秒以上の間 ${st.pauses}回${score != null ? `／アプリの自動判定 ${score}%` : ""}

【自動文法チェックの指摘】
${g}

お願い：
1. 文法の誤りを1つずつ「誤 → 正」と理由を日本語で（音声認識の誤認識らしいものは区別して）
2. 同じ内容を、私のレベルで本番でも言える自然な英語に言い直した例
3. Versantの採点（内容の語彙・文法・流暢さ）を意識して、次に気をつけることを3つまで`;
  }
  function claudeButton(getText){
    const wrap = document.createElement("div"); wrap.className = "row";
    wrap.innerHTML = `<button class="btn ghost small">Claudeに聞く（コピー）</button><span class="sub"></span>`;
    wrap.querySelector("button").addEventListener("click", async () => {
      const msg = wrap.querySelector(".sub");
      try { await navigator.clipboard.writeText(getText()); msg.textContent = "コピーしました。Claudeのチャットに貼ってください。"; }
      catch(e){ msg.textContent = "コピーできませんでした。"; }
    });
    return wrap;
  }


  /* ================= 問題セットの取り込み（JSON） ================= */
  const IMPORT_PROMPT = `Versant English Speaking and Listening Test の模擬問題を、下のJSON形式で1セット作ってください。

条件：
- すべてオリジナルの問題（実際の試験問題は使わない）。難易度はCEFR B1〜B2、日常生活や仕事の身近な話題
- 問題数：A 8問、B 16問、C 6問、D 合計6問、E 2問、F 2問
- A：常識クイズと簡単な計算問題（お釣り・時間など）を混ぜる。answers は正解とみなすキーワード（数字は "four" と "4" の両方）
- B：4〜16語の文。前半は短く、後半ほど長くし、Although / Even though / If などの複文を含める
- C：2〜3人の短い会話のあとに質問1つ（最終的に決まった時間・場所・数・理由を問う）。speaker は M / W / M2 / W2
- D：3〜5文の短い話。質問1問の話を3つと、質問3問が続く話を1つ（questions の数で表す）
- E：4〜5文の話。points に「入れるべきポイント名: [判定キーワード]」を4つ（人物・きっかけ・行動・結果、数字があれば数字も）
- F：Do you prefer A or B? / Should ...? の形の質問と、意見＋理由2つの模範解答
- JSONだけを出力し、説明文やコードブロックの記号は付けない

形式：
{
  "title": "セット名",
  "items": [
    {"part": "A", "q": "Which is heavier, a feather or a brick?", "answers": ["brick"], "model": "A brick."},
    {"part": "B", "text": "Although it was raining, we still went for a walk."},
    {"part": "C", "lines": [{"speaker": "M", "text": "Shall we meet at three?"}, {"speaker": "W", "text": "How about four?"}, {"speaker": "M", "text": "Four is fine."}],
     "q": "What time will they meet?", "answers": ["four", "4"], "model": "At four."},
    {"part": "D", "passage": "Ken wanted to learn to cook, but ...",
     "questions": [{"q": "Who gave Ken advice?", "answers": ["sister"], "model": "His sister."}]},
    {"part": "E", "passage": "Lisa's office was always messy ...",
     "points": {"人物": ["lisa"], "きっかけ": ["contract", "hour"], "行動": ["five minutes", "clean"], "結果": ["tidy", "month"]},
     "model": "This story is about Lisa. ..."},
    {"part": "F", "q": "Do you prefer working from home or in an office? Why?", "model": "I prefer working from home, for two reasons. First, ... Second, ... That's why ..."}
  ]
}`;

  function importSet(text){
    const errors = [], warnings = [];
    let j;
    const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    if (!raw) return {ok: false, errors: ["貼り付け欄が空です。"]};
    try { j = JSON.parse(raw); } catch(e){ return {ok: false, errors: ["JSONとして読めませんでした（" + e.message + "）。Claudeの出力を最初の { から最後の } まで丸ごと貼ってください。"]}; }
    const arr = Array.isArray(j) ? j : j && Array.isArray(j.items) ? j.items : null;
    if (!arr) return {ok: false, errors: ["\"items\" の配列が見つかりません。"]};
    const strs = x => Array.isArray(x) ? x.map(String).filter(Boolean) : typeof x === "string" ? [x] : [];
    const out = [], stamp = Date.now().toString(36);
    let n = 0;
    const add = (p, it) => out.push(Object.assign({p, id: `I${stamp}-${p}${String(++n).padStart(2, "0")}`, imported: true}, it));
    arr.forEach((x, i) => {
      const at = `${i + 1}番目`;
      const p = String(x && (x.part || x.p) || "").toUpperCase().replace(/^PART\s*/, "");
      if (!"ABCDEF".includes(p) || p.length !== 1){ errors.push(`${at}：part が A〜F ではありません`); return; }
      if (p === "A"){
        if (!x.q || !strs(x.answers || x.accept).length){ errors.push(`${at}（A）：q と answers が必要です`); return; }
        add("A", {q: String(x.q), accept: strs(x.answers || x.accept), model: String(x.model || strs(x.answers || x.accept)[0])});
      } else if (p === "B"){
        if (!x.text){ errors.push(`${at}（B）：text が必要です`); return; }
        const w = String(x.text).split(/\s+/).length; if (w > 18) warnings.push(`Bに${w}語の長い文あり`);
        add("B", {text: String(x.text)});
      } else if (p === "C"){
        const lines = Array.isArray(x.lines) ? x.lines : [];
        if (lines.length < 2 || !x.q || !strs(x.answers || x.accept).length){ errors.push(`${at}（C）：lines（2つ以上）と q と answers が必要です`); return; }
        const map = {}; let alt = 0; const order = ["M","W","M2","W2"];
        add("C", {lines: lines.map(l => { let sp = String(l.speaker || l.s || "").toUpperCase(); if (!order.includes(sp)){ if (!(sp in map)) map[sp] = order[alt++ % 4]; sp = map[sp]; } return {s: sp, t: String(l.text || l.t || "")}; }),
          q: String(x.q), accept: strs(x.answers || x.accept), model: String(x.model || strs(x.answers || x.accept)[0])});
      } else if (p === "D"){
        const qs = Array.isArray(x.questions) ? x.questions : x.q ? [{q: x.q, answers: x.answers || x.accept, model: x.model}] : [];
        if (!x.passage || !qs.length){ errors.push(`${at}（D）：passage と questions が必要です`); return; }
        qs.forEach((y, k) => {
          if (!y.q || !strs(y.answers || y.accept).length){ errors.push(`${at}（D）の質問${k + 1}：q と answers が必要です`); return; }
          add("D", {passage: String(x.passage), q: String(y.q), accept: strs(y.answers || y.accept), model: String(y.model || strs(y.answers || y.accept)[0]), samePassage: k > 0});
        });
      } else if (p === "E"){
        if (!x.passage){ errors.push(`${at}（E）：passage が必要です`); return; }
        let keys = x.points || x.keys;
        if (!keys || typeof keys !== "object" || Array.isArray(keys) || !Object.keys(keys).length){ warnings.push("Eのpointsがないので名前だけで判定"); keys = {"人物": [String(x.passage).split(/\s+/)[0].replace(/[^A-Za-z]/g, "").toLowerCase()]}; }
        add("E", {passage: String(x.passage), keys: Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, strs(v).map(w => w.toLowerCase())])), model: String(x.model || "")});
      } else if (p === "F"){
        if (!x.q){ errors.push(`${at}（F）：q が必要です`); return; }
        const it = {q: String(x.q), model: String(x.model || "")};
        if (x.points && typeof x.points === "object" && !Array.isArray(x.points)) it.checks = Object.entries(x.points).map(([label, v]) => ({label, any: strs(v)}));
        add("F", it);
      }
    });
    if (errors.length) return {ok: false, errors};
    if (!out.length) return {ok: false, errors: ["問題が1つもありませんでした。"]};
    const title = String(j.title || "取り込んだセット").slice(0, 40);
    return {ok: true, warnings: [...new Set(warnings)], set: {id: stamp, title, items: out, added: today(), done: false}};
  }

  /* imported items first (in their order), missing parts filled with generated questions */
  function fillFromImport(imp){
    const plan = {A: 8, B: 16, C: 6, D: 6, E: 2, F: 2}, out = [], seen = seenMap();
    ["A","B","C","D","E","F"].forEach(p => {
      const mine = imp.items.filter(x => x.p === p).map(it => ({p, it}));
      mine.forEach(x => out.push(x));
      const lack = plan[p] - mine.length;
      if (lack > 0 && window.VGen) VGen.part(p, lack, seen, level()).forEach(it => out.push({p, it}));
    });
    return out;
  }

  function renderImpList(){
    const box = $("vImpList"); if (!box) return;
    const list = store.get("v-imports", []);
    box.innerHTML = list.length ? `<div class="sub" style="margin-top:6px">取り込んだセット</div>` : "";
    list.forEach(x => {
      const row = document.createElement("div"); row.className = "row";
      row.innerHTML = `<button class="btn ghost small" data-a="go"${az() ? "" : " disabled"}></button><button class="btn ghost small" data-a="del">削除</button>`;
      row.querySelector('[data-a="go"]').textContent = `${x.title}（${x.items.length}問${x.done ? "・受験済み" : ""}）で開始`;
      row.querySelector('[data-a="go"]').addEventListener("click", () => startMock("imp:" + x.id));
      let armed = false;
      row.querySelector('[data-a="del"]').addEventListener("click", e => {
        if (!armed){ armed = true; e.target.textContent = "もう一度押すと削除"; return; }
        store.set("v-imports", store.get("v-imports", []).filter(y => y.id !== x.id)); renderImpList();
      });
      box.appendChild(row);
    });
  }

  /* ================= 本番模擬モード ================= */
  const PLAN = [["A",8],["B",16],["C",6],["D",6],["E",2],["F",2]];
  const INSTR = {
    A: "Part A. Short answer questions. Please answer each question with a single word or a short phrase.",
    B: "Part B. Repeats. Please repeat each sentence that you hear, exactly as you hear it.",
    C: "Part C. Conversations. You will hear a conversation between two people, followed by a question. Please answer the question with a word or a short phrase.",
    D: "Part D. Passage comprehension. You will hear a short passage, followed by a question. Please answer the question.",
    E: "Part E. Story retelling. You will hear a short story. Please retell the story in your own words.",
    S: "Before the test begins, please answer a sample question. Your answer will not be scored.",
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
      <div id="vLevelMock"></div>
      <ul class="finds">
        <li class="warn" style="display:grid"><span class="ic">1</span><span>イヤホンをつけ、静かな場所で受けてください。途中で止めると最初からになります。</span></li>
        <li class="warn" style="display:grid"><span class="ic">2</span><span>問題の音声は1回だけ。戻る・聞き直しはできません。</span></li>
        <li class="warn" style="display:grid"><span class="ic">3</span><span>音声が終わったらすぐ回答。6秒話さないと次の問題へ進みます。時間切れでも、途中まで話した分は採点されます。</span></li>
        <li class="warn" style="display:grid"><span class="ic">4</span><span>結果は最後にまとめて表示します（採点はテスト中に裏で進めます）。</span></li>
      </ul>
      ${az() ? "" : `<div class="err">設定タブでAzureのキーを入れてから始めてください（読み上げと採点に使います）。</div>`}
      <div class="vstart">
        <button class="btn" id="vMockGen"${az() ? "" : " disabled"}>新しい問題で開始（自動生成）</button>
        <div class="sub">毎回テンプレートから新しく作ります（上で選んだ難しさ）。過去30日に出た問題は出しません。問題バンク・初見用セットは基礎レベルです。</div>
        <button class="btn ghost" id="vMockGo"${az() ? "" : " disabled"}>問題バンクからランダム</button>
        ${bank.sets && bank.sets.first ? `<button class="btn ghost" id="vMockSet"${az() ? "" : " disabled"}>${esc(bank.sets.first.name)}で開始${store.get("v-set-done-first", false) ? "（受験済み）" : ""}</button>` : ""}
        <div id="vImpList"></div>
      </div></div>
      <div class="card"><h2>問題セットを取り込む</h2>
        <div class="sub">Claudeのチャットで作った問題セット（JSON）を貼り付けて、模擬テストに使えます。足りないパートは自動生成で埋めて40問にします。</div>
        <details class="vprompt"><summary>Claudeに作らせる依頼文を見る</summary><pre id="vPromptText"></pre><div class="row"><button class="btn ghost small" id="vPromptCopy">依頼文をコピー</button><span class="sub" id="vPromptMsg"></span></div></details>
        <textarea id="vImpText" placeholder='{"title": "...", "items": [ ... ]}'></textarea>
        <div class="row"><button class="btn ghost" id="vImpBtn">取り込む</button></div>
        <div id="vImpMsg"></div></div>`;
    $("vBack").addEventListener("click", renderHome);
    $("vLevelMock").appendChild(levelSeg());
    $("vMockGen").addEventListener("click", () => startMock("gen"));
    $("vMockGo").addEventListener("click", () => startMock(null));
    if ($("vMockSet")) $("vMockSet").addEventListener("click", () => startMock("first"));
    $("vPromptText").textContent = IMPORT_PROMPT;
    $("vPromptCopy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(IMPORT_PROMPT); $("vPromptMsg").textContent = "コピーしました。Claudeのチャットに貼ってください。"; }
      catch(e){ $("vPromptMsg").textContent = "コピーできませんでした。上の文を長押しして選択してください。"; }
    });
    $("vImpBtn").addEventListener("click", () => {
      const r = importSet($("vImpText").value);
      const box = $("vImpMsg");
      if (!r.ok){ box.innerHTML = `<div class="err">取り込めませんでした：</div><ul class="finds">${r.errors.slice(0, 8).map(e => `<li class="ng" style="display:grid"><span class="ic">✗</span><span>${esc(e)}</span></li>`).join("")}</ul>`; return; }
      const list = store.get("v-imports", []); list.unshift(r.set); store.set("v-imports", list.slice(0, 10));
      box.innerHTML = `<div class="okmsg">「${esc(r.set.title)}」を取り込みました（${r.set.items.length}問${r.warnings.length ? "・" + esc(r.warnings.join(" / ")) : ""}）。上のボタンから開始できます。</div>`;
      $("vImpText").value = ""; renderImpList();
    });
    renderImpList();
  }

  async function startMock(source){
    const setKey = source && bank.sets && bank.sets[source] ? source : null;
    cancel();
    const token = run;
    setAudioSession("play-and-record"); unlockAudio();
    const list = [];
    let impId = null;
    if (setKey) bank.sets[setKey].items.forEach(it => list.push({p: it.p, it}));
    else if (source === "gen") VGen.buildTest(seenMap(), level()).forEach(x => list.push(x));
    else if (source && source.startsWith("imp:")){
      impId = source.slice(4);
      const imp = store.get("v-imports", []).find(x => x.id === impId);
      if (imp) fillFromImport(imp).forEach(x => list.push(x));
    }
    else (window.__vPlan || PLAN).filter(([p]) => bank.parts[p]).forEach(([p, n]) => shuffle(bank.parts[p].items).slice(0, n).forEach(it => list.push({p, it})));
    if (window.__vPlan && source === "gen"){ const keep = {}; window.__vPlan.forEach(([p, n]) => keep[p] = n); const c = {}; for (let i = list.length - 1; i >= 0; i--){ const p = list[i].p; c[p] = (c[p] || 0) + 1; } const seenC = {}; const trimmed = list.filter(x => (seenC[x.p] = (seenC[x.p] || 0) + 1) <= (keep[x.p] || 0)); list.length = 0; trimmed.forEach(x => list.push(x)); }
    markSeen(list);
    mock = {list, results: [], token, done: 0, queue: Promise.resolve(), set: setKey, imp: impId, gen: source === "gen", level: level()};
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
        $("vMPart").textContent = `Part ${part}・${pinfo(part).name}`;
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
        rec = recordAnswer(stream, meter, pinfo(part).time, token, {mock: true});
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
    res.filter(e => e.p !== "S").forEach(e => h.unshift({d: today(), part: e.p, id: e.it.id, score: e.score, lat: e.r.onset, wpm: e.stats.wpm, mock: true}));
    store.set("v-hist", h.slice(0, 800));
    const summary = summarize(res);
    if (mock.set){ summary.set = bank.sets[mock.set].name; store.set("v-set-done-" + mock.set, true); }
    if (mock.gen) summary.set = "自動生成・" + LEVEL_NAME[mock.level];
    if (mock.imp){
      const imps = store.get("v-imports", []), x = imps.find(y => y.id === mock.imp);
      if (x){ summary.set = x.title; x.done = true; store.set("v-imports", imps); }
    }
    const mh = store.get("v-mock", []); mh.unshift(summary); store.set("v-mock", mh.slice(0, 30));
    renderMockResult(res, summary);
  }

  function summarize(res){
    res = res.filter(e => e.p !== "S");          // the speech sample is never scored
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
    const cats = {}, words = {};
    res.forEach(e => { if (!e.bx) return; Object.entries(e.bx).forEach(([k, v]) => {
      if (k === "違う語・余計な語") return;
      cats[k] = (cats[k] || 0) + v.length;
      v.forEach(w => { const key = w.split(" → ")[0]; words[key] = (words[key] || 0) + 1; });
    }); });
    const patterns = {cats: Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6),
      words: Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 10),
      fillers: res.reduce((n, e) => n + (e.stats ? e.stats.fillers : 0), 0),
      restarts: res.reduce((n, e) => n + (e.stats ? e.stats.restarts || 0 : 0), 0)};
    const lat = res.map(e => e.r.onset).filter(x => typeof x === "number");
    return {patterns, date: new Date().toLocaleString("ja-JP", {month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"}), parts,
      noAnswer: res.filter(e => e.r.why === "noanswer").length,
      lat: lat.length ? +(lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(1) : null};
  }

  function summaryTable(sm){
    const row = p => {
      const x = sm.parts[p]; if (!x) return "";
      const main = p === "B" ? `平均一致率 ${x.pct}%` : (p === "E" ? `要素 ${x.pct}%` : p === "F" ? `型＋お題 ${x.pct}%` : `${x.correct}/${x.n} 正解`);
      const weak = x.pct != null && x.pct < 60;
      return `<tr class="${weak ? "weak" : ""}"><td><b>${p}</b> ${esc(pinfo(p).name)}</td><td>${main}</td><td>${x.lat == null ? "–" : x.lat + "秒"}</td><td>${x.noAnswer ? x.noAnswer + "問" : "0"}</td>${x.wpm != null && (p === "E" || p === "F") ? `<td>${x.wpm}</td>` : "<td>–</td>"}</tr>`;
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
      ${patternsHTML(sm.patterns)}
      <div class="sub">結果はこのアプリの自動判定による目安で、本番のスコアとは別物です。60%未満のパートは色付きで表示しています。</div>`;
  }
  function patternsHTML(pt){
    if (!pt) return "";
    const tips = {"冠詞（a / an / the）": "a / the は弱く短く読まれて聞き逃しやすい音です。名詞の前に何かあったか意識しましょう。",
      "前置詞（to / at / for など）": "to / at / for は「タ」「アッ」「ファ」のように弱くなります。動詞とつなげて覚えましょう（go to → ゴウタ）。",
      "語尾（-s / -ed / -ing）が違う": "語尾の s・ed は小さな音です。主語と時制から語尾を予想しながら聞きましょう。",
      "時制・形が違う": "過去の話か今の話かを先に押さえると、went / go のような形の違いを落としにくくなります。",
      "be動詞・助動詞": "is / was / have などは短縮されがちです（he's, I've）。かたまりで聞き取る練習をしましょう。",
      "短縮形（I'm / didn't など）": "I'm / didn't などはかたまりの音で覚えると聞き取れます。",
      "接続詞（because / although など）": "長い文は because / although の前後で区切って覚えると繰り返しやすくなります。",
      "内容語（名詞・動詞・形容詞）": "意味の中心の語が抜けています。長い文はまず意味をつかみ、イメージで覚えましょう。",
      "代名詞": "you / him / them などは弱く短くなります（tell him → テリム）。前の語とつなげて聞きましょう。"};
    return `<div class="field"><label>全体のまとめ（Part Bでよく抜けた語のパターン）</label>
      ${pt.cats.length ? `<ul class="finds">${pt.cats.map(([k, n]) => `<li class="warn" style="display:grid"><span class="ic">${n}</span><span><b>${esc(k)}</b><div class="tp">${esc(tips[k] || "")}</div></span></li>`).join("")}</ul>` : `<div class="sub">目立つ抜けはありませんでした。</div>`}
      ${pt.words.length ? `<div class="sub">よく抜けた語：${pt.words.map(([w, n]) => `${esc(w)}${n > 1 ? `×${n}` : ""}`).join(", ")}</div>` : ""}
      <div class="sub">フィラー合計 ${pt.fillers}回・言い直し合計 ${pt.restarts}回</div></div>`;
  }

  function renderMockResult(res, sm){
    $("vHome").hidden = true; const q = $("vQ"); q.hidden = false;
    q.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>模擬テストの結果</h2><span class="sub">${esc(sm.date)}${sm.set ? "・" + esc(sm.set) : ""}</span></div>
      ${summaryTable(sm)}
      <div class="row"><button class="btn ghost" id="vHome2">パート一覧へ</button><button class="btn" id="vRetry">もう一度受ける</button></div></div>
      <div class="card"><h2>問題ごとの結果</h2><div class="sub">タップすると、スクリプト・あなたの回答・録音・模範解答を確認できます。</div><div id="vItems"></div></div>`;
    $("vHome2").addEventListener("click", () => { stopListen(); renderHome(); });
    $("vRetry").addEventListener("click", () => { stopListen(); mockIntro(); });
    const box = $("vItems");
    res.forEach((e, k) => {
      const d = document.createElement("details"); d.className = "vitem";
      const tag = e.p === "S" ? "採点外" : e.r.why === "noanswer" ? "無回答" : e.p === "B" ? `${e.score ?? "–"}%` : (e.p === "A" || e.p === "C" || e.p === "D") ? (e.score === 100 ? "○" : "×") : e.score != null ? `${e.score}%` : "–";
      const bad = e.p !== "S" && (e.r.why === "noanswer" || (e.score != null && e.score < 60));
      d.innerHTML = `<summary><span class="chip">${e.p}</span> <span class="vsumtxt"></span><span class="vtag${bad ? " bad" : ""}">${tag}</span></summary>
        <div class="vdet">
          ${e.judge || ""}
          <div class="sub">話し始め ${e.r.onset == null ? "–" : e.r.onset.toFixed(1) + "秒"}・フィラー ${e.stats.fillers}回・言い直し ${e.stats.restarts}回・1秒以上の間 ${e.stats.pauses}回${e.stats.wpm ? "・WPM " + e.stats.wpm : ""}</div>
          ${e.r.blob ? `<audio controls playsinline preload="none" src="${URL.createObjectURL(e.r.blob)}"></audio>` : ""}
          <div class="field"><label>あなたの回答</label><div class="vbox">${e.tr ? esc(e.tr.display || "（なし）") : esc("文字起こしできませんでした " + e.err)}</div></div>
          <div class="field"><label>問題のスクリプト</label><div class="vlisten"></div><div class="vbox">${scriptHTML(e.p, e.it)}</div></div>
          ${(e.p === "E" || e.p === "F" || e.p === "S") && e.tr && e.tr.display ? grammarBlock() : ""}
          ${e.it.model ? `<div class="field"><label>模範解答</label><div class="vbox">${esc(e.it.model)}</div></div>` : ""}
        </div>`;
      d.querySelector(".vsumtxt").textContent = `${k + 1}. ${(e.it.q || e.it.text || e.it.passage || "").slice(0, 48)}…`;
      d.querySelector(".vlisten").appendChild(listenButton(e.p, e.it));
      const grammar = [];
      let checked = false;
      d.addEventListener("toggle", () => { if (d.open && !checked && d.querySelector(".vgram")){ checked = true; fillGrammar(d, e.tr.display, grammar); } });
      const askRow = claudeButton(() => claudePrompt(e.p, e.it, e.tr, e.stats, e.score, grammar));
      askRow.appendChild(shadowButton(e.p, e.it));
      d.querySelector(".vdet").appendChild(askRow);
      box.appendChild(d);
    });
    window.scrollTo(0, 0);
  }

  function showMockSummaryOnly(sm){
    $("vHome").hidden = true; const q = $("vQ"); q.hidden = false;
    q.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>模擬テストの結果</h2><span class="sub">${esc(sm.date)}${sm.set ? "・" + esc(sm.set) : ""}</span></div>
      ${summaryTable(sm)}<button class="btn ghost" id="vHome2">パート一覧へ</button></div>`;
    $("vHome2").addEventListener("click", renderHome);
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  function status(t){ const s = $("vStatus"); if (s) s.textContent = t; }
  function setFill(f){ const el = $("vFill"); if (el) el.style.width = Math.round(f * 100) + "%"; }


  /* ================= Versant → シャドーイング教材 ================= */
  /* What to shadow for each part: B = the sentence itself; A/C/D = what was heard (question,
     conversation, passage) to train listening; E/F = the model answer, so the useful phrasing
     ("This story is about…", "For example…") gets drilled with pronunciation feedback. */
  const splitSent = t => String(t).replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map(x => x.trim()).filter(Boolean) || [];
  function itemSentences(p, it){
    switch (p){
      case "A": return [it.q];
      case "B": return [it.text];
      case "C": return [...it.lines.map(l => l.t), it.q];
      case "D": return [...splitSent(it.passage), it.q];
      case "E": return splitSent(it.model);
      case "F": return splitSent(it.model);
    }
    return [];
  }
  function toShadowing(list, title){
    const sentences = [];
    list.forEach(({p, it}) => itemSentences(p, it).forEach(en => { if (en && !sentences.some(x => x.en === en)) sentences.push({en, ja: `Versant ${p}`}); }));
    if (!sentences.length) return false;
    setScript({title, level: "Versant", sentences: sentences.slice(0, 14)});
    showTab("practice");
    return true;
  }
  function shadowButton(p, it){
    const b = document.createElement("button"); b.className = "btn ghost small"; b.textContent = "シャドーイングで練習";
    b.addEventListener("click", () => toShadowing([{p, it}], `Versant ${p}・${it.id}`));
    return b;
  }
  /* weakest recent items: latest result per question, low scores first */
  function findItem(p, id){
    const inPart = bank.parts[p] && bank.parts[p].items.find(x => x.id === id);
    if (inPart) return inPart;
    for (const k in (bank.sets || {})){ const x = bank.sets[k].items.find(y => y.id === id); if (x) return x; }
    const g = store.get("v-gencache", {})[id]; if (g) return g.it;
    for (const s of store.get("v-imports", [])){ const x = s.items.find(y => y.id === id); if (x) return x; }
    return null;
  }
  function weakItems(max){
    const latest = new Map();
    hist().forEach(h => { if (!latest.has(h.id)) latest.set(h.id, h); });      // hist is newest first
    const all = [];
    latest.forEach(h => {
      const it = findItem(h.part, h.id);
      if (!it) return;
      const score = typeof h.score === "number" ? h.score : 0;                  // no transcript / no answer counts as weak
      const weak = (h.part === "A" || h.part === "C" || h.part === "D") ? score === 0 : score < 70;
      all.push({p: h.part, it, score, weak});
    });
    const pri = {B: 0, E: 1, F: 2, A: 3, C: 4, D: 5};                         // repeats first: pure pronunciation/fluency
    all.sort((a, b) => a.score - b.score || pri[a.p] - pri[b.p]);
    const weak = all.filter(x => x.weak);
    if (weak.length) return {list: weak.slice(0, max), fallback: false, seen: all.length};
    return {list: all.filter(x => x.score < 100).slice(0, max), fallback: true, seen: all.length};
  }
  function addSourceCard(){
    const src = document.getElementById("p-src"); if (!src || document.getElementById("vShadowCard")) return;
    const c = document.createElement("div"); c.className = "card"; c.id = "vShadowCard";
    c.innerHTML = `<h2>Versantの苦手から作る</h2>
      <div class="sub">Versantの練習・模擬テストで点数が低かった問題（Bの一致率70%未満、A/C/Dの不正解など）を集めて教材にします。シャドーイングで提出すると、発音まで添削されます。</div>
      <div class="row"><button class="btn" id="vShadowBtn">苦手な問題で教材を作る</button></div><div class="sub" id="vShadowMsg"></div>`;
    src.insertBefore(c, src.firstChild);
    c.querySelector("#vShadowBtn").addEventListener("click", async () => {
      const msg = c.querySelector("#vShadowMsg");
      try { await loadBank(); } catch(e){ msg.textContent = "問題データを読み込めませんでした。"; return; }
      const {list: w, fallback, seen} = weakItems(6);
      if (!w.length){
        msg.textContent = seen ? `Versantの記録${seen}問はすべて満点でした。苦手な問題が出たら、ここに集まります。` : "Versantの記録がまだありません。Versantタブでパート別練習か模擬テストをすると、ここに集まります。";
        return;
      }
      const d = new Date().toLocaleDateString("ja-JP", {month: "numeric", day: "numeric"});
      toShadowing(w, `Versant${fallback ? "の復習" : "苦手"} ${d}（${w.map(x => x.p).join("")}）`);
    });
  }
  addSourceCard();

  window.Versant = {show: renderHome, cancel};
})();
