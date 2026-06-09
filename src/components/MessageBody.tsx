import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import {
  fetchMessageView,
  attachmentDownloadUrl,
  formatBytes,
  type MessageView,
} from "../lib/liveBridge";
import { attachmentIcon, attachmentKind } from "../lib/attachments";

// SECURITY: this iframe renders attacker-controlled email HTML. Its sandbox MUST
// remain WITHOUT `allow-scripts` and WITHOUT `allow-same-origin`. That, combined
// with the DOMPurify pass below, is what makes untrusted HTML safe to show:
//   - DOMPurify strips <script>, on*= handlers, javascript: URLs, <iframe> etc.
//   - the sandbox makes the browser refuse to run ANY script and gives the frame
//     a null origin, so even a sanitizer bypass can't read cookies/localStorage,
//     the parent DOM, or our same-origin /api/* mailbox.
// Do NOT add allow-scripts or allow-same-origin here.
const SANDBOX = "allow-popups allow-popups-to-escape-sandbox"; // links open in a new tab; still NO scripts / NO same-origin

function sanitize(html: string): string {
  // Force links to open in a new tab and never share window.opener.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if ((node as Element).tagName === "A") {
      (node as Element).setAttribute("target", "_blank");
      (node as Element).setAttribute("rel", "noopener noreferrer");
    }
  });
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "link", "meta", "base"],
    FORBID_ATTR: ["srcset"],
  });
  DOMPurify.removeAllHooks();
  return clean;
}

// Wrap the sanitized fragment in a minimal document so iframe srcDoc renders with
// readable defaults and links target a new tab.
function wrapDoc(cleanHtml: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<base target="_blank">' +
    "<style>html,body{margin:0;padding:0;}" +
    'body{font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;word-wrap:break-word;overflow-wrap:anywhere;padding:4px 2px;}' +
    "img{max-width:100%;height:auto;}a{color:#1a73e8;}" +
    "blockquote{margin:0 0 0 8px;padding-left:8px;border-left:2px solid #ddd;color:#555;}" +
    "table{max-width:100%;}</style></head><body>" +
    cleanHtml +
    "</body></html>"
  );
}

export function MessageBody({
  messageId,
  fallbackText,
  onSelectionChange,
  hide,
}: {
  messageId: string;
  fallbackText: string;
  onSelectionChange: () => void;
  hide?: boolean;
}) {
  const [view, setView] = useState<MessageView | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  // Fetch the full message once, when this expanded body mounts (i.e. on open).
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setView(null);
    void fetchMessageView(messageId).then((v) => {
      if (cancelled) return;
      if (v) {
        setView(v);
        setState("ready");
      } else {
        setState("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  const srcDoc = useMemo(() => {
    if (!view || !view.html) return "";
    return wrapDoc(sanitize(view.html));
  }, [view]);

  if (hide) {
    // Body is entirely quoted history; App.tsx renders the quoted block itself.
    // Still surface attachment chips if we have them.
    return view && view.attachments.length ? (
      <AttachmentChips id={messageId} atts={view.attachments} />
    ) : null;
  }

  // Fall back to the existing flattened-text rendering while loading, on error,
  // or when the message has no HTML part — identical to non-bridge mode.
  if (state !== "ready" || !view || !srcDoc) {
    return (
      <>
        <pre className="body" onMouseUp={onSelectionChange}>
          {fallbackText}
        </pre>
        {view && view.attachments.length > 0 && (
          <AttachmentChips id={messageId} atts={view.attachments} />
        )}
      </>
    );
  }

  return (
    <>
      <iframe
        ref={frameRef}
        className="mail-html-frame"
        title="Message content"
        sandbox={SANDBOX}
        srcDoc={srcDoc}
        style={{ width: "100%", maxHeight: "70vh", minHeight: 80 }}
      />
      {view.attachments.length > 0 && <AttachmentChips id={messageId} atts={view.attachments} />}
    </>
  );
}

function AttachmentChips({ id, atts }: { id: string; atts: MessageView["attachments"] }) {
  // Hide attachments inlined into the HTML (cid images); show real files only.
  const files = atts.filter((a) => !a.inline);
  if (!files.length) return null;
  return (
    <div className="mail-att-chips">
      {files.map((a) => (
        <a
          key={a.index}
          className="mail-att-chip"
          href={attachmentDownloadUrl(id, a.index)}
          download={a.filename}
          title={`${a.filename} (${a.contentType})`}
        >
          <span aria-hidden="true">{attachmentIcon(attachmentKind(a.filename))}</span>
          <span>{a.filename}</span>
          {a.size > 0 && <span className="sz">{formatBytes(a.size)}</span>}
        </a>
      ))}
    </div>
  );
}
