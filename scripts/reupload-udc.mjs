import { readFile } from "node:fs/promises";

const UDC_PATH = "D:\\workspace_pkg2_term (2)\\workspace_pkg2_term\\exbuilder\\clx-build\\cpr-lib\\udc.js";
const PORTS = [3002, 3001, 3000];

const content = await readFile(UDC_PATH, "utf8");

for (const port of PORTS) {
  try {
    const res = await fetch(`http://localhost:${port}/api/udc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "udc.js", content, replaceAll: true }),
    });
    const text = await res.text();
    console.log(`[${port}] status=${res.status}`);
    console.log(text.slice(0, 2000));
    if (res.ok) process.exit(0);
  } catch (e) {
    console.log(`[${port}] failed: ${e.message}`);
  }
}
process.exit(1);
