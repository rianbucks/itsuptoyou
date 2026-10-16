import { computeAge } from "../../engine/years.js";
import { portraitFrame } from "../components.js";
import { renderDevPanel } from "../dev-panel.js";
import { el } from "../dom.js";
import { formatYear } from "../format.js";
import { leaveRun, startFigure } from "../game.js";
import { render } from "../render.js";
import { randomSeed, seedFromUrl } from "../seed.js";
import { store } from "../store.js";

const DEV_FIGURE_PREFIX = "dev_";
const DEATH_TYPES = { event: "사건으로 맞는 죽음", natural: "자연사" };

function isDevFigure(figure) {
  return figure.id.startsWith(DEV_FIGURE_PREFIX);
}

function visibleFigures() {
  return store.figureHeaders.filter((figure) => store.settings.devMode || !isDevFigure(figure));
}

function settingsControls() {
  const toggle = (key, label, onChange) => el("label", { class: "setting", for: `setting-${key}` },
    el("input", { type: "checkbox", id: `setting-${key}`, checked: store.settings[key] || null, onchange: (event) => { store.settings[key] = event.target.checked; onChange(); } }),
    label);
  return el("fieldset", { class: "settings" }, el("legend", {}, "설정"),
    toggle("showHistorical", "역사대로 선택지 표시", renderDevPanel),
    store.devAvailable ? toggle("devMode", "개발자 모드 (확률·상태·개발용 인물 표시)", renderTitle) : null);
}

function figureOption(figure) {
  const selected = figure.id === store.selectedFigureId;
  return el("button", {
    type: "button",
    class: `figure-option${selected ? " selected" : ""}`,
    role: "radio",
    "aria-checked": String(selected),
    onclick: () => { store.selectedFigureId = figure.id; renderTitle(); },
  },
  portraitFrame(figure),
  el("span", { class: "figure-text" },
    el("strong", { class: "figure-name" }, figure.name),
    el("span", { class: "meta num" }, `${formatYear(figure.born)} – ${formatYear(figure.died)} · ${computeAge(figure.born, figure.died)}세`),
    el("span", { class: "meta" }, DEATH_TYPES[figure.deathType]),
    isDevFigure(figure) ? el("span", { class: "stamp" }, "개발용 배치 시험") : null));
}

function seedControls() {
  store.seedDraft ??= seedFromUrl() ?? randomSeed();
  const input = el("input", { type: "number", min: "0", id: "seed-input", class: "seed-input num", value: store.seedDraft, oninput: (event) => { store.seedDraft = Number(event.target.value) >>> 0; } });
  const reroll = () => { store.seedDraft = randomSeed(); input.value = store.seedDraft; };
  return el("div", { class: "seed-row" },
    el("label", { for: "seed-input" }, "시드"),
    input,
    el("button", { type: "button", class: "btn ghost", onclick: reroll }, "무작위"));
}

function startSelected() {
  if (store.selectedFigureId) startFigure(store.selectedFigureId, store.seedDraft >>> 0);
}

export function renderTitle() {
  leaveRun();
  store.session = null;
  store.content = null;
  store.trace = [];
  store.card = null;
  const figures = visibleFigures();
  if (!figures.some((figure) => figure.id === store.selectedFigureId)) store.selectedFigureId = figures[0]?.id ?? null;
  render(
    el("section", { class: "title-screen" },
      el("div", { class: "masthead" },
        el("span", { class: "kicker num" }, "UP TO YOU · 엔진 시험판"),
        el("h1", {}, "당신이 산다면"),
        el("p", {}, "사료대로 흘러가는 한 생애를 1년씩 넘기다가, 갈림길에서 고른다. 인물과 사건은 모두 엔진 시험용 가상 데이터다.")),
      el("div", { class: "figure-list", role: "radiogroup", "aria-label": "인물 선택" }, figures.map(figureOption)),
      el("div", { class: "title-controls" }, seedControls(), settingsControls()),
      el("div", { class: "title-actions" },
        el("button", { type: "button", class: "btn primary", disabled: store.selectedFigureId ? null : true, onclick: startSelected }, "태어나기"))));
}
