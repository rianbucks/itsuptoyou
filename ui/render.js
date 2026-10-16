import { renderDevPanel } from "./dev-panel.js";
import { renderStatusBar } from "./status-bar.js";

export function render(...children) {
  const app = document.getElementById("app");
  app.replaceChildren(...children.flat(Infinity).filter(Boolean));
  renderStatusBar();
  renderDevPanel();
  window.scrollTo({ top: 0 });
}
