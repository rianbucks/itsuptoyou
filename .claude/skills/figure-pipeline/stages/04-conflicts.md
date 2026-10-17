# 4 충돌 플래그 점검 (stage: conflicts, GDD §4.6)

`node tools/stage.mjs start {id} conflicts`

1. `node tools/check-conflicts.mjs {id}` → `tools/pipeline/{id}/conflict-candidates.json`에 기록 서술·시대 배경과, 그보다 먼저 처리되는 일탈 결과 목록이 나온다.
   - 앞선 해의 결과는 모두 포함한다.
   - `after`가 있는 서술은 같은 해에 기준 사건까지(그 사건 포함) 처리되는 결과도 포함한다. 기준 사건이 건너뛰어질 수 있으면(requires 플래그나 교체 노드가 있으면) 같은 해의 모든 결과를 포함한다.
   - `after`가 없는 서술은 같은 해 결과를 포함하지 않는다(그 해 첫머리에 나온다).
2. 짝마다 "이 결과가 일어난 판에서 이 문장이 거짓이 되는가"를 판단해 `tools/pipeline/{id}/conflicts.json`에 적는다.
   ```json
   { "judgments": [
     { "item": "chronicle:x_chr_4", "outcome": "node:x_coup/stay/failure", "conflict": true, "reason": "왕이 복위하지 못한 판에서 복위한 왕의 인장은 없다" },
     { "item": "chronicle:x_chr_4", "outcome": "*", "conflict": false, "reason": "나머지 결과는 이 기록과 무관하다" }
   ] }
   ```
   - `"outcome": "*"`는 따로 적지 않은 나머지 결과 전부에 대한 판단이다.
   - 시대 배경도 인물의 선택으로 거짓이 될 수 있다(예: 인물이 막은 전쟁의 결과).
3. 충돌로 판단한 짝은 데이터로 막는다.
   - 충돌하는 결과에 setFlags를 추가하고, 서술에 requires를 단다. 역사대로 성공 결과가 남기는 긍정 플래그(`king_restored: true`)를 requires에 쓰면 실패·대안 결과 전부를 한 번에 막을 수 있다.
   - `deviated`로 일괄로 숨기지 않는다(§4.6).
4. `node tools/check-conflicts.mjs {id}`를 다시 실행한다. 통과 조건:
   - 판단이 없는 짝 0개
   - 충돌로 판단한 결과 뒤에 문장이 보이는 판 0
   - requires 플래그가 서술 연도보다 앞선 결과에서 설정됨
   - 역사대로만 진행한 판에서 모든 서술이 보임
5. 연표에 시대 배경 후보 절이 있으면 스크립트가 trace.json으로 era와 후보 행을 이어 함께 점검한다.
   - '달라질 수 있는지: 예' 행에서 온 era는 requires가 없으면 오류다.
   - '설계에 따라' 행에서 온 era는 해당 주제의 노드·연장 노드·결말 플래그가 지금 데이터에 있는지 판단해 `{ "item": "era:…", "outcome": "design", "conflict": true|false, "reason": "…" }`를 남긴다. 판단이 없으면 미판단으로 세고, true인데 requires가 없으면 오류다. `"*"` 판단은 이것을 대신하지 않는다.
   - 기록 이후 절에서 온 era가 원래 사망 연도 이하이거나, 원래 사망 연도 뒤의 era가 기록 이후 절이 아닌 행에서 왔으면 오류다.
   - 원래 사망 연도 뒤의 era가 '달라질 수 있는지: 아니오'가 아닌 행에서 왔으면 오류다(GDD §4.6). requires로 숨기지 않고 era를 지운다.
6. `npm run validate`로 플래그 규칙(설정 안 된 플래그 오류)을 다시 확인한다.
7. `tools/pipeline/{id}/conflicts.md`가 검수 페이지에 쓰인다.

`node tools/stage.mjs end {id} conflicts --counts pairs=판단한짝수,conflicts=충돌수,flagsAdded=추가한플래그수`
