import { computeAge } from "../../engine/years.js";

const CALENDARS = ["lunar", "julian", "gregorian"];
const MARKS = ["✓", "△", "✗", "⚠"];
const USABLE_MARKS = ["✓", "△"];
const BCE = /^(?:기원전|BC|B\.C\.|BCE)\s*(\d+)$|^(\d+)\s*(?:BC|B\.C\.|BCE)$/i;
const CE = /^(?:AD|A\.D\.|CE|서기)?\s*(\d+)(?:\s*(?:AD|A\.D\.|CE))?$/i;
const ERA_MARK = /기원전|BC|B\.C\.|BCE/i;
const NEGATIVE = /^[−-]\s*(\d+)$/;
const ALTERNATIVE = /\s+또는\s+/;
const LINK = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g;
const USES = [
  ["노드 후보", "node"],
  ["성장 사건 후보", "growth"],
  ["기록 서술 후보", "chronicle"],
  ["시대 배경 후보", "era"],
  ["제외", "exclude"],
];
const VARIABILITIES = [
  ["설계에 따라", "design"],
  ["아니오", "no"],
  ["예", "yes"],
];
const ERA_SECTIONS = [
  ["생애 중 시대 배경 후보", "during", "e"],
  ["기록 이후 시대 배경 후보", "after", "x"],
];
const REFERENCE = /^→\s*생애\s*연표\s*(.+?)\s*「([^」]+)」/;

export function parseHeader(text) {
  const match = text.match(/^\s*<!--\s*uty\s*\n([\s\S]*?)-->/);
  if (!match) return null;
  return Object.fromEntries(match[1].split("\n")
    .map((line) => line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]));
}

export function splitSections(text) {
  const sections = [];
  let current = { title: "", level: 0, lines: [] };
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,2})\s+(.+?)\s*$/);
    if (heading) {
      sections.push(current);
      current = { title: heading[2], level: heading[1].length, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections;
}

function splitCells(line) {
  const cells = [];
  let cell = "";
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === "\\" && line[index + 1] === "|") {
      cell += "|";
      index++;
    } else if (char === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells.slice(1, -1);
}

function isSeparator(line) {
  return /^\|\s*:?-{3,}/.test(line.trim());
}

export function parseTable(lines) {
  const tableLines = [];
  for (const line of lines) {
    if (line.trim().startsWith("|")) tableLines.push(line.trim());
    else if (tableLines.length) break;
  }
  if (tableLines.length < 2 || !isSeparator(tableLines[1])) return { header: [], rows: [] };
  const header = splitCells(tableLines[0]);
  const rows = tableLines.slice(2).map((line) => {
    const cells = splitCells(line);
    return Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""]));
  });
  return { header, rows };
}

function parseSingleYear(text, inheritBce) {
  const value = text.trim();
  const negative = value.match(NEGATIVE);
  if (negative) return Number(negative[1]) === 0 ? { error: "0년은 없다" } : { year: -Number(negative[1]) };
  const bce = value.match(BCE);
  if (bce) return { year: -Number(bce[1] ?? bce[2]) };
  const ce = value.match(CE);
  if (ce) {
    const number = Number(ce[1]);
    if (number === 0) return { error: "0년은 없다" };
    return { year: inheritBce && !/AD|A\.D\.|CE|서기/i.test(value) ? -number : number };
  }
  return null;
}

function parseAlternativeYears(cleaned, raw, uncertain) {
  const years = cleaned.split(ALTERNATIVE).map((part) => parseSingleYear(part, false));
  if (years.some((year) => !year || year.error)) return { error: `연도 후보를 읽지 못했다: ${raw}` };
  const values = years.map((year) => year.year);
  return { year: Math.min(...values), yearEnd: Math.max(...values), alternatives: values, uncertain };
}

export function parseYearText(text) {
  const raw = text.trim();
  const uncertain = raw.includes("?");
  const cleaned = raw.replace(/\?/g, "").trim();
  if (!/\d/.test(cleaned)) return { undated: true, uncertain };
  if (ALTERNATIVE.test(cleaned)) return parseAlternativeYears(cleaned, raw, uncertain);
  const [left, right] = cleaned.split(/\s*[~–]\s*/);
  const start = parseSingleYear(left, false);
  if (!start) return { error: `연도를 읽지 못했다: ${raw}` };
  if (start.error) return { error: `${start.error}: ${raw}` };
  if (right === undefined) return { year: start.year, yearEnd: start.year, uncertain };
  const end = parseSingleYear(right, ERA_MARK.test(left));
  if (!end || end.error) return { error: `연도 범위를 읽지 못했다: ${raw}` };
  return { year: start.year, yearEnd: end.year, uncertain };
}

