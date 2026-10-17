# 5 난이도 조정 (stage: tune)

`node tools/stage.mjs start {id} tune`

1. `node tools/tune-difficulty.mjs {id}` (미리보기). LLM을 쓰지 않는 결정적 알고리즘이다.
   - A: 역사대로 선택지 difficulty를 함께 이동해 역사 일치 확률 평균을 45~55%로 맞추고, 초점 고정 최고값이 70%를 넘으면 그 능력치 비중이 큰 노드를 올린 뒤 다시 맞춘다.
   - B: 무작위 선택 판에서 결말 비율이 `rules.endingShare.max`(30%) 이상이거나 0%인 결말을 대안 선택지 difficulty로 고친다. 실제 역사 결말과 기본 결말(isDefault)은 0% 검사에서 뺀다(GDD §5). 30% 상한은 모든 결말에 적용한다.
   - 참고용으로 역사 성향 플레이어(역사대로 선택지·역사적 성향을 70% 확률로 고름)의 분포도 함께 출력한다. 통과 기준에는 쓰지 않는다.
   - 목표 미달의 원인이 결말 순서라면 GDD §5대로 플래그를 큰 일탈·작은 일탈로 나눈 표를 만들어 사용자 확인을 받고, 큰 일탈을 먼저 검사하거나 작은 일탈을 앞선 상태와 조합한 조건으로 고친다.
   - 각 difficulty는 작성 값 ±20, 0~100 안에서만 움직인다.
2. "목표 달성"이면 `node tools/tune-difficulty.mjs {id} --write`로 nodes.json에 쓴다.
3. "목표 미달"이면 멈추고 미해결 항목과 이유를 사용자에게 보여준다. 구조 문제(결말 조건이 넓음, 한 능력치에 쏠린 노드 등)는 데이터를 어떻게 고칠지 제안하고 승인을 받는다. 승인 없이 결말 조건이나 노드 구조를 바꾸지 않는다.
4. 쓴 뒤 `npm run validate`, `npm run simulate`로 확인한다.

`node tools/stage.mjs end {id} tune --counts changed=바뀐difficulty수,ok=1또는0`
