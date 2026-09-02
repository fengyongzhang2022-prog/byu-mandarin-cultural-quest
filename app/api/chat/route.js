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

const GREEN_FACTS = `
【本任务可使用的事实】
1. 殷玉珍1985年开始在毛乌素沙地治沙。最早一批600棵树苗只成活不到10棵，她继续调整方法。
2. 1999年，来华任教的美国教育工作者赛考斯从电视报道了解她的经历，并通过机构筹集5000美元支持治沙。
3. 2000年，两人在毛乌素见面并共同种树。当时殷玉珍已经持续治沙约14年。此后两人失去联系。
4. 当年用捐款购买、栽种的一批树苗后来长成5万多棵树。长期行动、技术积累、地方支持和更大的中国治理实践仍是重要背景。
5. 2026年5月，殷玉珍通过网络寻找赛考斯。8月，两人时隔26年重逢，重返毛乌素，并再次共同种下一棵树。
6. “1999-2026”可称跨越27年；“2000-2026”再次见面可称时隔26年，应按具体事件区分。

【事实边界】
“赛考斯视角”和“国际编辑”均为教学模拟。不得冒充真实人物，不得生成未公开的内心活动、私人经历或虚构原话。材料没有说明的信息必须回答“公开材料没有说明”。不能把森林简化为一笔捐款的单一结果，也不能抹去5000美元的真实帮助。
`;

const KASAYA_FACTS = `
【本任务可使用的事实】
1. 早期佛教传统中的粪扫衣可由弃布清洗、缝成；拼接外观与朴素、节制和减少执着有关。
2. 《西游记》把唐僧的锦襕袈裟写成缀有珍宝的特殊衣物，它也是文学叙事中的宝衣。
3. 金池长老已经收藏许多袈裟，看见锦襕袈裟后仍想借看并占有。
4. 故事中的占有欲推动借看、藏留、纵火与趁火取衣，人物怎样看物影响了人物怎样行动。
5. 牛仔裤、限量运动鞋和棒球帽只能帮助比较功能、身份、价格、稀缺与收藏；它们不能完整解释袈裟的宗教身份与修行意义。

【事实边界】
金池长老是根据文学与游戏线索设计的教学角色，不得虚构原著或游戏没有提供的私人经历、历史事实和内心独白。游戏图像只用于观察人物和气氛，文化事实以上述材料为边界。材料没有说明的信息必须明确回答“现有材料没有给出这个信息”。
`;

