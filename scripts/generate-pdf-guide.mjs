/**
 * CLX 매뉴얼 자동생성기 - 사용자 가이드 PDF 생성 스크립트
 *
 * 실행 방법:
 *   node scripts/generate-pdf-guide.mjs
 *
 * 사전 조건:
 *   - 개발 서버 실행 중 (localhost:3000)
 *   - 매뉴얼 생성을 한 번 완료한 상태 (결과가 localStorage에 저장됨)
 *
 * 출력:
 *   docs/user-guide.pdf
 */

import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = join(ROOT, "docs", "screenshots");
const OUTPUT_PDF = join(ROOT, "docs", "user-guide.pdf");

mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ──────────────────────────────────────────────
// 1. 스크린샷 캡처 대상 목록
// ──────────────────────────────────────────────
const CAPTURES = [
  {
    id: "01-home",
    url: "/",
    label: "메인 대시보드",
    fullPage: true,
    waitFor: null,
  },
  {
    id: "02-generate-empty",
    url: "/generate",
    label: "매뉴얼 생성 - 초기 화면",
    fullPage: false,
    waitFor: null,
  },
  {
    id: "03-generate-ai-panel",
    url: "/generate",
    label: "AI 설정 패널",
    fullPage: false,
    clip: { selector: null, rightPanel: true }, // 우측 1/3 패널
    waitFor: null,
  },
  {
    id: "04-result-analysis",
    url: "/result",
    label: "결과 - 분석 결과 탭",
    fullPage: false,
    waitFor: null,
    clickTabText: null, // 기본 탭
  },
  {
    id: "04-result-html",
    url: "/result",
    label: "결과 - HTML 미리보기 탭",
    fullPage: false,
    waitFor: null,
    clickTabText: "HTML 미리보기",
  },
  {
    id: "04-result-markdown",
    url: "/result",
    label: "결과 - Markdown 탭",
    fullPage: false,
    waitFor: null,
    clickTabText: "Markdown",
  },
  {
    id: "05-dictionary",
    url: "/dictionary",
    label: "단어사전 관리",
    fullPage: false,
    waitFor: null,
  },
  {
    id: "06-layout-manager",
    url: "/layout-manager",
    label: "레이아웃 관리",
    fullPage: false,
    waitFor: null,
  },
];

// ──────────────────────────────────────────────
// 2. API 캐시에서 생성 결과 읽기
// ──────────────────────────────────────────────
async function readGenerationResult(browser) {
  const page = await browser.newPage();
  try {
    const response = await page.goto(`${BASE_URL}/api/result-cache`, {
      waitUntil: "networkidle",
      timeout: 10000,
    });
    const json = await response.json();
    return json?.result ?? null;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

// ──────────────────────────────────────────────
// 3. 스크린샷 캡처 함수
// ──────────────────────────────────────────────
async function captureScreenshots(browser, generationResult) {
  const screenshots = {};

  for (const capture of CAPTURES) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log(`  📸 캡처 중: ${capture.label} (${capture.url})`);

    try {
      // result 페이지는 localStorage 주입 후 이동
      if (capture.url === "/result" && generationResult) {
        // 먼저 같은 origin 페이지로 이동해 localStorage 접근 권한 확보
        await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 15000 });
        await page.evaluate((result) => {
          // Zustand persist 형식으로 localStorage에 주입
          localStorage.setItem(
            "clx-generation-result",
            JSON.stringify({ state: { result }, version: 0 })
          );
        }, generationResult);
      }

      await page.goto(`${BASE_URL}${capture.url}`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });

      // 애니메이션 정착 대기
      // 탭 목록이 있는 페이지라면 탭리스트 렌더링까지 대기
      if (capture.clickTabText) {
        await page.waitForSelector('[role="tablist"]', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);
      } else {
        await page.waitForTimeout(1500);
      }

      // 탭 클릭이 필요한 경우 — 여러 selector를 순서대로 시도
      if (capture.clickTabText) {
        let clicked = false;
        try {
          // 방법 1: role=tab + 텍스트 필터
          const tab = page.locator('[role="tab"]').filter({ hasText: capture.clickTabText }).first();
          await tab.waitFor({ state: "visible", timeout: 8000 });
          await tab.click();
          clicked = true;
        } catch (_) {}

        if (!clicked) {
          try {
            // 방법 2: 텍스트로 직접 버튼 클릭
            await page.getByRole("tab", { name: capture.clickTabText }).click({ timeout: 5000 });
            clicked = true;
          } catch (_) {}
        }

        if (!clicked) {
          console.warn(`     ⚠ 탭 클릭 실패: "${capture.clickTabText}" 탭을 찾지 못했습니다.`);
        }
        // 탭 콘텐츠 렌더링 대기
        await page.waitForTimeout(1500);
      }

      const filePath = join(SCREENSHOT_DIR, `${capture.id}.png`);

      if (capture.clip?.rightPanel) {
        // 우측 AI 설정 패널 클로즈업
        const viewportSize = page.viewportSize();
        await page.screenshot({
          path: filePath,
          clip: {
            x: Math.floor(viewportSize.width * 0.65),
            y: 0,
            width: Math.floor(viewportSize.width * 0.35),
            height: viewportSize.height,
          },
        });
      } else {
        await page.screenshot({
          path: filePath,
          fullPage: capture.fullPage ?? false,
        });
      }

      const imgBuffer = readFileSync(filePath);
      screenshots[capture.id] = {
        base64: imgBuffer.toString("base64"),
        label: capture.label,
      };

      console.log(`     ✓ 완료`);
    } catch (err) {
      console.warn(`     ⚠ 실패 (${err.message}) — 빈 슬롯으로 처리`);
      screenshots[capture.id] = { base64: null, label: capture.label };
    } finally {
      await page.close();
    }
  }

  return screenshots;
}

