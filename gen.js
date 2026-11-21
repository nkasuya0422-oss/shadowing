"use strict";
/* Versant question generator: templates + interchangeable material (names, objects, places, days,
   times, prices…) so every mock test can be built from questions the learner has not seen.
   Each generated item carries `sig` (template + key slot values) for the "seen" history, and
   `tpl` (template id) so one test never uses the same template twice.
   Output items use the same shape as versant.json items, so the rest of the app treats them alike. */
const VGen = (() => {
  /* ---------- helpers ---------- */
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const int = (a, b) => a + rnd(b - a + 1);
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--){ const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const pickN = (a, n) => shuffle(a).slice(0, n);
  const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  function num(n){
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
    if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + num(n % 100) : "");
    return String(n);
  }
  const numAcc = n => [num(n), String(n)];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const words = s => s.split(/\s+/).filter(Boolean).length;

  /* ---------- material ---------- */
  const MEN = ["Ken","Tom","David","Mark","Ryan","Leo","Sam","Ben","Jack","Daniel","Kevin","Hiro","Jun","Carlos","Peter","Alex","Chris","Max","Paul","Ethan","Ravi","Omar","Luke","Noah"];
  const WOMEN = ["Lisa","Emma","Mia","Sara","Anna","Yuki","Rina","Grace","Nina","Kate","Amy","Olivia","Sophie","Hana","Lucy","Maria","Emily","Julia","Chloe","Aya","Priya","Laura","Mei","Zoe"];
  const person = () => Math.random() < 0.5
    ? {name: pick(MEN), he: "he", He: "He", his: "his", His: "His", him: "him", g: "man"}
    : {name: pick(WOMEN), he: "she", He: "She", his: "her", His: "Her", him: "her", g: "woman"};
  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const OBJ = ["umbrella","laptop","wallet","phone","jacket","notebook","charger","ticket","passport","bag","watch","scarf"];
  const PLACE = ["the library","the gym","the post office","the bank","the dentist","the supermarket","the station","the pharmacy"];
  const TIMES = [["two",2],["three",3],["four",4],["five",5],["six",6],["seven",7],["eight",8],["nine",9],["ten",10],["eleven",11]];
  const CITY = ["Madrid","London","Sydney","Toronto","Seoul","Paris","Berlin","Vancouver","Singapore","Rome"];
  const COUNTRY = ["Canada","Italy","Australia","Spain","Korea","Thailand","Mexico","Iceland"];
  const LANG = ["Spanish","French","Korean","German","Italian","Chinese","Portuguese"];
  const FOOD = ["pizza","sushi","noodles","curry","sandwiches","burgers","salad","tacos"];
  const CUISINE = ["Italian","Thai","Korean","Mexican","Indian","French","Chinese","Greek"];
  const EVENT = ["party","workshop","barbecue","team dinner","seminar","welcome lunch"];

  /* ---------- Part A: short answers ---------- */
  const COMPARE = [["a feather","a brick","heavier","brick"],["a mouse","an elephant","bigger","elephant"],["ice","hot soup","colder","ice"],
    ["a bicycle","an airplane","faster","airplane"],["a minute","an hour","longer","hour"],["a lemon","a watermelon","bigger","watermelon"],
    ["a candle","the sun","brighter","sun"],["a pencil","a tree","taller","tree"],["a coin","a car","heavier","car"],["a snail","a horse","faster","horse"],
    ["summer","winter","colder","winter"],["a baby","a teenager","older","teenager"],["a week","a year","longer","year"],["a cup","a bathtub","bigger","bathtub"]];
  const JOBS = [["flies an airplane",["pilot"]],["takes care of people's teeth",["dentist"]],["cooks food in a restaurant",["chef","cook"]],
    ["teaches students at a school",["teacher"]],["puts out fires",["firefighter","fireman"]],["fixes cars",["mechanic"]],
    ["grows vegetables on a farm",["farmer"]],["cuts people's hair",["hairdresser","barber","stylist"]],["delivers letters",["mail carrier","mailman","postman","letter carrier"]],
    ["takes care of sick animals",["vet","veterinarian"]],["works in a hospital and helps doctors",["nurse"]],["drives a bus",["bus driver","driver"]],
    ["takes your money at a supermarket",["cashier"]],["designs buildings",["architect"]]];
  const PLACES_DO = [["borrow books",["library"]],["buy medicine",["pharmacy","drugstore","chemist"]],["catch a plane",["airport"]],["mail a letter",["post office"]],
    ["watch a new movie",["theater","theatre","cinema"]],["exercise and lift weights",["gym"]],["buy fresh bread",["bakery"]],["see lions and giraffes",["zoo"]],
    ["see old paintings",["museum","gallery"]],["catch a train",["station"]],["swim in a pool",["pool","gym"]]];
  const TOOLS = [["cut paper",["scissor"]],["tell the time",["clock","watch"]],["dry your hair",["dryer","hair dryer"]],["open a locked door",["key"]],
    ["eat soup",["spoon"]],["sweep the floor",["broom"]],["brush your teeth",["toothbrush"]],["hammer a nail",["hammer"]],["boil water",["kettle","pot"]],["take photos",["camera","phone"]]];
  const EITHER = [["Do people drink coffee from a cup or from a plate?",["cup"],"From a cup."],["Do you put shoes on your feet or on your hands?",["feet","foot"],"On your feet."],
    ["Is ice cream usually hot or cold?",["cold"],"Cold."],["Do you use a pillow when you sleep or when you cook?",["sleep"],"When you sleep."],
    ["Is a kitten a baby cat or a baby dog?",["cat"],"A baby cat."],["Do people keep ice cream in the freezer or in the oven?",["freezer"],"In the freezer."],
    ["Should you cross the street when the light is green or red?",["green"],"When it's green."],["Do you wear a heavy coat in winter or in summer?",["winter"],"In winter."],
    ["Would you wear sunglasses on a sunny day or on a dark night?",["sunny","sun"],"On a sunny day."],["Is a ripe tomato usually red or blue?",["red"],"Red."],
    ["Do birds have feathers or fur?",["feather"],"Feathers."],["Is the ocean full of salt water or fresh water?",["salt"],"Salt water."],
    ["Do people use an umbrella when it rains or when it's windy and dry?",["rain"],"When it rains."],["Would you find a bed in a bedroom or in a garage?",["bedroom"],"In a bedroom."]];
  const FACTS = [["How many legs does a spider have?",8],["How many days are there in a week?",7],["How many months are there in a year?",12],
    ["How many wheels does a bicycle have?",2],["How many sides does a triangle have?",3],["How many minutes are there in an hour?",60],
    ["How many legs does a dog have?",4],["How many seasons are there in a year?",4],["How many hours are there in a day?",24]];

  const A_T = [
    {id:"A-change", make(){
      const thing = pick(["a shirt","a book","a hat","an umbrella","a lunch box","a T-shirt","a game"]), p = pick([12,13,15,17,18,23,25,27,32,35,38,42,45]);
      const bill = p < 20 ? pick([20,50]) : p < 50 ? 50 : 100, c = bill - p;
      return {sig: `${p}-${bill}`, q: `If ${thing} costs ${num(p)} dollars and you pay with a ${num(bill)}-dollar bill, how much change do you get?`, accept: numAcc(c), model: `${cap(num(c))} dollars.`, explain: `${bill} − ${p} = ${c}`};
    }},
    {id:"A-endtime", make(){
      const ev = pick(["meeting","class","movie","lesson","concert"]), s = int(1, 8), d = int(1, 3), e = s + d;
      return {sig: `${s}-${d}`, q: `If a ${ev} starts at ${num(s)} o'clock and lasts ${num(d)} hour${d > 1 ? "s" : ""}, what time does it end?`, accept: numAcc(e), model: `At ${num(e)} o'clock.`, explain: `${s} + ${d} = ${e}`};
    }},
    {id:"A-left", make(){
      const P = person(), thing = pick(["apples","cookies","pencils","stickers","oranges","postcards"]), n = int(6, 12), m = int(2, n - 2);
      return {sig: `${n}-${m}-${thing}`, q: `${P.name} had ${num(n)} ${thing} and gave ${num(m)} to a friend. How many does ${P.he} have now?`, accept: numAcc(n - m), model: `${cap(num(n - m))}.`, explain: `${n} − ${m} = ${n - m}`};
    }},
    {id:"A-total", make(){
      const t = pick([["coffee","coffees"],["ticket","tickets"],["sandwich","sandwiches"],["notebook","notebooks"]]), p = int(2, 6), k = int(2, 4);
      return {sig: `${t[0]}-${p}-${k}`, q: `If one ${t[0]} costs ${num(p)} dollars, how much do ${num(k)} ${t[1]} cost?`, accept: numAcc(p * k), model: `${cap(num(p * k))} dollars.`, explain: `${p} × ${k} = ${p * k}`};
    }},
    {id:"A-day", make(){
      const i = rnd(7), kind = pick(["tomorrow","yesterday","in two days"]);
      const j = kind === "tomorrow" ? (i + 1) % 7 : kind === "yesterday" ? (i + 6) % 7 : (i + 2) % 7;
      const q = kind === "yesterday" ? `If today is ${DAYS[i]}, what day was yesterday?` : kind === "tomorrow" ? `If today is ${DAYS[i]}, what day is tomorrow?` : `If today is ${DAYS[i]}, what day will it be in two days?`;
      return {sig: `${i}-${kind}`, q, accept: [DAYS[j].toLowerCase()], model: `${DAYS[j]}.`};
    }},
    {id:"A-month", make(){
      const i = rnd(12), after = Math.random() < 0.6, j = after ? (i + 1) % 12 : (i + 11) % 12;
      return {sig: `${i}-${after}`, q: `Which month comes ${after ? "after" : "before"} ${MONTHS[i]}?`, accept: [MONTHS[j].toLowerCase()], model: `${MONTHS[j]}.`};
    }},
    {id:"A-compare", make(){
      const c = pick(COMPARE), [x, y] = Math.random() < 0.5 ? [c[0], c[1]] : [c[1], c[0]];
      return {sig: c[3] + c[2], q: `Which is ${c[2]}, ${x} or ${y}?`, accept: [c[3]], model: `${cap(c[0] === c[3] || c[0].endsWith(c[3]) ? c[0] : c[1])}.`};
    }},
    {id:"A-job", make(){ const j = pick(JOBS); return {sig: j[1][0], q: `What do you call a person who ${j[0]}?`, accept: j[1], model: `A ${j[1][0]}.`}; }},
    {id:"A-place", make(){ const j = pick(PLACES_DO); return {sig: j[1][0] + j[0], q: `Where do you usually go to ${j[0]}?`, accept: j[1], model: `To the ${j[1][0]}.`}; }},
    {id:"A-tool", make(){ const j = pick(TOOLS); return {sig: j[0], q: `What do you use to ${j[0]}?`, accept: j[1], model: `A ${j[1][0].replace(/^scissor$/, "pair of scissors")}.`}; }},
    {id:"A-either", make(){ const j = pick(EITHER); return {sig: j[0], q: j[0], accept: j[1], model: j[2]}; }},
    {id:"A-fact", make(){ const j = pick(FACTS); return {sig: j[0], q: j[0], accept: numAcc(j[1]), model: `${cap(num(j[1]))}.`}; }},
  ];

  /* ---------- Part B: repeats in three lengths ---------- */
  const fill = (s, P) => s.replace(/\{(\w+)\}/g, (_, k) => ({
    N: P.name, he: P.he, He: P.He, his: P.his, His: P.his, him: P.him,
    obj: P.obj, place: P.place, day: P.day, time: P.time, city: P.city, lang: P.lang, food: P.food
  })[k] ?? `{${k}}`);
  const B_SHORT = ["{N} called me last night.","The {obj} is on the table.","I'll see you on {day}.","Please close the window.","We're out of milk again.",
    "My train leaves at {time}.","{N} is in a meeting.","Can you turn it down?","The shop opens at {time}.","I left my {obj} at home.",
    "It's too cold outside today.","Let's take a short break.","The bus is late again.","Dinner is almost ready.","Please sign here."];
  const B_MID = ["{N} forgot to bring {his} {obj} today.","The meeting has been moved to {day} afternoon.","Could you send me the report before {time}?",
    "I'm going to {place} after work today.","They're painting the office walls this weekend.","We need to leave now to catch the train.",
    "The package should arrive before {day}.","I didn't know the store had already closed.","{N} usually takes the bus on rainy days.",
    "Can you remind me to call {N} tomorrow?","The new printer is much faster than the old one.","Most of the staff prefer working in the morning.",
    "Please make sure the lights are off when you leave.","{N} has worked here for almost ten years.","I'd like to book a table for four, please."];
  const B_LONG = ["Although the train was delayed, we still arrived before the meeting started.","If it rains on {day}, the picnic will be moved indoors.",
    "{N} has been learning {lang} since {he} moved to {city}.","Because the printer wasn't working, I had to send the documents by email.",
    "Even though {N} left home early, {he} got stuck in traffic and missed the flight.","Although the restaurant was full, the manager found us a table by the window.",
    "If you finish the report before {time}, we can review it together this afternoon.","The company has decided to open a new office in {city} next spring.",
    "Since the elevator was out of order, everyone had to use the stairs all day.","Although {N} had never cooked before, {his} dinner turned out to be delicious.",
    "We should book the hotel soon because prices usually go up during the holidays.","After the meeting ended, {N} stayed behind to answer a few more questions.",
    "Even though it was only a short trip, we managed to visit three different museums.","If the weather is nice tomorrow, let's have lunch in the park near the office.",
    "Although the tickets were expensive, everyone agreed that the concert was worth it."];
  const bTpl = (tier, list) => list.map((s, k) => ({id: `B-${tier}${k}`, tier, make(){
    const P = Object.assign(person(), {obj: pick(OBJ), place: pick(PLACE), day: pick(DAYS), time: pick(TIMES)[0], city: pick(CITY), lang: pick(LANG), food: pick(FOOD)});
    const text = fill(s, P);
    return {sig: text.toLowerCase(), text};
  }}));
  const B_T = [...bTpl("s", B_SHORT), ...bTpl("m", B_MID), ...bTpl("l", B_LONG)];

  /* ---------- Part C: conversations (2–3 speakers), question about the final decision ---------- */
  const voices = (n) => { const a = shuffle(["M","W"]); return n === 3 ? [a[0], a[1], a[0] + "2"] : a; };
  const g = s => s.startsWith("M") ? "man" : "woman";
  const C_T = [
    {id:"C-time", make(){ const [x, y] = voices(2), t = pickN(TIMES, 2), d = pick(DAYS);
      return {sig: t[0][0] + t[1][0] + d, lines: [{s:x,t:`Shall we meet at ${t[0][0]} on ${d}?`},{s:y,t:`${cap(t[0][0])}'s a bit difficult for me. How about ${t[1][0]}?`},{s:x,t:`${cap(t[1][0])} works. See you then.`}],
        q: "What time will they meet?", accept: [t[1][0], String(t[1][1])], model: `At ${t[1][0]}.`}; }},
    {id:"C-day", make(){ const [x, y] = voices(2), d = pickN(DAYS.slice(0, 5), 2);
      return {sig: d.join(), lines: [{s:x,t:`Can we have the meeting on ${d[0]}?`},{s:y,t:`I'm out of the office on ${d[0]}. What about ${d[1]}?`},{s:x,t:`${d[1]} is fine.`}],
        q: "On which day will they have the meeting?", accept: [d[1].toLowerCase()], model: `On ${d[1]}.`}; }},
    {id:"C-count", make(){ const [x, y] = voices(2), ev = pick(EVENT), n = pick([10,12,15,20,25,30]), m = int(2, 6);
      return {sig: `${ev}${n}${m}`, lines: [{s:x,t:`How many people are coming to the ${ev}?`},{s:y,t:`We invited ${num(n)}, but ${num(m)} can't make it.`}],
        q: "How many people are coming?", accept: numAcc(n - m), model: `${cap(num(n - m))}.`, explain: `${n} − ${m} = ${n - m}`}; }},
    {id:"C-transport", make(){ const [x, y] = voices(2), dest = pick(["conference","airport","concert","client's office"]), mode = pick(["train","bus","subway"]),
        why = pick(["parking is too expensive","my car is being repaired","the traffic will be terrible"]);
      return {sig: dest + mode, lines: [{s:x,t:`Are you driving to the ${dest}?`},{s:y,t:`I was going to, but ${why}. I'll take the ${mode} instead.`}],
        q: `How will the ${g(y)} get to the ${dest}?`, accept: [mode], model: `By ${mode}.`}; }},
    {id:"C-food", make(){ const [x, y] = voices(2), f = pickN(FOOD, 2);
      return {sig: f.join(), lines: [{s:x,t:`Let's get ${f[0]} for lunch.`},{s:y,t:`I had ${f[0]} yesterday. How about ${f[1]}?`},{s:x,t:`Sure, ${f[1]} it is.`}],
        q: "What will they have for lunch?", accept: [f[1].replace(/es$|s$/, "")], model: `${cap(f[1])}.`}; }},
    {id:"C-lost", make(){ const [x, y] = voices(2), o = pick(OBJ), loc = pick([["in your bag",["bag"]],["on the kitchen table",["kitchen","table"]],["in your jacket pocket",["pocket","jacket"]],["in the car",["car"]],["in your desk drawer",["drawer","desk"]]]);
      return {sig: o + loc[0], lines: [{s:x,t:`I can't find my ${o} anywhere.`},{s:y,t:`Did you check ${loc[0]}?`},{s:x,t:`Oh, here it is. Thanks!`}],
        q: `Where was the ${o}?`, accept: loc[1], model: cap(loc[0].replace("your", `the ${g(x)}'s`)) + "."}; }},
    {id:"C-price", make(){ const [x, y] = voices(2), it = pick(["jacket","train ticket","concert ticket","pair of shoes","new bag"]), p = pick([40,50,60,80,90]), d = pick([10,15,20]);
      return {sig: it + p + d, lines: [{s:x,t:`How much was the ${it}?`},{s:y,t:`It was ${num(p)} dollars, but I got ${num(d)} dollars off.`}],
        q: `How much did the ${g(y)} pay?`, accept: numAcc(p - d), model: `${cap(num(p - d))} dollars.`, explain: `${p} − ${d} = ${p - d}`}; }},
    {id:"C-room", make(){ const [x, y] = voices(2), r = pickN([2,3,4,5,6,7,8,9], 2), why = pick(["it's being cleaned","the projector is broken","it's too small for everyone"]);
      return {sig: r.join(), lines: [{s:x,t:`Is the meeting still in Room ${num(r[0])}?`},{s:y,t:`No, it moved to Room ${num(r[1])} because ${why}.`}],
        q: "Where is the meeting now?", accept: numAcc(r[1]), model: `In Room ${num(r[1])}.`}; }},
    {id:"C-reason", make(){ const [x, y] = voices(2), he = g(y) === "man" ? ["he","his"] : ["she","her"];
      const r = pick([["I have to pick up my son from school",["son","school","pick"],`${he[0]} has to pick up ${he[1]} son from school`],
                      ["I have a dentist appointment",["dentist"],`${he[0]} has a dentist appointment`],
                      ["I'm catching a flight to Osaka",["flight","plane","osaka"],`${he[0]}'s catching a flight to Osaka`],
                      ["I'm helping my sister move",["sister","move"],`${he[0]}'s helping ${he[1]} sister move`],
                      ["My daughter has a fever",["daughter","fever","sick"],`${he[1]} daughter has a fever`]]);
      return {sig: r[0], lines: [{s:x,t:`Why are you leaving early today?`},{s:y,t:`${r[0]}.`}],
        q: `Why is the ${g(y)} leaving early?`, accept: r[1], model: `Because ${r[2]}.`}; }},
    {id:"C-dinner3", make(){ const [x, y, z] = voices(3), c = pickN(CUISINE, 2), d = pick(DAYS);
      return {sig: c.join() + d, lines: [{s:x,t:`Where should we have the team dinner on ${d}?`},{s:y,t:`How about the ${c[0]} place near the station?`},{s:z,t:`It's closed on ${d}s. Let's try the new ${c[1]} restaurant.`},{s:x,t:`Good idea.`}],
        q: "Where will they have the team dinner?", accept: [c[1].toLowerCase()], model: `At the ${c[1]} restaurant.`}; }},
    {id:"C-start3", make(){ const [x, y, z] = voices(3), t = pickN(TIMES.slice(2), 2).sort((a, b) => a[1] - b[1]), ev = pick(EVENT);
      return {sig: t[0][0] + t[1][0] + ev, lines: [{s:x,t:`What time should we start the ${ev}?`},{s:y,t:`Maybe ${t[0][0]}?`},{s:z,t:`Some people work until ${t[0][0]}. Let's start at ${t[1][0]}.`},{s:x,t:`Agreed.`}],
        q: `What time will the ${ev} start?`, accept: [t[1][0], String(t[1][1])], model: `At ${t[1][0]}.`}; }},
    {id:"C-weather", make(){ const [x, y] = voices(2), d = pick(DAYS.slice(5)), alt = pick([["museum",["museum"]],["aquarium",["aquarium"]],["movies",["movie"]],["shopping mall",["mall","shopping"]]]);
      return {sig: d + alt[0], lines: [{s:x,t:`Shall we go to the beach on ${d}?`},{s:y,t:`It's supposed to rain all day. Let's go to the ${alt[0]} instead.`},{s:x,t:`Okay, sounds good.`}],
        q: "Where will they go?", accept: alt[1], model: `To the ${alt[0]}.`}; }},
  ];

  /* ---------- Part D: passages with 1 or 3 questions ---------- */
  const D_T = [
    {id:"D-learn", make(){ const P = person(), sk = pick([["to play the guitar","play ten songs"],["to cook","cook more than twenty dishes"],["to speak "+pick(LANG),"have simple conversations"],["to swim","swim one kilometer"]]),
        rel = pick(["sister","brother","friend","coworker"]), alt = pick(["on weekends","early in the morning","during lunch breaks"]), k = int(3, 9);
      return {sig: P.name + sk[0] + k, passage: `${P.name} wanted to learn ${sk[0]}, but ${P.he} was always too busy after work. ${P.His} ${rel} suggested practicing ${alt} instead. ${P.He} started practicing for thirty minutes at a time. After ${num(k)} months, ${P.he} could ${sk[1]}.`,
        qs: [{q: `Why couldn't ${P.name} practice after work?`, accept: ["busy"], model: `Because ${P.he} was too busy.`},
             {q: `Who gave ${P.name} advice?`, accept: [rel], model: `${P.His} ${rel}.`},
             {q: `How long did it take before ${P.he} could ${sk[1]}?`, accept: [num(k), String(k)], model: `${cap(num(k))} months.`},
             {q: `When did ${P.name} start practicing?`, accept: [alt.split(" ").pop().replace(/s$/, ""), alt.split(" ")[1]], model: cap(alt) + "."}]};
    }},
    {id:"D-shop", make(){ const v = pick([
        ["café","many customers were working on laptops but leaving early","there weren't enough power outlets","added outlets to every table","customers stayed longer and ordered more drinks",["outlet","power","plug"],["outlet"],["longer","more drink","ordered more"]],
        ["bakery","the lines in the morning were very long","only one person was working at the register","hired a second cashier","the waiting time was cut in half",["register","one person","cashier","line","wait"],["cashier","hired"],["half","shorter","cut"]],
        ["bookstore","customers rarely stayed for long","the shop was too dark to read comfortably","installed brighter lights","customers stayed longer and sales went up",["dark"],["light","bright"],["longer","sales"]],
        ["restaurant","fewer couples were coming in the evening","the dining room was very noisy","put up thick curtains","more couples started coming for dinner",["noisy","noise","loud"],["curtain"],["couple","more"]]]);
      const P = person();
      return {sig: v[0], passage: `A small ${v[0]} noticed that ${v[1]}. The owner, ${P.name}, found out that ${v[2]}. ${P.He} ${v[3]}. Soon, ${v[4]}.`,
        qs: [{q: "What was the problem?", accept: v[5], model: cap(v[2]) + "."},
             {q: `What did ${P.name} do?`, accept: v[6], model: `${P.He} ${v[3]}.`},
             {q: "What happened after the change?", accept: v[7], model: cap(v[4]) + "."}]};
    }},
    {id:"D-flight", make(){ const P = person(), c = pick(CITY), h = int(2, 6), why = pick([["a snowstorm",["snow","storm"]],["a technical problem",["technical","problem"]],["strong winds",["wind"]]]), act = pick(["finish a report","call some friends","read a whole book"]);
      return {sig: P.name + c + h, passage: `${P.name}'s flight to ${c} was delayed by ${num(h)} hours because of ${why[0]}. The airline gave ${P.him} a meal coupon. ${P.He} used the extra time to ${act}. ${P.He} finally arrived late at night, but ${P.he} was still in a good mood.`,
        qs: [{q: "How long was the flight delayed?", accept: numAcc(h), model: `${cap(num(h))} hours.`},
             {q: "Why was the flight delayed?", accept: why[1], model: `Because of ${why[0]}.`},
             {q: `What did the airline give ${P.name}?`, accept: ["coupon","meal","voucher"], model: "A meal coupon."}]};
    }},
    {id:"D-save", make(){ const P = person(), it = pick(["bike","camera","guitar","laptop","sofa"]), s = pick([10,20,25,30]), w = pick([4,5,6,8,10]);
      return {sig: P.name + it + s + w, passage: `${P.name} wanted to buy a new ${it} that cost ${num(s * w)} dollars. ${P.He} decided to save ${num(s)} dollars every week. ${P.He} stopped buying coffee on the way to work to save money. After ${num(w)} weeks, ${P.he} finally had enough to buy it.`,
        qs: [{q: `How much did the ${it} cost?`, accept: numAcc(s * w), model: `${cap(num(s * w))} dollars.`},
             {q: `How much did ${P.name} save every week?`, accept: numAcc(s), model: `${cap(num(s))} dollars.`},
             {q: `How many weeks did it take?`, accept: numAcc(w), model: `${cap(num(w))} weeks.`}]};
    }},
    {id:"D-office", make(){ const P = person(), area = pick([["near the station",["station"]],["downtown",["downtown","city"]],["closer to the river",["river"]]]), m = pick([20,30,40]), act = pick([["go to the gym",["gym"]],["eat breakfast with " + P.his + " family",["breakfast","family"]],["study English",["english","study"]]]);
      return {sig: P.name + area[0] + m, passage: `Last month, ${P.name}'s company moved its office ${area[0]}. ${P.His} commute became ${num(m)} minutes shorter. Now ${P.he} uses the extra time to ${act[0]} every morning.`,
        qs: [{q: "Where did the office move?", accept: area[1], model: cap(area[0]) + "."},
             {q: `How much shorter is ${P.name}'s commute now?`, accept: numAcc(m), model: `${cap(num(m))} minutes shorter.`},
             {q: `What does ${P.name} do with the extra time?`, accept: act[1], model: `${P.He} uses it to ${act[0]}.`}]};
    }},
    {id:"D-lost", make(){ const P = person(), o = pick(OBJ), v = pick(["train","bus"]), loc = pick([["the last station",["last station","station"]],["the lost and found office",["lost and found"]]]), when = pick([["during lunch",["lunch"]],["after work",["after work"]]]);
      return {sig: P.name + o + v, passage: `${P.name} left ${P.his} ${o} on the ${v} on the way to work. ${P.He} called the ${v} company right away. They found it at ${loc[0]}. ${P.He} picked it up ${when[0]}.`,
        qs: [{q: `What did ${P.name} leave on the ${v}?`, accept: [o], model: `${P.His} ${o}.`},
             {q: `Where was it found?`, accept: loc[1], model: `At ${loc[0]}.`},
             {q: `When did ${P.name} pick it up?`, accept: when[1], model: cap(when[0]) + "."}]};
    }},
  ];

  /* ---------- Part E: retell, with points to include ---------- */
  const E_T = [
    {id:"E-late", make(){ const P = person(), k = pick([20,30,40]);
      return {sig: P.name + k, passage: `${P.name} often arrived late to work because ${P.he} overslept. One day, ${P.he} missed an important meeting with a client. After that, ${P.he} started going to bed ${num(k)} minutes earlier every night. Within a month, ${P.he} was never late again.`,
        keys: {"人物": [P.name.toLowerCase()], "問題（遅刻・寝坊）": ["late","overslept","oversleep"], "きっかけ（会議を逃した）": ["meeting","client","missed"], "行動・数字（◯分早く寝る）": [num(k), "earlier","bed"], "結果（遅刻しなくなった）": ["never late","not late","on time","month"]},
        model: `This story is about ${P.name}. ${P.He} was often late because ${P.he} overslept, and one day ${P.he} missed a meeting with a client. Then ${P.he} started going to bed ${num(k)} minutes earlier. In the end, ${P.he} was never late again.`};
    }},
    {id:"E-desk", make(){ const P = person(), k = pick([5,10,15]);
      return {sig: P.name + k, passage: `${P.name}'s desk was always messy, and ${P.he} often couldn't find important papers. One day, ${P.he} spent an hour looking for a contract. After that, ${P.he} decided to clean ${P.his} desk for ${num(k)} minutes every evening. Within a month, ${P.his} desk was tidy, and ${P.he} never lost a document again.`,
        keys: {"人物": [P.name.toLowerCase()], "問題（散らかっていた）": ["messy","mess","couldn't find"], "きっかけ（契約書探しに1時間）": ["contract","hour"], "行動・数字（毎晩◯分片付け）": [num(k), "clean","every evening"], "結果（きれいになった）": ["tidy","never lost","clean"]},
        model: `This story is about ${P.name}. ${P.His} desk was always messy, and one day ${P.he} spent an hour looking for a contract. Then ${P.he} started cleaning ${P.his} desk for ${num(k)} minutes every evening. In the end, it was tidy, and ${P.he} never lost a document again.`};
    }},
    {id:"E-trip", make(){ const P = person(), c = pick(COUNTRY), th = pick([["coffee","making coffee at home"],["lunch","bringing lunch from home"],["taxis","walking to the station"]]), k = pick([6,8,10,12]);
      return {sig: P.name + c + th[0], passage: `${P.name} wanted to save money for a trip to ${c}. ${P.He} noticed that ${P.he} spent a lot on ${th[0]} every day. ${P.He} started ${th[1]} instead. After ${num(k)} months, ${P.he} had saved enough money for the trip.`,
        keys: {"人物": [P.name.toLowerCase()], "目的（◯◯旅行の貯金）": [c.toLowerCase(), "trip","save"], "きっかけ（◯◯代が多い）": [th[0].replace(/s$/, ""), "spent","spend"], "行動": th[1].split(" ").slice(0, 2), "結果・数字（◯か月で貯まった）": [num(k), "enough","saved"]},
        model: `This story is about ${P.name}. ${P.He} wanted to save money for a trip to ${c}, but ${P.he} spent a lot on ${th[0]}. Then ${P.he} started ${th[1]}. In the end, after ${num(k)} months, ${P.he} had enough money for the trip.`};
    }},
    {id:"E-phone", make(){ const P = person(), k = int(4, 7), t = pick(["nine","ten"]);
      return {sig: P.name + k + t, passage: `${P.name} was spending about ${num(k)} hours a day on ${P.his} phone. ${P.He} often felt tired and couldn't focus at work. So ${P.he} decided to leave ${P.his} phone in another room after ${t} o'clock. Two weeks later, ${P.he} was sleeping better and felt much more energetic.`,
        keys: {"人物": [P.name.toLowerCase()], "問題・数字（1日◯時間スマホ）": [num(k), "phone","hours"], "きっかけ（疲れて集中できない）": ["tired","focus"], "行動（別の部屋に置く）": ["another room","other room","leave"], "結果（よく眠れる・元気）": ["sleep","energ","better"]},
        model: `This story is about ${P.name}. ${P.He} spent about ${num(k)} hours a day on ${P.his} phone and felt tired at work. Then ${P.he} started leaving ${P.his} phone in another room after ${t}. In the end, ${P.he} slept better and felt more energetic.`};
    }},
    {id:"E-park", make(){ const P = person(), k = int(4, 9), d = pick(["Sunday","Saturday"]);
      return {sig: P.name + k + d, passage: `The park near ${P.name}'s apartment was always full of trash. ${P.He} felt sad because children could not play there safely. ${P.He} asked ${num(k)} neighbors to help clean it every ${d} morning. After a few months, the park was clean, and families started having picnics there again.`,
        keys: {"人物": [P.name.toLowerCase()], "問題（公園がごみだらけ）": ["trash","garbage","dirty"], "きっかけ（子どもが遊べない）": ["children","kids","play"], "行動・数字（◯人の近所の人と掃除）": [num(k), "neighbor","clean"], "結果（きれいになった・ピクニック）": ["clean","picnic","famil"]},
        model: `This story is about ${P.name}. The park near ${P.his} home was full of trash, so children couldn't play there. Then ${P.he} and ${num(k)} neighbors cleaned it every ${d}. In the end, the park was clean, and families had picnics there again.`};
    }},
    {id:"E-english", make(){ const P = person(), d = pick(DAYS), k = int(3, 8);
      return {sig: P.name + d + k, passage: `${P.name} wanted to improve ${P.his} English, but ${P.he} had no one to practice with. ${P.He} joined a language exchange group that met every ${d} evening. ${P.He} talked with a different partner each week. After ${num(k)} months, ${P.he} passed an English interview at ${P.his} company.`,
        keys: {"人物": [P.name.toLowerCase()], "問題（練習相手がいない）": ["no one","nobody","practice"], "行動（言語交換グループ）": ["exchange","group","partner"], "数字・曜日": [num(k), d.toLowerCase()], "結果（英語面接に合格）": ["interview","passed","pass"]},
        model: `This story is about ${P.name}. ${P.He} wanted to improve ${P.his} English but had no one to practice with. Then ${P.he} joined a language exchange group every ${d}. In the end, after ${num(k)} months, ${P.he} passed an English interview.`};
    }},
    {id:"E-bike", make(){ const P = person(), k = int(3, 6);
      return {sig: P.name + k, passage: `${P.name} wanted a new bike, but ${P.his} parents said it was too expensive. ${P.He} started washing cars in the neighborhood every weekend. ${P.He} saved almost all the money ${P.he} earned. After ${num(k)} months, ${P.he} bought the bike with ${P.his} own money.`,
        keys: {"人物": [P.name.toLowerCase()], "問題（高すぎる）": ["expensive"], "行動（洗車して貯金）": ["wash","car","saved"], "数字（◯か月）": [num(k), "months"], "結果（自分のお金で買った）": ["bought","own money","buy"]},
        model: `This story is about ${P.name}. ${P.He} wanted a new bike, but it was too expensive. Then ${P.he} washed cars every weekend and saved the money. In the end, after ${num(k)} months, ${P.he} bought the bike with ${P.his} own money.`};
    }},
  ];

  /* ---------- Part F: opinions ---------- */
  const PREF = [
    ["working from home","working in an office","I don't have to commute","I can focus in a quiet place","I save about two hours every day"],
    ["living in a big city","living in the countryside","there are more job opportunities","public transportation is convenient","I can get to work by train in twenty minutes"],
    ["shopping online","shopping in stores","it saves time","it's easy to compare prices","I can order things during my lunch break"],
    ["cooking at home","eating out","it's cheaper","it's healthier","one restaurant meal costs as much as three home meals"],
    ["traveling with friends","traveling alone","it's more fun to share experiences","it's safer","we can talk about the food we tried"],
    ["reading paper books","reading e-books","my eyes don't get tired","I remember the story better","I can read for hours without a headache"],
    ["exercising in the morning","exercising in the evening","it gives me energy for the day","I don't have to worry about evening plans","I feel more awake at work after a run"],
    ["watching movies at a theater","watching movies at home","the big screen is exciting","there are no distractions","action movies feel much more real"],
    ["summer","winter","there are more outdoor activities","the days are longer","I can go to the beach or have barbecues"],
    ["working in a team","working alone","we can share ideas","the work is more fun","a teammate might find a better solution"],
    ["taking the train","driving a car","it's cheaper than owning a car","I can read or rest on the way","I don't have to pay for gas or parking"],
    ["a few close friends","many friends","I can trust them more","I can spend more time with each of them","I can talk to them about serious problems"],
    ["meeting in person","meeting online","it's easier to understand people's feelings","it's easier to have casual talks","I can see their reactions clearly"],
    ["saving money","spending money on experiences","I feel safer about the future","I can buy something important later","I can use the money for a house someday"],
  ];
  const SHOULD = [
    ["Should companies allow employees to work from home?","allowing work from home is better","employees save commuting time","they can focus better","they can start work without a crowded train"],
    ["Should students wear school uniforms?","school uniforms are better","students don't have to choose clothes every morning","uniforms help students feel like a team","they can save time before school"],
    ["Should public transportation be free?","free public transportation is better","more people would leave their cars at home","it would help people with low incomes","traffic in the city center would go down"],
    ["Should children have their own smartphones?","waiting until children are older is better","children may spend too much time on games","they can see dangerous websites","some kids play games for hours every night"],
    ["Should companies have a four-day work week?","a four-day work week is better","employees get more time to rest","rested people work more efficiently","they can spend a long weekend with family"],
    ["Should cities build more bicycle lanes?","more bicycle lanes are better","cycling is good for people's health","it reduces traffic and pollution","people can exercise on the way to work"],
    ["Should people take regular breaks from social media?","taking breaks is better","it reduces stress","people have more time for hobbies","I don't compare myself with others as much"],
    ["Should stores be open twenty-four hours a day?","twenty-four-hour stores are better","people who work at night can shop easily","they are helpful in emergencies","nurses can buy food after a night shift"],
    ["Should restaurants show calories on their menus?","showing calories is better","people can make healthier choices","it helps people understand what they eat","someone on a diet can choose a lighter meal"],
    ["Should meetings be shorter than thirty minutes?","shorter meetings are better","people stay focused","there is more time for real work","we can make decisions faster"],
  ];
  const F_T = [
    {id:"F-pref", make(){ const p = pick(PREF), [a, b] = Math.random() < 0.5 ? [p[0], p[1]] : [p[1], p[0]];
      const q = Math.random() < 0.5 ? `Do you prefer ${a} or ${b}? Why?` : `Some people prefer ${a}, while others prefer ${b}. Which do you prefer, and why?`;
      return {sig: p[0] + "|" + p[1], q, model: `I prefer ${p[0]}, for two reasons. First, ${p[2]}. For example, ${p[4]}. Second, ${p[3]}. That's why I prefer ${p[0]}.`};
    }},
    {id:"F-should", make(){ const p = pick(SHOULD);
      return {sig: p[0], q: `${p[0]} Why or why not?`, model: `I think ${p[1]}, for two reasons. First, ${p[2]}. For example, ${p[4]}. Second, ${p[3]}. That's why I think ${p[1]}.`};
    }},
    {id:"F-advdis", make(){ const t = pick([
        ["living in a big city",["there are many jobs","public transportation is convenient"],["rent is expensive","it's crowded and noisy"]],
        ["working from home",["you don't have to commute","you can focus in a quiet place"],["you can feel lonely","it's hard to separate work and rest"]],
        ["having a car",["you can go anywhere anytime","it's easy to carry heavy things"],["parking is expensive","it causes pollution"]],
        ["online shopping",["it saves time","prices are easy to compare"],["you can't touch the product","returns can be troublesome"]]]);
      return {sig: "advdis" + t[0], q: `What are two advantages of ${t[0]}? What are two disadvantages?`,
        checks: [{label:"利点を言えた（advantage / good thing）",any:["advantage","good thing","good point","benefit"]},{label:"欠点を言えた（disadvantage / downside）",any:["disadvantage","bad thing","bad point","downside","drawback"]},
                 {label:"2つずつ挙げた（First / Second / also）",any:["second","another","also"]},{label:"結論まで言い切った（That's why / So overall）",any:["that's why","so overall","overall","in conclusion"]}],
        model: `${cap(t[0])} has two advantages. First, ${t[1][0]}. Second, ${t[1][1]}. But there are also two disadvantages. First, ${t[2][0]}. Second, ${t[2][1]}. That's why ${t[0]} has good and bad points.`};
    }},
  ];

  const TPL = {A: A_T, B: B_T, C: C_T, D: D_T, E: E_T, F: F_T};

  /* ---------- building items with the seen-history ---------- */
  let counter = 0;
  const uid = () => "G" + Date.now().toString(36) + (counter++).toString(36);
  const sigKey = (t, sig) => `${t.id}|${String(sig).toLowerCase()}`;

  /* one fresh item from part p, avoiding seen signatures and templates already used in this test */
  function fresh(p, seen, usedTpl, opts = {}){
    let pool = TPL[p].filter(t => !usedTpl.has(t.id) && (!opts.tier || t.tier === opts.tier));
    if (!pool.length) pool = TPL[p].filter(t => !opts.tier || t.tier === opts.tier);
    for (let tries = 0; tries < 60; tries++){
      const t = pick(pool), r = t.make(), key = sigKey(t, r.sig);
      if (seen && seen[key] && tries < 50) continue;
      if (p === "B" && (words(r.text) < 4 || words(r.text) > 16)) continue;
      usedTpl.add(t.id);
      const it = Object.assign({id: uid(), tpl: t.id, seenKey: key, generated: true}, r);
      delete it.sig;
      return it;
    }
    return null;
  }

  /* D: one passage gives 1 or 3 questions; the 2nd/3rd are marked samePassage */
  function dItems(r, n){
    const qs = n === 3 ? r.qs.slice(0, 3) : [pick(r.qs)];
    return qs.map((x, k) => ({id: uid(), tpl: r.tpl, seenKey: r.seenKey + (k ? "#" + k : ""), generated: true, passage: r.passage, q: x.q, accept: x.accept, model: x.model, samePassage: k > 0}));
  }

  const PLAN = {A: 8, B: 16, C: 6, D: 6, E: 2, F: 2};
  function buildTest(seen){
    const list = [];
    ["A","B","C","D","E","F"].forEach(p => {
      const used = new Set();
      if (p === "B"){
        const tiers = [["s", 5], ["m", 6], ["l", 5]];
        tiers.forEach(([tier, n]) => {
          const got = []; for (let i = 0; i < n; i++){ const it = fresh("B", seen, used, {tier}); if (it) got.push(it); }
          got.sort((a, b) => words(a.text) - words(b.text)).forEach(it => list.push({p, it}));
        });
      } else if (p === "D"){
        const one = fresh("D", seen, used), three = [fresh("D", seen, used), fresh("D", seen, used), fresh("D", seen, used)];
        const plan = Math.random() < 0.5 ? [[one, 3], ...three.map(x => [x, 1])] : [...three.map(x => [x, 1]), [one, 3]];
        plan.forEach(([r, n]) => r && dItems(r, n).forEach(it => list.push({p, it})));
      } else {
        for (let i = 0; i < PLAN[p]; i++){ const it = fresh(p, seen, used); if (it) list.push({p, it}); }
      }
    });
    return list;
  }
  /* a single practice item (D gives one question) */
  function one(p, seen, recentTpl){
    const used = new Set(recentTpl || []);
    const it = fresh(p, seen, used);
    if (!it) return null;
    return p === "D" ? dItems(it, 1)[0] : it;
  }
  /* n items of one part (D as single questions), no repeated template inside the batch */
  function part(p, n, seen){
    const used = new Set(), out = [];
    for (let i = 0; i < n; i++){
      const it = fresh(p, seen, used, p === "B" ? {tier: i < n / 3 ? "s" : i < 2 * n / 3 ? "m" : "l"} : {});
      if (!it) continue;
      out.push(p === "D" ? dItems(it, 1)[0] : it);
    }
    return p === "B" ? out.sort((a, b) => words(a.text) - words(b.text)) : out;
  }
  function counts(){ const o = {}; Object.keys(TPL).forEach(p => o[p] = TPL[p].length); return o; }

  return {buildTest, one, part, counts, num, PLAN, _TPL: TPL};
})();
if (typeof window !== "undefined") window.VGen = VGen;
if (typeof module !== "undefined" && module.exports) module.exports = VGen;
