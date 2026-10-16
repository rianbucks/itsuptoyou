import { el } from "../dom.js";
import { startFigure } from "../flow.js";
import { renderDevPanel } from "../dev-panel.js";
import { render } from "../render.js";
import { randomSeed, seedFromUrl } from "../seed.js";
import { store } from "../store.js";

function settingsControls() {
  const toggle = (key, label) => el("label", { class: "setting" },
    el("input", { type: "checkbox", checked: store.settings[key] || null, onchange: (event) => { store.settings[key] = event.target.checked; renderDevPanel(); } }),
    label);
  return el("fieldset", { class: "settings" }, el("legend", {}, "설정"),
    toggle("showHistorical", "역사대로 선택지 표시"),
    toggle("devMode", "개발자 모드 (확률·상태 표시)"));
}

function figureButtons(seedInput) {
  return store.figureHeaders.map((figure) =>
    el("button", { type: "button", class: "primary", onclick: () => startFigure(figure.id, Number(seedInput.value) >>> 0) }, figure.name));
}

export function renderTitle() {
  store.session = null;
  store.content = null;
  const seedInput = el("input", { type: "number", min: "0", value: seedFromUrl() ?? randomSeed(), class: "seed-input", "aria-label": "시드" });
  render(
    el("section", { class: "card title-card" },
      el("h1", {}, "Up to You"),
      el("p", { class: "lead" }, "역사적 인물로 태어나 생애를 따라가다가, 결정적 순간에 역사를 바꿔라."),
      el("p", { class: "notice" }, "엔진 시험용 프로토타입입니다. 인물·사건·결말은 모두 가상 데이터이며 실제 역사가 아닙니다."),
      el("label", { class: "seed-row" }, "시드 ", seedInput,
        el("button", { type: "button", class: "ghost", onclick: () => { seedInput.value = randomSeed(); } }, "무작위")),
      settingsControls(),
      el("div", { class: "figure-list" }, figureButtons(seedInput))));
}