// ──────────────────────────────────────────────
// 3. PDF HTML 템플릿 생성
// ──────────────────────────────────────────────
function buildHtml(screenshots) {
  const img = (id, alt) => {
    const shot = screenshots[id];
    if (!shot?.base64) {
      return `<div class="no-screenshot">[ ${alt} 스크린샷 없음 ]</div>`;
    }
    return `<img src="data:image/png;base64,${shot.base64}" alt="${alt}" class="screenshot" />`;
  };

  return /* html */ `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif;
    font-size: 11pt;
    color: #1a1a2e;
    background: #fff;
    line-height: 1.6;
  }

  /* ── 공통 페이지 구조 ── */
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 20mm 18mm;
    page-break-after: always;
    position: relative;
  }
  .page:last-child { page-break-after: avoid; }

  /* ── 표지 ── */
  .cover {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%);
    color: #fff;
  }
  .cover-badge {
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.4);
    border-radius: 20px;
    padding: 6px 18px;
    font-size: 9pt;
    letter-spacing: 2px;
    margin-bottom: 32px;
  }
  .cover-title {
    font-size: 28pt;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 16px;
  }
  .cover-subtitle {
    font-size: 13pt;
    font-weight: 400;
    opacity: 0.85;
    margin-bottom: 40px;
  }
  .cover-divider {
    width: 60px;
    height: 3px;
    background: rgba(255,255,255,0.5);
    margin: 0 auto 40px;
    border-radius: 2px;
  }
  .cover-meta {
    font-size: 9.5pt;
    opacity: 0.7;
  }

  /* ── 목차 ── */
  .toc-title {
    font-size: 18pt;
    font-weight: 700;
    color: #1e3a8a;
    border-bottom: 3px solid #1d4ed8;
    padding-bottom: 10px;
    margin-bottom: 28px;
  }
  .toc-item {
    display: flex;
    align-items: baseline;
    padding: 7px 0;
    border-bottom: 1px dashed #e2e8f0;
    font-size: 10.5pt;
  }
  .toc-num {
    font-weight: 700;
    color: #1d4ed8;
    min-width: 28px;
  }
  .toc-dots { flex: 1; border-bottom: 1px dotted #cbd5e1; margin: 0 8px; }
  .toc-page { color: #64748b; font-size: 9.5pt; }

  /* ── 챕터 공통 ── */
  .chapter-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 22px;
  }
  .chapter-num {
    background: #1d4ed8;
    color: #fff;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14pt;
    font-weight: 700;
    flex-shrink: 0;
  }
  .chapter-title {
    font-size: 17pt;
    font-weight: 700;
    color: #1e3a8a;
    border-bottom: 2px solid #bfdbfe;
    padding-bottom: 6px;
    flex: 1;
  }

  /* ── 섹션 ── */
  .section-title {
    font-size: 12pt;
    font-weight: 700;
    color: #1d4ed8;
    margin: 20px 0 8px;
    padding-left: 10px;
    border-left: 4px solid #3b82f6;
  }

  /* ── 텍스트 요소 ── */
  p { margin-bottom: 10px; font-size: 10.5pt; }

  ul, ol { padding-left: 20px; margin-bottom: 10px; }
  li { margin-bottom: 4px; font-size: 10pt; }

  .highlight-box {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-left: 4px solid #3b82f6;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 12px 0;
    font-size: 10pt;
  }
  .warning-box {
    background: #fefce8;
    border: 1px solid #fde68a;
    border-left: 4px solid #f59e0b;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 12px 0;
    font-size: 10pt;
  }

  /* ── 스크린샷 ── */
  .screenshot {
    width: 100%;
    max-width: 170mm;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.10);
    display: block;
    margin: 14px auto;
  }
  .screenshot-caption {
    text-align: center;
    font-size: 9pt;
    color: #64748b;
    margin-top: -8px;
    margin-bottom: 14px;
  }
  .no-screenshot {
    width: 100%;
    height: 80px;
    background: #f8fafc;
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 10pt;
    margin: 14px 0;
  }

  /* ── 단계 카드 ── */
  .step-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 14px 0;
  }
  .step-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 14px;
  }
  .step-card-num {
    font-size: 9pt;
    font-weight: 700;
    color: #3b82f6;
    margin-bottom: 4px;
  }
  .step-card-title {
    font-size: 10.5pt;
    font-weight: 700;
    color: #1e3a8a;
    margin-bottom: 4px;
  }
  .step-card-desc {
    font-size: 9.5pt;
    color: #475569;
  }

  /* ── 기능 테이블 ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 9.5pt;
  }
  th {
    background: #1d4ed8;
    color: #fff;
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
  }
  td {
    padding: 7px 10px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #f8fafc; }

  /* ── 페이지 푸터 ── */
  .footer {
    position: absolute;
    bottom: 14mm;
    left: 18mm;
    right: 18mm;
    display: flex;
    justify-content: space-between;
    font-size: 8pt;
    color: #94a3b8;
    border-top: 1px solid #e2e8f0;
    padding-top: 6px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- ════════════════════════════════════
     표지
════════════════════════════════════ -->
<div class="page cover">
  <div class="cover-badge">USER GUIDE</div>
  <div class="cover-title">CLX 매뉴얼<br/>자동생성기</div>
  <div class="cover-subtitle">exBuilder6 .clx.js 파일을 자동으로 분석하여<br/>사용자 매뉴얼을 생성하는 도구</div>
  <div class="cover-divider"></div>
  <div class="cover-meta">Acanet 매뉴얼 자동화 솔루션</div>
</div>

<!-- ════════════════════════════════════
     목차
════════════════════════════════════ -->
<div class="page">
  <div class="toc-title">목차</div>

  <div class="toc-item">
    <span class="toc-num">1</span>
    <span>서비스 개요</span>
    <span class="toc-dots"></span>
    <span class="toc-page">3</span>
  </div>
  <div class="toc-item">
    <span class="toc-num">2</span>
    <span>메인 화면 안내</span>
    <span class="toc-dots"></span>
    <span class="toc-page">4</span>
  </div>
  <div class="toc-item">
    <span class="toc-num">3</span>
    <span>매뉴얼 생성하기</span>
    <span class="toc-dots"></span>
    <span class="toc-page">5</span>
  </div>
  <div class="toc-item">
    <span class="toc-num">4</span>
    <span>결과 확인 및 다운로드</span>
    <span class="toc-dots"></span>
    <span class="toc-page">7</span>
  </div>
  <div class="toc-item">
    <span class="toc-num">5</span>
    <span>단어사전 관리</span>
    <span class="toc-dots"></span>
    <span class="toc-page">9</span>
  </div>
  <div class="toc-item">
    <span class="toc-num">6</span>
    <span>레이아웃 관리</span>
    <span class="toc-dots"></span>
    <span class="toc-page">10</span>
  </div>

  <div class="footer">
    <span>CLX 매뉴얼 자동생성기 사용 가이드</span>
    <span>2</span>
  </div>
</div>

<!-- ════════════════════════════════════
     1장: 서비스 개요
════════════════════════════════════ -->
<div class="page">
  <div class="chapter-header">
    <div class="chapter-num">1</div>
    <div class="chapter-title">서비스 개요</div>
  </div>

  <p>
    CLX 매뉴얼 자동생성기는 <strong>exBuilder6 프레임워크</strong> 기반으로 개발된
    화면의 <code>.clx.js</code> 파일을 자동으로 분석하여 HTML 또는 Markdown 형식의
    사용자 매뉴얼을 생성합니다.
  </p>

  <div class="highlight-box">
    <strong>핵심 목적:</strong> 반복적이고 시간이 많이 소요되는 매뉴얼 수동 작성 업무를
    AI로 자동화하여 개발팀의 생산성을 향상시킵니다.
  </div>

  <div class="section-title">주요 기능</div>

  <table>
    <thead>
      <tr><th>기능</th><th>설명</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>매뉴얼 자동 생성</strong></td>
        <td>.clx.js 파일을 업로드하면 AI가 11개 항목(화면개요·CRUD·그리드·팝업 등)을 분석하여 매뉴얼을 자동 작성</td>
      </tr>
      <tr>
        <td><strong>단어사전</strong></td>
        <td>자주 사용하는 용어와 설명을 미리 등록하여 AI 호출 비용을 최소화하고 일관성 유지</td>
      </tr>
      <tr>
        <td><strong>레이아웃 관리</strong></td>
        <td>매뉴얼에 포함할 섹션을 선택하고 순서를 조정하여 커스터마이징 가능</td>
      </tr>
      <tr>
        <td><strong>다운로드</strong></td>
        <td>생성된 매뉴얼을 HTML 또는 Markdown 형식으로 개별 또는 ZIP 일괄 다운로드</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">사용 흐름</div>

  <div class="step-grid">
    <div class="step-card">
      <div class="step-card-num">STEP 1</div>
      <div class="step-card-title">파일 업로드</div>
      <div class="step-card-desc">.clx.js 파일을 드래그앤드롭 또는 버튼으로 업로드</div>
    </div>
    <div class="step-card">
      <div class="step-card-num">STEP 2</div>
      <div class="step-card-title">AI 설정</div>
      <div class="step-card-desc">API 키와 모델을 설정하거나 VS Code 프록시 모드 사용</div>
    </div>
    <div class="step-card">
      <div class="step-card-num">STEP 3</div>
      <div class="step-card-title">매뉴얼 생성</div>
      <div class="step-card-desc">파일을 선택하고 생성 버튼 클릭, 진행률 실시간 확인</div>
    </div>
    <div class="step-card">
      <div class="step-card-num">STEP 4</div>
      <div class="step-card-title">결과 다운로드</div>
      <div class="step-card-desc">분석 결과 확인 후 HTML 또는 Markdown으로 다운로드</div>
    </div>
  </div>

  <div class="footer">
    <span>CLX 매뉴얼 자동생성기 사용 가이드</span>
    <span>3</span>
  </div>
</div>

<!-- ════════════════════════════════════
     2장: 메인 화면
════════════════════════════════════ -->
<div class="page">
  <div class="chapter-header">
    <div class="chapter-num">2</div>
    <div class="chapter-title">메인 화면 안내</div>
  </div>

  <p>
    서비스에 접속하면 메인 대시보드가 표시됩니다.
    상단 히어로 섹션에서 서비스 소개와 주요 통계를 확인할 수 있으며,
    하단의 3개 카드를 통해 각 기능으로 이동할 수 있습니다.
  </p>

  ${img("01-home", "메인 대시보드")}
  <div class="screenshot-caption">▲ 메인 대시보드 — 3가지 기능 진입점 제공</div>

  <div class="section-title">화면 구성</div>
  <ul>
    <li><strong>매뉴얼 생성 카드 (파란색)</strong>: .clx.js 파일을 업로드하여 매뉴얼을 자동 생성합니다.</li>
    <li><strong>단어사전 관리 카드 (초록색)</strong>: 자주 사용하는 용어를 미리 등록하여 AI 호출을 최소화합니다.</li>
    <li><strong>레이아웃 관리 카드 (보라색)</strong>: 매뉴얼에 포함할 섹션과 순서를 커스터마이징합니다.</li>
  </ul>

  <div class="footer">
    <span>CLX 매뉴얼 자동생성기 사용 가이드</span>
    <span>4</span>
  </div>
</div>

<!-- ════════════════════════════════════
     3장: 매뉴얼 생성하기
════════════════════════════════════ -->
<div class="page">
  <div class="chapter-header">
    <div class="chapter-num">3</div>
    <div class="chapter-title">매뉴얼 생성하기</div>
  </div>

  <div class="section-title">3.1 파일 업로드</div>

  <p>
    메인 화면에서 <strong>매뉴얼 생성</strong> 버튼을 클릭하면 생성 페이지로 이동합니다.
    좌측 업로드 영역에서 다음 3가지 방법으로 파일을 업로드할 수 있습니다.
  </p>

  ${img("02-generate-empty", "매뉴얼 생성 초기 화면")}
  <div class="screenshot-caption">▲ 매뉴얼 생성 페이지 — 파일 업로드 전 초기 상태</div>

  <ul>
    <li><strong>단일 파일 선택</strong>: .clx.js 확장자 파일 하나를 선택</li>
    <li><strong>다중 파일 선택</strong>: 여러 .clx.js 파일을 동시에 선택</li>
    <li><strong>폴더 선택</strong>: 폴더 내 모든 .clx.js 파일을 재귀적으로 탐색하여 일괄 업로드</li>
  </ul>

  <div class="highlight-box">
    <strong>파일 트리 패널:</strong> 업로드된 파일은 폴더 계층 구조로 표시됩니다.
    체크박스로 개별 파일 또는 폴더 단위로 선택할 수 있으며, 전체 선택/해제도 가능합니다.
  </div>

  <div class="footer">
    <span>CLX 매뉴얼 자동생성기 사용 가이드</span>
    <span>5</span>
  </div>
</div>

<div class="page">
  <div class="section-title">3.2 AI 설정</div>

  <p>
    우측 패널에서 AI 모드와 모델을 설정합니다.
    설정값은 자동으로 저장되어 다음 접속 시에도 유지됩니다.
  </p>

  ${img("03-generate-ai-panel", "AI 설정 패널")}
  <div class="screenshot-caption">▲ AI 설정 패널 — 모드 및 모델 선택</div>

  <table>
    <thead>
      <tr><th>설정 항목</th><th>설명</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>GitHub Models API 모드</strong></td>
        <td>GitHub Personal Access Token을 입력하여 직접 API 호출. API 비용이 발생할 수 있습니다.</td>
      </tr>
      <tr>
        <td><strong>VS Code 프록시 모드</strong></td>
        <td>VS Code Copilot의 프록시 서버(기본: localhost:3100)를 통해 API 호출. 별도 키 불필요.</td>
      </tr>
      <tr>
        <td><strong>모델 선택</strong></td>
        <td>gpt-4o-mini (기본, 빠르고 경제적), gpt-4o (고품질), gpt-4-turbo 등 선택 가능</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">3.3 생성 실행</div>

  <ol>
    <li>파일 트리에서 매뉴얼을 생성할 파일을 체크박스로 선택합니다.</li>
    <li>출력 형식을 선택합니다: <strong>HTML</strong>, <strong>Markdown</strong> 또는 둘 다.</li>
    <li>단어사전 사용 여부를 설정합니다 (등록된 용어를 우선 사용하여 비용 절감).</li>
    <li><strong>매뉴얼 생성</strong> 버튼을 클릭합니다.</li>
    <li>각 파일별 진행률이 실시간으로 표시되며, 완료 후 결과 페이지로 자동 이동합니다.</li>
  </ol>

  <div class="warning-box">
    <strong>참고:</strong> 파일이 선택되지 않은 경우 생성 버튼이 비활성화됩니다.
    단어사전에 등록된 용어는 AI를 호출하지 않고 저장된 설명을 재사용하므로 비용이 절약됩니다.
  </div>

  <div class="footer">
    <span>CLX 매뉴얼 자동생성기 사용 가이드</span>
    <span>6</span>
  </div>
</div>

<!-- ════════════════════════════════════
     4장: 결과 확인
════════════════════════════════════ -->
<div class="page">
  <div class="chapter-header">
    <div class="chapter-num">4</div>
    <div class="chapter-title">결과 확인 및 다운로드</div>
  </div>

  <p>
    생성이 완료되면 결과 페이지로 자동 이동합니다.
    좌측 사이드바에서 분석된 파일을 선택하고, 우측의 3개 탭(분석 결과 / HTML 미리보기 / Markdown)을 통해
    각기 다른 형식으로 결과를 확인하고 다운로드할 수 있습니다.
  </p>

  <div class="section-title">4.1 분석 결과 탭</div>

  <p>
    기본으로 열리는 탭으로, CLX 파싱 결과를 <strong>11개 카테고리 아코디언</strong>으로 표시합니다.
    각 항목을 클릭하면 세부 내용이 테이블 형식으로 펼쳐집니다.
  </p>

  ${img("04-result-analysis", "분석 결과 탭")}
  <div class="screenshot-caption">▲ 분석 결과 탭 — 11개 카테고리 아코디언으로 파싱 데이터 표시</div>

  <table>
    <thead>
      <tr><th>카테고리</th><th>표시 내용</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>화면개요</strong></td><td>시스템명, 부시스템, 프로그램명, 화면 설명 등 기본 정보</td></tr>
      <tr><td><strong>CRUD 작업</strong></td><td>조회·등록·수정·삭제 버튼과 연결된 함수 목록</td></tr>
      <tr><td><strong>필수값</strong></td><td>저장/실행 시 반드시 입력해야 하는 필드 목록</td></tr>
      <tr><td><strong>그리드</strong></td><td>화면 내 그리드 컴포넌트의 컬럼 구성 정보</td></tr>
      <tr><td><strong>조건그룹</strong></td><td>검색 조건 영역(conditionGroup)의 필드 구성</td></tr>
      <tr><td><strong>인포그룹</strong></td><td>정보 표시 영역(infoGroup)의 항목 구성</td></tr>
      <tr><td><strong>팝업</strong></td><td>화면에서 호출하는 팝업 목록과 파라미터</td></tr>
      <tr><td><strong>탭페이지</strong></td><td>탭 컴포넌트별 화면 구성 정보</td></tr>
      <tr><td><strong>버튼</strong></td><td>화면 내 모든 버튼과 연결 함수</td></tr>
      <tr><td><strong>스타일</strong></td><td>UDC 컴포넌트 및 커스텀 스타일 정보</td></tr>
      <tr><td><strong>주의사항</strong></td><td>AI가 분석한 주요 업무 규칙 및 주의점</td></tr>
    </tbody>
  </table>

  <div class="highlight-box">
    <strong>화면 이미지 첨부:</strong> 분석 결과 탭 상단의 이미지 업로드 영역에서
    실제 화면 캡처 이미지를 첨부하면, 생성된 HTML 매뉴얼에 화면 이미지가 포함됩니다.
  </div>

  <div class="footer">
    <span>CLX 매뉴얼 자동생성기 사용 가이드</span>
    <span>7</span>
  </div>
</div>

<div class="page">
  <div class="section-title">4.2 HTML 미리보기 탭</div>

  <p>
    생성된 매뉴얼을 <strong>실제 HTML로 렌더링</strong>하여 최종 결과물을 확인하는 탭입니다.
    다운로드 전에 매뉴얼이 어떻게 보일지 미리 확인할 수 있습니다.
  </p>

  ${img("04-result-html", "HTML 미리보기 탭")}
  <div class="screenshot-caption">▲ HTML 미리보기 탭 — 최종 매뉴얼의 실제 렌더링 결과 확인</div>

  <ul>
    <li>레이아웃 관리에서 설정한 섹션 구성과 순서가 그대로 반영됩니다.</li>
    <li>업로드한 화면 이미지가 매뉴얼 상단에 포함되어 표시됩니다.</li>
    <li>다운로드할 HTML 파일과 동일한 내용이므로 최종 검토에 활용하세요.</li>
  </ul>

  <div class="section-title">4.3 Markdown 탭</div>

  <p>
    매뉴얼을 <strong>Markdown 형식의 텍스트</strong>로 확인하는 탭입니다.
    Notion, GitHub, Confluence 등 Markdown을 지원하는 문서 시스템에 바로 붙여 넣어 활용할 수 있습니다.
  </p>

  ${img("04-result-markdown", "Markdown 탭")}
  <div class="screenshot-caption">▲ Markdown 탭 — 구조화된 Markdown 원문 확인 및 복사</div>

  <ul>
    <li>코드블록 형태로 전체 Markdown 텍스트가 표시됩니다.</li>
    <li>우측 상단 <strong>복사 버튼</strong>으로 클립보드에 바로 복사할 수 있습니다.</li>
    <li>헤딩(##), 테이블, 리스트 등 표준 Markdown 문법을 사용합니다.</li>
  </ul>

  <div class="section-title">4.4 다운로드</div>

  <p>상단 다운로드 바에서 생성된 매뉴얼 파일을 저장할 수 있습니다.</p>

  <table>
    <thead>
      <tr><th>다운로드 방법</th><th>설명</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>HTML 다운로드</strong></td>
        <td>현재 선택된 파일의 매뉴얼을 <code>.html</code> 파일로 저장. 브라우저에서 바로 열 수 있는 독립 문서 형식</td>
      </tr>
      <tr>
        <td><strong>Markdown 다운로드</strong></td>
        <td>현재 선택된 파일의 매뉴얼을 <code>.md</code> 파일로 저장. 다양한 문서 시스템에서 활용 가능</td>
      </tr>
      <tr>
        <td><strong>ZIP 일괄 다운로드</strong></td>
        <td>분석된 모든 파일의 HTML과 Markdown을 하나의 ZIP으로 묶어 한 번에 다운로드</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <span>CLX 매뉴얼 자동생성기 사용 가이드</span>
    <span>8</span>
  </div>
</div>

<!-- ════════════════════════════════════
     5장: 단어사전 관리
════════════════════════════════════ -->
<div class="page" style="page-break-before: always;">
  <div class="chapter-header">
    <div class="chapter-num">5</div>
    <div class="chapter-title">단어사전 관리</div>
  </div>

  <p>
    단어사전에 용어와 설명을 미리 등록해 두면, 매뉴얼 생성 시 해당 용어가 등장할 때
    AI를 호출하지 않고 등록된 설명을 재사용합니다. <strong>API 비용 절감과 설명 일관성</strong>에 효과적입니다.
  </p>

  ${img("05-dictionary", "단어사전 관리 화면")}
  <div class="screenshot-caption">▲ 단어사전 관리 페이지</div>

  <div class="section-title">주요 기능</div>

  <ul>
    <li><strong>용어 추가</strong>: 용어명, 컨텍스트 타입, 설명을 입력하여 새 항목 등록</li>
    <li><strong>용어 수정</strong>: 기존 항목의 설명을 업데이트</li>
    <li><strong>용어 삭제</strong>: 불필요한 항목 제거 (확인 다이얼로그 표시)</li>
    <li><strong>전체 초기화</strong>: 모든 사전 데이터 일괄 삭제</li>
    <li><strong>카테고리 필터</strong>: 컨텍스트 타입별로 항목 필터링</li>
    <li><strong>AI/수동 구분</strong>: AI가 생성한 설명과 수동 입력 항목을 구분하여 표시</li>
  </ul>

  <div class="highlight-box">
    <strong>활용 팁:</strong> 자주 등장하는 도메인 용어(예: 수강신청, 학적번호, 수납금액 등)를
    미리 등록해두면 생성 시간이 단축되고 API 비용이 크게 줄어듭니다.
  </div>

  <div class="footer">
    <span>CLX 매뉴얼 자동생성기 사용 가이드</span>
    <span>9</span>
  </div>
</div>

<!-- ════════════════════════════════════
     6장: 레이아웃 관리
════════════════════════════════════ -->
<div class="page">
  <div class="chapter-header">
    <div class="chapter-num">6</div>
    <div class="chapter-title">레이아웃 관리</div>
  </div>

  <p>
    매뉴얼에 포함할 섹션과 순서를 커스터마이징합니다.
    불필요한 섹션을 제외하거나 조직의 스타일에 맞게 순서를 변경할 수 있습니다.
  </p>

  ${img("06-layout-manager", "레이아웃 관리 화면")}
  <div class="screenshot-caption">▲ 레이아웃 관리 페이지</div>

  <div class="section-title">주요 기능</div>

  <ul>
    <li><strong>섹션 포함/제외</strong>: 매뉴얼에 포함할 항목을 체크박스로 선택</li>
    <li><strong>순서 변경</strong>: 드래그앤드롭으로 섹션 순서 재배치</li>
    <li><strong>프리셋 저장</strong>: 현재 레이아웃 설정을 이름 붙여 저장</li>
    <li><strong>프리셋 불러오기</strong>: 저장된 레이아웃 프리셋을 불러와 적용</li>
  </ul>

  <div class="highlight-box">
    <strong>활용 팁:</strong> 업무 유형별로 프리셋을 만들어두면(예: "조회 화면용", "입력 화면용")
    매번 설정을 변경하지 않고 빠르게 전환할 수 있습니다.
  </div>

  <div class="section-title">지원 섹션 목록</div>

  <div class="step-grid">
    <div class="step-card">
      <div class="step-card-title">화면개요</div>
      <div class="step-card-desc">화면의 목적과 주요 기능 요약</div>
    </div>
    <div class="step-card">
      <div class="step-card-title">CRUD 작업</div>
      <div class="step-card-desc">조회·등록·수정·삭제 기능 설명</div>
    </div>
    <div class="step-card">
      <div class="step-card-title">필수값</div>
      <div class="step-card-desc">입력 시 필수 항목 목록</div>
    </div>
    <div class="step-card">
      <div class="step-card-title">그리드</div>
      <div class="step-card-desc">그리드 컬럼 구성 및 의미</div>
    </div>
    <div class="step-card">
      <div class="step-card-title">팝업</div>
      <div class="step-card-desc">연결된 팝업 화면 목록</div>
    </div>
    <div class="step-card">
      <div class="step-card-title">버튼</div>
      <div class="step-card-desc">화면 내 버튼 기능 설명</div>
    </div>
  </div>

  <div class="footer">
    <span>CLX 매뉴얼 자동생성기 사용 가이드</span>
    <span>10</span>
  </div>
</div>

</body>
</html>`;
}

