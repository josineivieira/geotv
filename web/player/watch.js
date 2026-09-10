import { renderSlide } from "/shared/templates.js";
import { presentationFrames } from "/shared/presentation.js";
import { eligible } from "/shared/schedule.js";
const id = location.pathname.split("/")[2],
  screen = document.querySelector("#screen");
let channel = null,
  index = -1,
  deadline = 0,
  currentId = null,
  currentVersion = null,
  busy = false,
  transition;
function tick() {
  if (!channel) return;
  let frames = channel.contents
    .filter((c) => eligible(c, new Date(), channel.settings.timezone))
    .flatMap(presentationFrames);
  const urgent = channel.alerts?.find(
    (alert) =>
      new Date(alert.start) <= new Date() && new Date(alert.end) > new Date(),
  );
  if (urgent)
    frames = [
      {
        id: urgent.id,
        template: "urgent",
        title: urgent.title,
        duration: 3600,
        fields: { message: urgent.message, footer: "AVISO URGENTE" },
      },
    ];
  if (!frames.length) {
    if (currentId !== null || !screen.querySelector(".opening p"))
      screen.innerHTML =
        '<div class="opening"><strong>geo<span>tv</span></strong><p>Em breve, novas conexões por aqui.</p></div>';
    currentId = null;
    return;
  }
  if (
    Date.now() < deadline &&
    frames.some((c) => c.id === currentId) &&
    currentVersion === channel.version
  )
    return;
  index = (index + 1) % frames.length;
  const c = frames[index];
  currentId = c.id;
  currentVersion = channel.version;
  deadline = Date.now() + c.duration * 1000;
  const frame = document.createElement("div");
  frame.className =
    "frame " + (c.transition || channel.settings.transition || "fade");
  frame.innerHTML = renderSlide(c);
  const old = screen.lastElementChild;
  for (const node of [...screen.children]) if (node !== old) node.remove();
  screen.append(frame);
  clearTimeout(transition);
  transition = setTimeout(() => {
    old?.querySelectorAll("video").forEach((v) => v.pause());
    old?.remove();
  }, 700);
}
async function sync() {
  if (busy) return;
  busy = true;
  try {
    const res = await fetch("/api/channels/" + encodeURIComponent(id), {
      signal: AbortSignal.timeout(10000),
    });
    if ([401, 403, 404].includes(res.status)) {
      channel = null;
      screen.replaceChildren();
      location.replace("/");
      return;
    }
    if (!res.ok) throw new Error();
    channel = await res.json();
    tick();
  } catch {
    if (!channel)
      screen.innerHTML =
        '<div class="opening"><strong>geo<span>tv</span></strong><p>Aguardando conexão com o canal.</p></div>';
  } finally {
    busy = false;
  }
}
const timer = setInterval(tick, 500),
  refresh = setInterval(sync, 10000);
window.addEventListener(
  "pagehide",
  () => {
    clearInterval(timer);
    clearInterval(refresh);
    clearTimeout(transition);
  },
  { once: true },
);
sync();
