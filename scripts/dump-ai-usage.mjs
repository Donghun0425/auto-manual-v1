/**
 * usc_3010605_u.clx.js 파싱 결과 덤프
 */
import { readFileSync } from "fs";
import { analyzeFile } from "../src/lib/parser/index.ts";
import { buildUsagePrompt } from "../src/lib/ai/prompts.ts";

const filePath = "sample/usc_3010605_u.clx.js";
const content = readFileSync(filePath, "utf-8");
const parseResult = analyzeFile(filePath, content);

console.log("=== CRUD Info ===");
console.log("hasInquiry:", parseResult.usage.menuTitleBar.hasInquiry);
console.log("hasNew:", parseResult.usage.menuTitleBar.hasNew);
console.log("hasSave:", parseResult.usage.menuTitleBar.hasSave);
console.log("hasDelete:", parseResult.usage.menuTitleBar.hasDelete);
console.log("extButtons:", parseResult.usage.menuTitleBar.extButtons.map(b => b.name));
console.log("operations:", parseResult.usage.menuTitleBar.operations?.map(o => ({
  operation: o.operation,
  preconditions: o.preconditions,
  validations: o.validations,
})));
console.log("extraButtons:", parseResult.usage.extraButtons.map(b => b.name));

console.log("\n=== Usage Prompt User Message (first 5000 chars) ===");
const msgs = buildUsagePrompt(parseResult);
console.log(msgs[1].content.slice(0, 5000));
console.log("...(truncated)");