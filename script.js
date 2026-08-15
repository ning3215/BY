const startDate = new Date("2024-05-20T00:00:00+08:00");
const today = new Date();
const oneDay = 1000 * 60 * 60 * 24;
const daysTogether = Math.max(1, Math.floor((today - startDate) / oneDay) + 1);

document.getElementById("daysTogether").textContent = daysTogether.toLocaleString("zh-CN");

const whispers = [
  "今天也想认真地偏爱你。",
  "见到你之前，我没想过平凡也可以这么浪漫。",
  "我喜欢我们，也喜欢那个和你在一起时更柔软的自己。",
  "慢慢来吧，反正最想去的未来是有你的未来。",
  "你一笑，今天就有了最好的结尾。"
];

const button = document.getElementById("surpriseButton");
const whisper = document.getElementById("whisper");
let whisperIndex = 0;

button.addEventListener("click", () => {
  whisperIndex = (whisperIndex + 1) % whispers.length;
  whisper.textContent = whispers[whisperIndex];
});
