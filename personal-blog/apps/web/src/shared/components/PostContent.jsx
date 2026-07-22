import { useMemo } from "react";

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
    const heading = blockLines.length === 1 ? blockLines[0].match(/^(#{1,3})\s+(.+)$/) : null;

    if (heading) blocks.push({ level: heading[1].length, text: heading[2], type: "heading" });
    else if (blockLines.every((line) => /^[-*]\s+/.test(line))) {
      blocks.push({ items: blockLines.map((line) => line.replace(/^[-*]\s+/, "")), type: "unordered-list" });
    } else if (blockLines.every((line) => /^\d+\.\s+/.test(line))) {
      blocks.push({ items: blockLines.map((line) => line.replace(/^\d+\.\s+/, "")), type: "ordered-list" });
    } else if (blockLines.every((line) => /^>\s?/.test(line))) {
      blocks.push({ text: blockLines.map((line) => line.replace(/^>\s?/, "")).join(" "), type: "quote" });
    } else blocks.push({ text: blockLines.join(" "), type: "paragraph" });
  }

  for (const line of lines) {
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
    if (!isCode && !line.trim()) flushBuffer();
    else buffer.push(line);
  }

  if (isCode) blocks.push({ language: codeLanguage, text: buffer.join("\n"), type: "code" });
  else flushBuffer();
  return blocks;
}

function renderInlineText(text) {
  return String(text)
    .split(/(`[^`]+`)/g)
    .filter(Boolean)
    .map((part, index) =>
      part.startsWith("`") && part.endsWith("`") ? (
        <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>
      ) : (
        part
      ),
    );
}

export function PostContent({ body, compact = false }) {
  const blocks = useMemo(() => parseContentBlocks(body), [body]);
  if (!blocks.length) return <p className="preview-placeholder">正文预览会显示在这里。</p>;

  return (
    <div className={compact ? "rich-content is-compact" : "rich-content"}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          const Heading = `h${Math.min(block.level + 1, 4)}`;
          return <Heading key={key}>{renderInlineText(block.text)}</Heading>;
        }
        if (block.type === "unordered-list" || block.type === "ordered-list") {
          const List = block.type === "ordered-list" ? "ol" : "ul";
          return (
            <List key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineText(item)}</li>
              ))}
            </List>
          );
        }
        if (block.type === "quote") return <blockquote key={key}>{renderInlineText(block.text)}</blockquote>;
        if (block.type === "code") {
          return (
            <pre data-language={block.language || undefined} key={key}>
              <code>{block.text}</code>
            </pre>
          );
        }
        return <p key={key}>{renderInlineText(block.text)}</p>;
      })}
    </div>
  );
}
