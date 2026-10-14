# kordoc

**모두 파싱해버리겠다** — Parse them all.

[![npm version](https://img.shields.io/npm/v/kordoc.svg)](https://www.npmjs.com/package/kordoc)
[![license](https://img.shields.io/npm/l/kordoc.svg)](LICENSE)

> *Korea's document hell is second to none. Built by a civil servant who survived seven years in it.*

Convert HWP 3.x/5.x, HWPX, HWPML, PDF, XLS/XLSX, DOCX, PPTX and PNG/JPG/WebP to Markdown and structured data. Use it as a library, CLI or MCP server.

[한국어](README.md) · [Usage guide](docs/usage-en.md) · [Benchmarks](docs/benchmarks-en.md) · [Changelog](CHANGELOG.md)

- 📊 **0.963 overall on the public PDF benchmark** — opendataloader-bench, 200 documents. Ranked first against 12 published parsers in the 2026-09-29 comparison. [Measurement details](docs/benchmarks-en.md)
- 🇰🇷 **100% Korean document table structure match** — all **10,342 visible tables** from 2,424 original HWPX documents. [4.21.22 verification](docs/benchmarks-en.md)

If this saves you time, a GitHub ⭐ helps others find it.

[![kordoc — watch the demo](./docs/video-demo.jpg)](https://youtu.be/Q13GmgDcIw0)

<sub>▶ Click to play on YouTube. Narration is in Korean.</sub>

**New video:** [kordoc 공개벤치 1위 마크 — public benchmark](https://youtu.be/9kRbwiTRQLs) · 2026-09-27 · 1 min 31 sec · Korean

## Install

Node.js **20+** · macOS / Linux / Windows

```bash
npm install kordoc
```

Run the CLI without installing it globally: `npx kordoc`. PDF/OCR dependencies are installed by default; omitting them with `--omit=optional` limits those features.

**Connect an AI agent**

```bash
npx -y kordoc setup
```

Registers MCP with installed clients such as Claude Desktop, Claude Code, Cursor and Codex. Restart the client to use **17 tools** for parsing, comparison, generation, rendering and more.

Claude Code plugin:

```text
/plugin marketplace add chrisryugj/kordoc
/plugin install kordoc@kordoc
```

[Manual MCP setup and installation troubleshooting](docs/usage-en.md)

## Quick start

### CLI

```bash
npx kordoc document.hwpx -o document.md
npx kordoc *.pdf --jobs 4 -d ./output
npx kordoc document.pdf --format json --pages 1-3
npx kordoc scan.pdf --ocr -o scan.md
npx kordoc generate report.md --preset report -o report.hwpx
npx kordoc fill --template gian -j values.json -o draft.hwpx
```

`--jobs` converts files in parallel and increases memory use. [Batch conversion details](docs/parallel-batch.md)

For the report, plan, gaejosik and bangchim presets, a blockquote right after the `#` title (`> …하고자 함`) becomes the summary box (gaejosik puts it under the title box on the first body page when the cover is on, the default; with `cover: false` the first `#` is a chapter header and the quote stays a ※ note). Keep it to one sentence (commas allowed) within three lines; longer or multi-sentence summaries produce a warning. For ministry, `> ▪ …` blockquotes become performance summary boxes wherever they appear.

### JavaScript / TypeScript

```typescript
import { parse, markdownToHwpx } from "kordoc"
import { writeFile } from "node:fs/promises"

const result = await parse("document.hwpx")
if (result.success) {
  console.log(result.markdown)
  // result.blocks: structured data; result.metadata: document metadata
}

const hwpx = await markdownToHwpx("# Plan\n\nBody text", {
  gongmun: { preset: "report" },
})
await writeFile("report.hwpx", Buffer.from(hwpx))
```

[Parse options, APIs, forms and rendering examples](docs/usage-en.md#-quick-start)

## Features

| Task | Capabilities |
| --- | --- |
| Read | Markdown, IR, page text, RAG chunks and local OCR |
| Compare and edit | Block/cell diffs, format-preserving HWPX/HWP patches |
| Create | Markdown → HWPX, government-document presets, tables, equations and charts |
| Fill forms | Fields, click-here controls, two draft templates and seal placement |
| Review | HWPX/HWP previews and region crops, validation, style checks and PII masking |

Extract Markdown for format-preserving patches with `--keep-layout-tables`. Unsupported edits are skipped with a reason. [Full CLI and API reference](docs/usage-en.md#-cli)

## Validation

**4.21.31 release verification · 2026-10-13**. Results use fixed corpora and reference criteria.

| Target | Population | Result |
| --- | --- | --- |
| HWPX | 2,424 documents · 10,342 tables | Table structure match **10,342/10,342 · 100%** |
| HWP 5.x ↔ HWPX | 1,130 pairs · 4,315 tables | Paired-document table structure match **100%** |
| PDF text | 744 pairs | Character recall **99.86%** · precision **99.67%** · reading order **99.23%** · word-boundary F1 **99.02%** |
| PDF tables | 708 pairs · 2,331 tables | Detection **99.83%** · structure match **97.98%** · cell F1 **0.991** |
| All PDFs | 1,729 scored out of 1,911 documents | Text coverage **99.80%** |
| OCR | 53 documents · 102 pages | CER **0.0412** · character recall **99.02%** |

Table structure, cell content and visual fidelity are separate metrics. See [benchmark details](docs/benchmarks-en.md) for scope, exclusions and the per-document comparison of every bench.

The external **opendataloader-bench, 200 documents** was measured with the 4.21.22 release: overall **0.963** with defaults, **0.939** with OCR off. [Options and reproduction](docs/benchmarks-en.md#pdf--markdown--opendataloader-bench)

## Recent updates

Latest release: **[4.21.32](https://github.com/chrisryugj/kordoc/releases/tag/v4.21.32)** · 2026-10-15

| Version | Highlights |
| --- | --- |
| 4.21.32 | Render and reflow page layout — table cells and floating objects that cross pages. Cell line positions matching 97.4% → 99.5%, body 87.2% → 95.9% |
| 4.21.31 | Render and reflow layout matching, tables kept in notes (#149), opt-in inline math (#150), security review fixes |
| 4.21.23 | OCR of text inside pictures in HWP and HWPX (`ocr: true`, #143) |
| 4.21.0 | Ministry document styles `--agency`, press release contact tables |
| 4.20.0 | Writing-convention checks, learning styles from a sample HWPX, `compare` and `patch --json` |

See the [changelog](CHANGELOG.md) for details on every release.

## FAQ

**How do I convert an HWP or HWPX file to Markdown?**
`npx kordoc document.hwp -o document.md`. It reads the file directly, without Hancom Office. Convert many files at once with `npx kordoc *.hwpx -d ./output`.

**How do I let Claude, Cursor or another AI agent read Korean documents?**
Run `npx -y kordoc setup` to register the MCP server. The agent can then read, compare and fill HWP, PDF and Excel files from a file path.

**Does it work on an air-gapped network?**
Yes. `KORDOC_OFFLINE=1` blocks all outbound traffic, and OCR runs on the local CPU with no API key. [Offline deployment](docs/offline-deployment.md)

**Can I use it for RAG indexing?**
`--format chunks` emits structure chunks with heading breadcrumbs plus standalone table chunks. Use `--table-format gfm` (API: `tableFormat: "gfm"`) for tables without HTML. From Python or Java, use the [Python SDK](sdk/python/README.md) or [Java SDK](sdk/java/README.md).

## Documentation and security

- [Usage guide](docs/usage-en.md): complete CLI, MCP tools, APIs and format support
- [Java SDK](sdk/java/README.md) · [Python SDK](sdk/python/README.md): parse from Java and Python systems through a resident engine worker ([worker protocol](docs/parse-worker-protocol.md), Korean)
- [Government-document generation](docs/gongmunseo-engine-spec.md) · [Architecture](docs/architecture.md)
- [Offline deployment](docs/offline-deployment.md): `KORDOC_OFFLINE=1`; MCP file scope with `KORDOC_ROOT`
- [Security policy](SECURITY.md) · [MIT license](LICENSE) · [Third-party notices](NOTICE)

## About the Author

A local civil servant in Korea. Built this after seven years of wrestling HWP files at the Gwangjin-gu District Office in Seoul. Validated on thousands of real government documents across five public-sector projects.
