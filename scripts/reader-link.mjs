#!/usr/bin/env node
/**
 * Print a Margin reader link for a snapshot JSON file on stdin.
 *
 *   node scripts/reader-link.mjs http://127.0.0.1:43123 < post.json
 *
 * This checks JSON syntax and size only. The reader validates the schema.
 * Compression is raw deflate (RFC 1951): Node zlib.deflateRawSync,
 * Python zlib.compressobj(wbits=-15), browser CompressionStream("deflate-raw").
 */
import fs from "node:fs";
import zlib from "node:zlib";

const origin = (process.argv[2] ?? "http://127.0.0.1:43123").replace(/\/$/, "");
const input = fs.readFileSync(0);
if (input.byteLength > 48 * 1024) {
  console.error("snapshot is larger than 48 KB");
  process.exit(1);
}
try {
  JSON.parse(input.toString("utf8"));
} catch {
  console.error("snapshot is not valid JSON");
  process.exit(1);
}
const token = zlib.deflateRawSync(input).toString("base64url");
if (token.length > 24000) {
  console.error("compressed link is longer than 24000 characters; send the JSON file instead");
  process.exit(2);
}
process.stdout.write(`${origin}/#s1.${token}\n`);
