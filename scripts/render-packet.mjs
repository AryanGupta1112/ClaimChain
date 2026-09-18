import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const response = await fetch("http://127.0.0.1:3001/api/cases/case-1/packet");
if (!response.ok) throw new Error(`Packet failed: ${response.status}`);
const data = new Uint8Array(await response.arrayBuffer());
mkdirSync(".impeccable/review", { recursive: true });
writeFileSync(".impeccable/review/packet.pdf", data);
const document = await getDocument({
  data,
  useSystemFonts: true,
  isEvalSupported: false,
}).promise;
for (let number = 1; number <= document.numPages; number++) {
  const page = await document.getPage(number);
  const viewport = page.getViewport({ scale: 1.4 });
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  await page.render({ canvasContext: canvas.getContext("2d"), viewport })
    .promise;
  writeFileSync(
    `.impeccable/review/packet-${number}.png`,
    canvas.toBuffer("image/png"),
  );
  const text = await page.getTextContent();
  console.log(
    `Page ${number}: ${text.items
      .map((item) => item.str || "")
      .join(" ")
      .slice(0, 180)}`,
  );
}
console.log(`Rendered ${document.numPages} PDF pages.`);