// ──────────────────────────────────────────────
// 4. PDF 변환 함수
// ──────────────────────────────────────────────
async function generatePdf(browser, html) {
  const page = await browser.newPage();

  console.log("  📄 HTML → PDF 변환 중...");

  await page.setContent(html, { waitUntil: "networkidle" });

  // 웹폰트 로딩 대기
  await page.waitForTimeout(3000);

  await page.pdf({
    path: OUTPUT_PDF,
    format: "A4",
    printBackground: true,
    margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
  });

  await page.close();
}

// ──────────────────────────────────────────────
// 5. 메인
// ──────────────────────────────────────────────
async function main() {
  console.log("====================================");
  console.log(" CLX 매뉴얼 자동생성기 - 사용자 가이드 PDF 생성");
  console.log("====================================\n");

  const browser = await chromium.launch({ headless: true });

  try {
    // Step 0: localStorage에서 실제 생성 결과 읽기
    console.log("[0/2] 생성 결과 확인");
    const generationResult = await readGenerationResult(browser);
    if (generationResult) {
      const count = generationResult.results?.length ?? 0;
      const files = generationResult.results?.map((r) => r.fileName).join(", ");
      console.log(`  ✅ 실제 데이터 발견: ${count}개 파일 (${files})\n`);
    } else {
      console.warn("  ⚠ localStorage에 생성 결과 없음 — 더미 데이터로 캡처됩니다.");
      console.warn("  → 매뉴얼 생성을 먼저 완료한 뒤 다시 실행하세요.\n");
    }

    // Step 1: 스크린샷 캡처
    console.log("[1/2] 스크린샷 캡처");
    const screenshots = await captureScreenshots(browser, generationResult);

    const captured = Object.values(screenshots).filter((s) => s.base64).length;
    console.log(`\n  ✅ ${captured}/${CAPTURES.length}개 캡처 완료\n`);

    // Step 2: PDF 생성
    console.log("[2/2] PDF 생성");
    const html = buildHtml(screenshots);
    await generatePdf(browser, html);

    console.log(`\n✅ PDF 생성 완료: ${OUTPUT_PDF}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("❌ 오류:", err.message);
  process.exit(1);
});
