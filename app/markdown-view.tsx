"use client";

import { type Block, parseBlocks, parseInline } from "./markdown";

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((span, index) => {
        if (span.kind === "strong") return <strong key={index}>{span.value}</strong>;
        if (span.kind === "em") return <em key={index}>{span.value}</em>;
        if (span.kind === "code") return <code key={index}>{span.value}</code>;
        if (span.kind === "link")
          return (
            <a key={index} href={span.href} target="_blank" rel="noreferrer">
              {span.value} ↗
            </a>
          );
        return <span key={index}>{span.value}</span>;
      })}
    </>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "h")
          return (
            <h5 className={"mdH mdH" + block.level} key={index}>
              <Inline text={block.text} />
            </h5>
          );
        if (block.type === "code")
          return (
            <pre className="mdPre" key={index}>
              <code>{block.text}</code>
            </pre>
          );
        if (block.type === "list")
          return block.ordered ? (
            <ol className="mdList" key={index}>
              {block.items.map((item, i) => (
                <li key={i}>
                  <Inline text={item} />
                </li>
              ))}
            </ol>
          ) : (
            <ul className="mdList" key={index}>
              {block.items.map((item, i) => (
                <li key={i}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        if (block.type === "table")
          return (
            <div className="mdTableWrap" key={index}>
              <table className="mdTable">
                <thead>
                  <tr>
                    {block.head.map((cell, i) => (
                      <th key={i}>
                        <Inline text={cell} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, c) => (
                        <td key={c}>
                          <Inline text={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        return (
          <p className="mdP" key={index}>
            <Inline text={block.text} />
          </p>
        );
      })}
    </>
  );
}

/** Renders plain text while the answer types itself out, then upgrades to markdown. */
export default function Markdown({ text, partial = false }: { text: string; partial?: boolean }) {
  if (partial) return <p className="mdP">{text}</p>;
  return <Blocks blocks={parseBlocks(text)} />;
}