import { renderDevPanel } from "./dev-panel.js";

export function render(...children) {
  const app = document.getElementById("app");
  app.replaceChildren(...children.flat(Infinity).filter(Boolean));
  renderDevPanel();
  window.scrollTo({ top: 0 });
}
