import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const presetRoot = path.resolve(__dirname, "..");

export const presetIncludesPath = path.join(
  presetRoot,
  "templates",
  "includes",
);
