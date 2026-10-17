# 0 연표 파싱 (stage: parse)

1. `node tools/stage.mjs start {id} parse`
2. `node tools/parse-timeline.mjs {id}`
   - 오류가 있으면 멈추고 사용자에게 연표 수정을 요청한다. 연표를 직접 고치지 않는다(머리 블록 추가처럼 형식만 맞추는 수정은 사용자에게 알리고 해도 된다).
   - 경고(나이 불일치, 확인 기호 없음)는 제안 단계에서 다룬다.
3. `tools/pipeline/{id}/timeline.json`을 읽어 다음을 파악한다: 사실로 쓸 수 있는 행(`usable`), 이견 행(`disputed`), 연도 없는 행, 행별 용도(`use`, 열이 있을 때), 시대 배경 후보 행(`eraRows`: `section` during·after, 참조 `ref`, `variability` yes·no·design), 이견 절, 출처 미확인 절, 출생 연도 세계 사건 후보, 참고 링크.
4. `node tools/stage.mjs end {id} parse --counts rows=행수,usable=사용가능,disputed=이견`
