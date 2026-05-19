# CLX 매뉴얼 자동생성기 개발 로드맵

exBuilder6 프레임워크 기반 `.clx.js` 파일을 정적 분석하여 사용자 매뉴얼(HTML/MD)을 자동 생성하는 도구

## 개요

CLX 매뉴얼 자동생성기는 1인 개발자 또는 소규모 개발팀을 위한 도구로 다음 기능을 제공합니다:

- **CLX 파일 파싱**: .clx.js 파일을 11개 카테고리로 정적 분석
- **AI 매뉴얼 생성**: GitHub Models API / VS Code 프록시를 통한 화면 설명 자동 생성
- **단어사전 연동**: Supabase 기반 용어 사전으로 AI 호출 최소화 및 일관성 보장
- **레이아웃 커스터마이징**: 매뉴얼 출력 형식 및 섹션 구성 템플릿 관리
- **다중 출력 형식**: HTML 및 Markdown 매뉴얼 생성 및 다운로드

## 개발 워크플로우

1. **작업 계획**

   - 기존 코드베이스를 학습하고 현재 상태를 파악
   - 새로운 작업을 포함하도록 `ROADMAP.md` 업데이트
   - 우선순위 작업은 마지막 완료된 작업 다음에 삽입

2. **작업 생성**

   - 기존 코드베이스를 학습하고 현재 상태를 파악
   - `/tasks` 디렉토리에 새 작업 파일 생성
   - 명명 형식: `XXX-description.md` (예: `001-setup.md`)
   - 고수준 명세서, 관련 파일, 수락 기준, 구현 단계 포함
   - **API/비즈니스 로직 작업 시 "## 테스트 체크리스트" 섹션 필수 포함 (Playwright MCP 테스트 시나리오 작성)**
   - 예시를 위해 `/tasks` 디렉토리의 마지막 완료된 작업 참조

3. **작업 구현**

   - 작업 파일의 명세서를 따름
   - 기능과 기능성 구현
   - **API 연동 및 비즈니스 로직 구현 시 Playwright MCP로 테스트 수행 필수**
   - 각 단계 후 작업 파일 내 단계 진행 상황 업데이트
   - 구현 완료 후 Playwright MCP를 사용한 E2E 테스트 실행
   - 테스트 통과 확인 후 다음 단계로 진행
   - 각 단계 완료 후 중단하고 추가 지시를 기다림

4. **로드맵 업데이트**

   - 로드맵에서 완료된 작업을 ✅로 표시

---

## 개발 단계

### Phase 1: 애플리케이션 골격 구축 ✅

- **Task 001: 프로젝트 구조 및 라우팅 설정** ✅ - 완료
  - ✅ Next.js 16 App Router 기반 전체 라우트 구조 생성 (`/`, `/generate`, `/result`, `/dictionary`, `/layout-manager`)
  - ✅ 공통 레이아웃 컴포넌트 구현 (Header, Footer, Container, PageHeader)
  - ✅ ThemeProvider 및 다크모드 지원 설정
  - ✅ shadcn/ui 기반 UI 컴포넌트 라이브러리 설치

- **Task 002: 타입 정의 및 인터페이스 설계** ✅ - 완료
  - ✅ CLX 파싱 결과 타입 정의 (11개 카테고리: 화면개요, CRUD, 필수값, 그리드, 조건그룹, 인포그룹, 팝업, 탭페이지 등)
  - ✅ Supabase 데이터베이스 스키마 타입 정의 (dictionary, layout_template, generation_log)
  - ✅ AI 요청/응답 인터페이스 정의 (GitHub Models API, VS Code 프록시)
  - ✅ 파일 트리 구조 타입 정의 (FileNode, FileTree, CheckState)
  - ✅ 매뉴얼 생성 옵션 및 결과 타입 정의

- **Task 003: 상태 관리 스토어 설계** ✅ - 완료
  - ✅ Zustand 스토어 구조 설계 (파일트리 스토어, 분석결과 스토어, 생성옵션 스토어)
  - ✅ AI 설정 상태 관리 (localStorage 연동 - zustand/persist)
  - ✅ 생성 진행률 및 토큰 사용량 추적 상태
  - ✅ 레이아웃 템플릿 편집 상태

---

### Phase 2: UI/UX 완성 (더미 데이터 활용)

- **Task 004: 메인 대시보드 UI 완성** ✅ - 완료
  - ✅ 3개 기능 카드 UI 디자인 완성 (아이콘, 뱃지, 기능 목록, 호버 효과, 접근성 aria-label)
  - ✅ 최근 생성 히스토리 요약 표시 (더미 데이터)
  - ✅ 반응형 디자인 적용 (모바일/태블릿/데스크탑)
  - ✅ 히어로 섹션 통계 수치 표시 (분석 카테고리·출력형식·AI 모델)

