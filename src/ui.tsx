import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { href } from "./navigation";

const ICONS = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-8h6v8" /></>,
  live: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.7" /></>,
  sports: <><circle cx="12" cy="14" r="8" /><path d="M12 14V9m-3-7h6m-3 0v4m6 1 2-2" /></>,
  slots: <><rect x="7" y="3" width="13" height="18" rx="2" /><path d="m7 5-4 1a2 2 0 0 0-1 2l3 13" /><path d="M13.5 7c-1.5 2-4 3-4 5a2.4 2.4 0 0 0 4 1.6A2.4 2.4 0 0 0 17.5 12c0-2-2.5-3-4-5Zm0 6v4" /></>,
  casino: <><path d="M4 3h16v13H4zM4 16l-2 4h20l-2-4" /><circle cx="12" cy="7.5" r="2" /><path d="M8.5 13c0-3.5 7-3.5 7 0" /></>,
  games: <><rect x="3" y="2" width="11" height="17" rx="2" /><path d="m8.5 6-3 4 3 4 3-4Z" /><rect x="12" y="13" width="9" height="9" rx="2" /><path d="M15 16h.01M18 19h.01" /></>,
  plane: <><path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3" /></>,
  rocket: <><path d="M14 4c3-2 7-1 7-1s1 4-1 7l-8 8-6-6Z" /><path d="m7 11-4-1 4-5 6 1m0 11 1 4 5-4-1-6M3 21l4-1-3-3Z" /><circle cx="16" cy="8" r="1.5" /></>,
  gift: <><path d="M3 8h18v4H3zm2 4v9h14v-9M12 8v13" /><path d="M12 8H8a3 3 0 1 1 3-3Zm0 0h4a3 3 0 1 0-3-3Z" /></>,
  support: <><path d="M4 14v-3a8 8 0 0 1 16 0v3M20 16v2a3 3 0 0 1-3 3h-3" /><rect x="2" y="11" width="4" height="7" rx="2" /><rect x="18" y="11" width="4" height="7" rx="2" /><path d="M10 21h4" /></>,
  menu: <path d="M4 5h16M4 12h16M4 19h16" />,
  more: <><circle cx="12" cy="5" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="19" r="1.2" fill="currentColor" /></>,
  close: <path d="m5 5 14 14M19 5 5 19" />,
  chevron: <path d="m7 10 5 5 5-5" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  user: <><circle cx="12" cy="7" r="4" /><path d="M4 22v-2a8 8 0 0 1 16 0v2" /></>,
  wallet: <><rect x="3" y="6" width="18" height="15" rx="2" /><path d="M3 8V5l14-3v4m4 6h-6v5h6m-4-2.5h.01" /></>,
  deposit: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  withdraw: <><path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5" /></>,
  history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2" /></>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="var(--bg-soft)" /><circle cx="16" cy="12" r="2" fill="var(--bg-soft)" /><circle cx="10" cy="18" r="2" fill="var(--bg-soft)" /></>,
  lock: <><rect x="5" y="10" width="14" height="12" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3" /></>,
  shield: <><path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z" /><path d="m8 12 3 3 5-6" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="m3 3 18 18M10 5c7-1 12 7 12 7l-3 4M6 6c-2 2-4 6-4 6s4 7 10 7c2 0 4-1 5-2M10 10a3 3 0 0 0 4 4" /></>,
  check: <path d="m5 12 4 4 10-10" />,
  search: <><circle cx="10.5" cy="10.5" r="7.5" /><path d="m16 16 5 5" /></>,
  logout: <><path d="M9 3H3v18h6m5-16 7 7-7 7m-7-7h14" /></>,
  bell: <><path d="M4 18h16l-2-4V9a6 6 0 0 0-12 0v5Zm5 3h6" /></>,
  document: <><path d="M5 2h10l4 4v16H5Zm10 0v5h4M8 12h8m-8 4h8" /></>,
  ticket: <><path d="m4 3 2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2v19l-2-2-2 2-2-2-2 2-2-2-2 2-2-2-2 2Z" /><path d="M8 9h8m-8 4h8m-8 4h5" /></>,
  bank: <><path d="m2 8 10-6 10 6H2Zm2 3v7m5-7v7m6-7v7m5-7v7M2 22h20M3 19h18" /></>,
  card: <><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M2 9h20M5 16h5" /></>,
  coin: <><circle cx="12" cy="12" r="10" /><path d="M15 7H9v5h6v5H9m3-13v3m0 10v3" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><ellipse cx="12" cy="12" rx="4" ry="10" /><path d="M2 12h20M4 6h16M4 18h16" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 11v6m0-10h.01" /></>,
  plus: <path d="M12 4v16M4 12h16" />,
  upload: <><path d="M12 17V3m-5 5 5-5 5 5M3 15v6h18v-6" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 5 10 8L22 5" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  star: <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;
