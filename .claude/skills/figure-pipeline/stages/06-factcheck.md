# 6 사실 대조 (stage: factcheck)

`node tools/stage.mjs start {id} factcheck`

1. `node tools/factcheck.mjs list {id}` → `tools/pipeline/{id}/factcheck-todo.json`. 대조하지 않았거나 내용이 바뀐 사실 항목과 근거 연표 행·링크가 들어 있다. 대체역사 내용은 목록에 없다.
2. 항목마다 원문을 찾는다.
   - 근거 행의 링크, 연표 참고 자료의 링크를 WebFetch로 연다. 원문 전사본(위키문헌 등)을 우선한다.
   - 로컬 원문(`docs/figures/{id}_sources/`)이 있으면 그것을 읽는다.
   - 사이트가 막혀 있거나 해당 구절을 찾지 못하면 억지로 판정하지 않는다.
3. 판정
   - `match`: 문장의 사실(인물·연도·수치·행위·결과)이 발췌와 모두 맞는다.
   - `mismatch`: 하나라도 어긋난다. note에 어느 부분이 어떻게 다른지 적는다.
   - `unverifiable`: 원문을 열지 못했거나 해당 구절을 찾지 못했다. note에 시도한 곳을 적는다.
   - 게임 문장의 2인칭 서술·연출은 판정 대상이 아니다. 사실 주장만 본다.
4. 발췌는 판정에 필요한 몇 문장만 원문 언어 그대로 적는다. 한국어가 아니면 translation에 대역을 적는다. 근현대 2차 자료는 짧게 인용한다.
5. 결과를 `tools/pipeline/{id}/factcheck-results.json`에 쓰고 기록한다.
   ```json
   [{ "item": "chronicle:x_chr_1", "verdict": "match", "source": "사료 이름 권·장", "url": "https://...", "excerpt": "원문", "translation": "대역", "note": "" }]
   ```
   `node tools/factcheck.mjs record {id} --file tools/pipeline/{id}/factcheck-results.json`
6. `mismatch`는 데이터를 고치지 않는다. 연표와 원문 중 무엇이 맞는지는 검수에서 사람이 정한다.
7. `node tools/factcheck.mjs status {id}`

`node tools/stage.mjs end {id} factcheck --counts items=대조항목수,match=..,mismatch=..,unverifiable=..`
