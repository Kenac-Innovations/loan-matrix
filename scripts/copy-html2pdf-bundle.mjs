import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(
  projectRoot,
  "node_modules/html2pdf.js/dist/html2pdf.bundle.min.js"
);
const destinationPath = resolve(projectRoot, "public/html2pdf.bundle.min.js");

await mkdir(dirname(destinationPath), { recursive: true });
await copyFile(sourcePath, destinationPath);
