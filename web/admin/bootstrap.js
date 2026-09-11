// The player service worker also controls the admin on the same origin.
// Ask it to update so an old cached template catalog does not hide new models.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => location.reload(),
    { once: true },
  );
  navigator.serviceWorker
    .getRegistration()
    .then((registration) => registration?.update())
    .catch(() => {});
}
import("./app.js");
