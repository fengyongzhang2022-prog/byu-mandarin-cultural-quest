export const runtime = "edge";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const FACTS = `
【文化材料】
1. 袈裟是佛教出家人的服饰，可连接修行身份、朴素与少欲的提醒。
2. 早期佛教传统中的粪扫衣可由弃布清洗后缝成；拼接外观可提示朴素与节制。
3. 《西游记》把唐僧的锦襕袈裟写成缀有珍宝的特殊宝衣。
4. 金池长老已经收藏许多袈裟，看见锦襕袈裟后仍想占有；占有欲推动藏留与纵火。
5. 黑熊精趁火取走袈裟，并把它当作值得展示的宝物。
6. 游戏中的人物和场景属于改编叙事；文化事实来自标明来源的教学材料。
7. 跨文化比较可使用牛仔裤、限量运动鞋、棒球帽或学习者自选物件。比较轴包括原来功能、后来意义、身份、价格和行动后果。
`;

const PROMPTS = {
  interact: `你扮演《黑神话：悟空》中的金池长老，与美国大学Intermediate High–Advanced Low中文学习者进行连续语音对话。你的声音感是苍老、缓慢、克制，心里仍放不下锦襕袈裟。每轮先回应学习者刚说的内容，再问一个自然的问题。问题围绕收藏、身份、他人眼光、喜欢、占有和后果。每轮总计20至38个汉字。使用常见词和短句。学习者追问时直接回答，并把矛盾继续推向前。`,
  compare: `你扮演《黑神话：悟空》中的黑熊精，与美国大学Intermediate High–Advanced Low中文学习者协商。你说话低沉、直接、略带不服，认为宝物可以归强者。每轮先回应学习者的一点，再问一个问题。围绕物的价值、拥有资格、行动后果和跨文化物件展开。学习者使用证据后，你可以逐步改口。每轮总计20至38个汉字。`,
  feedback: `你是中文口语教练。阅读学习者关于袈裟的文化解释，给一条能立即用于补说的建议。建议聚焦证据、因果、比较边界或段落连接；总计不超过38个汉字，并提供半句口语支架。`,
  story: `你是文化故事整理伙伴。把学习者关于袈裟的解释整理成三段中文：【这件衣服】一句；【人物与行动】一至两句；【我的理解】一句。保留学习者观点，使用常见词，总计100至150个汉字。`,
};

function clean(value, max = 800) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function history(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-10).map((item) => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: clean(item?.content, 500),
  })).filter((item) => item.content);
}

function key(value) {
  const raw = String(value || "").trim();
  return raw.match(/sk-[A-Za-z0-9_-]+/)?.[0] || raw;
}

function fallback(stage, message, turns = []) {
  const text = clean(message, 500);
  const userTurns = history(turns).filter((item) => item.role === "user").length;
  if (stage === "feedback") {
    if (text.length < 20) return "因果：再说人物做了什么，所以发生了什么。";
    if (!/(因为|所以|因此|结果|后来)/.test(text)) return "因果：补一句“因为……，所以……”。";
    if (!/(牛仔裤|运动鞋|棒球帽|相似|不同|比较)/.test(text)) return "比较：加入一个熟悉物件，再说一个差异。";
    return "证据：补一句“收藏记录里……”，让判断更清楚。";
  }
  if (stage === "story") {
    return `【这件衣服】${text.slice(0, 55) || "袈裟连接修行身份、珍贵材料和他人的眼光。"}\n【人物与行动】金池长老已经收藏许多袈裟，仍想占有锦襕袈裟；黑熊精又在火中把它取走。\n【我的理解】物会获得价值，人怎样看物也会改变自己的行动。`;
  }
  if (stage === "interact") {
    if (/(很多|收藏)/.test(text)) return "收藏越多，我越怕别人看轻我。你觉得我真正想守住什么？";
    if (/(珍贵|宝物|漂亮)/.test(text)) return "人人看它，我也想让人看我。珍贵是谁说出来的？";
    if (/(欲望|占有|放下)/.test(text)) return "我知道该放下，心里却更想得到。你会怎样劝我？";
    return userTurns ? "你说的是衣服，也是在说看衣服的人。哪一步让我越走越远？" : "记事人，你看见这件袈裟，先看见衣服，还是先看见宝物？";
  }
  if (/(后果|火|伤害)/.test(text)) return "火烧起来以后，宝物还值得拿吗？你用一条证据说服我。";
  if (/(牛仔裤|运动鞋|棒球帽)/.test(text)) return "这个物件也会代表身份。它和袈裟最大的差异在哪里？";
  if (/(价值|珍贵|身份)/.test(text)) return "若价值来自众人的眼光，强者拿走它为什么有错？";
  return userTurns ? "你的解释让我改了一点想法。占有这件衣服改变了谁？" : "人人都说它是宝物，强者拿走它，有什么错？";
}

export async function POST(request) {
  let stage = "interact";
  let message = "";
  let turns = [];
  try {
    const body = await request.json();
    stage = ["interact", "compare", "feedback", "story"].includes(body?.stage) ? body.stage : "interact";
    message = clean(body?.message);
    turns = body?.history;
    if (!message) return Response.json({ error: "没有收到语音转写。" }, { status: 400 });

    const apiKey = key(process.env.DEEPSEEK_API_KEY);
    if (!apiKey) return Response.json({ reply: fallback(stage, message, turns), demo: true });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: .55,
        max_tokens: stage === "story" ? 280 : 120,
        messages: [
          { role: "system", content: `${PROMPTS[stage]}\n${FACTS}\n回应当前话语，保持角色身份和事实边界。` },
          ...(stage === "feedback" || stage === "story" ? [] : history(turns)),
          { role: "user", content: message },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return Response.json({ reply: fallback(stage, message, turns), demo: true });
    const data = await response.json();
    const reply = clean(data?.choices?.[0]?.message?.content, 500) || fallback(stage, message, turns);
    return Response.json({ reply, demo: false });
  } catch {
    return Response.json({ reply: fallback(stage, message, turns), demo: true });
  }
}
