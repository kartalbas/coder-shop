import zlib from "node:zlib";

// Test helper: the drawn text of a pdf-lib document. pdf-lib writes every drawn
// string as a WinAnsi hex string inside a Flate-compressed content stream, so a raw
// byte search finds nothing — this inflates the streams and decodes the `<hex> Tj`
// operands back to text. WinAnsi and latin1 agree on the accented Latin letters, so
// assertions can use them directly; typographic dashes/quotes map to other bytes and
// are best avoided in expectations.
export function pdfDrawnText(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  const raw = buffer.toString("latin1");
  const texts: string[] = [];
  const streamStart = /stream\r?\n/g;
  for (;;) {
    if (streamStart.exec(raw) === null) break;
    const start = streamStart.lastIndex;
    const end = raw.indexOf("endstream", start);
    if (end === -1) break;
    streamStart.lastIndex = end;
    let content: string;
    try {
      content = zlib.inflateSync(buffer.subarray(start, end)).toString("latin1");
    } catch {
      continue;
    }
    for (const drawn of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      texts.push(Buffer.from(drawn[1], "hex").toString("latin1"));
    }
  }
  return texts.join("\n");
}
