import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// react-markdown builds real React elements and never touches
// dangerouslySetInnerHTML, so model output cannot inject script tags or event
// handlers — raw HTML in a reply is escaped, not executed, and no separate
// sanitizer is required.
// Condition sources are plain external links (the system prompt asks the model
// for markdown links), so they open in a new tab with noopener to keep the
// chat SPA unreachable from window.opener.
const markdownComponents: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {children}
    </ReactMarkdown>
  );
}