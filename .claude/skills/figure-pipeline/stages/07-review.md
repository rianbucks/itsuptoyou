# 7 검수 (stage: review, 사람)

1. 검수 서버를 띄운다: `node tools/review-server.mjs` (http://127.0.0.1:8770/?figure={id}). localhost에서만 열린다. 게임 배포물이 아니다.
2. 사용자에게 안내한다: 항목마다 문장·sources·근거 연표 행·원문 발췌·자동 판정·이견·충돌 판단을 보고 승인 또는 반려한다. 원문을 직접 찾았으면 "원문 직접 붙이기"로 남긴다.
3. 기록:
   ```
   node tools/stage.mjs start {id} review      (사용자가 검수를 시작할 때)
   node tools/stage.mjs end {id} review --counts approved=..,rejected=..
   ```
   항목별 검수 시간은 검수 파일의 decision.elapsedMs에 남는다.
4. 반려된 항목이 있으면 메모를 읽고 2단계 규칙으로 데이터를 고친 뒤, 바뀐 항목만 6단계(`factcheck list`는 바뀐 항목만 다시 뽑는다)와 7단계를 다시 한다. 승인 뒤 문장이 바뀌면 승인은 자동으로 무효(검증기 경고 '승인 뒤 내용이 바뀜')가 된다.
5. 승인은 사용자만 한다. Claude가 검수 API로 승인하지 않는다.
