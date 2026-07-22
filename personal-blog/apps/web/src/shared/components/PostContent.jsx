import { useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/* URL sanitization — only allow safe protocols                        */
/* ------------------------------------------------------------------ */

function sanitizeUrl(url) {
  const trimmed = String(url || "").trim();
  if (/^(https?:\/\/|mailto:|#|\/(?!\/))/i.test(trimmed)) return trimmed;
  return "";
}

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url);
}

/* ------------------------------------------------------------------ */
/* Inline parser — single-pass regex scan                              */
/* Precedence: code > image > link > bold > strikethrough > italic     */
/* ------------------------------------------------------------------ */

const INLINE_PATTERN =
  /(`[^`\n]+`)|(!\[[^\]\n]*\]\([^)\n]+\))|(\[[^\]\n]+\]\([^)\n]+\))|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(~~[^~\n]+~~)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;

function parseInline(text, keyPrefix = "") {
  const result = [];
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of String(text).matchAll(INLINE_PATTERN)) {
    if (match.index > lastIndex) {
      result.push(String(text).slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}i${matchIndex++}`;

    if (token.startsWith("`")) {
      result.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("![")) {
      const imgMatch = token.match(/^!\[([^\]\n]*)\]\(([^)\n]+)\)$/);
      const src = imgMatch ? sanitizeUrl(imgMatch[2]) : "";
      if (src) {
        result.push(<img alt={imgMatch[1]} decoding="async" key={key} loading="lazy" src={src} />);
      } else {
        result.push(token);
      }
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]\n]+)\]\(([^)\n]+)\)$/);
      const href = linkMatch ? sanitizeUrl(linkMatch[2]) : "";
      if (href) {
        const external = isExternalUrl(href);
        result.push(
          <a
            href={href}
            key={key}
            rel={external ? "noopener noreferrer" : undefined}
            target={external ? "_blank" : undefined}
          >
            {parseInline(linkMatch[1], `${key}-`)}
          </a>,
        );
      } else {
        result.push(token);
      }
    } else if (token.startsWith("**") || token.startsWith("__")) {
      result.push(<strong key={key}>{parseInline(token.slice(2, -2), `${key}-`)}</strong>);
    } else if (token.startsWith("~~")) {
      result.push(<del key={key}>{parseInline(token.slice(2, -2), `${key}-`)}</del>);
    } else if (token.startsWith("*") || token.startsWith("_")) {
      result.push(<em key={key}>{parseInline(token.slice(1, -1), `${key}-`)}</em>);
    } else {
      result.push(token);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < String(text).length) {
    result.push(String(text).slice(lastIndex));
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Block parser                                                        */
/* ------------------------------------------------------------------ */

const HR_PATTERN = /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const IMAGE_BLOCK = /^!\[([^\]\n]*)\]\(([^)\n]+)\)$/;
const TASK_ITEM = /^[-*]\s+\[( |x|X)\]\s+(.+)$/;

function splitTableRow(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function parseTableAlign(separatorLine) {
  return splitTableRow(separatorLine).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return undefined;
  });
}

function parseContentBlocks(body) {
  const lines = String(body || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let buffer = [];
  let codeLanguage = "";
  let isCode = false;

  function flushBuffer() {
    const content = buffer.join("\n").trim();
    buffer = [];
    if (!content) return;
    const blockLines = content.split("\n");

    /* Heading (h1–h6) */
    const heading = blockLines.length === 1 ? blockLines[0].match(/^(#{1,6})\s+(.+)$/) : null;
    if (heading) {
      blocks.push({ level: heading[1].length, text: heading[2], type: "heading" });
      return;
    }

    /* Horizontal rule */
    if (blockLines.length === 1 && HR_PATTERN.test(blockLines[0])) {
      blocks.push({ type: "hr" });
      return;
    }

    /* Standalone image block */
    if (blockLines.length === 1) {
      const imageMatch = blockLines[0].trim().match(IMAGE_BLOCK);
      if (imageMatch) {
        blocks.push({ alt: imageMatch[1], src: imageMatch[2], type: "image" });
        return;
      }
    }

    /* Table: first line has |, second line is a separator */
    if (blockLines.length >= 2 && blockLines[0].includes("|") && TABLE_SEPARATOR.test(blockLines[1])) {
      blocks.push({
        align: parseTableAlign(blockLines[1]),
        head: splitTableRow(blockLines[0]),
        rows: blockLines.slice(2).filter((line) => line.includes("|")).map(splitTableRow),
        type: "table",
      });
      return;
    }

    /* Task list */
    if (blockLines.every((line) => TASK_ITEM.test(line))) {
      blocks.push({
        items: blockLines.map((line) => {
          const taskMatch = line.match(TASK_ITEM);
          return { checked: taskMatch[1].toLowerCase() === "x", text: taskMatch[2] };
        }),
        type: "task-list",
      });
      return;
    }

    /* Unordered list */
    if (blockLines.every((line) => /^[-*]\s+/.test(line))) {
      blocks.push({ items: blockLines.map((line) => line.replace(/^[-*]\s+/, "")), type: "unordered-list" });
      return;
    }

    /* Ordered list */
    if (blockLines.every((line) => /^\d+\.\s+/.test(line))) {
      blocks.push({ items: blockLines.map((line) => line.replace(/^\d+\.\s+/, "")), type: "ordered-list" });
      return;
    }

    /* Blockquote */
    if (blockLines.every((line) => /^>\s?/.test(line))) {
      blocks.push({ text: blockLines.map((line) => line.replace(/^>\s?/, "")).join(" "), type: "quote" });
      return;
    }

    /* Paragraph (fallback) */
    blocks.push({ text: blockLines.join("\n"), type: "paragraph" });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (isCode) {
        blocks.push({ language: codeLanguage, text: buffer.join("\n"), type: "code" });
        buffer = [];
        codeLanguage = "";
        isCode = false;
      } else {
        flushBuffer();
        codeLanguage = line.slice(3).trim();
        isCode = true;
      }
      continue;
    }

    if (!isCode) {
      /* Horizontal rule detected in-stream (before list buffering) */
      if (HR_PATTERN.test(line) && buffer.length === 0) {
        blocks.push({ type: "hr" });
        continue;
      }
      /* Table detected in-stream: current line has |, next line is separator */
      if (line.includes("|") && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1])) {
        flushBuffer();
        const tableLines = [line, lines[i + 1]];
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
          tableLines.push(lines[i]);
          i += 1;
        }
        i -= 1;
        blocks.push({
          align: parseTableAlign(tableLines[1]),
          head: splitTableRow(tableLines[0]),
          rows: tableLines.slice(2).map(splitTableRow),
          type: "table",
        });
        continue;
      }
      if (!line.trim()) {
        flushBuffer();
      } else {
        buffer.push(line);
      }
    } else {
      buffer.push(line);
    }
  }

  if (isCode) blocks.push({ language: codeLanguage, text: buffer.join("\n"), type: "code" });
  else flushBuffer();

  let headingIndex = 0;
  for (const block of blocks) {
    if (block.type === "heading") {
      headingIndex += 1;
      block.id = `section-${headingIndex}`;
    }
  }

  return blocks;
}

