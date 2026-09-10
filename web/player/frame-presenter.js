import { renderSlide } from "/shared/templates.js";

function decoded(image) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => finish(new Error("Imagem indisponível")),
      15000,
    );
    const finish = (error) => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      error ? reject(error) : resolve();
    };
    if (image.decode) image.decode().then(() => finish(), finish);
    else if (image.complete)
      finish(image.naturalWidth ? null : new Error("Imagem inválida"));
    else {
      image.onload = () => finish();
      image.onerror = () => finish(new Error("Imagem inválida"));
    }
  });
}

export function createFramePresenter(screen) {
  let generation = 0,
    pending = null,
    removal;
  const warmed = new Map();
  function cancel() {
    generation++;
    pending = null;
    clearTimeout(removal);
  }
  function preload(content) {
    const url = content?.fields?.media;
    if (!url || content.template === "video" || warmed.has(url)) return;
    const image = new Image();
    image.src = url;
    warmed.set(url, image);
    decoded(image).catch(() => warmed.delete(url));
    while (warmed.size > 3) warmed.delete(warmed.keys().next().value);
  }
  function show(content, effect, onShown) {
    const key = JSON.stringify(content);
    if (pending === key) return;
    pending = key;
    const request = ++generation;
    const frame = document.createElement("div");
    frame.className = "frame";
    frame.innerHTML = renderSlide(content);
    Promise.all([...frame.querySelectorAll("img")].map(decoded))
      .then(() => {
        if (request !== generation) return;
        const old = screen.lastElementChild;
        clearTimeout(removal);
        for (const child of [...screen.children])
          if (child !== old) child.remove();
        frame.classList.add(effect || "fade");
        screen.append(frame);
        const counter = frame.querySelector("[data-story-value]");
        if (
          counter &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          const label = counter.dataset.storyValue;
          const numeric = label.replace("%", "").trim();
          const value = Number(numeric.replace(",", "."));
          if (
            /^\d+(?:[.,]\d+)?%?$/.test(label.trim()) &&
            Number.isFinite(value)
          ) {
            const start = performance.now(),
              digits = numeric.split(/[.,]/)[1]?.length || 0;
            const animate = (time) => {
              if (!frame.isConnected) return;
              const progress = Math.min(1, (time - start) / 1400);
              counter.textContent =
                progress === 1
                  ? label
                  : (value * (1 - Math.pow(1 - progress, 3))).toLocaleString(
                      "pt-BR",
                      {
                        minimumFractionDigits: digits,
                        maximumFractionDigits: digits,
                      },
                    ) + (label.includes("%") ? "%" : "");
              if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
          }
        }
        pending = null;
        onShown();
        removal = setTimeout(() => {
          old?.querySelectorAll("video").forEach((video) => {
            video.pause();
            video.removeAttribute("src");
            video.load();
          });
          old?.remove();
        }, 700);
      })
      .catch(() => {
        // Keep the current frame visible; allow a later tick to retry.
        if (request === generation)
          setTimeout(() => {
            if (request === generation) pending = null;
          }, 3000);
      });
  }
  return { show, preload, cancel };
}
