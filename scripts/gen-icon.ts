#!/usr/bin/env bun
/**
 * Generate or edit an image via OpenRouter.
 *
 * Usage:
 *   bun scripts/gen-icon.ts <prompt-file> [--model openai/gpt-5-image] [--out generated/] [--ref PATH]
 *
 *   --ref PATH   Reference image to pass as input for image-to-image editing.
 *                Enables true iteration: the model sees the prior image and
 *                edits it per the prompt instead of generating from scratch.
 */

import { mkdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "usage: bun scripts/gen-icon.ts <prompt-file> [--model MODEL] [--out DIR] [--ref PATH]",
  );
  process.exit(1);
}

const promptFile = args[0]!;
const getFlag = (name: string, fallback: string | null = null): string | null => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};

const model = getFlag("model", "openai/gpt-5-image")!;
const outDir = resolve(getFlag("out", "generated")!);
const refPath = getFlag("ref");

const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("OPENROUTER_API_KEY is not set");
  process.exit(1);
}

const prompt = await Bun.file(promptFile).text();
if (!prompt.trim()) {
  console.error(`prompt file ${promptFile} is empty`);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

const userContent: ContentPart[] = [{ type: "text", text: prompt }];

if (refPath) {
  const refBuf = await Bun.file(refPath).arrayBuffer();
  const refB64 = Buffer.from(refBuf).toString("base64");
  const mime = refPath.endsWith(".jpg") || refPath.endsWith(".jpeg") ? "image/jpeg" : "image/png";
  userContent.push({
    type: "image_url",
    image_url: { url: `data:${mime};base64,${refB64}` },
  });
  console.log(`ref:    ${refPath} (${(refBuf.byteLength / 1024).toFixed(1)} KiB, ${mime})`);
}

console.log(`model:  ${model}`);
console.log(`prompt: ${basename(promptFile)} (${prompt.length} chars)`);
console.log(`out:    ${outDir}`);
console.log(`mode:   ${refPath ? "image-to-image (edit)" : "text-to-image (generate)"}`);
console.log("→ calling OpenRouter…");

const t0 = Date.now();
const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://githut.local",
    "X-Title": "GitHut icon generator",
  },
  body: JSON.stringify({
    model,
    modalities: ["image", "text"],
    messages: [{ role: "user", content: userContent }],
  }),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`HTTP ${res.status}: ${text}`);
  process.exit(1);
}

const data = (await res.json()) as {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type: string; image_url?: { url: string } }>;
      images?: Array<{ image_url?: { url: string }; type?: string }>;
    };
  }>;
  error?: { message: string };
};

if (data.error) {
  console.error("OpenRouter error:", data.error.message);
  process.exit(1);
}

const message = data.choices?.[0]?.message;
const images: string[] = [];

if (Array.isArray(message?.images)) {
  for (const img of message.images) {
    if (img?.image_url?.url) images.push(img.image_url.url);
  }
}
if (Array.isArray(message?.content)) {
  for (const part of message.content) {
    if (part.type === "image_url" && part.image_url?.url) images.push(part.image_url.url);
  }
}

if (images.length === 0) {
  console.error("no images returned. full response:");
  console.error(JSON.stringify(data, null, 2).slice(0, 4000));
  process.exit(1);
}

const stem = basename(promptFile, extname(promptFile));
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

let saved = 0;
for (const [i, url] of images.entries()) {
  const match = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    console.warn(`image ${i}: not a data URI, skipping (url starts: ${url.slice(0, 60)}…)`);
    continue;
  }
  const [, mime, b64] = match;
  const ext = mime!.split("/")[1]!;
  const buf = Buffer.from(b64!, "base64");
  const out = join(outDir, `${stem}-${ts}-${i}.${ext}`);
  await Bun.write(out, buf);
  console.log(`✓ ${out} (${(buf.byteLength / 1024).toFixed(1)} KiB)`);
  saved++;
}

console.log(`done: ${saved}/${images.length} saved in ${Date.now() - t0}ms`);
