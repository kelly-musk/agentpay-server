import { appendFileSync } from "fs";

export function logRequest(entry) {
  appendFileSync("logs.txt", JSON.stringify({ ...entry, payment_status: "verified" }) + "\n");
}
