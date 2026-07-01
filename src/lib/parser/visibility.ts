/**
 * 컨트롤 visible 속성 판별 유틸
 *
 * eXBuilder6 컴파일 결과(.clx.js)의 컨트롤 선언/속성 설정 패턴:
 *   var <varName> = (linker.<x> =)? new <Type>("<controlId>");
 *   <varName>.visible = false;            // 디자이너에서 숨김 처리한 컨트롤
 *   container.addChild(<varName>, { ... });
 *
 * 매뉴얼의 사용방법/항목에는 visible 속성이 true 인(또는 명시되지 않은)
 * 컨트롤만 표시한다. visible = false 로 명시된 컨트롤은 화면에 노출되지
 * 않으므로 매뉴얼에서도 제외한다.
 */

/** 정규식 특수문자 이스케이프 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 주어진 내용(content) 안에서 controlId 컨트롤의 visible 속성 최종값을 검사한다.
 *
 * @param content   컨트롤 선언이 포함된 소스(전체 본문 또는 컨테이너 본문)
 * @param controlId 컨트롤 ID (예: "BTN_FILEUPLOAD01")
 * @returns visible 속성이 false 로 명시되었으면 false, 그 외(미설정 포함)는 true
 */
export function isControlVisibleInLayout(content: string, controlId: string): boolean {
  const idEsc = escapeRegex(controlId);
  const declRe = new RegExp(
    `var\\s+(\\w+)\\s*=\\s*(?:linker\\.\\w+\\s*=\\s*)?new\\s+[\\w.]+\\(\\s*"${idEsc}"\\s*\\)`,
  );
  const m = declRe.exec(content);
  if (!m) return true; // 선언을 찾지 못하면 기본 노출로 간주

  const varName = m[1];
  const localAssignments: Array<{ visible: boolean; position: number }> = [];

  // 선언 이후 ~ 해당 변수의 container.addChild 호출 직전까지를 속성 설정 영역으로 본다.
  // (다음 컨트롤의 visible 속성을 잘못 잡는 것을 방지)
  const after = content.slice(m.index + m[0].length);
  const addChildM = new RegExp(`container\\.addChild\\(\\s*${varName}\\b`).exec(after);
  const scope = addChildM ? after.slice(0, addChildM.index) : after.slice(0, 2000);
  const localRe = new RegExp(`${varName}\\.visible\\s*=\\s*(false|true)\\b`, "g");
  let localMatch: RegExpExecArray | null;
  while ((localMatch = localRe.exec(scope)) !== null) {
    localAssignments.push({
      visible: localMatch[1] === "true",
      position: m.index + m[0].length + localMatch.index,
    });
  }

  const lookupAssignments: Array<{ visible: boolean; position: number }> = [];
  const lookupRe = new RegExp(`app\\.lookup\\("${idEsc}"\\)\\.visible\\s*=\\s*(false|true)\\b`, "g");
  let lookupMatch: RegExpExecArray | null;
  while ((lookupMatch = lookupRe.exec(content)) !== null) {
    lookupAssignments.push({
      visible: lookupMatch[1] === "true",
      position: lookupMatch.index,
    });
  }

  if (lookupAssignments.length > 0) {
    lookupAssignments.sort((a, b) => a.position - b.position);
    return lookupAssignments[lookupAssignments.length - 1].visible;
  }

  if (localAssignments.length === 0) return true;
  localAssignments.sort((a, b) => a.position - b.position);
  return localAssignments[localAssignments.length - 1].visible;
}
