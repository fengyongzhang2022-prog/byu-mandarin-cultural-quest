export const runtime = "edge";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const FACTS = `
【本任务可使用的事实】
1. 小西天原名千佛庵，位于山西省临汾市隰县。
2. 大雄宝殿面积约169.6平方米，保存1978尊明代悬塑。
3. 《黑神话：悟空》公布的36处国内取景地中，27处位于山西；小西天的建筑和彩塑进入游戏视觉世界。
4. 游戏上线前，小西天日均游客约300至400人；2024年国庆假期日均超过1万人。
5. 2024年当地组织工作专班和志愿者，实行线上预约、分时售票、每日接待上限、单向游线、停车与接驳等措施。
6. 2026年小西天核心区域使用微环境监测系统，监测温湿度、人群密度和二氧化碳浓度。
7. Yosemite游客进入管理关注拥挤、交通、公平进入、自然与文化资源保护以及游客体验。
8. 六张学习者方案卡：分时预约、延长开放时间、数字小西天、核心区外游戏打卡区、停车与接驳、社区共同参与。

【事实边界】
文保人员、青年志愿者、Alex和Mia均为教学角色。回答只能使用上述事实和学习者已经说过的观点。材料没有提供的信息，要明确说“现有材料没有给出这个信息”，再提出一个可以继续讨论的问题。
`;

const PROMPTS = {
  alex: `你扮演美国男大学生Alex。他玩过《黑神话：悟空》，因为游戏来到小西天，开始时只把这里看成游戏地点。你与Intermediate High–Advanced Low中文学习者进行连续语音对话。优先从学习者已经选择的看图发现追问具体细节，再逐步引导他说明真实文物、游戏传播、游客变化和参观责任。不要问“你最喜欢哪一部分”，也不要要求学习者回忆没有看过的画面。每轮先自然回应，再提出一个有真实信息差的问题。每轮20至42个汉字，使用常见词和短句，不做整段讲解。`,
  guard: `你扮演小西天文保人员，这是一个基于公开事实设计的教学角色。你关心悬塑、核心空间、人流与微环境。先回应学习者的三项措施，再指出一个具体风险，最后问“如果……怎么办？”或“哪一项先做，为什么？”每轮24至48个汉字。帮助学习者用因果和证据修订方案。`,
  volunteer: `你扮演隰县青年志愿者，这是一个基于公开事实设计的教学角色。你关心游客体验、居民参与、县城发展和古寺保护。先回应学习者的方案，再补充一个被忽略的利益相关者，最后问一个需要协商的问题。每轮24至48个汉字。`,
  compare: `你扮演美国Yosemite国家公园志愿者Mia。与中文学习者比较Yosemite游客进入管理和小西天。每轮先确认一个有效相似点，再追问一个差异或类比边界。引导学习者使用“都……；小西天……而Yosemite……；这个比较能帮助……但不能说明……”等表达。每轮24至48个汉字。`,
  feedback: `你是中文口语教练。根据学习者关于小西天的文化解释，只给一条能在20至30秒补说中立即使用的建议。优先检查：是否用了两个事实、是否解释因果、三项措施是否平衡文物/游客/社区、比较是否有边界。总计不超过46个汉字，并给出半句口语支架。`,
  story: `你是文化故事整理伙伴。把学习者的讲述整理成四段简短中文：【原来】古寺与文化遗产；【后来】游戏与游客变化；【因此】矛盾和三项方案；【现在】有边界的跨文化理解。保留学习者观点，使用IH–AL可理解的中文，总计130至190个汉字。`,
};

function clean(value, max = 1200) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-10).map((item) => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: clean(item?.content, 500),
  })).filter((item) => item.content);
}

function fallback(stage, role) {
  if (stage === "feedback") return "补充一个因果句：因此，我们先……，这样既保护文物，也改善游客体验。";
  if (stage === "story") return "【原来】小西天保存着珍贵的明代悬塑。【后来】游戏让更多人看见古寺，游客也迅速增加。【因此】开放、保护与县城发展需要一起考虑。【现在】预约、分流、社区参与和数字展示可以相互配合，让古寺在当代获得新的生命。";
  if (stage === "alex") return "我开始明白实景比游戏画面更丰富了。你会用哪个数字提醒游客？";
  if (stage === "compare") return "这个相似点很清楚。两地的空间和文化意义有什么不能直接等同？";
  return role === "volunteer"
    ? "这三项措施怎样让当地青年和居民一起参与，而不只服务游客？"
    : "如果核心空间同时进入很多人，你的方案先用哪一项降低风险？";
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const stage = clean(body?.stage, 24);
  const role = clean(body?.role, 24);
  const promptKey = stage === "stakeholder" ? (role === "volunteer" ? "volunteer" : "guard") : stage;
  const systemPrompt = PROMPTS[promptKey];
  if (!systemPrompt) return Response.json({ error: "Unknown stage" }, { status: 400 });

  const message = clean(body?.message, 1000);
  const plans = Array.isArray(body?.plans) ? body.plans.map((x) => clean(x, 30)).slice(0, 3) : [];
  const observations = body?.observations && typeof body.observations === "object"
    ? Object.entries(body.observations).slice(0, 3).map(([key, value]) => `${clean(key, 20)}：${clean(value, 80)}`)
    : [];
  const axisNames = { crowd: "游客拥挤与交通", protect: "资源保护", access: "公平进入与体验" };
  const comparisonAxis = axisNames[clean(body?.comparisonAxis, 20)] || "";
  const context = [
    plans.length ? `学习者选择的方案代码：${plans.join("、")}` : "",
    observations.length ? `学习者已经完成的看图发现：${observations.join("；")}` : "",
    comparisonAxis ? `学习者选择的比较角度：${comparisonAxis}` : "",
  ].filter(Boolean).map((x) => `\n${x}`).join("");
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return Response.json({ reply: fallback(stage, role), source: "fallback" });

  try {
    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: stage === "feedback" ? 0.25 : 0.55,
        max_tokens: stage === "story" ? 320 : 150,
        messages: [
          { role: "system", content: `${FACTS}\n${systemPrompt}${context}` },
          ...cleanHistory(body?.history),
          { role: "user", content: message || "请根据本任务事实继续。" },
        ],
      }),
    });
    if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
    const data = await response.json();
    const reply = clean(data?.choices?.[0]?.message?.content, stage === "story" ? 1200 : 500);
    return Response.json({ reply: reply || fallback(stage, role), source: "deepseek" });
  } catch {
    return Response.json({ reply: fallback(stage, role), source: "fallback" });
  }
}
