import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Link } from "react-router-dom";

// react-markdown builds real React elements and never touches
// dangerouslySetInnerHTML, so model output cannot inject script tags or event
// handlers — raw HTML in a reply is escaped, not executed, and no separate
// sanitizer is required.
// Mountain-card links stay inside the app; condition sources open externally.
const markdownComponents: Components = {
  a: ({ children, href }) =>
    href && /^\/mountain\/\d+$/.test(href) ? (
      <Link to={href}>{children}</Link>
    ) : (
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