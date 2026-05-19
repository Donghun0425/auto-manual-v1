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
};
