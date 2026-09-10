const button = document.createElement("button");
button.type = "button";
button.className = "fullscreen-button";
button.textContent = "⛶ Tela cheia";
button.setAttribute("aria-label", "Exibir canal em tela cheia");
const message = document.createElement("p");
message.className = "fullscreen-message";
message.setAttribute("role", "status");
message.hidden = true;
document.body.append(button, message);

const active = () =>
  document.fullscreenElement || document.webkitFullscreenElement;
function update() {
  button.hidden = !!active();
  if (active()) {
    message.hidden = true;
    button.blur();
  }
}
async function enter() {
  if (active()) return;
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  try {
    if (!request) throw new Error("unsupported");
    await request.call(root);
    update();
  } catch {
    message.textContent =
      "Use F11 no computador ou a opção Tela cheia do navegador da TV.";
    message.hidden = false;
  }
}
button.addEventListener("click", enter);
document.addEventListener("fullscreenchange", update);
document.addEventListener("webkitfullscreenchange", update);
document.addEventListener("keydown", (event) => {
  if (
    event.repeat ||
    active() ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  if (
    event.key === "Enter" &&
    !event.target.closest("button, a, input, textarea, select")
  ) {
    event.preventDefault();
    enter();
  }
});
update();