/* ------------------------------------------------------------------ */
/* TOC extraction — shares parseContentBlocks with the renderer so ids */
/* and ordering can never drift from the rendered headings             */
/* ------------------------------------------------------------------ */

function plainHeadingText(text) {
  return String(text)
    .replace(/!\[([^\]\n]*)\]\([^)\n]+\)/g, "$1")
    .replace(/\[([^\]\n]+)\]\([^)\n]+\)/g, "$1")
    .replace(/(`+|\*\*|__|~~|\*|_)/g, "")
    .trim();
}

export function extractTocItems(body) {
  return parseContentBlocks(body)
    .filter((block) => block.type === "heading")
    .map((block) => ({
      id: block.id,
      level: Math.min(block.level + 1, 4),
      text: plainHeadingText(block.text),
    }));
}

/* ------------------------------------------------------------------ */
/* Code block with copy button                                         */
/* ------------------------------------------------------------------ */

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-lang">{language || "code"}</span>
        <button className={copied ? "code-copy is-copied" : "code-copy"} onClick={copyCode} type="button">
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function PostContent({ body, compact = false }) {
  const blocks = useMemo(() => parseContentBlocks(body), [body]);
  if (!blocks.length) return <p className="preview-placeholder">正文预览会显示在这里。</p>;

  return (
    <div className={compact ? "rich-content is-compact" : "rich-content"}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === "heading") {
          const Heading = `h${Math.min(block.level + 1, 4)}`;
          return <Heading id={block.id} key={key}>{parseInline(block.text, `${key}-`)}</Heading>;
        }

        if (block.type === "hr") return <hr key={key} />;

        if (block.type === "image") {
          const src = sanitizeUrl(block.src);
          if (!src) return <p key={key}>{block.src}</p>;
          return (
            <figure key={key}>
              <img alt={block.alt} decoding="async" loading="lazy" src={src} />
              {block.alt && <figcaption>{block.alt}</figcaption>}
            </figure>
          );
        }

        if (block.type === "table") {
          return (
            <div className="table-wrap" key={key}>
              <table>
                <thead>
                  <tr>
                    {block.head.map((cell, cellIndex) => (
                      <th key={`th-${cellIndex}`} style={block.align[cellIndex] ? { textAlign: block.align[cellIndex] } : undefined}>
                        {parseInline(cell, `${key}-h${cellIndex}-`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`tr-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`td-${cellIndex}`} style={block.align[cellIndex] ? { textAlign: block.align[cellIndex] } : undefined}>
                          {parseInline(cell, `${key}-r${rowIndex}c${cellIndex}-`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "task-list") {
          return (
            <ul className="task-list" key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`task-${itemIndex}`}>
                  <input checked={item.checked} disabled readOnly tabIndex={-1} type="checkbox" />
                  <span className={item.checked ? "is-checked" : undefined}>{parseInline(item.text, `${key}-t${itemIndex}-`)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "unordered-list" || block.type === "ordered-list") {
          const List = block.type === "ordered-list" ? "ol" : "ul";
          return (
            <List key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`li-${itemIndex}`}>{parseInline(item, `${key}-l${itemIndex}-`)}</li>
              ))}
            </List>
          );
        }

        if (block.type === "quote") return <blockquote key={key}>{parseInline(block.text, `${key}-`)}</blockquote>;

        if (block.type === "code") return <CodeBlock code={block.text} key={key} language={block.language} />;

        return <p key={key}>{parseInline(block.text, `${key}-`)}</p>;
      })}
    </div>
  );
}
