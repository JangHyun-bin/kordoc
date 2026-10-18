# kordoc

**모두 파싱해버리겠다** — Parse them all.

[![npm version](https://img.shields.io/npm/v/kordoc.svg)](https://www.npmjs.com/package/kordoc)
[![license](https://img.shields.io/npm/l/kordoc.svg)](LICENSE)

> *Korea's document hell is second to none. Built by a civil servant who survived seven years in it.*

Convert HWP 3.x/5.x, HWPX, HWPML, PDF, XLS/XLSX, DOCX, PPTX and PNG/JPG/WebP to Markdown and structured data. Use it as a library, CLI or MCP server.

[한국어](README.md) · [Usage guide](docs/usage-en.md) · [Benchmarks](docs/benchmarks-en.md) · [Changelog](CHANGELOG.md)

- 📊 **0.963 overall on the public PDF benchmark** — opendataloader-bench, 200 documents. Ranked first against 12 published parsers in the 2026-09-29 comparison. [Measurement details](docs/benchmarks-en.md)
- 🇰🇷 **100% Korean document table structure match** — all **10,461 visible tables** from 2,429 original HWPX documents. [4.22.0 verification](docs/benchmarks-en.md)

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

**4.22.13 verification · 2026-10-18**. Results use fixed corpora and reference criteria.

| Target | Population | Result |
| --- | --- | --- |
| HWPX | 2,424 documents · 10,342 tables | Table structure match **10,342/10,342 · 100%** |
| HWP 5.x ↔ HWPX | 1,130 pairs · 4,315 tables | Paired-document table structure match **100%** |
| PDF text | 744 pairs | Character recall **99.879%** · precision **99.670%** · reading order **99.247%** · word-boundary F1 **99.049%** |
| PDF tables | 708 pairs · 2,331 tables | Detection **99.87%** · structure match **98.16%** · cell F1 **0.9918** |
| HWPX reflow | 25,187 multiline paragraphs (12 folders) | All line starts match **24,940/25,187 · 99.02%** |
| Nested PDF tables (text layer) | 29 documents · 101 tables | Structure and cell content **101/101 · 100%** |
| Statute annexes | 272 documents · 346 tables | HWP **346/346**, PDF **342/346 · 98.84%** |
| All PDFs | 1,729 scored out of 1,911 documents | Text coverage **99.80%** |
| OCR | 53 documents · 102 pages | CER **0.0409** · character recall **99.02%** |

Table structure, cell content and visual fidelity are separate metrics. The nested-table 100% applies only to these 101 tables, not all PDF parsing or page layout. See [benchmark details](docs/benchmarks-en.md) for scope, exclusions and the per-document comparison of every bench.

**4.22.13 improvement verification (2026-10-18)**: re-measured against 4.22.12 with the same scorer and corpora, parser output (all four opendataloader-bench modes, PDF text and tables, annexes, OCR, other formats, round trips and generation) is unchanged per document and the reflow saved-file metrics are unchanged, while rendered text spans within 1.5pt of Hancom's PDF rose **85,968/90,428→86,051/90,433**, images **3,869→3,872/3,976** and page counts **1,413→1,421/1,431**. Fixed: page numbers in sections without a footer area, page breaks of tables and rows that Hancom saved split across pages, tables in cells that push their anchor line down, and tables in cells that run past the page. [Details](docs/benchmarks-en.md)

Merged corner cells are retained within the existing logical grid during empty-row folding. Six number glyphs in the reproduced PDF are now restored; HTML rule rendering and unregistered font glyphs remain [documented limitations](docs/parsing-loss-reproductions.md) (Korean).

The external **opendataloader-bench, 200 documents** was verified on the same corpus with the 4.22.13 release candidate: overall **0.964** with defaults, **0.939** with OCR off. [Options and reproduction](docs/benchmarks-en.md#pdf--markdown--opendataloader-bench)

## Recent updates

Latest release: **[4.22.13](https://github.com/chrisryugj/kordoc/releases/tag/v4.22.13)** · 2026-10-18

| Version | Highlights |
| --- | --- |
| 4.22.13 | Page-break and in-cell table rendering fixes — page numbers without a footer area, no bottom-margin slack for tables with cells saved split, saved-split rows whose first line does not fit start on the next page, lines pushed by tables in cells, in-cell tables that run past the page (rendered text spans 85,968 → 86,051, images 3,869 → 3,872, page counts 1,413 → 1,421) — parser output and reflow metrics unchanged from 4.22.12 |
| 4.22.12 | Text-box rendering fixes — current size (curSz), re-layout of page-absolute caches, text boxes without a text-area width, old Hangul jamo widths; page-break paragraphs pushed by their own table; longest-path column boundaries for tables with no row matching the table width (rendered text spans 85,837 → 85,968, images 3,866 → 3,869) — parser output and reflow metrics unchanged from 4.22.11 |
| 4.22.11 | Rendering fixes — where tables inside split cells restart, float bottoms in the last part of split rows, multi-row cell content heights and the alignment of the last part of split centred cells (rendered text spans 85,496 → 85,837); fixes the 4.21.31 regression that pushed pictures in empty paragraphs off the page — parser output and reflow unchanged from 4.22.10 |
| 4.22.10 | MCP `parse_document` OCR model arguments (#165); rendering fixes for tables — column boundaries of rows with different cell-width sums, merged-cell row growth, cells saved split after their first line, first rows at the page bottom and next-page parts of split centred cells (rendered text spans 84,468 → 85,496, page counts 1,410 → 1,413) — parser output and reflow unchanged from 4.22.9 |
| 4.22.9 | Gulim/Dotum half-width symbol widths and bullet reservations in layout (body first-line positions 76,676 → 76,729, table cells 205,007 → 205,015); later pages of split centred cells, row-level table page breaks and automatic tabs after inline objects in rendering (rendered text spans 82,816 → 84,468) — parser output unchanged from 4.22.8 |
| 4.22.8 | PDF captions below tables in reading order, false two-column gutters rejected, image-region OCR map tables unwrapped (ODL default 0.96305 → 0.96367); page-split shares of fixed-height tables, Wingdings symbol widths and table-only line heights in layout — body first-line positions 76,631 → 76,676, table cells 205,005 → 205,007 |
| 4.22.7 | Drop needless Markdown escapes for intraword underscores and blank lines (ODL default 0.96291 → 0.96305); captions and paragraph space-before in tables split across pages; space compression in bulleted paragraphs of early Hangul 2024 builds — body first-line positions 76,525 → 76,631, table cells 204,958 → 205,005 (no per-document drops) |
| 4.22.6 | Handwriting OCR model preset (#164); enclosed numbers from character overlays and Hancom number PUA come out the same in HWPX, HWP and PDF; restore Hancom font symbols in PDFs; fix split-table, paper-anchored image and moved-paragraph layout — body first-line positions 76,443 → 76,525, table cells 204,869 → 204,958 |
| 4.22.5 | Fix zero-width tabs, symbol advances, bullet reservations, split tables and line heights; restore PDF partial cells, section headings and missing glyphs |
| 4.22.4 | Fix image, border, space-font, vertical baseline and quote layout; restore PDF bullet cells, notes, form headings and split list rows |
| 4.22.3 | Improve table, image and optional-hyphen reflow; restore PDF continuations and independent rows; retain merged corner cells during empty-row folding |
| 4.22.2 | Fix partial-edit positions, image wrapping and fixed-width spaces; preserve separate PDF title boxes and numbered rows; restore contact columns and shaded-row content |
| 4.22.1 | Fix mixed deskewed and high-resolution crop coordinates in figure-region OCR on PDFs with a text layer; full-scan deskew remains enabled |
| 4.22.0 | Nested PDF tables 94/101 → 101/101; preserve page-boundary cells, HWP captions and notes inside table cells. OCR line coordinates and model selection; lighter formula OCR installation |
| 4.21.33 | Endnote column flow, footnotes in split tables, cell spacing — body line positions matching 95.9% → 97.5%, cells 99.5% → 99.7% |
| 4.21.32 | Render and reflow page layout — table cells and floating objects that cross pages. Cell line positions matching 97.4% → 99.5%, body 87.2% → 95.9% |
| 4.21.31 | Render and reflow layout matching, tables kept in notes (#149), opt-in inline math (#150), security review fixes |
| 4.21.23 | OCR of text inside pictures in HWP and HWPX (`ocr: true`, #143) |
| 4.21.0 | Ministry document styles `--agency`, press release contact tables |

Use `--ocr --ocr-lines --format json` to export OCR line boxes and confidence. Select the detector and resolution with `--ocr-det` and `--ocr-det-long-side`. [OCR lines and models](docs/usage-en.md#ocr-lines-and-models)

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
