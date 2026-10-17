---
name: figure-pipeline
description: UTY 인물 콘텐츠 제작 파이프라인. docs/figures/{id}_timeline.md 연표에서 노드·성장 사건 제안, data/figures/{id}/ JSON 9종 생성, 검증, 충돌 플래그 점검, 난이도 자동 조정, 사실 대조, 사람 검수까지 단계별로 진행한다. "인물 만들기", "{인물} 콘텐츠 생성", "파이프라인 실행/재개" 같은 요청에 쓴다.
---

# 인물 콘텐츠 파이프라인

입력: `docs/figures/{id}_timeline.md` (형식은 `docs/figures/TIMELINE_FORMAT.md`).
출력: `data/figures/{id}/` 9개 파일, `tools/review/{id}.json`, `tools/pipeline/{id}/` 작업 기록.

## 시작과 재개

1. `node tools/stage.mjs status {id}`로 어느 단계까지 끝났는지 본다. 새 세션이면 이것부터 한다.
2. `done`이 아닌 첫 단계부터 진행한다. 단계 지침은 `stages/`에 있다. 해당 단계 파일을 읽고 그대로 따른다.
3. 단계를 시작할 때 `node tools/stage.mjs start {id} {stage}`, 끝낼 때 `node tools/stage.mjs end {id} {stage} --counts 키=값,...`을 실행한다. 사용자를 기다리는 동안은 `wait`/`resume`으로 기록한다. 시간 기록이 인물 100명 작업량 추정의 근거이므로 빠뜨리지 않는다.

| 단계 | stage | 지침 | 멈춤 |
| --- | --- | --- | --- |
| 0 연표 파싱 | parse | stages/00-parse.md | 파서 오류가 있으면 연표 수정을 요청 |
| 1 노드·성장 사건 제안 | propose | stages/01-propose.md | **사용자 승인 필수** |
| 2 JSON 생성 | generate | stages/02-generate.md | |
| 3 검증 루프 | validate | stages/03-validate.md | 같은 오류 3회 반복 시 질문 |
| 4 충돌 플래그 점검 | conflicts | stages/04-conflicts.md | |
| 5 난이도 조정 | tune | stages/05-tune.md | 목표 미달(구조 문제)이면 보고하고 질문 |
| 6 사실 대조 | factcheck | stages/06-factcheck.md | |
| 7 검수 | review | stages/07-review.md | **사용자 검수 필수** |
| 8 마무리 | finish | stages/08-finish.md | |

## 모든 단계에 걸리는 규칙

- 사실은 연표에서만 가져온다. 기억으로 연도·인물·수치·사건을 채우지 않는다(CLAUDE.md). 연표에 없으면 사용자에게 묻는다.
- 연표 행의 확인 기호: `✓`·`△`만 사실로 쓴다. `✗`와 연도 뒤 `?`(불확실) 행은 쓰지 않는다. `⚠` 행은 disputed를 달고 단정하지 않는 문장으로 쓴다(GDD §9).
- sources에는 연표 출처 열의 문구를 그대로 옮긴다(언어 그대로, 번역하지 않는다).
- 문체: 플레이 문장은 2인칭 현재형("당신은 ~한다"), 시대 배경만 3인칭 현재형. 한 단락 3문장 이내. 결말에 굿·배드 같은 평가 표현을 쓰지 않는다(GDD §5). 악영향 코멘트는 피해를 사실로만 쓴다(§7).
- 날짜는 연표 머리 블록의 calendar 역법 그대로 쓰고 환산하지 않는다. 음력이 아닌 역법도 같다.
- 기원전 연도는 음수, 0년은 없다. 나이는 엔진 규칙(출생 해 0세)으로 계산한다.
- 가상 내용(대안 선택지, 대체역사 조각·결말, 공통 이벤트, 생활 서술)에는 특정 인명·지명·날짜·사건을 사실처럼 주장하지 않는다(§4.5).
- 이순신 같은 특정 인물 전용 규칙을 스킬이나 tools/에 넣지 않는다. 인물 차이는 연표와 데이터로만 표현한다.
