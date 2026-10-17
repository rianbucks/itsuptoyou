const VERDICT_NAMES = { match: "일치", mismatch: "불일치", unverifiable: "확인 불가", unchecked: "대조 안 함", stale: "내용 바뀜" };
const REVIEW_NAMES = { approved: "승인", rejected: "반려", pending: "미결", stale: "승인 뒤 바뀜" };
const MAX_ELAPSED_MS = 30 * 60 * 1000;
const state = { figure: null, items: [], filter: "open", lastActionAt: Date.now() };

function el(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "class") element.className = value;
    else if (key.startsWith("on")) element.addEventListener(key.slice(2), value);
    else if (value !== null && value !== undefined && value !== false) element.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

async function api(path, body) {
  const response = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  if (!response.ok) throw new Error((await response.json()).error ?? response.statusText);
  return response.json();
}

function isOpen(item) {
  return item.reviewStatus === "pending" || item.reviewStatus === "stale";
}

function visibleItems() {
  if (state.filter === "open") return state.items.filter(isOpen);
  if (state.filter === "mismatch") return state.items.filter((item) => item.factcheckStatus === "mismatch");
  if (state.filter === "unverifiable") return state.items.filter((item) => ["unverifiable", "unchecked", "stale"].includes(item.factcheckStatus));
  return state.items;
}

function panel(title, ...children) {
  return el("section", { class: "panel" }, el("h4", {}, title), ...children);
}

function sourcesPanel(item) {
  return panel("출처 (sources)", el("ul", {}, item.sources.map((source) => el("li", {}, source))));
}

function timelinePanel(item) {
  if (!item.timelineRows.length) return panel("근거 연표 행", el("p", { class: "muted" }, "trace.json에 근거 행이 없다"));
  return panel("근거 연표 행", item.timelineRows.map((row) => el("div", {},
    el("p", {}, el("strong", {}, `${row.id} · ${row.yearText} `), row.marks.join(" ")),
    el("p", {}, row.event),
    el("p", { class: "muted" }, row.sourceText),
    row.links.length ? el("ul", {}, row.links.map((link) => el("li", {}, el("a", { href: link.url, target: "_blank", rel: "noopener" }, link.label)))) : null)));
}

function excerptBlock(record, label) {
  if (!record) return null;
  return el("div", {},
    el("p", { class: "muted" }, label, record.source ? ` · ${record.source}` : ""),
    record.url ? el("p", {}, /^https?:/.test(record.url) ? el("a", { href: record.url, target: "_blank", rel: "noopener" }, record.url) : el("span", { class: "muted" }, record.url)) : null,
    record.excerpt ? el("p", { class: "excerpt" }, record.excerpt) : null,
    record.translation ? el("p", {}, "대역: ", record.translation) : null,
    record.note ? el("p", { class: "muted" }, record.note) : null);
}

function factcheckPanel(item) {
  return panel("원문 발췌와 자동 대조",
    el("p", {}, el("span", { class: `badge ${item.factcheckStatus}` }, VERDICT_NAMES[item.factcheckStatus])),
    excerptBlock(item.factcheck, "자동 대조"),
    excerptBlock(item.manual, "사람이 붙인 원문"),
    manualForm(item));
}

function manualForm(item) {
  const fields = {
    source: el("input", { placeholder: "사료 이름과 위치" }),
    url: el("input", { placeholder: "URL" }),
    excerpt: el("textarea", { rows: 3, placeholder: "원문 발췌" }),
    translation: el("textarea", { rows: 2, placeholder: "대역 (원문이 한국어가 아니면)" }),
  };
  const submit = async (event) => {
    event.preventDefault();
    await api(`/api/review/${state.figure}/excerpt`, { item: item.id, ...Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value])) });
    await load();
  };
  return el("details", {}, el("summary", {}, "원문 직접 붙이기"),
    el("form", { onsubmit: submit }, Object.values(fields), el("button", { type: "submit" }, "저장")));
}

