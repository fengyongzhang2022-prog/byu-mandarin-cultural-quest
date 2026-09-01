import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EdgeTTS, Constants } from "@andresaya/edge-tts";

const root = process.cwd();
const assets = path.join(root, "public", "assets");
const scratch = path.join(root, "scripts", ".tmp-green-story-films");
mkdirSync(scratch, { recursive: true });

const films = [
  {
    id: "01",
    source: "green-story-film-01-v3.mp4",
    zh: [
      "在中国北方，有一片地方叫毛乌素沙地。",
      "故事要从1978年说起。那一年，中国启动“三北”防护林工程，开始在东北、华北和西北防风固沙。",
      "可是，国家工程落到一个家庭身上，会是什么样子呢？",
      "1985年，19岁的殷玉珍来到井背塘。那里没有公路，也没有电。",
      "她住的土房半埋在沙里，一夜风沙就能堵住门。",
      "第二年，她和丈夫卖掉家里唯一的一只羊，换回600多棵树苗。",
      "他们用铁锹挖坑，用扁担挑水，再用钢钎在硬沙地上打洞。",
      "可一场大风过后，活下来的树苗不到10棵。",
      "失败了，怎么办？他们没有停，而是一次次重来。",
      "先固定流沙，再种灌木和乔木。",
      "十四年后，他们已经种出3万多亩林地。",
      "也就在那一年，700公里外的洛阳，一位美国教师从电视里看到了她的故事。",
      "下一段，我们看看这条远方的消息，后来带来了什么。",
    ],
    en: [
      "In northern China lies a place called the Mu Us Sandy Land.",
      "Our story begins in 1978, when China launched the Three-North Shelterbelt Program to curb wind and shifting sand across the northeast, north, and northwest.",
      "But what did a national project look like in the life of one family?",
      "In 1985, nineteen-year-old Yin Yuzhen arrived in Jingbeitang, a place with neither roads nor electricity.",
      "Her earthen home was half buried in sand, and a single night of wind could block the door.",
      "The next year, she and her husband sold their only sheep and bought more than six hundred seedlings.",
      "They dug with shovels, carried water on a shoulder pole, and drove steel rods into the hard sand to make planting holes.",
      "After one strong wind, fewer than ten seedlings survived.",
      "What could they do after that failure? They did not stop; they began again and again.",
      "First they stabilized the shifting sand, then planted shrubs and trees.",
      "Fourteen years later, they had planted more than thirty thousand mu of woodland.",
      "That same year, seven hundred kilometers away in Luoyang, an American teacher saw her story on television.",
      "In the next segment, we follow what that message from afar set in motion.",
    ],
  },
  {
    id: "02",
    source: "green-story-film-02-v3.mp4",
    zh: [
      "上一段里，赛考斯在电视上看到了殷玉珍。",
      "接下来，故事从电视屏幕走进了现实。",
      "1999年，他给许多机构发电子邮件，希望为治沙筹款。",
      "大约两个月后，他通过一家基金会筹到5000美元。",
      "殷玉珍只留下一张美元作纪念，其余的钱都买了树苗。",
      "2000年春天，赛考斯来到毛乌素。两个人第一次见面，还一起种下一棵树。",
      "后来，他们慢慢失去了联系。但是，治沙没有停。",
      "殷玉珍一家继续种树、补苗、护林。",
      "2007年，一条8公里长的公路修到她家门口，树苗和工具终于可以用车运进沙地。",
      "当地项目也陆续送来苗木和机械。",
      "他们一边种，一边看哪些树能活，再不断调整树种和方法。",
      "当年用那笔捐款买的树苗，后来长成了5万多棵树。",
      "到了2026年，一次重逢又把两个人带回毛乌素。",
      "这一次，他们还会一起种树吗？下一段，是真实新闻现场。",
    ],
    en: [
      "In the previous segment, Sakolsky saw Yin Yuzhen on television.",
      "Now the story moves from the television screen into real life.",
      "In 1999, he emailed many organizations, hoping to raise money for desertification control.",
      "About two months later, he had raised five thousand dollars through a foundation.",
      "Yin kept one dollar as a keepsake and spent the rest on seedlings.",
      "In the spring of 2000, Sakolsky came to the Mu Us. They met for the first time and planted a tree together.",
      "Over time, they lost touch. The work of controlling the sand, however, did not stop.",
      "Yin's family kept planting, replacing seedlings, and protecting the woodland.",
      "In 2007, an eight-kilometer road finally reached her home, allowing seedlings and tools to be transported by vehicle.",
      "Local projects also began supplying young trees and machinery.",
      "The family watched which trees survived and kept adjusting the species and planting methods.",
      "The seedlings bought with that donation eventually grew into more than fifty thousand trees.",
      "Then, in 2026, a reunion brought the two friends back to the Mu Us.",
      "Would they plant together again? The next segment takes us to the real news footage.",
    ],
  },
];

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`);
}

function duration(file) {
  const result = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`ffprobe failed for ${file}`);
  return Number(result.stdout.trim());
}

function stamp(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const rest = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(rest).padStart(3, "0")}`;
}

function vtt(cues, total) {
  const weights = cues.map((cue) => Math.max(8, [...cue].length));
  const sum = weights.reduce((a, b) => a + b, 0);
  let cursor = 0.18;
  const usable = Math.max(1, total - 0.36);
  const rows = cues.map((cue, index) => {
    const start = cursor;
    cursor += usable * (weights[index] / sum);
    return `${index + 1}\n${stamp(start)} --> ${stamp(Math.min(total - 0.08, cursor))} line:84% align:center\n${cue}`;
  });
  return `WEBVTT\n\n${rows.join("\n\n")}\n`;
}

for (const film of films) {
  const audioBase = path.join(scratch, `green-story-film-${film.id}-v4-voice`);
  const audioFile = `${audioBase}.mp3`;
  if (!existsSync(audioFile)) {
    const tts = new EdgeTTS();
    await tts.synthesize(film.zh.join(" "), "zh-CN-XiaoxiaoNeural", {
      rate: "-4%",
      pitch: "+0Hz",
      volume: "+0%",
      outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
    });
    await tts.toFile(audioBase);
  }
  const sourceFile = path.join(assets, film.source);
  const outputFile = path.join(assets, `green-story-film-${film.id}-v4.mp4`);
  const audioDuration = duration(audioFile);
  const sourceDuration = duration(sourceFile);
  const stretch = audioDuration / sourceDuration;
  run("ffmpeg", [
    "-y", "-loglevel", "error", "-i", sourceFile, "-i", audioFile,
    "-filter_complex", `[0:v]setpts=${stretch.toFixed(8)}*PTS[v]`,
    "-map", "[v]", "-map", "1:a:0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
    "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", outputFile,
  ]);
  writeFileSync(path.join(assets, `green-story-film-${film.id}-v4.zh-CN.vtt`), vtt(film.zh, audioDuration), "utf8");
  writeFileSync(path.join(assets, `green-story-film-${film.id}-v4.en-US.vtt`), vtt(film.en, audioDuration), "utf8");
  console.log(`${film.id}: ${audioDuration.toFixed(2)}s audio, ${sourceDuration.toFixed(2)}s source`);
}
