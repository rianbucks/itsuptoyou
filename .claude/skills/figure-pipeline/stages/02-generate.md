# 2 JSON 생성 (stage: generate)

전제: `node tools/stage.mjs status {id}`에 proposal 승인이 있어야 한다.

`node tools/stage.mjs start {id} generate`

## 파일과 스키마

| 파일 | 스키마 | 분량 기준 |
| --- | --- | --- |
| figure.json | figure.schema.json | 특성 3~5개 |
| growth.json | growth.schema.json | 승인된 성장 사건 |
| nodes.json | node.schema.json | 승인된 노드, 선택지 2~4개 |
| fragments.json | fragment.schema.json | 노드 × 선택지 × 성공/실패 전부 |
| endings.json | ending.schema.json | 20~30개 (시험 인물은 줄여도 된다) |
| events.json | common-event.schema.json | 30~40개 |
| chronicle.json | chronicle.schema.json | 승인된 후보 |
| era.json | era.schema.json | 승인된 후보 |
| life.json | life.schema.json | 약 120개(나이대 6 × 초점 7 × 변형 약 3) |

생성 순서: figure → nodes → fragments → growth → endings → chronicle·era → events → life. 앞 파일의 플래그·id를 뒤 파일이 쓴다.

## 규칙 (SKILL.md 공통 규칙에 더해)

- 사실 항목은 근거 행이 있어야 한다. 사실 항목: 프롤로그, 성장 사건 상황, 역사적 성향 문구, 역사 분기점 상황, 역사대로 선택지의 success 조각, 실제 역사 결말, 역사대로 선택지의 harm, 기록 서술, 시대 배경.
- 사실 항목마다 근거 행을 `tools/pipeline/{id}/trace.json`에 적는다. 키는 사실 항목 id다.
  - `prologue:{figure id}`, `growthSituation:{growth id}`, `growthHistorical:{growth id}/{choice id}`, `nodeSituation:{node id}`, `historicalFragment:{fragment id}`, `historicalEnding:{ending id}`, `harm:{growth 또는 node id}/{choice id}`, `chronicle:{id}`, `era:{id}`
  - 값은 행 id 배열: `{"chronicle:yi_chr_3": ["r014"]}`. 시대 배경 후보 절에서 가져온 era는 그 행 id(`e003`, `x002`)를 쓴다. 참조 행이면 `e011`과 참조된 `r031` 중 어느 쪽을 써도 된다.
- era 문장은 시대 배경 후보 절의 사건 칸(3인칭 현재형)을 바탕으로 쓰되, 한 단락 3문장 이내로 다듬는다. 기록 이후 절의 era는 year가 원래 사망 연도 뒤여야 하고, '달라질 수 있는지'가 `아니오`인 행에서만 만든다(GDD §4.6). 이 era에는 requires를 달지 않는다.
- 시대 배경 후보의 '달라질 수 있는지'가 `예`이면 제안 단계에서 정한 플래그를 그 노드 결과에 남기고 era에 requires를 단다.
- 같은 해 고정 사건 뒤에 일어난 기록 서술·시대 배경은 `after`에 그 성장 사건·노드 id를 적는다(GDD §2·§4.6). 그 사건을 처리한 직후에 보이고, requires는 그때 판단하므로 같은 해 앞선 노드의 플래그로 숨길 수 있다.
  - 같은 자리에 여럿이면 `order`(0부터)로 시간순을 맞춘다. 두 파일(chronicle·era)을 합쳐 정렬한다.
  - 기준 사건이 그 해에 처리되지 않으면(교체·requires로 건너뜀) 그 해 고정 사건이 끝난 뒤 보인다. 그 노드의 결과를 전제로 한 문장이면 그 노드 결과가 남기는 긍정 플래그를 requires로 단다.
  - 그 해 첫 고정 사건보다 앞선 일은 `after` 없이 둔다.
- 역사대로 선택지의 success는 '실제로 일어난 결과'다. 실제 역사가 패배였다면 success 조각이 그 패배를 쓴다(§3).
- 일탈을 만드는 결과(대안 성향, 대안 선택지, 역사대로 선택지의 실패)는 이후 기록 서술과 충돌하면 플래그를 남긴다. 4단계에서 다시 점검한다.
- 공통 이벤트가 남기는 플래그는 `life_`로 시작하고 공통 이벤트 requires에서만 읽는다(§4.5).
- 생활 서술은 반복될 수 있으므로 "~하기 시작한다"처럼 처음을 뜻하는 표현을 피한다.

`node tools/stage.mjs end {id} generate --counts nodes=..,fragments=..,endings=..,events=..,chronicle=..,era=..,life=..`