- **Task 005: 매뉴얼 생성 페이지 UI 구현** ✅ - 완료
  - ✅ 파일 업로드 영역 UI 완성 (드래그앤드롱 존, 파일 선택 버튼: 단일/다중/폴더)
  - ✅ 파일 트리 컴포넌트 구현 (계층 구조, 체크박스: 전체/폴더/개별 선택, indeterminate 상태)
  - ✅ AI 설정 패널 UI (모드 전환, API 키 입력·표시, 모델 선택, 프록시 URL)
  - ✅ 생성 진행률 표시 UI (프로그레스바, 현재 처리 파일, 토큰 사용량)
  - ✅ "매뉴얼 생성" 버튼 및 유효성 검사 표시 (zustand 스토어 연동)

- **Task 006: 결과 페이지 UI 구현** ✅ - 완료
  - ✅ 탭 전환 UI (분석 결과 / HTML 미리보기 / Markdown)
  - ✅ 분석 결과 카테고리별 아코디언 표시 (더미 파싱 데이터)
  - ✅ HTML 매뉴얼 실시간 미리보기 (iframe 렌더링)
  - ✅ Markdown 매뉴얼 표시 영역 (코드블록 스타일)
  - ✅ 파일별 결과 전환 사이드바
  - ✅ 다운로드 버튼 그룹 (HTML/MD 개별, JSZip ZIP 일괄)
  - ✅ 더미 데이터 2개 파일로 전체 흐름 확인 가능

- **Task 007: 단어사전 관리 페이지 UI 구현** ✅ - 완료
  - ✅ 용어 목록 테이블 UI (컬럼: 용어명, 카테고리, 설명, 출처, 등록일)
  - ✅ 검색 필터 UI (키워드·설명 전문 검색, 카테고리 드롭다운 필터)
  - ✅ 용어 추가/수정 모달 (Zod 유효성 검사, React Hook Form)
  - ✅ 삭제 확인 다이얼로그
  - ✅ 페이지네이션 컴포넌트 (10/20/50개씩, 페이지 번호)
  - ✅ 출처 구분 뱃지 (AI 자동 / 수동 등록)
  - ✅ 통계 요약 (전체·AI자동·수동 카운트), 더미 데이터 12건

- **Task 008: 레이아웃 관리 페이지 UI 구현** ✅ - 완료
  - ✅ 섹션 목록 드래그앤드롭 정렬 UI (GripVertical 핸들, HTML5 DnD API)
  - ✅ 섹션 포함/제외 토글 스위치 (zustand `toggleSection` 연동)
  - ✅ 섹션별 세부 옵션 패널 (커스텀 제목, 테이블 표시, 설명 깊이, 예시 포함)
  - ✅ 레이아웃 프리셋 저장/불러오기 UI (이름 입력, 목록/기본설정/삭제)
  - ✅ 미리보기 패널 (포함 섹션 순서 표시, 제외 섹션 배지, 출력 샘플 스켈레톤)
  - ✅ Tabs로 [섹션 구성 / 프리셋 관리] 전환, 초기화·저장 버튼

---

### Phase 3: 핵심 기능 구현

- **Task 009: Supabase 연동 및 데이터베이스 구축** ✅ - 완료
  - ✅ `.env.local.example` 환경변수 템플릿 생성 (SUPABASE_URL, SUPABASE_ANON_KEY)
  - ✅ `supabase/migrations/001_initial_schema.sql` — 3개 테이블 + RLS 정책 + 인덱스
  - ✅ `src/lib/supabase/client.ts` — 싱글턴 createClient (persistSession: false)
  - ✅ `src/lib/supabase/queries/dictionary.ts` — listDictionary, findByTerm, insert, update, delete
  - ✅ `src/lib/supabase/queries/layout-template.ts` — list, getDefault, insert, update, setDefault, delete
  - ✅ `src/lib/supabase/queries/generation-log.ts` — insert, listRecent
  - ✅ `database.ts` user_id nullable 수정 + Database 스키마 표준화

- **Task 010: 단어사전 CRUD 기능 구현** ✅ - 완료
  - ✅ 용어 목록 조회: Supabase `listDictionary` (서버사이드 검색·카테고리필터·페이지네이션)
  - ✅ 용어 추가: `insertDictionary` + sonner 토스트 성공/실패 알림
  - ✅ 용어 수정: `updateDictionary` + 모달 `submitting` 로딩 상태
  - ✅ 용어 삭제: `deleteDictionary` + `DeleteConfirmDialog` `loading` 상태
  - ✅ 더미 데이터 제거, 실제 Supabase 호출로 교체 완료
  - ✅ 로딩 스피너, 오류 배너(재시도 버튼), 빈 상태 UI 추가
  - ✅ 검색 350ms 디바운스 적용
  - ✅ `getDictionaryStats` 헬퍼 (전체/AI/수동 카운트)
  - ✅ E2E 브라우저 테스트: INSERT → UPDATE → DELETE 전 흐름 검증