export function Icon({ name, size = 22, className = "" }: { name: IconName; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={`icon ${className}`} aria-hidden="true">{ICONS[name]}</svg>;
}

export function Logo() {
  return <a className="brand" href={href("home")} aria-label="SHALOM BET ana sayfa"><span className="brand-crest"><span>S</span></span><span className="brand-type">SHALOM<span className="brand-sub">BET</span></span></a>;
}

export function EmptyState({ icon = "document", title, description, children, compact = false }: { icon?: IconName; title: string; description?: string; children?: ReactNode; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "compact" : ""}`}><span className="empty-icon"><Icon name={icon} size={32} /></span><h3>{title}</h3>{description && <p>{description}</p>}{children && <div className="empty-action">{children}</div>}</div>;
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`notice ${error ? "notice-error" : ""}`} role={error ? "alert" : "status"}><Icon name="info" size={18} /><span>{children}</span></div>;
}

export function Spinner() {
  return <span className="spinner" aria-label="Yükleniyor" role="status" />;
}

export function PageHeading({ title, eyebrow, children }: { title: string; eyebrow?: string; children?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1></div>{children}</div>;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hideLabel?: boolean; suffix?: ReactNode };
export function Field({ label, error, hideLabel = false, suffix, className = "", id: suppliedId, ...props }: FieldProps) {
  const generatedId = useId();
  const id = suppliedId || generatedId;
  return <div className={`field ${className}`}><label htmlFor={id} className={hideLabel ? "sr-only" : "field-label"}>{label}</label><div className="field-control"><input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...props} />{suffix}</div>{error && <span id={`${id}-error`} className="field-error">{error}</span>}</div>;
}

export function PasswordField(props: Omit<FieldProps, "type" | "suffix">) {
  const [visible, setVisible] = useState(false);
  return <Field {...props} type={visible ? "text" : "password"} suffix={<button type="button" className="password-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"} aria-pressed={visible}><Icon name={visible ? "eyeOff" : "eye"} size={19} /></button>} />;
}

export function Dialog({ title, children, onClose, className = "" }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => (panel.current?.querySelector<HTMLElement>("[data-autofocus]") || panel.current)?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter((node) => node.offsetParent !== null);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); panel.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`dialog-panel ${className}`}><header className="dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><Icon name="close" /></button></header><div className="dialog-content">{children}</div></div></div>, document.body);
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="search-input"><Icon name="search" size={19} /><input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />{value && <button className="icon-button" type="button" onClick={() => onChange("")} aria-label="Aramayı temizle"><Icon name="close" size={16} /></button>}</div>;
}

export function LegalContent({ title, body }: { title: string; body?: string }) {
  return body?.trim() ? <article className="prose-content"><h2>{title}</h2><div>{body}</div></article> : <EmptyState title="İçerik henüz yayınlanmadı." description="Bu sayfanın içeriği yayınlandığında burada görüntülenecek." />;
}