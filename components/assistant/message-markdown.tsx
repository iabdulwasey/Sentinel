"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { RecordLink } from "./record-link";

const RECORD_ROUTE = /^\/(compliance-monitoring\/partners|fleet-onboarding|authority-requests|rules)\//;

/** Renders an assistant message as GitHub-flavored Markdown, styled with the app's tokens. */
export function MessageMarkdown({ text }: { text: string }) {
  return (
    <div className="text-[13px] leading-relaxed text-ink [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2.5 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="mb-2.5 ml-1 list-inside list-disc space-y-1 marker:text-ink-muted">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2.5 ml-1 list-inside list-decimal space-y-1 marker:text-ink-muted">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed [&>p]:inline">{children}</li>,
          h1: ({ children }) => <h4 className="mb-2 mt-3 text-[14px] font-semibold text-ink">{children}</h4>,
          h2: ({ children }) => <h4 className="mb-2 mt-3 text-[14px] font-semibold text-ink">{children}</h4>,
          h3: ({ children }) => <h4 className="mb-1.5 mt-3 text-[13px] font-semibold text-ink">{children}</h4>,
          h4: ({ children }) => <h4 className="mb-1.5 mt-3 text-[13px] font-semibold text-ink">{children}</h4>,
          code: ({ children }) => <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.82em] text-brand-700">{children}</code>,
          pre: ({ children }) => <pre className="scroll-slim mb-2.5 overflow-x-auto rounded-md bg-surface-sunken p-2.5 font-mono text-[11.5px] text-ink-muted">{children}</pre>,
          blockquote: ({ children }) => <blockquote className="mb-2.5 border-l-2 border-brand-300 pl-3 text-ink-muted">{children}</blockquote>,
          hr: () => <hr className="my-3 border-border" />,
          a: ({ href, children }) =>
            href && RECORD_ROUTE.test(href) ? (
              <RecordLink href={href}>{children}</RecordLink>
            ) : href && href.startsWith("/") ? (
              <Link href={href} className="font-medium text-brand-700 hover:underline">{children}</Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">{children}</a>
            ),
          table: ({ children }) => (
            <div className="scroll-slim mb-2.5 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-[12px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-border bg-surface-sunken/50">{children}</thead>,
          th: ({ children }) => <th className="px-2.5 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-ink-muted">{children}</th>,
          td: ({ children }) => <td className="border-t border-border px-2.5 py-1.5 align-top text-ink-muted">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