- ✅ **Task 011: CLX 파일 파싱 엔진 구현** - 완료
  - ✅ v6 프로젝트 파서 코드 분석 및 포팅 (9개 파서 모듈)
  - ✅ `src/lib/parser/` 디렉토리: index, headerParser, crudParser, validationParser, gridParser, conditionGroupParser, infoGroupParser, popupParser, embAppParser, udcRegistry
  - ✅ `src/types/clx.ts` 완전 재작성 (v6 AnalysisResult 구조 반영)
  - ✅ 결과 페이지 컴포넌트 타입 호환 업데이트 (dummy-data, parse-result-accordion)
  - ✅ tsc --noEmit 0 errors 검증 완료

- **Task 012: 파일 업로드 및 트리 관리 기능 구현** ✅ - 완료
  - ✅ 단일/다중/폴더 파일 업로드 처리 (.clx.js 필터링)
  - ✅ 드래그앤드롭 업로드 기능 (폴더 재귀 읽기: webkitGetAsEntry)
  - ✅ 파일 트리 상태 관리 (Zustand 연동, 파일 content 병렬 읽기)
  - ✅ 체크박스 선택 로직 (전체/폴더/개별, 부모-자식 연동)
  - ✅ 선택된 파일 목록 추출 및 검증 (중복 제거, content 빈값 검증)

- **Task 013: AI 연동 및 매뉴얼 생성 로직 구현** ✅ - 완료
  - ✅ GitHub Models API 연동 (gpt-4o-mini 기본)
  - ✅ VS Code Extension 프록시 연동 (localhost:3100)
  - ✅ AI 모드 전환 로직 (API 키 모드 / 프록시 모드)
  - ✅ 단어사전 우선 조회 → 미존재 시 AI 호출 → 자동 INSERT 로직 (F008)
  - ✅ 프롬프트 엔지니어링 (카테고리별 최적 프롬프트: 그리드/조건그룹/버튼/개요)
  - ✅ 생성 진행률 추적 및 토큰 사용량 집계
  - ✅ API 키 및 설정 localStorage 저장/불러오기 (zustand/persist)
  - ✅ API Route (`/api/generate`) + 클라이언트 연동 완료

- **Task 014: 레이아웃 템플릿 관리 기능 구현** ✅ - 완료
  - ✅ 섹션 순서 변경 (드래그앤드롭) 상태 저장
  - ✅ 섹션 포함/제외 토글 로직
  - ✅ 섹션별 세부 옵션 저장
  - ✅ 프리셋 저장/불러오기 (Supabase CRUD)
  - ✅ 기본 템플릿 설정 기능
  - ✅ Playwright MCP로 레이아웃 저장/적용 테스트

- **Task 014-1: 핵심 기능 통합 테스트** ✅ - 완료
  - ✅ Playwright MCP를 사용한 전체 사용자 플로우 테스트 (파일 업로드 → 분석 → 생성 → 결과 확인)
  - ✅ 단어사전 연동 매뉴얼 생성 시나리오 검증
  - ✅ 레이아웃 적용 후 매뉴얼 출력 형식 검증
  - ✅ 에러 핸들링 및 엣지 케이스 테스트 (빈 파일, 잘못된 형식, API 오류)

---

### Phase 4: 출력 및 최적화

- ✅ **Task 015: HTML/MD 매뉴얼 출력 엔진 구현**
  - ✅ HTML 매뉴얼 템플릿 엔진 (레이아웃 설정 반영, 스타일링된 독립형 HTML)
  - ✅ Markdown 매뉴얼 생성기 (구조화된 MD 형식)
  - ✅ 레이아웃 템플릿 → 출력 매핑 로직 (섹션 순서, 포함/제외 반영)
  - ✅ iframe 기반 HTML 실시간 미리보기
  - ✅ 파일 다운로드 기능 (HTML/MD 개별 다운로드)
  - ✅ JSZip 활용 일괄 ZIP 다운로드 (다중 파일 결과)

- **Task 016: 성능 최적화 및 배포 준비**
  - 대용량 파일 처리 최적화 (Web Worker 또는 스트리밍)
  - AI 호출 병렬 처리 및 에러 재시도 로직
  - 생성 로그 저장 (generation_log 테이블)
  - Vercel 배포 설정 (환경변수, Edge Functions)
  - 에러 바운더리 및 로딩 상태 최적화
  - 최종 E2E 테스트 수행 및 검증

---

## 기술 스택 요약

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router), React 19, TypeScript 5.6+ |
| 스타일링 | TailwindCSS v4, shadcn/ui, Lucide React |
| 폼/검증 | React Hook Form 7.x, Zod |
| 상태 관리 | Zustand |
| 데이터베이스 | Supabase (PostgreSQL) |
| AI 연동 | GitHub Models API (gpt-4o-mini), VS Code Extension Proxy |
| 유틸리티 | JSZip (ZIP 다운로드) |
| 배포 | Vercel |
| 테스트 | Playwright MCP (E2E) |
