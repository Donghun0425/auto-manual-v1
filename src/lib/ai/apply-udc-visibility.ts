import type {
  ClxParseResult,
  ResolvedUdcInfo,
  ResolvedUdcInstanceInfo,
  UdcEnrichmentContext,
} from "@/types";

/**
 * Reconciles condition-group UDC labels with the final labels visible in each
 * concrete UDC instance. Structural visibility is applied independently from
 * whether UDC metadata is included in AI prompts.
 */
export function applyUdcVisibilityToConditionGroups(
  parseResult: ClxParseResult,
  context: UdcEnrichmentContext
): void {
  const byInstance = new Map<string, {
    udc: ResolvedUdcInfo;
    instance: ResolvedUdcInstanceInfo;
  }>();
  for (const udc of context.udcs) {
    for (const instance of udc.instances) {
      byInstance.set(instance.instanceId, { udc, instance });
    }
  }

  for (const group of parseResult.items.conditionGroups) {
    group.controls = group.controls.filter((control) => {
      const resolved = byInstance.get(control.controlId);
      if (!resolved || control.controlType !== resolved.udc.shortName) return true;

      const currentLabels = control.labelText.split("/").map((label) => label.trim()).filter(Boolean);
      let finalLabels = resolved.instance.resolvedLabels;
      // Stale UDC metadata must never re-introduce a label already removed by
      // direct CLX visibility analysis.
      if (finalLabels.length > currentLabels.length && currentLabels.length > 0) {
        const currentSet = new Set(currentLabels);
        const intersection = finalLabels.filter((label) => currentSet.has(label.resolvedLabel.trim()));
        if (intersection.length > 0) finalLabels = intersection;
      }
      resolved.instance.resolvedLabels = finalLabels;
      const labels = finalLabels.map((label) => label.resolvedLabel.trim()).filter(Boolean);
      if (labels.length === 0) return false;
      control.labelText = [...new Set(labels)].join(" / ");
      return true;
    });
  }

  for (const udc of context.udcs) {
    const seen = new Set<string>();
    udc.resolvedLabels = udc.instances.flatMap((instance) =>
      instance.resolvedLabels.filter((label) => {
        const key = `${label.targetControlId ?? ""}\0${label.resolvedLabel}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    );
  }
}
