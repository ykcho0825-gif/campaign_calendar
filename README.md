# Campaign Calendar

공개 Google Sheets CSV를 읽어 `캠페인명`을 캠페인 기간에 따라 월별 캘린더 형태로 보여주는 정적 웹페이지입니다.

## 실행 방법

```bash
python3 -m http.server 4173
```

브라우저에서 <http://localhost:4173>을 열면 기본 Google Sheets CSV 주소가 자동으로 로드됩니다.

## 지원하는 CSV 형식

- 캠페인명: `캠페인명`, `캠페인`, `Campaign Name`, `name`, `title`
- 시작/종료일: `시작일`/`종료일`, `start date`/`end date`
- 단일 기간 컬럼: `캠페인 기간`, `기간`, `일정`, `period`, `duration`

날짜는 `YYYY-MM-DD`, `YYYY.MM.DD`, `YYYY/MM/DD`, `YYYY년 MM월 DD일` 및 Google Sheets 날짜 serial 값을 지원합니다.
