import { appendFileSync, readFileSync } from "fs";

const LOG_FILE = "logs.txt";

export function logRequest(entry) {
  appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
}

export function readStats() {
  try {
    const contents = readFileSync(LOG_FILE, "utf-8").trim();

    if (!contents) {
      return { total_requests: 0, total_revenue: "0.00" };
    }

    const logs = contents.split("\n").map((line) => JSON.parse(line));
    const totalRevenue = logs.reduce(
      (sum, log) => sum + Number.parseFloat(log.payment.amount),
      0,
    );

    return {
      total_requests: logs.length,
      total_revenue: `${totalRevenue.toFixed(2)} ${logs[0]?.payment.asset || "XLM"}`,
    };
  } catch {
    return { total_requests: 0, total_revenue: "0.00 XLM" };
  }
}