function extraPanels(item) {
  const disputed = item.disputed.length ? panel("이견", el("ul", {}, item.disputed.map((entry) => el("li", {}, entry.note, el("span", { class: "muted" }, ` — ${entry.sources.join(" · ")}`))))) : null;
  const conflicts = item.conflicts.length ? panel("충돌로 판단한 선택", el("ul", {}, item.conflicts.map((entry) => el("li", {}, entry.outcome, el("span", { class: "muted" }, ` — ${entry.reason}`))))) : null;
  return [disputed, conflicts];
}

function decide(item, status, noteField) {
  return async () => {
    const elapsedMs = Math.min(Date.now() - state.lastActionAt, MAX_ELAPSED_MS);
    await api(`/api/review/${state.figure}/decision`, { item: item.id, status, note: noteField.value, elapsedMs });
    state.lastActionAt = Date.now();
    await load();
  };
}

function actions(item) {
  const note = el("input", { placeholder: "메모 (반려 이유 등)", value: item.decision?.note ?? "" });
  const decided = item.decision ? el("span", { class: "muted" }, `${REVIEW_NAMES[item.reviewStatus]} · ${item.decision.at.slice(0, 16).replace("T", " ")}`) : null;
  return el("div", { class: "actions" }, note,
    el("button", { type: "button", class: "approve", onclick: decide(item, "approved", note) }, "승인"),
    el("button", { type: "button", class: "reject", onclick: decide(item, "rejected", note) }, "반려"),
    decided);
}

function itemCard(item) {
  return el("article", { class: `item ${item.reviewStatus}` },
    el("div", { class: "head" },
      el("span", { class: "kind" }, item.kindName),
      el("strong", {}, item.label),
      el("span", { class: `badge ${item.reviewStatus}` }, REVIEW_NAMES[item.reviewStatus]),
      el("span", { class: "muted" }, item.id)),
    el("p", { class: "text" }, item.text),
    el("div", { class: "columns" }, sourcesPanel(item), timelinePanel(item), factcheckPanel(item), ...extraPanels(item)),
    actions(item));
}

function renderSummary() {
  const count = (predicate) => state.items.filter(predicate).length;
  document.getElementById("summary").textContent =
    `항목 ${state.items.length} · 승인 ${count((item) => item.reviewStatus === "approved")} · 반려 ${count((item) => item.reviewStatus === "rejected")} · 미결 ${count(isOpen)} · 불일치 ${count((item) => item.factcheckStatus === "mismatch")}`;
}

function render() {
  for (const button of document.querySelectorAll("[data-filter]")) button.classList.toggle("on", button.dataset.filter === state.filter);
  renderSummary();
  const items = visibleItems();
  document.getElementById("items").replaceChildren(...(items.length ? items.map(itemCard) : [el("p", { class: "muted" }, "이 보기에 해당하는 항목이 없다")]));
}

async function load() {
  const payload = await api(`/api/review/${state.figure}`);
  state.items = payload.items;
  render();
}

async function boot() {
  const figures = await api("/api/figures");
  const select = document.getElementById("figure");
  select.replaceChildren(...figures.map((figure) => el("option", { value: figure.id }, `${figure.name} (${figure.id})${figure.hasReview ? "" : " · 검수 파일 없음"}`)));
  const requested = new URLSearchParams(location.search).get("figure");
  state.figure = figures.find((figure) => figure.id === requested)?.id ?? figures.find((figure) => figure.hasReview)?.id ?? figures[0]?.id;
  select.value = state.figure;
  select.addEventListener("change", async () => {
    state.figure = select.value;
    await load();
  });
  for (const button of document.querySelectorAll("[data-filter]")) {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      render();
    });
  }
  await load();
}

boot().catch((error) => {
  document.getElementById("items").textContent = `불러오지 못했다: ${error.message}`;
});