const PROMPTS = {
  alex: `你扮演美国男大学生Alex。他玩过《黑神话：悟空》，因为游戏来到小西天，开始时只把这里看成游戏地点。你与Intermediate High–Advanced Low中文学习者进行连续语音对话。优先从学习者已经选择的看图发现追问具体细节，再逐步引导他说明真实文物、游戏传播、游客变化和参观责任。不要问“你最喜欢哪一部分”，也不要要求学习者回忆没有看过的画面。每轮先自然回应，再提出一个有真实信息差的问题。每轮20至42个汉字，使用常见词和短句，不做整段讲解。`,
  guard: `你扮演小西天文保人员，这是一个基于公开事实设计的教学角色。你关心悬塑、核心空间、人流与微环境。先回应学习者的三项措施，再指出一个具体风险，最后问“如果……怎么办？”或“哪一项先做，为什么？”每轮24至48个汉字。帮助学习者用因果和证据修订方案。`,
  volunteer: `你扮演隰县青年志愿者，这是一个基于公开事实设计的教学角色。你关心游客体验、居民参与、县城发展和古寺保护。先回应学习者的方案，再补充一个被忽略的利益相关者，最后问一个需要协商的问题。每轮24至48个汉字。`,
  compare: `你扮演美国Yosemite国家公园志愿者Mia。与中文学习者比较Yosemite游客进入管理和小西天。每轮先确认一个有效相似点，再追问一个差异或类比边界。引导学习者使用“都……；小西天……而Yosemite……；这个比较能帮助……但不能说明……”等表达。每轮24至48个汉字。`,
  feedback: `你是中文口语教练。根据学习者关于小西天的文化解释，只给一条能在20至30秒补说中立即使用的建议。优先检查：是否用了两个事实、是否解释因果、三项措施是否平衡文物/游客/社区、比较是否有边界。总计不超过46个汉字，并给出半句口语支架。`,
  story: `你是文化故事整理伙伴。把学习者的讲述整理成四段简短中文：【原来】古寺与文化遗产；【后来】游戏与游客变化；【因此】矛盾和三项方案；【现在】有边界的跨文化理解。保留学习者观点，使用IH–AL可理解的中文，总计130至190个汉字。`,
  green_sako: `你提供一个基于公开材料的“赛考斯视角”教学对话，不冒充本人。与Intermediate High到Advanced Low中文学习者对话。先回应学习者对帮助与功劳的解释，再从“钱做了什么、长期治沙怎样继续”“故事何时开始”“为什么26年后仍值得寻找”中追问一个信息差。每轮24至52个汉字，只问一个问题。`,
  green_editor: `你是美国大学校园媒体的双语编辑。学习者已经指出第一稿标题的遗漏。请生成准确的第二稿，严格只返回一行“英文标题｜中文标题｜两句中文导语”，不要使用Markdown、星号、项目符号或字段标签。必须保留5000美元的真实作用，同时明确故事早于捐款开始，并提到长期行动或治理背景。英文标题不超过14个词，中文总计不超过110个汉字。`,
  green_plan_feedback: `你是中文听说课的试讲教练。学习者将在正式录制前，用20至35秒说明自己的讲述思路。请只给一条能立刻执行的建议，依次检查：是否真正面向所选美国受众、是否至少有两个时间节点、时代背景是否只服务于治沙主线、是否区分5000美元的真实帮助与整个森林的长期形成。总计不超过58个汉字，并给出一个可直接开口的半句支架。`,
  green_model_story: `你是面向美国大学Intermediate High–Advanced Low中文学习者的口语示范者。请生成一段自然、可模仿的中文故事范例，约180至240个汉字。按“故事早已开始—一份跨国帮助加入—长期行动继续—今天为什么值得讲”的顺序组织。必须准确使用“殷玉珍、治沙、募款、5000美元、5万多棵树”等词；说明5000美元有真实帮助，但不是整片森林形成的唯一原因。严格按用户指定的受众调整表达：普通大学生需要先解释毛乌素与基本背景；环境科学学生需要突出成活、固沙、水土条件、监测和调整；校园媒体编辑需要突出准确的新闻重点、关键年代和避免夸大单一因果。使用清楚的时间连接词和适合口头表达的短句，不评价学习者，也不要添加标题、项目符号或材料外事实。`,
  green_feedback: `你是中文口语教练。只给一条可在20至30秒补说中立即使用的建议。优先检查：是否使用两个时间节点、是否区分帮助与单一因果、是否面向美国受众解释背景。总计不超过48个汉字，并给一个半句支架。`,
  green_annotate: `你是面向美国中高级中文学习者的词语注释助手。只解释用户选中的1至8个汉字，不延伸故事事实。严格返回四行：
词语：用户选中的词语
拼音：带声调符号；按整个词书写，词内音节连续、不加空格，例如dìjiào
英文：简明英文释义
例句：8至20个汉字的简单自然例句
不要添加其他内容。`,
  kasaya_jinchi: `你扮演根据《西游记》与游戏线索设计的金池长老教学角色。与Intermediate High–Advanced Low中文学习者讨论袈裟、收藏、身份、欲望与行动后果。每轮先回应学习者使用的一条证据，再从“已经收藏许多为什么还想要”“欣赏与占有的边界”“物件怎样改变行动”中追问一个问题。每轮24至48个汉字，只问一个问题，不冒充历史人物，不补写材料外情节。`,
  kasaya_feedback: `你是中文口语教练。根据学习者对袈裟的文化解释，只给一条可在20至30秒补说中立即使用的建议。依次检查：是否用了两条证据；是否把功能、价值、欲望、行动和后果连起来；是否说明跨文化物件的相似、差异与类比边界。总计不超过52个汉字，并给一个半句支架。`,
};

function clean(value, max = 1200) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-6).map((item) => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: clean(item?.content, 500),
  })).filter((item) => item.content);
}

