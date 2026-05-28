// AUTO-GENERATED — do not edit manually.
// Generated from: cpr-lib/udc.js
// Run: node scripts/buildUdcRegistry.cjs

/** UDC 라벨 함수 및 기본값 정보 */
export interface UdcInfo {
  /** UDC 전체 식별자 (udc.univ.UcoYrSmstrCombo 등) */
  qualifiedName: string;
  /** UDC 설명 */
  description: string;
  /** 라벨을 설정하는 함수명 목록 (init*Label, set*Label 등) */
  labelFns: string[];
  /** Output 컨트롤 ID 또는 appProperty 키 → 기본 라벨 텍스트 */
  defaultLabels: Record<string, string>;
  /** 라벨 인수 인덱스 (기본 0 = 첫 번째 인수, 1 = 두 번째 인수 등) */
  labelArgIndex?: number;
}

/** UDC 단축명 → UdcInfo 맵 */
export const UDC_REGISTRY: Record<string, UdcInfo> = {
  'AacAcntgComnt': {"qualifiedName":"udc.admin.AacAcntgComnt","description":"회계 공통 컨트롤","labelFns":["setObjectLabel","setAcntgYrLabel","setAcntgUnitCdLabel","setDeptCdLabel","setBizCdLabel","setBplcCdLabel","setBalcSeLabel","setObjectLabelWidth","setAcntgYrLabelWidth","setAcntgUnitCdLabelWidth","setDeptCdLabelWidth","setBizCdLabelWidth","setBplcCdLabelWidth","setBalcSeLabelWidth"],"defaultLabels":{"bplcCdLabel":"세무사업장"}},
  'AacCnptComnt': {"qualifiedName":"udc.admin.AacCnptComnt","description":"거래처 컴포넌트","labelFns":["setLabel"],"defaultLabels":{}},
  'AacGeoraecheoComp': {"qualifiedName":"udc.admin.AacGeoraecheoComp","description":"거래처 컴포넌트","labelFns":["setLabel"],"defaultLabels":{}},
  'AasPummokComp': {"qualifiedName":"udc.admin.AasPummokComp","description":"품목검색컨포넌트","labelFns":["setLabel"],"defaultLabels":{}},
  'AcoGridMultiControl': {"qualifiedName":"udc.admin.AcoGridMultiControl","description":"다수의 컨트롤을 하나의 UDC에 배치하여 필요에 따라 사용하는 UDC (그리드에서 사용하는 기준으로 개발함)","labelFns":["setCheckBoxText","setComboBoxDataSetLabel"],"defaultLabels":{}},
  'AfcHosilComp': {"qualifiedName":"udc.admin.AfcHosilComp","description":"품목검색컨포넌트","labelFns":["setLabel"],"defaultLabels":{}},
  'AfcRmnmComnt': {"qualifiedName":"udc.admin.AfcRmnmComnt","description":"호실 검색 컴포넌트","labelFns":["setLabel"],"defaultLabels":{}},
  'AhmBojikCdFindComp': {"qualifiedName":"udc.admin.AhmBojikCdFindComp","description":"보직조회컴포넌트","labelFns":["setLabel"],"defaultLabels":{}},
  'AhmBuseoComp': {"qualifiedName":"udc.admin.AhmBuseoComp","description":"부서조회컴포넌트","labelFns":["setLabel"],"defaultLabels":{}},
  'AhmGyojikwonComp': {"qualifiedName":"udc.admin.AhmGyojikwonComp","description":"교직원조회컴포넌트","labelFns":["setLabel"],"defaultLabels":{}},
  'AhmJikjongComp': {"qualifiedName":"udc.admin.AhmJikjongComp","description":"직종조회컴포넌트","labelFns":["setLabel"],"defaultLabels":{}},
  'PatisCombo': {"qualifiedName":"udc.common.PatisCombo","description":"공통 콤보박스 컴포넌트","labelFns":["setComboText"],"defaultLabels":{}},
  'UcoSrchComnt': {"qualifiedName":"udc.univ.UcoSrchComnt","description":"대학/학과/전공 콤보 화면이다.","labelFns":["initObjectLabelWidth","initObjectLabel","setObjectLabel","setObjectLabelWidth"],"defaultLabels":{"T_S_CLG":"대학","T_S_FACLT_SCSBJT":"학과","T_S_SCSBJT_MJR":"전공"}},
  'UcoStdntComnt': {"qualifiedName":"udc.univ.UcoStdntComnt","description":"학생 검색컴포넌트","labelFns":["setLabel"],"defaultLabels":{"T_S_STUNO":"학번/성명"}},
  'UcoYrSmstrCombo': {"qualifiedName":"udc.univ.UcoYrSmstrCombo","description":"학사 행정 연도/학기 콤보","labelFns":["initYrLabel","initYrLabelWidth","initSmstrLabel","initSmstrLabelWidth","setYrLabel","setSmstrLabel"],"defaultLabels":{"T_S_YR":"연도","T_S_SMSTR_SE":"학기"}},
  'UleSbjctComnt': {"qualifiedName":"udc.univ.UleSbjctComnt","description":"학사행정의 교과목검색 팝업을 호출한다.","labelFns":["initLabel","setObjectLabelWidth","setLabel"],"defaultLabels":{"T_S_SBJCT_CD":"교과목코드/명"}},
  'UleSubjectComp': {"qualifiedName":"udc.univ.UleSubjectComp","description":"학사횅정의 교과목검색 팝업을 호출한다.","labelFns":["initLabel","setObjectLabelWidth","setLabel"],"defaultLabels":{"T_S_SBJCT_CD":"교과목코드/명"}},
  'UscSearchCombo': {"qualifiedName":"udc.univ.UscSearchCombo","description":"대학/학과/전공 콤보 화면이다.","labelFns":["initObjectLabelWidth","initObjectLabel","setObjectLabel","setObjectLabelWidth"],"defaultLabels":{"T_S_DAEHAK":"대학","T_S_HAKGWA":"학과","T_S_JEONGONG":"전공"}},
  'UscStudentSearchComp': {"qualifiedName":"udc.univ.UscStudentSearchComp","description":"학생 검색컴포넌트","labelFns":["setLabel"],"defaultLabels":{"T_S_STUNO":"학번/성명"}},
  'UscYrSctmCombo': {"qualifiedName":"udc.univ.UscYrSctmCombo","description":"학사 행정 연도/학기 콤보","labelFns":["initYrLabel","initYrLabelWidth","initSctmLabel","initSctmLabelWidth","setYrLabel","setSctmLabel"],"defaultLabels":{"T_S_YR":"연도","T_S_SCTM":"학기"}},
  'UcoBtchList': {"qualifiedName":"udc.univ.UcoBtchList","description":"배치 목록 컴포넌트","labelFns":["initBtchList"],"defaultLabels":{"TITLE":"배치 목록"},"labelArgIndex":1},

  // --- 추가 항목 (분석 스크립트로 추출) ---
  'AacGyeoluiLink': {"qualifiedName":"udc.admin.AacGyeoluiLink","description":"결의서를 연동하기 위한 화면이다.","labelFns":[],"defaultLabels":{}},
  'AacRsltnLink': {"qualifiedName":"udc.admin.AacRsltnLink","description":"결의서를 연동하기 위한 화면이다.","labelFns":[],"defaultLabels":{}},
  'AasItemComnt': {"qualifiedName":"udc.admin.AasItemComnt","description":"품목검색컨포넌트","labelFns":[],"defaultLabels":{}},
  'AcoGroupware': {"qualifiedName":"udc.admin.AcoGroupware","description":"전자결재를 연동하기 위한 화면이다.","labelFns":[],"defaultLabels":{}},
  'AcoGrpwr': {"qualifiedName":"udc.admin.AcoGrpwr","description":"전자결재를 연동하기 위한 화면이다.","labelFns":[],"defaultLabels":{}},
  'AhmAppntCdComnt': {"qualifiedName":"udc.admin.AhmAppntCdComnt","description":"보직조회컴포넌트","labelFns":["setLabel"],"defaultLabels":{}},
  'AhmDeptComnt': {"qualifiedName":"udc.admin.AhmDeptComnt","description":"부서조회컴포넌트","labelFns":[],"defaultLabels":{}},
  'AhmOcptComnt': {"qualifiedName":"udc.admin.AhmOcptComnt","description":"직종조회컴포넌트","labelFns":[],"defaultLabels":{}},
  'AhmScstfComnt': {"qualifiedName":"udc.admin.AhmScstfComnt","description":"교직원조회컴포넌트","labelFns":[],"defaultLabels":{}},
  'CaUserComnt': {"qualifiedName":"udc.common.CaUserComnt","description":"공통 사용자 컴포넌트","labelFns":[],"defaultLabels":{}},
  'PatisCellExpand': {"qualifiedName":"udc.common.PatisCellExpand","description":"그리드 셀 expand 컨트롤","labelFns":[],"defaultLabels":{}},
  'PatisDeptComnt': {"qualifiedName":"udc.common.PatisDeptComnt","description":"부서 검색 컴포넌트","labelFns":[],"defaultLabels":{}},
  'PatisDeptSelector': {"qualifiedName":"udc.common.PatisDeptSelector","description":"부서를 조회하는 공통 선택 컴포넌트","labelFns":["setPopupTitleText"],"defaultLabels":{}},
  'PatisFileToList': {"qualifiedName":"udc.common.PatisFileToList","description":"공통 파일변환 컴포넌트","labelFns":["setButtonText"],"defaultLabels":{}},
  'PatisFileUpload': {"qualifiedName":"udc.common.PatisFileUpload","description":"공통 파일업로드 컴포넌트","labelFns":["setDeleteButtonText","setDownloadButtonText","setInqButtonText","setSaveButtonText","setSelectButtonText","setTitleText"],"defaultLabels":{}},
  'PatisGuidanceNotice': {"qualifiedName":"udc.common.PatisGuidanceNotice","description":"공통 안내문구 표시 컴포넌트","labelFns":[],"defaultLabels":{}},
  'PatisLayerTitle': {"qualifiedName":"udc.common.PatisLayerTitle","description":"공통 레이어 팝업의 타이틀","labelFns":[],"defaultLabels":{}},
  'PatisMenuTitleBar': {"qualifiedName":"udc.common.PatisMenuTitleBar","description":"공통 버튼 컴포넌트","labelFns":["initBscButtonTooltipText","initDelButtonTooltipText","initExcelButtonTooltipText","initExcelUldButtonTooltipText","initHelpButtonTooltipText","initInqButtonTooltipText","initNewButtonTooltipText","initPrintButtonTooltipText","initSaveButtonTooltipText","initSysInqryButtonTooltipText","initTipButtonTooltipText","setExcelButtonText","setExcelUldButtonText","setPrintButtonText"],"defaultLabels":{}},
  'PatisPopupBottom': {"qualifiedName":"udc.common.PatisPopupBottom","description":"공통 팝업 하단 버튼 컴포넌트","labelFns":["setCloseButtonText","setIdentifyButtonText"],"defaultLabels":{}},
  'PatisReportBottom': {"qualifiedName":"udc.common.PatisReportBottom","description":"공통 출력물 하단 영역 컴포넌트","labelFns":["setButtonText"],"defaultLabels":{}},
  'PatisReportForm': {"qualifiedName":"udc.common.PatisReportForm","description":"출력물 미리보기 컴포넌트","labelFns":[],"defaultLabels":{}},
  'PatisTitleBar': {"qualifiedName":"udc.common.PatisTitleBar","description":"공통 타이틀바 컴포넌트","labelFns":["setDelButtonText","setDelButtonTooltipText","setExcelButtonText","setExcelButtonTooltipText","setExcelUldButtonText","setExcelUldButtonTooltipText","setInqButtonText","setInqButtonTooltipText","setNewButtonText","setNewButtonTooltipText","setPrintButtonText","setPrintButtonTooltipText","setSaveButtonText","setSaveButtonTooltipText"],"defaultLabels":{}},
  'PatisUserComnt': {"qualifiedName":"udc.common.PatisUserComnt","description":"공통 사용자 컴포넌트","labelFns":[],"defaultLabels":{}},
  'PatisWebEditor': {"qualifiedName":"udc.common.PatisWebEditor","description":"공통 웹 에디터 컴포넌트","labelFns":["setTitleText"],"defaultLabels":{}},
  'PatisYearCombo': {"qualifiedName":"udc.common.PatisYearCombo","description":"공통 연도 컴포넌트","labelFns":[],"defaultLabels":{}},
  'PatisZipComnt': {"qualifiedName":"udc.common.PatisZipComnt","description":"공통 우편번호 검색 컴포넌트","labelFns":[],"defaultLabels":{}},
  'UcoStdntInfo': {"qualifiedName":"udc.univ.UcoStdntInfo","description":"학사 학생의 기초정보를 조회한다.","labelFns":[],"defaultLabels":{}},
  'UcoStdntInfo01': {"qualifiedName":"udc.univ.UcoStdntInfo01","description":"학사 학생의 기초정보를 조회한다.","labelFns":[],"defaultLabels":{}},
  'UscBatchList': {"qualifiedName":"udc.univ.UscBatchList","description":"학사 행정의 배치 리스트를 조회한다.","labelFns":["setTitleText"],"defaultLabels":{}},
  'UscStudentInfo': {"qualifiedName":"udc.univ.UscStudentInfo","description":"학사 학생의 기초정보를 조회한다.","labelFns":[],"defaultLabels":{}},
  'UscStudentInfo01': {"qualifiedName":"udc.univ.UscStudentInfo01","description":"학사 학생의 기초정보를 조회한다.","labelFns":[],"defaultLabels":{}},
};
