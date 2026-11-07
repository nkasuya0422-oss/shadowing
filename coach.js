"use strict";
/* Pure logic, no DOM: tokenizing, sound-change annotation, aligning Azure results,
   and turning them into Japanese feedback. Works in the browser and in Node (for tests). */
(function (root) {

const norm = w => {
  const NUM = {"0":"zero","1":"one","2":"two","3":"three","4":"four","5":"five","6":"six","7":"seven","8":"eight","9":"nine","10":"ten"};
  const x = String(w).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, "");
  return NUM[x] || x;
};

/* split a sentence into display tokens; hyphenated words become separate tokens (Azure does the same) */
function tokenize(sentence) {
  const out = [];
  sentence.split(/\s+/).filter(Boolean).forEach(chunk => {
    const parts = chunk.split(/(?<=-)/);           // keep the hyphen on the left part for display
    parts.forEach(p => { const n = norm(p); if (n) out.push({raw: p, n, pause: /[,.;:!?—]["')\]]*$/.test(p)}); });
  });
  return out;
}

/* ---------- sound-change rules ---------- */
const VOWEL = /^[aeiou]/;
const startsVowelSound = w => {
  if (/^(u[nsr]i|use|usu|uni|one|once|eu|ewe)/.test(w)) return false;        // use, unit, one → consonant sound
  if (/^(hour|honest|honor|heir)/.test(w)) return true;
  return VOWEL.test(w);
};
const endsConsonantSound = w => {
  if (/^(the|be|he|she|we|me|see|free|tree|three|agree)$/.test(w)) return false;
  if (/[aeiouwy]$/.test(w)) return /[^aeiou]e$/.test(w) && w.length > 2;  // make, like, have: silent e
  if (/'s$|'d$|'ll$|'ve$|'re$|'m$|n't$/.test(w)) return true;
  return true;
};
const lastConsonant = w => { const m = w.replace(/e$/, "").replace(/'/g, "").match(/[bcdfghjklmnpqrstvxz]+$/); return m ? m[0] : ""; };

const WEAK = {
  a:"ア（ə）", an:"アン", the:"ザ/ダ（ðə）", to:"タ", for:"ファ", of:"ア/ヴ", and:"ン", or:"アー",
  but:"バッ", at:"アッ", from:"フラム", as:"アズ", than:"ザン", can:"クン", could:"クッ", would:"ウッ",
  should:"シュッ", will:"ウル", have:"ァヴ", has:"ァズ", had:"ァッ", was:"ワズ", were:"ワー", are:"ア",
  am:"ム", do:"ドゥ", does:"ダズ", you:"ヤ", your:"ヤー", them:"アム", him:"イム", her:"アー", his:"イズ",
  us:"アス", some:"スム", there:"ザー", been:"ビン", be:"ビ", just:"ジャス", that:"ザッ"
};
const PRONOUN = /^(i|you|we|they|he|she|it|who|should|could|would|must|might|may)$/;
function isWeak(toks, i) {
  const t = toks[i], n = t.n, next = toks[i+1];
  if (!WEAK[n] || !next || t.pause) return false;                        // stressed at the end of a phrase
  if (/^(have|has|had)$/.test(n)) return i > 0 && PRONOUN.test(toks[i-1].n);
  if (/^(do|does)$/.test(n)) return /^(you|we|they|i|he|she|it)$/.test(next.n);
  if (n === "that") return false;                                         // too ambiguous (demonstrative vs. conjunction)
  if (n === "there") return /^(is|are|was|were|'s)$/.test(next.n);
  if (n === "can" || n === "just") return true;
  return true;
}

const REDUCTIONS = [
  [["want","to"], "wanna", "ワナ"], [["going","to"], "gonna", "ガナ"], [["got","to"], "gotta", "ガラ"],
  [["have","to"], "hafta", "ハフタ"], [["has","to"], "hasta", "ハスタ"], [["kind","of"], "kinda", "カインダ"],
  [["sort","of"], "sorta", "ソーラ"], [["out","of"], "outta", "アウラ"], [["a","lot","of"], "alotta", "アラーラ"],
  [["lot","of"], "lotta", "ラーラ"], [["let","me"], "lemme", "レミ"], [["give","me"], "gimme", "ギミ"],
  [["don't","know"], "dunno", "ダノウ"], [["what","do","you"], "whaddaya", "ワダヤ"], [["what","are","you"], "whatcha", "ワチャ"],
  [["did","you"], "didja", "ディジュ"], [["would","you"], "wouldja", "ウッジュ"], [["could","you"], "couldja", "クッジュ"],
  [["don't","you"], "doncha", "ドンチュ"], [["got","you"], "gotcha", "ガチャ"], [["used","to"], "useta", "ユースタ"],
  [["supposed","to"], "sposta", "スポウスタ"], [["should","have"], "should've", "シュダヴ"], [["could","have"], "could've", "クダヴ"],
  [["would","have"], "would've", "ウダヴ"], [["must","have"], "must've", "マスタヴ"], [["a","little"], "a liddle", "アリル"], [["out","here"], "out‿here", "アウリア"]
];

/* returns an array of marks: {type, i, j, label, reading, tip} — i..j are token indexes */
function annotate(toks) {
  const marks = [], used = new Set();
  for (let i = 0; i < toks.length; i++) {
    if (used.has(i)) continue;
    for (const [seq, spelled, reading] of REDUCTIONS) {
      if (seq.every((w, k) => toks[i+k] && toks[i+k].n === w) && !seq.slice(0, -1).some((_, k) => toks[i+k].pause)) {
        if (spelled === "gonna" && toks[i+2] && !/^[a-z]+$/.test(toks[i+2].n)) continue;
        const j = i + seq.length - 1;
        marks.push({type:"reduce", i, j, label:`${seq.join(" ")} → ${spelled}`, reading,
          tip:`2語をまとめて「${reading}」のように短く言う`});
        for (let k = i; k <= j; k++) used.add(k);
        break;
      }
    }
  }
  for (let i = 0; i < toks.length; i++) {
    if (!used.has(i) && isWeak(toks, i)) {
      marks.push({type:"weak", i, j:i, label:`${toks[i].n}（弱形）`, reading: WEAK[toks[i].n],
        tip:`強く言わず「${WEAK[toks[i].n]}」くらいに短く弱く`});
    }
  }
  for (let i = 0; i < toks.length - 1; i++) {
    const a = toks[i], b = toks[i+1];
    if (a.pause || (used.has(i) && used.has(i+1))) continue;
    const an = a.n.replace(/'/g, ""), bn = b.n;
    const lc = lastConsonant(a.n);
    let m = null;
    if (/^(you|your)$/.test(bn) && /t$/.test(an) && !/^(it)$/.test(an))
      m = {type:"tyou", label:`${a.n} ${bn}（t + y）`, reading:"チュ", tip:"t と you がくっついて「チュ」に（meet you → ミーチュ）"};
    else if (/^(you|your)$/.test(bn) && /d$/.test(an))
      m = {type:"dyou", label:`${a.n} ${bn}（d + y）`, reading:"ジュ", tip:"d と you がくっついて「ジュ」に（did you → ディジュ）"};
    else if (/[aeiour]t$/.test(an) && startsVowelSound(bn))
      m = {type:"flap", label:`${a.n}‿${bn}（t → ら行）`, reading:"", tip:"母音にはさまれた t は軽い「ら行」の音に（get it → ゲリッ、a lot of → アラーラ）"};
    else if (/^(him|her|his|have|has|had)$/.test(bn) && isWeak(toks, i+1) && endsConsonantSound(an))
      m = {type:"hdrop", label:`${a.n}‿${bn}（h が落ちる）`, reading:"", tip:"h を言わずに前の語とつなげる（tell him → テリム）"};
    else if (endsConsonantSound(an) && startsVowelSound(bn))
      m = {type:"link", label:`${a.n}‿${bn}`, reading:"", tip:"前の語の最後の子音を次の母音にくっつけて1語のように（check it out → チェキラウ）"};
    else if (/[bcdfgklmnpsvxz][td]$/.test(an) && !startsVowelSound(bn) && !/^h/.test(bn))
      m = {type:"elide", label:`${a.n.replace(/([td])$/, "($1)")} ${bn}`, reading:"", tip:"子音にはさまれた t / d はほぼ発音しない（last night → ラスナイ、and then → アンゼン）"};
    else if (lc && bn[0] && lc.slice(-1) === bn[0] && !/^(th|sh|ch|ph)/.test(bn) && !/(th|sh|ch|ph|gh)$/.test(an) && !startsVowelSound(bn))
      m = {type:"double", label:`${a.n}‿${bn}（同じ音）`, reading:"", tip:"同じ子音が続くときは1回だけ発音（bus stop → バストップ）"};
    else if (/t$/.test(an) && !startsVowelSound(bn))
      m = {type:"stopt", label:`${a.n.replace(/t$/, "(t)")} ${bn}`, reading:"", tip:"語末の t は息を止めるだけで破裂させない（that guy → ザッガイ）"};
    if (m) marks.push(Object.assign(m, {i, j:i+1}));
  }
  return marks.sort((x, y) => x.i - y.i || x.j - y.j);
}

/* ---------- Azure response handling ---------- */
function parseAzure(json) {
  const nb = json && json.NBest && json.NBest[0];
  if (!nb) return {ok:false, words:[], scores:null, display:""};
  const pa = nb.PronunciationAssessment || nb;
  const words = (nb.Words || []).map(w => {
    const p = w.PronunciationAssessment || w;
    const fb = p.Feedback && p.Feedback.Prosody || {};
    return {
      word: w.Word, n: norm(w.Word), acc: p.AccuracyScore, err: p.ErrorType || "None",
      off: (w.Offset || 0) / 1e7, dur: (w.Duration || 0) / 1e7,
      breakErr: (fb.Break && fb.Break.ErrorTypes) || [], intoErr: (fb.Intonation && fb.Intonation.ErrorTypes) || [],
      phon: (w.Phonemes || []).map(ph => ({p: ph.Phoneme, acc: (ph.PronunciationAssessment || ph).AccuracyScore}))
    };
  });
  return {ok:true, display: nb.Display || "", words,
    scores: {pron: pa.PronScore, acc: pa.AccuracyScore, flu: pa.FluencyScore, comp: pa.CompletenessScore, pros: pa.ProsodyScore}};
}

/* map Azure words (minus insertions) onto script tokens by LCS on normalized text */
function align(toks, words) {
  const ref = words.filter(w => w.err !== "Insertion");
  const A = toks.length, B = ref.length;
  const dp = Array.from({length: A+1}, () => new Array(B+1).fill(0));
  for (let i = A-1; i >= 0; i--) for (let j = B-1; j >= 0; j--)
    dp[i][j] = toks[i].n === ref[j].n ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
  const map = new Array(A).fill(null);
  let i = 0, j = 0;
  while (i < A && j < B) {
    if (toks[i].n === ref[j].n) { map[i] = ref[j]; i++; j++; }
    else if (dp[i+1][j] >= dp[i][j+1]) i++; else j++;
  }
  return {map, insertions: words.filter(w => w.err === "Insertion").map(w => w.word)};
}

/* ---------- phoneme tips (IPA and Azure's SAPI labels) ---------- */
const PH = [
  [/^(θ|th)$/, "th（無声）", "舌先を上の歯に軽く当てて息だけ出す。「ス」にしない"],
  [/^(ð|dh)$/, "th（有声）", "舌先を歯に当てたまま声を出す。「ズ」「ダ」にしない"],
  [/^(ɹ|r)$/, "r", "舌先をどこにも付けず奥に引く。「ら行」にしない"],
  [/^(l)$/, "l", "舌先を上の歯ぐきにしっかり付ける"],
  [/^(v)$/, "v", "上の歯を下唇に当てて声を出す。「ブ」にしない"],
  [/^(f)$/, "f", "上の歯を下唇に当てて息を出す。「フ」にしない"],
  [/^(æ|ae)$/, "æ", "「エ」の口の形で「ア」と言う"],
  [/^(ʌ|ah)$/, "ʌ", "短く軽い「ア」"],
  [/^(ɑ|aa|ɒ)$/, "ɑ", "口を縦に大きく開ける「アー」"],
  [/^(ə|ax)$/, "ə", "力を抜いたあいまいな「ア」。はっきり言いすぎない"],
  [/^(ɪ|ih)$/, "ɪ", "「イ」と「エ」の間の短い音"],
  [/^(i|iy|iː)$/, "iː", "口を横に引いて長めの「イー」"],
  [/^(ʊ|uh)$/, "ʊ", "唇を軽く丸めた短い「ウ」"],
  [/^(u|uw|uː)$/, "uː", "唇を丸めて突き出す「ウー」"],
  [/^(ɝ|ɚ|er)$/, "ɚ", "舌を奥に引いたこもった「アー」"],
  [/^(ŋ|ng)$/, "ng", "鼻に抜くだけ。最後に「グ」を付けない"],
  [/^(w)$/, "w", "唇をしっかり丸めて突き出してから始める"],
  [/^(ʃ|sh)$/, "sh", "唇を丸めて「シュ」"], [/^(s)$/, "s", "舌を歯ぐきに近づけて鋭い息。「シ」にしない"],
  [/^(z)$/, "z", "s の口で声を出す"], [/^(tʃ|ch)$/, "ch", "唇を丸めて「チュ」"], [/^(dʒ|jh)$/, "j", "唇を丸めて「ヂュ」"],
  [/^(t|d|k|g|p|b)$/, "破裂音", "語末に母音（ト・ド・ク）を付け足さない"],
  [/^(eɪ|ey)$/, "eɪ", "「エー」ではなく「エイ」"], [/^(oʊ|ow)$/, "oʊ", "「オー」ではなく「オウ」"],
  [/^(aɪ|ay)$/, "aɪ", "「アイ」の「ア」をはっきり"], [/^(aʊ|aw)$/, "aʊ", "「アウ」と唇を丸めて終わる"]
];
const phTip = p => { for (const [re, name, tip] of PH) if (re.test(p)) return {name, tip}; return {name: p, tip: "この音が崩れています"}; };

/* ---------- judging each sentence ---------- */
function judgeSentence(sentence, az, rate) {
  const toks = tokenize(sentence);
  const marks = annotate(toks);
  const {map, insertions} = align(toks, az.words);
  const slow = 1 / Math.max(0.6, rate || 1);
  const gap = (i, j) => (map[i] && map[j]) ? map[j].off - (map[i].off + map[i].dur) : 0;
  const findings = [];
  const covered = new Set();

  marks.forEach(m => {
    const wa = map[m.i], wb = map[m.j];
    const f = {type: m.type, label: m.label, reading: m.reading, tip: m.tip, i: m.i, j: m.j};
    for (let k = m.i; k <= m.j; k++) covered.add(k);
    if (m.type === "weak") {
      if (!wa || wa.err === "Omission") { f.status = "warn"; f.msg = "聞き取れませんでした。弱くしすぎて消えたか、言えていません"; }
      else if (wa.dur > 0.30 * slow) { f.status = "ng"; f.msg = `強く・長く言いすぎ（${wa.dur.toFixed(2)}秒）。もっと短く、軽く`; }
      else { f.status = "ok"; f.msg = `ちょうどいい短さ（${wa.dur.toFixed(2)}秒）`; }
    } else if (m.type === "elide" || m.type === "stopt") {
      f.status = "info"; f.msg = "ここは音を消してOKなところ";
    } else if (!wa || !wb || wa.err === "Omission" || wb.err === "Omission") {
      f.status = "warn"; f.msg = "どちらかの語が聞き取れず、判定できませんでした";
    } else {
      const g = gap(m.i, m.j), brk = wb.breakErr.includes("UnexpectedBreak");
      const span = wb.off + wb.dur - wa.off, words = m.j - m.i + 1;
      if (brk || g > 0.12) { f.status = "ng"; f.msg = `語の間で途切れています（${Math.max(g, 0).toFixed(2)}秒の間）。止めずにつなげる`; }
      else if (m.type === "reduce" && span > (0.28 * words + 0.05) * slow) { f.status = "ng"; f.msg = `まだ1語ずつはっきり言っています（${span.toFixed(2)}秒）。まとめて短く`; }
      else { f.status = "ok"; f.msg = "自然につながっています"; }
    }
    findings.push(f);
  });

  toks.forEach((t, i) => {
    const w = map[i];
    if (!w || w.err === "Omission") {
      if (!covered.has(i)) findings.push({type:"omit", i, j:i, label: t.n, status:"ng", msg:"抜けています（聞き取れませんでした）", tip:"お手本から遅れすぎていないか、聞き返してみましょう"});
      return;
    }
    if (w.err === "Mispronunciation" || w.acc < 70) {
      const worst = (w.phon || []).filter(p => typeof p.acc === "number").sort((a, b) => a.acc - b.acc)[0];
      const tip = worst ? phTip(worst.p) : null;
      findings.push({type:"pron", i, j:i, label: t.n, status: w.acc < 50 ? "ng" : "warn",
        msg: `発音 ${Math.round(w.acc)}点` + (tip ? `：特に「${tip.name}」の音（${Math.round(worst.acc)}点）` : ""),
        tip: tip ? tip.tip : "お手本をよく聞いてまねしましょう"});
    }
  });
  if (insertions.length) findings.push({type:"insert", i:-1, j:-1, label: insertions.join(", "), status:"warn", msg:"お手本にない語が入っています", tip:"言い直しや「ア」などの付け足しに注意"});
  const mono = az.words.filter(w => w.intoErr.includes("Monotone")).length;
  if (mono >= Math.max(2, az.words.length / 3)) findings.push({type:"tone", i:-1, j:-1, label:"抑揚", status:"warn", msg:"抑揚が平坦です", tip:"大事な語（名詞・動詞）を高く長く、それ以外を低く短く"});

  const order = {ng:0, warn:1, ok:2, info:3};
  findings.sort((a, b) => order[a.status] - order[b.status] || a.i - b.i);
  return {toks, marks, map, findings, scores: az.scores};
}

const api = {norm, tokenize, annotate, parseAzure, align, judgeSentence, phTip, WEAK};
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Coach = api;
})(typeof window !== "undefined" ? window : globalThis);