function fallback(stage, role, message = "") {
  if (stage === "green_annotate") {
    const word = clean(message, 8) || "这个词";
    return `词语：${word}\n拼音：—\n英文：selected expression\n例句：请结合听力材料理解“${word}”。`;
  }
  if (stage === "green_editor") return "A Gift That Joined a 40-Year Fight Against Sand｜一份善意怎样进入四十年的治沙行动｜1999年的5000美元帮助购买树苗，但故事早在1985年已经开始。森林也来自此后二十多年的坚持、技术与治理。";
  if (stage === "green_plan_feedback") return "正式讲述时先交代1985年的治沙起点，再说1999年的帮助；用“支持了树苗，但没有单独造成森林”收住因果。";
  if (stage === "green_model_story") return "如果我要把这个故事讲给美国大学生，我会从1985年说起。那一年，殷玉珍开始在毛乌素沙地治沙。最早栽下的600棵树苗只活了不到10棵，但她没有放弃。1999年，美国教育工作者赛考斯从电视上知道了她的故事，并通过机构募款5000美元。第二年，两人见面，也一起种下一棵树。这笔钱帮助购买和栽种了一批树苗，后来长成5万多棵树。不过，森林并不是一笔捐款单独创造的，它也来自殷玉珍几十年的坚持、技术积累和更大的治理实践。2026年，两人时隔26年重逢。这个故事让我看到，善意很重要，而长期行动让善意真正扎下了根。";
  if (stage === "green_feedback") return "补充一个边界句：这笔钱帮助了树苗进入沙地，但不能替代长期治沙和治理实践。";
  if (stage === "green_sako") return "这笔钱确实帮助购买了树苗。为什么不能把整片森林都写成它的功劳？";
  if (stage === "kasaya_jinchi") return "我已经收藏许多袈裟，却仍想留下这一件。你认为欣赏从什么时候变成了占有？";
  if (stage === "kasaya_feedback") return "补充因果链：袈裟本来提醒人减少执着，但人物赋予它宝物价值，因此欲望推动了行动。";
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
    Array.isArray(body?.evidence) && body.evidence.length ? `学习者已开放的绿色故事事实卡：${body.evidence.map((x) => clean(x, 4)).join("、")}` : "",
    Array.isArray(body?.omissions) && body.omissions.length ? `学习者指出的遗漏：${body.omissions.map((x) => clean(x, 4)).join("、")}` : "",
    clean(body?.audience, 20) ? `目标受众：${clean(body.audience, 20)}` : "",
    Array.isArray(body?.shots) && body.shots.length ? `学习者选择的镜头：${body.shots.map((x) => clean(x, 4)).join("、")}` : "",
  ].filter(Boolean).map((x) => `\n${x}`).join("");
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return Response.json({ reply: fallback(stage, role, message), source: "fallback" });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3200);
    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: stage === "feedback" || stage === "kasaya_feedback" || stage === "green_feedback" || stage === "green_plan_feedback" || stage === "green_annotate" ? 0.25 : 0.55,
        max_tokens: stage === "green_model_story" ? 320 : stage === "story" ? 320 : stage === "green_editor" ? 220 : stage === "feedback" || stage === "kasaya_feedback" || stage === "green_feedback" || stage === "green_plan_feedback" || stage === "green_annotate" ? 110 : 90,
        messages: [
          { role: "system", content: `${stage.startsWith("green_") ? GREEN_FACTS : stage.startsWith("kasaya_") ? KASAYA_FACTS : FACTS}\n${systemPrompt}${context}` },
          ...cleanHistory(body?.history),
          { role: "user", content: message || "请根据本任务事实继续。" },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
    const data = await response.json();
    const reply = clean(data?.choices?.[0]?.message?.content, stage === "story" || stage === "green_model_story" ? 1200 : 500);
    const modelStoryInvalid = stage === "green_model_story" && (reply.length > 330 || !["殷玉珍", "治沙", "5000美元"].every((term) => reply.includes(term)));
    return Response.json({ reply: modelStoryInvalid ? fallback(stage, role, message) : reply || fallback(stage, role, message), source: modelStoryInvalid ? "fallback" : "deepseek" });
  } catch {
    return Response.json({ reply: fallback(stage, role, message), source: "fallback" });
  }
}
