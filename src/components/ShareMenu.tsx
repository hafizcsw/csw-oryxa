import { useState, useRef, useEffect, useCallback } from "react";
import { Share2, Copy, Check, MessageCircle, Mail } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { portalUrl } from "@/config/urls";
import { createPortal } from "react-dom";

interface ShareMenuProps {
  uniName: string;
  className?: string;
}

const SHARE_OPTIONS = [
  {
    key: "whatsapp",
    labelAr: "واتساب",
    labelEn: "WhatsApp",
    icon: MessageCircle,
    color: "#25D366",
    getUrl: (url: string, title: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
  },
  {
    key: "facebook",
    labelAr: "فيسبوك",
    labelEn: "Facebook",
    icon: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
      <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    color: "#1877F2",
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: "twitter",
    labelAr: "تويتر / X",
    labelEn: "Twitter / X",
    icon: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
      <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    color: "#000000",
    getUrl: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    key: "email",
    labelAr: "البريد الإلكتروني",
    labelEn: "Email",
    icon: Mail,
    color: "#EA4335",
    getUrl: (url: string, title: string) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
];

export function ShareMenu({ uniName, className = "" }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const isAr = language === "ar";

  const shareUrl = typeof window !== "undefined"
    ? portalUrl(window.location.pathname)
    : "";

  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      left: isAr ? rect.right - 220 : rect.left,
    });
  }, [isAr]);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open, updatePos]);

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className={`qs-hero__share-btn ${className}`}
        aria-label="Share"
      >
        <Share2 className="h-4 w-4" />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] min-w-[220px] rounded-xl border border-border bg-popover p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95"
          style={{ top: pos.top, left: pos.left }}
        >
          {SHARE_OPTIONS.map((opt) => (
            <a
              key={opt.key}
              href={opt.getUrl(shareUrl, uniName)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <opt.icon className="h-4 w-4 shrink-0" style={{ color: opt.color }} />
              <span>{isAr ? opt.labelAr : opt.labelEn}</span>
            </a>
          ))}

          <div className="my-1 h-px bg-border" />

          <button
            onClick={handleCopy}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            {copied ? (
              <Check className="h-4 w-4 shrink-0 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span>{copied ? (isAr ? "تم النسخ!" : "Copied!") : (isAr ? "نسخ الرابط" : "Copy link")}</span>
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
