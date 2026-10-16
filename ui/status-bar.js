import { el } from "./dom.js";
import { formatYear } from "./format.js";
import { store } from "./store.js";

export function renderStatusBar() {
  const bar = document.getElementById("status");
  const { content, session } = store;
  if (!session) {
    bar.replaceChildren();
    return;
  }
  const { state } = session;
  bar.replaceChildren(
    el("span", { class: "status-name" }, content.figure.name),
    el("span", {}, formatYear(state.year)),
    el("span", {}, `${state.age}세`),
  );
}
