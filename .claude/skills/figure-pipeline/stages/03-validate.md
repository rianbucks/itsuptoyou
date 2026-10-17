# 3 검증 루프 (stage: validate)

`node tools/stage.mjs start {id} validate`

1. `data/figures/index.json`에 id가 없으면 추가한다.
2. `npm run validate`를 실행하고 그 인물의 오류를 고친다. 다시 실행한다. 오류가 0개가 될 때까지 반복한다.
3. 같은 오류가 3번 연속 남으면 멈추고 원인과 선택지를 사용자에게 보여준다. 스키마나 검증 규칙을 고쳐서 통과시키지 않는다.
4. 경고 처리
   - 역사 일치 확률·결말 비율 경고는 5단계에서 다룬다.
   - 검수 경고는 7단계에서 사라진다.
   - 그 밖의 경고(읽지 않는 플래그, 생활 서술 공백 등)는 고치거나, 남기는 이유를 마무리 보고에 적는다.
5. `npm test`도 통과해야 한다.

`node tools/stage.mjs end {id} validate --counts runs=validate실행횟수,errorsFixed=고친오류수`
