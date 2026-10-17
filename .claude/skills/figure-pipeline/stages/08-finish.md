# 8 마무리 (stage: finish)

`node tools/stage.mjs start {id} finish`

1. `npm run validate`: 그 인물의 오류 0개, 검수 경고 0개. 남은 경고는 이유를 적는다.
2. `npm test`, `npm run simulate`
3. `npm run simulate -- --story {id} 0`으로 한 판의 스토리 로그를 읽고 문체·사실 표기를 훑어본다.
4. `node tools/stage.mjs end {id} finish`
5. `node tools/stage.mjs summary {id}`와 `node tools/stage.mjs estimate`를 사용자에게 보여준다.
6. 커밋은 사용자가 요청할 때만 한다.
