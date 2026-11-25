"use strict";
/* 本番レベル (exam-level) templates for the Versant generator.
   Harder than "basic": vocabulary questions in Part A, natural service/workplace repeats with
   negations, perfect tenses, contractions and confusable sounds in Part B, 4–6 turn idiomatic
   conversations with inference questions in Part C, 6–8 sentence stories in D/E (E with a twist),
   and an unscored speech sample (S) at the start. All items are original. */
(function(VG){
VG.addLevel("hard", H => {
  const {pick, int, num, numAcc, cap, person, voices, g, DAYS, MONTHS, CITY} = H;
  const P3 = () => { const P = person(); P.himself = P.he === "he" ? "himself" : "herself"; return P; };

  /* ---------- Part A: vocabulary ---------- */
  const DEF = [
    ["What do you call a piece of furniture with shelves for keeping books?",["bookcase","bookshelf","shelf"],"A bookcase."],
    ["What is the word for the money you pay to ride a bus or a train?",["fare"],"The fare."],
    ["What do you call a long seat for several people, often found in a park?",["bench"],"A bench."],
    ["What do you call a person who travels to work every day from another town?",["commuter"],"A commuter."],
    ["What do you call the person who represents you in court?",["lawyer","attorney"],"A lawyer."],
    ["What is the word for an amount of money you borrow from a bank?",["loan","mortgage"],"A loan."],
    ["What do you call the person who owns a building and rents it to others?",["landlord","landlady","owner"],"A landlord."],
    ["What do you call a written agreement between two companies?",["contract","agreement"],"A contract."],
    ["What is the word for the money a person earns every year from a job?",["salary","income","pay","wage"],"A salary."],
    ["What is a small piece of paper that proves you paid for something?",["receipt"],"A receipt."],
    ["What do you call a person who gives money to help a charity?",["donor","sponsor","supporter"],"A donor."],
    ["What do you call a sudden, dangerous situation that needs action right away?",["emergency","crisis"],"An emergency."],
    ["What do you call an animal that hunts and eats other animals?",["predator","hunter"],"A predator."],
    ["What do you call the money you must pay to the government from your income?",["tax"],"Tax."],
    ["What is a garden tool with a long handle that you use for digging?",["shovel","spade"],"A shovel."],
    ["What do you call a young person learning a trade by working with an expert?",["apprentice","trainee","intern"],"An apprentice."],
    ["What do you call the list of topics to discuss at a meeting?",["agenda"],"An agenda."],
    ["What is the word for an exact copy of a document, made on a machine?",["photocopy","copy"],"A photocopy."],
    ["What do you call the extra money you pay a waiter for good service?",["tip","gratuity"],"A tip."],
    ["What do you call a short break in the middle of a play or concert?",["intermission","interval","break"],"An intermission."],
    ["What do you call the place where you wait for a train?",["platform","station"],"A platform."],
    ["What do you call a large shop that sells many kinds of goods in different sections?",["department store","department"],"A department store."],
    ["What do you call a person who designs buildings?",["architect"],"An architect."],
    ["What is the word for the time when a store or bank stops working for the day?",["closing time","closing","close"],"Closing time."],
    ["What do you call the person who checks tickets and helps passengers on a train?",["conductor","attendant"],"A conductor."],
    ["What is the word for a written request for a job, a school, or a loan?",["application"],"An application."],
    ["What do you call the person who is in charge of a newspaper or a magazine?",["editor"],"The editor."],
    ["What is a meal where guests serve themselves from many dishes on a table?",["buffet"],"A buffet."],
  ];
  const HYPER = [
    ["What word means both brothers and sisters?",["sibling"],"Siblings."],
    ["What one word describes chairs, tables, and sofas?",["furniture"],"Furniture."],
    ["What word means people in your family, such as aunts, uncles, and cousins?",["relative"],"Relatives."],
    ["What is one word for knives, forks, and spoons?",["cutlery","silverware","utensil"],"Cutlery."],
    ["What word describes cars, buses, and trucks?",["vehicle"],"Vehicles."],
    ["What is one word for hammers, saws, and screwdrivers?",["tool"],"Tools."],
    ["What is one word for shirts, jackets, and trousers?",["clothes","clothing"],"Clothing."],
    ["What word means family members who lived long before you, like your great-great-grandparents?",["ancestor"],"Ancestors."],
    ["What is one word for rain, snow, and wind?",["weather"],"Weather."],
    ["What is one word for guitars, pianos, and violins?",["instrument"],"Instruments."],
    ["What word means either a husband or a wife?",["spouse","partner"],"A spouse."],
    ["What is one word for necklaces, rings, and earrings?",["jewelry","jewellery"],"Jewelry."],
    ["What word covers rent, food, and electricity bills that a family pays?",["expense","cost","bill"],"Expenses."],
    ["What is one word for doctors, nurses, and dentists?",["medical","health","professional"],"Medical professionals."],
    ["What word means both cats and dogs that people keep at home?",["pet"],"Pets."],
    ["What is one word for carrots, onions, and potatoes?",["vegetable"],"Vegetables."],
  ];
  const BIN = [
    ["If something is fragile, does it break easily or is it very strong?",["break","easily"],"It breaks easily."],
    ["If you postpone a meeting, do you hold it later or cancel it forever?",["later"],"You hold it later."],
    ["If a road is narrow, is there a lot of space or very little space?",["little"],"Very little space."],
    ["If a task is mandatory, do you have to do it or can you skip it?",["have to","must"],"You have to do it."],
    ["If a price is reasonable, is it fair or far too high?",["fair"],"It's fair."],
    ["If someone is reluctant, are they eager or unwilling?",["unwilling"],"Unwilling."],
    ["If an answer is accurate, is it correct or mistaken?",["correct","right"],"Correct."],
    ["If you are exhausted, are you very tired or full of energy?",["tired"],"Very tired."],
    ["If an arrangement is temporary, does it last a short time or forever?",["short"],"A short time."],
    ["If bread is stale, is it fresh or old?",["old","not fresh"],"Old."],
    ["If a person is generous, do they like to give or to keep things for themselves?",["give"],"To give."],
    ["If a room is spacious, is it large or cramped?",["large","big"],"Large."],
    ["If a story is fictional, is it true or made up?",["made up","invented","not true"],"Made up."],
    ["If someone is punctual, do they usually arrive on time or late?",["on time"],"On time."],
    ["If a sound is faint, is it loud or hard to hear?",["hard to hear","quiet","soft"],"Hard to hear."],
    ["If a product is in stock, is it available or sold out?",["available"],"Available."],
    ["If an event is annual, does it happen every year or every week?",["year"],"Every year."],
    ["If you decline an invitation, do you accept it or say no?",["say no","no","refuse"],"You say no."],
    ["If a job is tedious, is it exciting or boring?",["boring","dull"],"Boring."],
    ["If a medicine is effective, does it work or fail?",["work"],"It works."],
    ["If someone is anxious, are they calm or worried?",["worried","nervous"],"Worried."],
    ["If a document is confidential, should it be shared with everyone or kept private?",["private","secret","kept"],"Kept private."],
    ["If a team is understaffed, does it have too many people or too few?",["few"],"Too few."],
  ];
  const ABS = [
    ["The rules are strict. Are they easy to ignore or firmly enforced?",["firm","enforce"],"Firmly enforced."],
    ["The evidence is convincing. Is it persuasive or doubtful?",["persuasive"],"Persuasive."],
    ["The decision was unanimous. Did everyone agree, or did people disagree?",["everyone","agree"],"Everyone agreed."],
    ["Her reply was vague. Was it clear or unclear?",["unclear","not clear"],"Unclear."],
    ["The damage was minor. Was it serious or slight?",["slight","small"],"Slight."],
    ["The results were consistent. Did they stay the same or keep changing?",["same","stay"],"They stayed the same."],
    ["His comment was relevant. Was it connected to the topic or unrelated?",["connected","related"],"Connected to the topic."],
    ["The plan is feasible. Is it possible or impossible?",["possible"],"Possible."],
    ["The schedule is flexible. Can it change, or is it fixed?",["change"],"It can change."],
    ["The instructions were explicit. Were they clearly stated or only hinted at?",["clear"],"Clearly stated."],
    ["The rise in prices was gradual. Did it happen slowly or suddenly?",["slow"],"Slowly."],
    ["The mistake was deliberate. Was it on purpose or by accident?",["purpose","intention"],"On purpose."],
    ["The workshop is optional. Do you have to attend, or can you choose?",["choose","choice"],"You can choose."],
    ["Her progress was remarkable. Was it ordinary or impressive?",["impressive"],"Impressive."],
    ["Water was scarce. Was there plenty, or not enough?",["not enough","little","short"],"Not enough."],
    ["The criticism was constructive. Was it helpful or hurtful?",["helpful","useful"],"Helpful."],
    ["The figures were approximate. Were they exact or roughly correct?",["rough","about","around"],"Roughly correct."],
    ["The meeting was productive. Did they get a lot done or waste time?",["lot done","a lot","achieve"],"They got a lot done."],
  ];
  const USE = [
    ["Where do you leave your coat at a theater or an expensive restaurant?",["cloakroom","coat check","check"],"At the coat check."],
    ["What do you have to show at the border when you enter another country?",["passport"],"Your passport."],
    ["Where do you go to pick up your suitcase after a flight?",["baggage claim","baggage","carousel"],"Baggage claim."],
    ["What do you check to find out when the next train leaves?",["timetable","schedule"],"The timetable."],
    ["Where can you get medicine with a doctor's prescription?",["pharmacy","drugstore","chemist"],"At a pharmacy."],
    ["What should you wear in a car to stay safe in an accident?",["seat belt","seatbelt","belt"],"A seat belt."],
    ["Where do guests go first when they arrive at a hotel?",["front desk","reception","desk"],"The front desk."],
    ["What do you use to protect your eyes from bright sunlight?",["sunglasses"],"Sunglasses."],
    ["Who should you call if a water pipe in your house breaks?",["plumber"],"A plumber."],
    ["Who would you ask for help with your taxes?",["accountant","tax adviser","tax advisor"],"An accountant."],
    ["What do you need to show to prove you are allowed to drive?",["license","licence"],"A driver's license."],
    ["Where do you put bottles and cans so they can be used again?",["recycling"],"In the recycling bin."],
    ["What do you use to pay for something online if you don't have cash?",["card","credit"],"A credit card."],
    ["Where would you go to see a doctor at night if it's an emergency?",["emergency room","hospital","er"],"The emergency room."],
    ["What do you call the place at an airport where your passport is checked?",["immigration","passport control","customs"],"Passport control."],
    ["What do you use to send a large file to a colleague who is far away?",["email","cloud","link"],"Email or a file-sharing link."],
  ];
  const aT = (id, list, sigPfx) => ({id, make(){ const j = pick(list); return {sig: sigPfx + j[0], q: j[0], accept: j[1], model: j[2]}; }});
  const A = [aT("HA-def1", DEF, "d"), aT("HA-def2", DEF, "d"), aT("HA-hyper", HYPER, "h"), aT("HA-bin1", BIN, "b"), aT("HA-bin2", BIN, "b"),
             aT("HA-abs1", ABS, "a"), aT("HA-abs2", ABS, "a"), aT("HA-use", USE, "u"), aT("HA-use2", USE, "u")];
  A.forEach(t => t.key = t.id.replace(/\d$/, ""));   // def1/def2 share one seen-history key, so the same question can't repeat

  /* ---------- Part B: natural speech, negations, perfect tenses, confusable sounds ---------- */
  const ITEMS = ["printer paper","coffee filters","large sizes","the blue ones","batteries","paper cups"];
  const fillB = (s) => s.replace("{day}", pick(DAYS)).replace("{item}", pick(ITEMS)).replace("{num}", num(pick([30, 40, 50, 100]))).replace("{city}", pick(CITY));
  const B_S = ["A server will be right with you.","Your table will be ready soon.","I can't make it tonight.","We're not open on {day}s.","Have you tried restarting it?",
    "I've never been there before.","Could I get the check, please?","There's no rush at all.","I won't be long.","That's not what I meant.","Please hold the line.",
    "It hasn't arrived yet.","Do you have this in blue?","We're all out of {item}.","Is this seat taken?","I can do it now.","No, I said now, not later.",
    "You've got the wrong number.","I'd rather not say.","We haven't decided yet."];
  const B_M = ["Sorry, we can't accept returns without a receipt.","Have you already sent in the expense report?","I'm afraid the manager isn't available right now.",
    "We've never had a complaint like this before.","If you can't find it, just ask at the front desk.","The printer's been jammed since this morning.",
    "Let me know if there's anything else you need.","There's no need to bring anything but your ID.","She hasn't replied to any of my emails yet.",
    "You can't park here between eight and six.","We now offer free delivery on orders over {num} dollars.","I can't believe we've already used up the budget.",
    "The line was so long that we gave up.","I'm sure I left my keys on the wrong desk.","Thanks for waiting. Your order's almost ready.","Would you mind if I opened the window?"];
  const B_L = ["If you sign up before {day}, you'll get the first month free.","I couldn't have finished the project without your help, so thank you.",
    "We haven't been able to reach the client since the meeting was canceled.","Unless you have a reservation, there's usually a long wait on weekends.",
    "If the long line doesn't move soon, we're going to miss the start.","I thought I'd taken the wrong train, but it was the right one after all.",
    "You can't return opened items, but you can exchange them for something else.","We'd have caught the flight if the taxi hadn't taken the wrong exit.",
    "Now that the renovation's finished, the office won't be closed on weekends.","If you're not completely satisfied, we'll give you a full refund.",
    "I can meet on Tuesday, but I can't make it on Thursday afternoon.","Have you ever thought about working part-time instead of quitting?",
    "They said it would be in stock by {day}, but it still hasn't come in.","If you act now, you can get two for the price of one.",
    "I'd have told you sooner if I'd known you were moving to {city}.","Nobody's ever complained about the noise, so it can't be that bad."];
  const bT = (tier, list) => list.map((s, k) => ({id: `HB-${tier}${k}`, tier, make(){ const text = fillB(s); return {sig: text.toLowerCase(), text}; }}));
  const B = [...bT("s", B_S), ...bT("m", B_M), ...bT("l", B_L)];

  /* ---------- Part C: 4–6 turns, idioms, inference questions ---------- */
  const NAMES_W = ["Rachel","Megan","Laura","Naomi","Priya"], NAMES_M = ["Steve","Kevin","Omar","Jason","Ravi"];
  const C = [
    {id:"HC-stockup", make(){ const [x, y] = voices(2), it = pick([["dish soap",["soap"]],["coffee beans",["coffee"]],["light bulbs",["light","bulb"]],["batteries",["batter"]]]);
      return {sig: it[0], lines: [{s:x,t:"The supermarket's having a big sale on paper towels this week."},{s:y,t:"Really? We should stock up. We're almost out."},{s:x,t:"I'll grab a few packs on my way home."},{s:y,t:`Great. Could you pick up some ${it[0]} while you're there?`},{s:x,t:"Sure, no problem."}],
        q: `What did the ${g(y)} ask the ${g(x)} to buy besides paper towels?`, accept: it[1], model: cap(it[0]) + "."}; }},
    {id:"HC-flying", make(){ const [x, y] = voices(2), pr = pick(["phone cases","winter jackets","rice cookers","wireless earphones"]), n = pick([200,300,500]);
      return {sig: pr, lines: [{s:x,t:`How are the new ${pr} selling?`},{s:y,t:`They're flying out the door. We've sold almost ${num(n)} this week.`},{s:x,t:"Then we'd better order more before the weekend."},{s:y,t:"I'll call the supplier this afternoon."}],
        q: `Why will the ${g(y)} call the supplier?`, accept: ["order more","more","selling","sell","stock","run out"], model: "To order more, because they're selling very quickly."}; }},
    {id:"HC-run", make(){ const [x, y] = voices(2), it = pick([["umbrellas","the storm warning came out"],["bottled water","the news said the water would be shut off"],["face masks","the pollen forecast came out"]]), d = pick(DAYS);
      return {sig: it[0], lines: [{s:x,t:`Why are all the ${it[0]} gone?`},{s:y,t:`There was a run on them this morning when ${it[1]}.`},{s:x,t:"Do you have any more in the back?"},{s:y,t:`Sorry, we won't get any more until ${d}.`}],
        q: `Why are there no ${it[0]} left?`, accept: ["run","bought","everyone","storm","news","forecast","warning","sold"], model: `Because a lot of people bought them after ${it[1]}.`}; }},
    {id:"HC-reason", make(){ const [x, y] = voices(2), n = pick([100,150,200,250]);
      return {sig: "within" + n, lines: [{s:x,t:"Can I order whatever I want for the team lunch?"},{s:y,t:`Within reason. Just don't spend more than ${num(n)} dollars.`},{s:x,t:"So ordering sushi for everyone is out?"},{s:y,t:"Probably. Maybe sandwiches and salad instead."}],
        q: `What limit did the ${g(y)} give?`, accept: [...numAcc(n), "dollar","budget"], model: `Not to spend more than ${num(n)} dollars.`}; }},
    {id:"HC-raincheck", make(){ const [x, y] = voices(2), d = pick(DAYS.slice(0, 5)), why = pick([["I have to finish a report tonight",["report","finish","work"]],["my sister's visiting tonight",["sister","visit"]],["I'm completely worn out",["tired","worn","exhaust"]]]);
      return {sig: why[0] + d, lines: [{s:x,t:"Do you want to grab dinner after work?"},{s:y,t:`I'd love to, but can I take a rain check? ${why[0][0].toUpperCase() + why[0].slice(1)}.`},{s:x,t:`Sure. How about ${d}?`},{s:y,t:`${d} works for me.`}],
        q: `Why did the ${g(y)} say no to dinner tonight?`, accept: why[1], model: `Because ${why[0].replace(/^I have/, g(y) === "man" ? "he has" : "she has").replace(/^my/, g(y) === "man" ? "his" : "her").replace(/^I'm/, g(y) === "man" ? "he's" : "she's")}.`}; }},
    {id:"HC-swamped", make(){ const [x, y] = voices(2), nm = pick(NAMES_W);
      return {sig: nm, lines: [{s:x,t:"Could you look over my slides before the meeting?"},{s:y,t:"I'm swamped right now. Can it wait until after lunch?"},{s:x,t:"The meeting's at one, so not really."},{s:y,t:`Then ask ${nm}. She's free this morning.`},{s:x,t:"Good idea. Thanks."}],
        q: `Who does the ${g(y)} suggest asking?`, accept: [nm.toLowerCase()], model: nm + "."}; }},
    {id:"HC-fence", make(){ const [x, y] = voices(2), c = pick(CITY);
      return {sig: c, lines: [{s:x,t:`Are you going to take the job in ${c}?`},{s:y,t:"I'm on the fence. The pay is better, but I'd have to move."},{s:x,t:"When do you have to decide?"},{s:y,t:"By the end of the week. I want to talk it over with my family first."}],
        q: `Why hasn't the ${g(y)} decided yet?`, accept: ["move","moving","family","talk"], model: `Because ${g(y) === "man" ? "he" : "she"} would have to move.`}; }},
    {id:"HC-ballpark", make(){ const [x, y] = voices(2), n = pick([200,300,400,500]), thing = pick(["washing machine","laptop","car stereo","dishwasher"]);
      return {sig: thing + n, lines: [{s:x,t:`Can you give me a ballpark figure for fixing my ${thing}?`},{s:y,t:`Somewhere around ${num(n)} dollars, but I'll know more after I open it up.`},{s:x,t:"Hmm, that's more than I was hoping for."},{s:y,t:"I could use a second-hand part. That would bring it down a bit."}],
        q: `How could the ${g(y)} lower the cost?`, accept: ["second hand","secondhand","used","part"], model: "By using a second-hand part."}; }},
    {id:"HC-lastminute", make(){ const [x, y] = voices(2), alt = pick([["the bakery downstairs","sandwiches and coffee",["sandwich","coffee"]],["the pizza place next door","pizza and salad",["pizza","salad"]],["the café across the street","pastries and tea",["pastr","tea"]]]);
      return {sig: alt[0], lines: [{s:x,t:"The caterer just canceled for tomorrow's event."},{s:y,t:"At the last minute? What are we going to do?"},{s:x,t:`I called ${alt[0]}. They can do ${alt[1]}.`},{s:y,t:"That'll have to do. Thanks for handling it."}],
        q: "What will they serve at the event?", accept: alt[2], model: cap(alt[1]) + "."}; }},
    {id:"HC-soldout", make(){ const [x, y] = voices(2), d = pick(DAYS.slice(4)), t = pick([["two",2],["three",3],["four",4]]);
      return {sig: d + t[0], lines: [{s:x,t:`I'd like two tickets for ${d} night's show, please.`},{s:y,t:"I'm sorry, that one's sold out. I can put you on the waiting list."},{s:x,t:"Is there anything earlier in the day?"},{s:y,t:`Yes, we have a few seats left for the ${t[0]} o'clock show.`},{s:x,t:"I'll take those, then."}],
        q: `What did the ${g(x)} finally buy?`, accept: [t[0], String(t[1]), "afternoon","earlier"], model: `Two tickets for the ${t[0]} o'clock show.`}; }},
    {id:"HC-shop3", make(){ const [x, y, z] = voices(3), why = pick([["my car's in the shop",["car","shop","repair"]],["I've got a dentist appointment",["dentist"]],["I'm stuck in a meeting until four",["meeting"]]]);
      return {sig: why[0], lines: [{s:x,t:"Who's going to pick up the client at the airport?"},{s:y,t:`I would, but ${why[0]}.`},{s:z,t:"I can do it if someone covers my two o'clock call."},{s:x,t:"I'll take your call, then."}],
        q: `Why can't the ${g(y)} go to the airport?`, accept: why[1], model: `Because ${why[0].replace(/^my/, g(y) === "man" ? "his" : "her").replace(/^I've got/, g(y) === "man" ? "he has" : "she has").replace(/^I'm/, g(y) === "man" ? "he's" : "she's")}.`}; }},
    {id:"HC-headsup", make(){ const [x, y] = voices(2), what = pick([["the elevator","be out of service",["elevator"]],["the water","be shut off",["water"]],["the internet","be down",["internet","wifi","network"]]]);
      return {sig: what[0], lines: [{s:x,t:`Just a heads-up: ${what[0]} will ${what[1]} tomorrow.`},{s:y,t:"All day?"},{s:x,t:"From nine to three. They're doing some repairs."},{s:y,t:"Then I'd better move my deliveries to the afternoon."}],
        q: `Why did the ${g(x)} talk to the ${g(y)}?`, accept: [...what[2], "warn","tell","heads up","repair"], model: `To warn ${g(y) === "man" ? "him" : "her"} that ${what[0]} will ${what[1]} tomorrow.`}; }},
    {id:"HC-alt", make(){ const [x, y] = voices(2), d = pick(DAYS), st = pick(["downtown","airport","station"]);
      return {sig: d + st, lines: [{s:x,t:"Do you have this jacket in a medium?"},{s:y,t:"We're out of mediums, but we can order one. It'd take about a week."},{s:x,t:`I need it for a trip on ${d}.`},{s:y,t:`Then let me call our ${st} store and see if they have one.`}],
        q: `What will the ${g(y)} do next?`, accept: ["call","check","other store","another store", st], model: `Call the ${st} store to check.`}; }},
    {id:"HC-treat", make(){ const [x, y] = voices(2), aft = pick([["coffee",["coffee"]],["dessert",["dessert"]],["the taxi home",["taxi"]]]);
      return {sig: aft[0], lines: [{s:x,t:"Should we split the bill?"},{s:y,t:"No, this one's on me. You paid last time."},{s:x,t:`That's kind of you. Then I'll get ${aft[0]}.`},{s:y,t:"Deal."}],
        q: `Why does the ${g(y)} want to pay?`, accept: ["paid last time","last time"], model: `Because the ${g(x)} paid last time.`}; }},
  ];

  /* ---------- Part D: 6–8 sentence stories, three questions ---------- */
  const D = [
    {id:"HD-bike", make(){ const P = P3(), y = int(5, 12);
      return {sig: P.name + y, passage: `${P.name} had ridden ${P.his} trusty old bicycle to work for ${num(y)} years. One morning, the chain broke on the way, and ${P.he} arrived an hour late. ${P.His} coworkers tried to convince ${P.him} to buy a new one. However, ${P.his} finances were tight that month. Instead, ${P.he} watched a few videos and fixed the chain ${P.himself}. It took ${P.him} the whole weekend, but it worked. ${P.He} felt so proud that ${P.he} started fixing ${P.his} friends' bikes for free.`,
        qs: [{q: `What caused ${P.name} to be late?`, accept: ["chain","broke","bike"], model: `The chain on ${P.his} bike broke.`},
             {q: `Why didn't ${P.name} buy a new bike?`, accept: ["money","finances","tight","afford","expensive"], model: `Because ${P.his} finances were tight.`},
             {q: `How did ${P.name} feel after fixing it?`, accept: ["proud"], model: "Proud."}]};
    }},
    {id:"HD-offer", make(){ const P = P3(), c = pick(CITY);
      return {sig: P.name + c, passage: `${P.name} received a job offer from a large company in ${c}. The salary was much higher, and ${P.he} was tempted to accept it right away. However, ${P.he} would have to move far away from ${P.his} elderly parents. After talking it over with ${P.his} family for several nights, ${P.he} politely declined the offer. A month later, ${P.his} current boss gave ${P.him} a promotion and a raise. ${P.He} was glad ${P.he} had stayed.`,
        qs: [{q: `What made the offer tempting?`, accept: ["salary","pay","money","higher"], model: "The salary was much higher."},
             {q: `Why did ${P.name} decline the offer?`, accept: ["parents","move","family"], model: `Because ${P.he} would have to move away from ${P.his} parents.`},
             {q: `What happened a month later?`, accept: ["promotion","promoted","raise"], model: `${P.He} got a promotion and a raise.`}]};
    }},
    {id:"HD-marathon", make(){ const P = P3(), m = pick(MONTHS);
      return {sig: P.name + m, passage: `${P.name} had never run more than five kilometers. Then a friend convinced ${P.him} to sign up for a half marathon in ${m}. At first, ${P.he} trained hard, but after three weeks ${P.he} hurt ${P.his} knee. ${P.His} doctor told ${P.him} to rest, so ${P.he} switched to swimming to stay fit. On race day, ${P.his} knee still hurt a little. Instead of quitting, ${P.he} walked part of the course. ${P.He} finished last, but ${P.he} was proud that ${P.he} hadn't given up.`,
        qs: [{q: `Who persuaded ${P.name} to sign up?`, accept: ["friend"], model: "A friend."},
             {q: `What caused ${P.name} to stop running for a while?`, accept: ["knee","hurt","injur"], model: `${P.He} hurt ${P.his} knee.`},
             {q: `How did ${P.name} feel at the end of the race?`, accept: ["proud"], model: "Proud."}]};
    }},
    {id:"HD-bakery", make(){ const P = P3(), food = pick(["cinnamon rolls","croissants","fruit tarts","bagels"]);
      return {sig: P.name + food, passage: `${P.name} had always dreamed of opening a small bakery. Because ${P.his} finances were tight, ${P.he} applied for a bank loan, but the bank declined it. Instead of giving up, ${P.he} started selling bread at a weekend market. ${P.His} ${food} became so popular that they often sold out by ten. After a year, ${P.he} had saved enough to rent a small shop. On opening day, a line of regular customers was waiting outside.`,
        qs: [{q: `What happened when ${P.name} applied for a loan?`, accept: ["declined","refused","rejected","said no","didn't","turned down"], model: "The bank declined it."},
             {q: `How did ${P.name} save enough money?`, accept: ["market","selling","sold","bread"], model: `By selling bread at a weekend market.`},
             {q: "Who was waiting outside on opening day?", accept: ["customer","regular"], model: "A line of regular customers."}]};
    }},
    {id:"HD-umbrella", make(){ const P = P3();
      return {sig: P.name, passage: `${P.name} was walking to a job interview when it started to pour. At a bus stop, ${P.he} noticed an elderly man without an umbrella. Although ${P.he} was tempted to keep ${P.his} trusty umbrella, ${P.he} handed it to the man and ran the rest of the way. ${P.He} arrived soaking wet and felt embarrassed. When the interview began, ${P.he} was surprised to see the same man sitting at the table. He turned out to be the company's president, and he offered ${P.name} the job.`,
        qs: [{q: `Why did ${P.name} arrive wet?`, accept: ["umbrella","gave","rain","handed"], model: `Because ${P.he} gave ${P.his} umbrella to an elderly man.`},
             {q: `How did ${P.name} feel when ${P.he} arrived?`, accept: ["embarrass"], model: "Embarrassed."},
             {q: "Who was the man at the bus stop?", accept: ["president","boss","head"], model: "The company's president."}]};
    }},
    {id:"HD-drums", make(){ const P = P3(), t = pick([["eight",8],["nine",9]]);
      return {sig: P.name + t[0], passage: `${P.name}'s new neighbor practiced the drums every evening. At first, ${P.name} tried to ignore it, but ${P.he} couldn't get to sleep before work. ${P.He} was tempted to complain to the landlord, but ${P.he} decided to talk to the neighbor first. The neighbor apologized and explained that he was preparing for an important audition. They agreed that he would only practice until ${t[0]}. A month later, the neighbor invited ${P.name} to his first concert.`,
        qs: [{q: `What caused ${P.name}'s problem?`, accept: ["drum","noise","practic"], model: "The neighbor practiced the drums every evening."},
             {q: "Why was the neighbor practicing so much?", accept: ["audition"], model: "He was preparing for an audition."},
             {q: "What did they agree on?", accept: [t[0], String(t[1]), "until"], model: `That he would only practice until ${t[0]}.`}]};
    }},
    {id:"HD-car", make(){ const P = P3(), age = pick([8,10,12]);
      return {sig: P.name + age, passage: `${P.name} needed a car for ${P.his} new job, but ${P.his} finances were tight. A salesperson tried to convince ${P.him} to buy a new model with lots of extras. ${P.He} was tempted, but ${P.he} declined and searched online for a used car instead. ${P.He} found a ${num(age)}-year-old car in good condition for a third of the price. A friend who was a mechanic checked it and said it was reliable. ${P.He} still drives it to work every day.`,
        qs: [{q: `Why didn't ${P.name} buy the new model?`, accept: ["tight","money","finances","expensive","afford"], model: `Because ${P.his} finances were tight.`},
             {q: `Where did ${P.name} find the car ${P.he} bought?`, accept: ["online","internet","web"], model: "Online."},
             {q: "Who checked the car?", accept: ["mechanic","friend"], model: "A friend who was a mechanic."}]};
    }},
    {id:"HD-volunteer", make(){ const P = P3(), d = pick(DAYS.slice(0, 5));
      return {sig: P.name + d, passage: `${P.name} was convinced that ${P.he} was too busy to volunteer. Then ${P.his} daughter's school asked parents to help with a reading program. ${P.He} reluctantly agreed to come for one hour on ${d}s. At first, ${P.he} checked ${P.his} phone the whole time. But one boy who had never enjoyed reading started asking ${P.him} for more books. After six months, ${P.name} found it was the most relaxing hour of ${P.his} week.`,
        qs: [{q: "What did the school ask parents to do?", accept: ["read","reading","help"], model: "To help with a reading program."},
             {q: `How did ${P.name} feel about volunteering at first?`, accept: ["reluctant","busy","didn't want","unwilling","not"], model: "Reluctant."},
             {q: `What changed ${P.name}'s feelings?`, accept: ["boy","book","enjoy"], model: "A boy who disliked reading started asking for more books."}]};
    }},
  ];

  /* ---------- Part E: 6–8 sentences with a twist ---------- */
  const E = [
    {id:"HE-lottery", make(){ const P = P3();
      return {sig: P.name, passage: `${P.name} bought a lottery ticket for the first time and put it in the pocket of an old jacket. A week later, ${P.he} gave the jacket to a charity shop without thinking. When the winning numbers were announced, ${P.he} realized ${P.his} ticket might be a winner. ${P.He} rushed to the shop, but the jacket had already been sold. That evening, a young woman knocked on ${P.his} door holding the ticket. She had found ${P.his} address on a receipt in the same pocket. The ticket had only won ten dollars, but the two of them became good friends.`,
        keys: {"人物": [P.name.toLowerCase()], "きっかけ（宝くじ・上着を寄付）": ["lottery","ticket","jacket","charity"], "行動（店へ急いだ）": ["shop","rush","went","sold"], "ひねり（女性が届けた）": ["woman","brought","returned","door","receipt"], "結果（10ドル・友達に）": ["ten dollars","ten","friend"]},
        model: `This story is about ${P.name}. ${P.He} left a lottery ticket in a jacket and gave the jacket to a charity shop. Then ${P.he} rushed to the shop, but the jacket was already sold. In the end, a woman brought the ticket back. It only won ten dollars, but they became friends.`};
    }},
    {id:"HE-contest", make(){ const P = P3(), dish = pick(["apple pie","curry","chocolate cake","tomato soup"]), miss = pick([["sugar","less sweet"],["salt","lighter"]]);
      return {sig: P.name + dish, passage: `${P.name} entered a local cooking contest with ${P.his} grandmother's ${dish} recipe. ${P.He} practiced it every weekend for two months. On the day of the contest, ${P.he} was so nervous that ${P.he} forgot to add the ${miss[0]}. ${P.He} only noticed when the judges were already tasting it. ${P.He} was sure ${P.he} had lost. To ${P.his} surprise, the judges said the ${miss[1]} taste was refreshing. They gave ${P.him} first prize.`,
        keys: {"人物": [P.name.toLowerCase()], "きっかけ（料理コンテスト）": ["contest","competition","grandmother","recipe"], "問題（◯◯を入れ忘れた）": [miss[0], "forgot"], "ひねり（審査員が気に入った）": ["judge","refresh","liked","loved"], "結果（優勝）": ["first prize","won","win","first"]},
        model: `This story is about ${P.name}. ${P.He} entered a cooking contest with ${P.his} grandmother's recipe. But ${P.he} was nervous and forgot to add the ${miss[0]}. In the end, the judges liked the ${miss[1]} taste, and ${P.he} won first prize.`};
    }},
    {id:"HE-flight", make(){ const P = P3(), c = pick(CITY);
      return {sig: P.name + c, passage: `${P.name} was flying to a conference in ${c} to meet a potential client. ${P.His} taxi got stuck in traffic, and ${P.he} missed ${P.his} flight. ${P.He} was upset because ${P.he} would now miss the meeting. ${P.He} booked a later flight and took the last seat on the plane. The man sitting next to ${P.him} turned out to be the head of a company looking for a partner. They talked for the whole flight. By the time they landed, ${P.name} had a new client, even bigger than the one ${P.he} had planned to meet.`,
        keys: {"人物": [P.name.toLowerCase()], "問題（渋滞で乗り遅れた）": ["missed","traffic","late"], "行動（遅い便に乗った）": ["later flight","next flight","booked","another flight"], "ひねり（隣の人が会社のトップ）": ["next to","man","head","boss","company"], "結果（新しい顧客）": ["client","customer","deal"]},
        model: `This story is about ${P.name}. ${P.He} missed ${P.his} flight to a conference because of traffic. Then ${P.he} took a later flight, and the man next to ${P.him} was the head of a company. In the end, ${P.he} got an even bigger new client.`};
    }},
    {id:"HE-seeds", make(){ const P = P3(), fl = pick(["sunflowers","tomatoes","pumpkins"]);
      return {sig: P.name + fl, passage: `${P.name} planted ${fl} in ${P.his} small garden in the spring. ${P.He} watered them every day, but nothing came up. After two months, ${P.he} gave up and planted grass instead. In the summer, ${P.his} neighbor knocked on the door with a big smile. ${fl[0].toUpperCase() + fl.slice(1)} were growing all over the neighbor's yard. A strong wind had carried the seeds over the fence. The neighbor invited ${P.name} to help harvest them, and they shared the results.`,
        keys: {"人物": [P.name.toLowerCase()], "問題（芽が出なかった）": ["nothing","didn't grow","not grow","gave up"], "行動（あきらめて芝生）": ["grass","gave up"], "ひねり（隣の庭に生えた・風）": ["neighbor","neighbour","wind","fence"], "結果（一緒に収穫）": ["harvest","share","together"]},
        model: `This story is about ${P.name}. ${P.He} planted ${fl}, but nothing grew, so ${P.he} gave up. Then the ${fl} grew in the neighbor's yard because the wind had carried the seeds. In the end, they harvested and shared them together.`};
    }},
    {id:"HE-gps", make(){ const P = P3();
      return {sig: P.name, passage: `${P.name} was driving to a friend's wedding in a town ${P.he} had never visited. ${P.He} followed ${P.his} GPS, but it took ${P.him} to the wrong church. A wedding was starting there too, so ${P.he} quietly sat down at the back. Halfway through, ${P.he} realized ${P.he} didn't know anyone. ${P.He} slipped out and drove to the right church across town. ${P.He} arrived just in time for the cake. ${P.His} friend laughed and said it was the best excuse ${P.he} had ever heard.`,
        keys: {"人物": [P.name.toLowerCase()], "問題（GPSで違う教会へ）": ["wrong","gps","church"], "行動（別の結婚式に座った・抜け出した）": ["sat","another wedding","slipped","left"], "結果（ケーキに間に合った）": ["cake","in time","right church"], "オチ（友人が笑った）": ["laugh","excuse"]},
        model: `This story is about ${P.name}. ${P.His} GPS took ${P.him} to the wrong church, where another wedding was starting. Then ${P.he} realized ${P.he} didn't know anyone and drove to the right church. In the end, ${P.he} arrived in time for the cake, and ${P.his} friend laughed.`};
    }},
    {id:"HE-dog", make(){ const P = P3(), pet = pick(["dog","puppy"]);
      return {sig: P.name + pet, passage: `${P.name}'s ${pet} kept barking in the middle of the night. ${P.He} was annoyed because ${P.he} couldn't sleep, and ${P.he} even thought about giving the ${pet} to a friend. One night, the barking was louder than ever, so ${P.he} got up to see what was wrong. ${P.He} smelled smoke coming from the apartment next door. ${P.He} called the fire department and woke up the neighbors. Everyone got out safely. After that, the neighbors brought treats for the ${pet} every week.`,
        keys: {"人物": [P.name.toLowerCase()], "問題（夜中に吠える）": ["bark","sleep","annoy"], "きっかけ（煙のにおい）": ["smoke","fire"], "行動（消防に電話・起こした）": ["called","fire department","woke"], "結果（全員無事・ご褒美）": ["safe","treat","saved"]},
        model: `This story is about ${P.name}. ${P.His} ${pet} kept barking at night, and ${P.he} was annoyed. Then one night ${P.he} smelled smoke next door and called the fire department. In the end, everyone was safe, and the neighbors brought the ${pet} treats.`};
    }},
    {id:"HE-movers", make(){ const P = P3(), c = pick(CITY);
      return {sig: P.name + c, passage: `${P.name} moved to ${c} and hired the cheapest moving company ${P.he} could find. When the boxes arrived, the one with ${P.his} family photos was missing. The company said they had no idea where it was. ${P.name} was heartbroken and thought the photos were gone forever. Three months later, a package arrived from a stranger. The stranger had found the box in a storage room and saw ${P.name}'s name on one of the photos. ${P.He} sent the stranger a thank-you letter and a gift.`,
        keys: {"人物": [P.name.toLowerCase()], "問題（写真の箱がなくなった）": ["photo","box","missing","lost"], "きっかけ（安い引っ越し業者）": ["cheap","moving","company"], "ひねり（他人が送ってくれた）": ["stranger","package","sent","found"], "結果（お礼の手紙）": ["thank","letter","gift"]},
        model: `This story is about ${P.name}. ${P.He} moved with a cheap moving company, and the box with ${P.his} family photos went missing. Three months later, a stranger found it and sent it back. In the end, ${P.he} sent the stranger a thank-you letter and a gift.`};
    }},
    {id:"HE-tickets", make(){ const P = P3(), h = pick([4,5,6]);
      return {sig: P.name + h, passage: `${P.name} waited in line for ${num(h)} hours to buy tickets for ${P.his} favorite band. Just before ${P.his} turn, the staff announced that the concert was sold out. ${P.He} was about to go home when the person behind ${P.him} tapped ${P.his} shoulder. She said her friend couldn't come and offered ${P.him} an extra ticket at the normal price. ${P.name} gladly paid her. At the concert, ${P.he} found that the seat was in the very first row.`,
        keys: {"人物": [P.name.toLowerCase()], "問題（売り切れ）": ["sold out","sold"], "きっかけ（◯時間並んだ）": [num(h), "hours","line","waited"], "ひねり（後ろの人が余りの券）": ["extra","behind","woman","offered"], "結果（最前列）": ["first row","front"]},
        model: `This story is about ${P.name}. ${P.He} waited ${num(h)} hours for concert tickets, but they sold out. Then the woman behind ${P.him} offered ${P.him} an extra ticket. In the end, the seat was in the very first row.`};
    }},
  ];

  /* ---------- Part F: opinions (40 s) ---------- */
  const OPIN = [
    ["Some people think it's better to save money for the future, while others think it's better to enjoy it now. What do you think, and why?","saving for the future is better","unexpected costs can come up anytime","it gives me peace of mind","my car broke down last year, and my savings helped"],
    ["Do you think it's better to have one career for life or to change careers several times? Why?","changing careers is better","people can keep learning new skills","they can find work that really suits them","a friend of mine moved from sales to design and is much happier"],
    ["Should companies let employees choose where they work, at home or in the office? Why or why not?","letting employees choose is better","people know where they work best","it improves morale","some people focus better at home, while others need a team around them"],
    ["Is it better to learn from your own mistakes or from other people's advice? Why?","learning from my own mistakes is better","I remember the lesson more clearly","I understand the reasons more deeply","I only learned to manage my time after missing a deadline"],
    ["Do you think technology makes people's lives easier or more stressful? Why?","technology makes life easier","it saves time on everyday tasks","it keeps us connected with people far away","I can pay bills and book trips on my phone in minutes"],
    ["Should young people live with their parents until they get married? Why or why not?","living on your own first is better","young people learn to be independent","they learn how to manage money","cooking and paying rent taught me a lot"],
    ["Is it more important to have a high salary or to enjoy your job? Why?","enjoying your job is more important","you spend most of your day at work","people who enjoy their work do it better","I'd rather earn a little less and look forward to Mondays"],
    ["Do you prefer making plans in advance or deciding things at the last minute? Why?","making plans in advance is better","it reduces stress","I can get better prices","booking a hotel early is often much cheaper"],
  ];
  const F = [
    {id:"HF-opin", make(){ const p = pick(OPIN);
      return {sig: p[0], q: p[0], model: `I think ${p[1]}, for two reasons. First, ${p[2]}. For example, ${p[4]}. Second, ${p[3]}. That's why I think ${p[1]}.`}; }},
  ];

  /* ---------- S: unscored speech sample at the start ---------- */
  const SPEECH = ["Talk about a skill you would like to learn, and explain why.","Describe a place you like to visit on weekends.",
    "Talk about a person who has helped you in your career.","Describe a challenge you faced at work and how you handled it.",
    "Talk about a movie that changed the way you think about something.","Describe your ideal vacation.",
    "Talk about something you learned from a mistake.","Describe a tradition from your country that you enjoy.",
    "Talk about a goal you are working toward right now.","Describe a teacher you remember well, and explain why.",
    "Talk about the best piece of advice you have ever received.","Describe a typical day at your job.",
    "Talk about a hobby you would recommend to a friend.","Describe a city you would like to live in someday."];
  const S = [{id:"HS-speech", make(){ const q = pick(SPEECH); return {sig: q, q, model: ""}; }}];

  return {A, B, C, D, E, F, S};
});
})(typeof VGen !== "undefined" ? VGen : require("./gen.js"));