function parseAge(text) {
  const match = text.match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

export function extractLinks(text) {
  return [...text.matchAll(LINK)].map(([, label, url]) => ({ label, url }));
}

function splitSources(text) {
  return text.split(/\s*;\s*/).map((part) => part.trim()).filter(Boolean);
}

function marksOf(text) {
  return MARKS.filter((mark) => text.includes(mark));
}

function findSection(sections, predicate) {
  return sections.find((section) => section.level === 2 && predicate(section.title));
}

function figureMemo(sections) {
  const section = findSection(sections, (title) => title.startsWith("figure.json"));
  if (!section) return null;
  return Object.fromEntries(parseTable(section.lines).rows.map((row) => [row["필드"], { value: row["값"], basis: row["근거"] }]));
}

function deathTypeOf(text) {
  if (/natural|자연사/.test(text)) return "natural";
  if (/event|사건|전사|암살|처형/.test(text)) return "event";
  return null;
}

function nameOf(sections, header) {
  if (header?.name) return header.name;
  const title = sections.find((section) => section.level === 1)?.title ?? "";
  return title.replace(/\s*생애\s*연표.*$/, "").trim();
}

function rowId(prefix, index) {
  return `${prefix}${String(index + 1).padStart(3, "0")}`;
}

function factRow(row, id, born, problems, { checkMarks = true } = {}) {
  const yearInfo = parseYearText(row["연도"] ?? "");
  if (yearInfo.error) problems.errors.push(`[${id}] ${yearInfo.error}`);
  const ageText = row["나이"] ?? "";
  const age = parseAge(ageText);
  const expectedAge = born !== null && yearInfo.year !== undefined ? computeAge(born, yearInfo.year) : null;
  if (age !== null && expectedAge !== null && age !== expectedAge) problems.warnings.push(`[${id}] 나이 ${age}가 엔진 나이 ${expectedAge}와 다르다 (${row["연도"]})`);
  const marks = marksOf(row["확인"] ?? "");
  if (checkMarks && !marks.length) problems.warnings.push(`[${id}] 확인 기호가 없다`);
  return {
    id,
    yearText: row["연도"],
    year: yearInfo.year ?? null,
    yearEnd: yearInfo.yearEnd ?? null,
    yearAlternatives: yearInfo.alternatives ?? null,
    uncertain: Boolean(yearInfo.uncertain),
    undated: Boolean(yearInfo.undated),
    ageText,
    age: expectedAge,
    event: row["사건"],
    sourceText: row["출처"],
    sources: splitSources(row["출처"] ?? ""),
    links: extractLinks(`${row["사건"]} ${row["출처"]}`),
    marks,
    usable: marks.some((mark) => USABLE_MARKS.includes(mark)) && !marks.includes("✗") && !yearInfo.uncertain,
    disputed: marks.includes("⚠"),
  };
}

function classify(text, table) {
  return table.find(([label]) => text.includes(label))?.[1] ?? null;
}

function useOf(row, id, problems) {
  const text = (row["용도"] ?? "").trim();
  if (!text) return { useText: null, use: null };
  const use = classify(text, USES);
  if (!use) problems.warnings.push(`[${id}] 용도 '${text}'를 분류하지 못했다 (${USES.map(([label]) => label).join("·")})`);
  return { useText: text, use };
}

function timelineRows(section, born, problems) {
  return parseTable(section.lines).rows.map((row, index) => {
    const id = rowId("r", index);
    return { ...factRow(row, id, born, problems), ...useOf(row, id, problems) };
  });
}

function variabilityColumn(row) {
  const key = Object.keys(row).find((name) => name.includes("달라질"));
  return key ? row[key].trim() : "";
}

function resolveReference(event, lifeRows) {
  const match = event.trim().match(REFERENCE);
  if (!match) return null;
  const year = parseYearText(match[1]).year;
  const snippet = match[2].trim();
  const sameYear = lifeRows.filter((row) => row.year === year);
  const target = sameYear.find((row) => row.event.startsWith(snippet)) ?? sameYear.find((row) => row.event.includes(snippet));
  return { snippet, target: target ?? null };
}

function referencedRow(row, id, reference, context) {
  const base = factRow(row, id, context.born, context.problems, { checkMarks: false });
  const { target } = reference;
  if (!target) {
    context.problems.errors.push(`[${id}] 참조 행 「${reference.snippet}」(${row["연도"]})을 생애 연표에서 찾지 못했다`);
    return { ...base, ref: null, usable: false };
  }
  const { event, sourceText, sources, links, marks, usable, disputed } = target;
  return { ...base, ref: target.id, event, sourceText, sources, links, marks, usable, disputed };
}

function checkEraYear(entry, kind, context) {
  const { born, died, problems } = context;
  if (entry.year === null) return;
  if (entry.year <= born) problems.warnings.push(`[${entry.id}] 시대 배경은 출생 다음 해부터다 (${entry.yearText})`);
  if (kind === "during" && entry.year > died) problems.warnings.push(`[${entry.id}] 생애 중 시대 배경인데 원래 사망 연도(${died}) 뒤다`);
  if (kind === "after" && entry.year <= died) problems.errors.push(`[${entry.id}] 기록 이후 시대 배경은 원래 사망 연도(${died}) 뒤여야 한다`);
}

function eraRow(row, id, kind, context) {
  const reference = resolveReference(row["사건"] ?? "", context.lifeRows);
  const entry = reference ? referencedRow(row, id, reference, context) : { ...factRow(row, id, context.born, context.problems), ref: null };
  const variabilityText = variabilityColumn(row);
  const variability = variabilityText ? classify(variabilityText, VARIABILITIES) : null;
  if (variabilityText && !variability) context.problems.warnings.push(`[${id}] '달라질 수 있는지' 값 '${variabilityText}'를 분류하지 못했다 (예·아니오·설계에 따라)`);
  checkEraYear(entry, kind, context);
  return { ...entry, section: kind, variabilityText: variabilityText || null, variability, eraUsable: isEraUsable(kind, variability) };
}

function isEraUsable(kind, variability) {
  return kind !== "after" || variability === "no";
}

function eraCandidateRows(sections, context) {
  return ERA_SECTIONS.flatMap(([title, kind, prefix]) => {
    const section = findSection(sections, (heading) => heading.startsWith(title));
    if (!section) return [];
    return parseTable(section.lines).rows.map((row, index) => eraRow(row, rowId(prefix, index), kind, context));
  });
}

export function allTimelineRows(timeline) {
  return [...(timeline?.rows ?? []), ...(timeline?.eraRows ?? [])];
}

function optionalTable(sections, predicate) {
  const section = findSection(sections, predicate);
  return section ? parseTable(section.lines).rows : [];
}

function references(sections) {
  const section = findSection(sections, (title) => title.startsWith("참고 자료"));
  return section ? extractLinks(section.lines.join("\n")) : [];
}

export function parseTimeline(text, expectedId) {
  const problems = { errors: [], warnings: [] };
  const header = parseHeader(text);
  if (!header) problems.errors.push("머리 블록(<!-- uty ... -->)이 없다");
  if (header && header.id !== expectedId) problems.errors.push(`머리 블록 id(${header.id})가 파일 이름(${expectedId})과 다르다`);
  if (header && !CALENDARS.includes(header.calendar)) problems.errors.push(`calendar는 ${CALENDARS.join("·")} 중 하나여야 한다 (현재 ${header.calendar})`);
  const sections = splitSections(text);
  const memo = figureMemo(sections);
  if (!memo) problems.errors.push("'figure.json 반영 메모' 절이 없다");
  const bornInfo = memo?.born ? parseYearText(memo.born.value) : {};
  const diedInfo = memo?.died ? parseYearText(memo.died.value) : {};
  const deathType = memo?.deathType ? deathTypeOf(memo.deathType.value) : null;
  if (bornInfo.year === undefined) problems.errors.push("반영 메모에서 born을 읽지 못했다");
  if (diedInfo.year === undefined) problems.errors.push("반영 메모에서 died를 읽지 못했다");
  if (!deathType) problems.errors.push("반영 메모에서 deathType(event·natural)을 읽지 못했다");
  const born = bornInfo.year ?? null;
  const lifeSection = findSection(sections, (title) => title.startsWith("생애 연표"));
  if (!lifeSection) problems.errors.push("'생애 연표' 절이 없다");
  const rows = lifeSection ? timelineRows(lifeSection, born, problems) : [];
  const eraRows = eraCandidateRows(sections, { born, died: diedInfo.year ?? null, lifeRows: rows, problems });
  return {
    id: header?.id ?? expectedId,
    name: nameOf(sections, header),
    calendar: header?.calendar ?? null,
    born,
    died: diedInfo.year ?? null,
    deathType,
    memo,
    rows,
    eraRows,
    disputes: optionalTable(sections, (title) => title.startsWith("이견")),
    unconfirmed: optionalTable(sections, (title) => title.startsWith("출처 미확인")),
    birthYearEvents: optionalTable(sections, (title) => title.startsWith("출생 연도")),
    references: references(sections),
    ...problems,
  };
}
