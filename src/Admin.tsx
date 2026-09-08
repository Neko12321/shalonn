/* SHALOM BET Yönetim Paneli — CRM düzeni (lacivert menü, beyaz içerik) */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "./admin.css";
import emblemUrl from "./assets/logo.png";
import { money, type Banner, type Game, type HelpArticle, type Match, type PaymentMethod } from "./platform";
import {
  DEFAULT_ADMIN_PASSWORD, adjustBalance, clearContent, deleteMember, deleteRecord, exportState,
  hashText, importState, loadSampleContent, moveItem, newId, removeItem, resetAll, resolveRequest,
  setStaffSession, updateMember, updatePage, updateSettings, updateSupport, upsertItem, useStore,
  type PermissionId, type StaffSession, type StoredMember,
} from "./store";
import { AffiliatesPanel, EmployeesPanel, usePermissions } from "./Staff";

type Section =
  | "dashboard" | "players" | "finance" | "bets"
  | "games" | "banners" | "matches" | "payments"
  | "pages" | "support" | "employees" | "affiliates" | "settings" | "backup";

const NAV: { group: string; items: { id: Section; label: string; icon: string }[] }[] = [
  {
    group: "Operasyon",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "▦" },
      { id: "players", label: "Oyuncular", icon: "◍" },
      { id: "finance", label: "Talepler", icon: "₺" },
      { id: "bets", label: "Bahisler", icon: "▣" },
      { id: "employees", label: "Çalışanlar", icon: "👤" },
      { id: "affiliates", label: "Affiliate", icon: "🔗" },
    ],
  },
  {
    group: "İçerik",
    items: [
      { id: "games", label: "Oyunlar", icon: "▶" },
      { id: "banners", label: "Bannerlar", icon: "▣" },
      { id: "matches", label: "Maçlar", icon: "◎" },
      { id: "payments", label: "Ödeme Yöntemleri", icon: "▭" },
    ],
  },
  {
    group: "Sistem",
    items: [
      { id: "pages", label: "Sayfalar", icon: "☰" },
      { id: "support", label: "Destek", icon: "☎" },
      { id: "settings", label: "Ayarlar", icon: "⚙" },
      { id: "backup", label: "Yedekleme", icon: "⇩" },
    ],
  },
];

const TITLES: Record<Section, { title: string; sub: string }> = {
  dashboard: { title: "Dashboard", sub: "Genel bakış ve bekleyen işlemler" },
  players: { title: "Oyuncular", sub: "Kayıtlı üyeler, bakiye ve hesap durumu" },
  finance: { title: "Talepler", sub: "Yatırım ve çekim taleplerini onaylayın" },
  bets: { title: "Bahisler", sub: "Oynanan kuponlar ve bahis hareketleri" },
  games: { title: "Oyunlar", sub: "Görsel, bağlantı ve API ile oyun yönetimi" },
  banners: { title: "Bannerlar", sub: "Ana sayfa duyuru slaytları" },
  matches: { title: "Maçlar", sub: "Karşılaşmalar, oranlar ve canlı durum" },
  payments: { title: "Ödeme Yöntemleri", sub: "Yatırım ve çekim yöntemleri" },
  pages: { title: "Sayfalar", sub: "Kurumsal metinler" },
  support: { title: "Destek", sub: "İletişim ve canlı sohbet" },
  employees: { title: "Çalışanlar", sub: "Kullanıcı adı, şifre ve yetkiler" },
  affiliates: { title: "Affiliate", sub: "Ortaklar, promo kodu ve özel kayıt linki" },
  settings: { title: "Ayarlar", sub: "Marka, görünüm ve yönetici hesabı" },
  backup: { title: "Yedekleme", sub: "Dışa aktar, içe aktar, sıfırla" },
};

type FieldType = "text" | "textarea" | "number" | "select" | "switch" | "datetime";
interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  half?: boolean;
}
type FormValue = Record<string, unknown>;
type Collection = "banners" | "games" | "matches" | "paymentMethods" | "helpArticles";

function Fields({ defs, value, onChange }: { defs: FieldDef[]; value: FormValue; onChange: (p: FormValue) => void }) {
  const render = (def: FieldDef) => {
    const current = value[def.key];
    const set = (next: unknown) => onChange({ [def.key]: next });
    return (
      <div className="field" key={def.key}>
        {def.type !== "switch" && <label htmlFor={`f-${def.key}`}>{def.label}</label>}
        {def.type === "textarea" && <textarea id={`f-${def.key}`} value={String(current ?? "")} placeholder={def.placeholder} onChange={(e) => set(e.target.value)} />}
        {def.type === "select" && (
          <select id={`f-${def.key}`} value={String(current ?? "")} onChange={(e) => set(e.target.value)}>
            {def.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {def.type === "switch" && (
          <label className="check"><input type="checkbox" checked={current !== false} onChange={(e) => set(e.target.checked)} /><span>{def.label}</span></label>
        )}
        {def.type === "number" && (
          <input id={`f-${def.key}`} type="number" step="any" value={current === undefined || current === null ? "" : String(current)} placeholder={def.placeholder} onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))} />
        )}
        {def.type === "datetime" && <input id={`f-${def.key}`} type="datetime-local" value={String(current ?? "")} onChange={(e) => set(e.target.value)} />}
        {(!def.type || def.type === "text") && <input id={`f-${def.key}`} type="text" value={String(current ?? "")} placeholder={def.placeholder} onChange={(e) => set(e.target.value)} />}
        {def.help && <small>{def.help}</small>}
      </div>
    );
  };
  return (
    <>
      {defs.filter((d) => d.half).length > 0 && <div className="g2">{defs.filter((d) => d.half).map(render)}</div>}
      {defs.filter((d) => !d.half).map(render)}
    </>
  );
}

function Crud<T extends { id: string }>({
  collection, items, defs, blank, describe, toForm, fromForm, searchText, notify, extra,
}: {
  collection: Collection;
  items: T[];
  defs: FieldDef[];
  blank: () => T;
  describe: (item: T) => { title: string; subtitle: string; thumb?: string; tag?: ReactNode };
  toForm?: (item: T) => FormValue;
  fromForm?: (form: FormValue) => T;
  searchText?: (item: T) => string;
  notify: (m: string) => void;
  extra?: ReactNode;
}) {
  const [form, setForm] = useState<FormValue | null>(null);
  const [query, setQuery] = useState("");
  const open = (item: T) => setForm(toForm ? toForm(item) : ({ ...item } as FormValue));
  const visible = items.filter((item) => !query.trim() || (searchText ? searchText(item) : JSON.stringify(item)).toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  const save = () => {
    if (!form) return;
    upsertItem(collection, fromForm ? fromForm(form) : (form as unknown as T));
    setForm(null);
    notify("Kaydedildi.");
  };
  return (
    <>
      <div className="toolbar">
        <div className="search"><span>⌕</span><input placeholder="Ara" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <button className="btn btn-blue" onClick={() => open(blank())}>+ Yeni Ekle</button>
      </div>
      {extra}
      {form && (
        <div className="panel">
          <div className="panel-h"><h3>{items.some((i) => i.id === form.id) ? "Kaydı düzenle" : "Yeni kayıt"}</h3></div>
          <div className="panel-b">
            <div className="form">
              <Fields defs={defs} value={form} onChange={(p) => setForm({ ...form, ...p })} />
              {typeof form.imageUrl === "string" && form.imageUrl && <img className="preview-img" src={String(form.imageUrl)} alt="" />}
              <div className="actions">
                <button className="btn btn-blue" onClick={save}>Kaydet</button>
                <button className="btn btn-white" onClick={() => setForm(null)}>Vazgeç</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="panel">
        <div className="panel-h"><h3>Kayıtlar</h3><span className="tag tag-gray">{items.length}</span></div>
        {visible.length === 0 ? <div className="empty"><b>Kayıt yok</b><p>Sağ üstten yeni kayıt ekleyin.</p></div> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Kayıt</th><th>Detay</th><th>Durum</th><th></th></tr></thead>
              <tbody>
                {visible.map((item, index) => {
                  const info = describe(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {info.thumb
                            ? <img className="thumb" src={info.thumb} alt="" />
                            : <span className="thumb ph">◆</span>}
                          <div><strong>{info.title}</strong><span className="sub">{info.subtitle}</span></div>
                        </div>
                      </td>
                      <td className="hide-sm">{info.subtitle}</td>
                      <td>{info.tag}</td>
                      <td>
                        <div className="acts">
                          <button className="btn btn-white btn-sm" onClick={() => moveItem(collection, item.id, -1)} disabled={index === 0}>↑</button>
                          <button className="btn btn-white btn-sm" onClick={() => moveItem(collection, item.id, 1)} disabled={index === visible.length - 1}>↓</button>
                          <button className="btn btn-white btn-sm" onClick={() => open(item)}>Düzenle</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm("Silinsin mi?")) { removeItem(collection, item.id); notify("Silindi."); } }}>Sil</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Login({ onEnter }: { onEnter: (session: StaffSession) => void }) {
  const { settings, employees } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const name = username.trim().toLocaleLowerCase("tr-TR");
      const saved = settings.admin.passwordHash;
      const ownerOk = name === settings.admin.username.toLocaleLowerCase("tr-TR")
        && (saved ? (await hashText(password)) === saved : password === DEFAULT_ADMIN_PASSWORD);
      if (ownerOk) {
        if (!saved) updateSettings({ admin: { ...settings.admin, passwordHash: await hashText(password) } });
        onEnter({ role: "owner" });
        return;
      }
      const emp = employees.find((item) => item.username.toLocaleLowerCase("tr-TR") === name);
      if (emp && emp.status === "active" && (await hashText(password)) === emp.passwordHash) {
        onEnter({ role: "employee", employeeId: emp.id });
        return;
      }
      setError("Kullanıcı adı veya şifre hatalı.");
    } finally { setBusy(false); }
  };
  return (
    <div className="adm-login">
      <form className="adm-login-card" onSubmit={submit}>
        <div className="adm-login-brand"><img src={emblemUrl} alt="" /><b>SHALOM BET</b></div>
        <h1>Yönetim Paneli</h1>
        <p>Operasyon, oyuncular ve içerik</p>
        <div className="form">
            <div className="field"><label>Kullanıcı adı</label><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></div>
          <div className="field"><label>Şifre</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
          {error && <div className="note warn">{error}</div>}
          <button className="btn btn-blue" type="submit" disabled={busy} style={{ width: "100%" }}>{busy ? "Kontrol..." : "Giriş Yap"}</button>
        </div>
        {!settings.admin.passwordHash && (
          <div className="adm-hint-box">İlk giriş: <b>admin</b> / <b>{DEFAULT_ADMIN_PASSWORD}</b>. Girişten sonra Ayarlar bölümünden şifrenizi değiştirin.</div>
        )}
        <a className="adm-aff-link" href="#/ortak">Affiliate girişi için tıklayın →</a>
      </form>
    </div>
  );
}

const toLocal = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function Admin({ onExit }: { onExit: () => void }) {
  const { content, settings, members, records, staffSession, employees, affiliates } = useStore();
  const allowed = usePermissions();
  const [section, setSection] = useState<Section>("dashboard");
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const signed = staffSession?.role === "owner" || staffSession?.role === "employee";

  useEffect(() => { document.title = "Yönetim | SHALOM BET"; document.body.style.background = "#f5f7fb"; return () => { document.body.style.background = ""; }; }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2400); return () => clearTimeout(t); }, [toast]);
  const notify = (m: string) => setToast(m);

  const pending = records.filter((r) => r.kind === "transaction" && r.status === "pending");
  const bets = records.filter((r) => r.kind === "bet");
  const go = (id: Section) => { setSection(id); setMenu(false); };

  useEffect(() => {
    if (signed && allowed.length && !allowed.includes(section as PermissionId)) {
      setSection((allowed[0] as Section) || "dashboard");
    }
  }, [signed, allowed, section]);

  if (!signed) return <div className="adm"><Login onEnter={(session) => setStaffSession(session)} /></div>;

  const head = TITLES[section];

  const dashboard = (
    <>
      <div className="stats">
        <div className="stat on"><span>Oyuncu</span><b>{members.length}</b></div>
        <div className="stat"><span>Bekleyen</span><b>{pending.length}</b></div>
        <div className="stat"><span>Toplam bakiye</span><b>{members.reduce((s, m) => s + m.balance, 0).toLocaleString("tr-TR")}</b></div>
        <div className="stat"><span>Oyun</span><b>{content.games.length}</b></div>
        <div className="stat"><span>Maç</span><b>{content.matches.length}</b></div>
        <div className="stat"><span>Bahis</span><b>{bets.length}</b></div>
      </div>
      <div className="panel">
        <div className="panel-h"><h3>Bekleyen talepler</h3><span className="tag tag-amber">{pending.length}</span></div>
        {pending.length === 0 ? <div className="empty"><b>Bekleyen talep yok</b></div> : (
          <table className="tbl"><thead><tr><th>Oyuncu</th><th>İşlem</th><th>Tutar</th><th></th></tr></thead>
            <tbody>{pending.map((r) => {
              const u = members.find((m) => m.id === r.memberId);
              return (
                <tr key={r.id}>
                  <td><strong>{u?.username || "—"}</strong><span className="sub">{new Date(r.date).toLocaleString("tr-TR")}</span></td>
                  <td>{r.title}</td>
                  <td>{money(r.amount || 0)}</td>
                  <td><div className="acts">
                    <button className="btn btn-blue btn-sm" onClick={() => { resolveRequest(r.id, true); notify("Onaylandı."); }}>Onayla</button>
                    <button className="btn btn-white btn-sm" onClick={() => { resolveRequest(r.id, false); notify("Reddedildi."); }}>Reddet</button>
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
      {content.games.length === 0 && (
        <div className="panel"><div className="panel-b">
          <div className="note">Site şu an boş. Örnek içerik yükleyebilir veya oyun ekleyebilirsiniz.</div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn btn-blue" onClick={() => { loadSampleContent(); notify("Örnek içerik yüklendi."); }}>Örnek içerik yükle</button>
            <button className="btn btn-white" onClick={() => go("games")}>Oyun ekle</button>
          </div>
        </div></div>
      )}
    </>
  );

  const body: Record<Section, ReactNode> = {
    dashboard,
    players: <Players members={members} notify={notify} />,
    finance: <Finance members={members} records={records} notify={notify} />,
    bets: <Bets members={members} records={bets} />,
    games: (
      <Crud<Game>
        collection="games" items={content.games} notify={notify}
        searchText={(g) => `${g.title} ${g.provider}`}
        blank={() => ({ id: newId(), title: "", provider: "", category: "slots", symbol: "7", from: "#2A2410", to: "#B08F3F", badge: "", imageUrl: "", url: "", apiEndpoint: "", active: true })}
        describe={(g) => ({
          title: g.title || "İsimsiz oyun",
          subtitle: `${g.provider || "—"} · ${g.category}${g.url ? " · Link" : ""}${g.apiEndpoint ? " · API" : ""}`,
          thumb: g.imageUrl,
          tag: <span className={`tag ${g.active !== false ? "tag-green" : "tag-gray"}`}>{g.active !== false ? "Yayında" : "Gizli"}</span>,
        })}
        defs={[
          { key: "title", label: "Oyun adı", half: true },
          { key: "provider", label: "Sağlayıcı", half: true, placeholder: "Pragmatic Play" },
          { key: "category", label: "Kategori", type: "select", half: true, options: [
            { value: "slots", label: "Slot" }, { value: "casino", label: "Canlı Casino" }, { value: "games", label: "Masa oyunları" },
            { value: "aviator", label: "Aviator" }, { value: "highflyer", label: "High Flyer" }, { value: "spaceman", label: "Spaceman" },
          ]},
          { key: "badge", label: "Rozet", half: true, placeholder: "YENİ" },
          { key: "imageUrl", label: "Oyun görseli (URL)", placeholder: "https://.../kapak.jpg", help: "Kapak görseli. Boşsa renkli sembol gösterilir." },
          { key: "url", label: "Oyun bağlantısı (Link)", placeholder: "https://oyun-adresi", help: "Oyuncu tıklayınca bu sayfa açılır." },
          { key: "apiEndpoint", label: "Oyun API adresi", placeholder: "https://api.ornek.com/launch", help: "POST { gameId, memberId, username }. Yanıtta url veya launchUrl beklenir. API varsa önce API kullanılır." },
          { key: "symbol", label: "Yedek sembol", half: true, placeholder: "7 ♠" },
          { key: "active", label: "Yayında", type: "switch" },
        ]}
      />
    ),
    banners: (
      <Crud<Banner>
        collection="banners" items={content.banners} notify={notify}
        blank={() => ({ id: newId(), badge: "", title: "", description: "", buttonLabel: "Detaylar", destination: "/slot-oyunlari", symbol: "✦", active: true })}
        describe={(b) => ({
          title: b.title || "Başlıksız", subtitle: b.badge || b.destination,
          tag: <span className={`tag ${b.active !== false ? "tag-green" : "tag-gray"}`}>{b.active !== false ? "Yayında" : "Gizli"}</span>,
        })}
        defs={[
          { key: "badge", label: "Etiket", half: true }, { key: "symbol", label: "Sembol", half: true },
          { key: "title", label: "Başlık" }, { key: "description", label: "Açıklama", type: "textarea" },
          { key: "buttonLabel", label: "Buton", half: true }, { key: "destination", label: "Hedef", half: true, placeholder: "/slot-oyunlari" },
          { key: "active", label: "Yayında", type: "switch" },
        ]}
      />
    ),
    matches: (
      <Crud<Match>
        collection="matches" items={content.matches} notify={notify}
        searchText={(m) => `${m.home} ${m.away} ${m.league}`}
        blank={() => ({ id: newId(), home: "", away: "", league: "", sport: "football", startsAt: new Date().toISOString(), live: false, minute: 0, score: [0, 0], odds: [2, 3, 3] })}
        toForm={(m) => ({ id: m.id, home: m.home, away: m.away, league: m.league, sport: m.sport, startsAt: toLocal(m.startsAt), live: m.live, minute: m.minute ?? 0, scoreHome: m.score?.[0] ?? 0, scoreAway: m.score?.[1] ?? 0, odd1: m.odds[0], oddX: m.odds[1], odd2: m.odds[2] })}
        fromForm={(f) => ({
          id: String(f.id), home: String(f.home || ""), away: String(f.away || ""), league: String(f.league || ""),
          sport: (String(f.sport) as Match["sport"]) || "football",
          startsAt: f.startsAt ? new Date(String(f.startsAt)).toISOString() : new Date().toISOString(),
          live: f.live === true, minute: Number(f.minute) || 0,
          score: [Number(f.scoreHome) || 0, Number(f.scoreAway) || 0],
          odds: [Number(f.odd1) || 1, Number(f.oddX) || 1, Number(f.odd2) || 1],
        })}
        describe={(m) => ({
          title: `${m.home} - ${m.away}`,
          subtitle: `${m.league} · ${m.odds.map((o) => o.toFixed(2)).join(" / ")}`,
          tag: <span className={`tag ${m.live ? "tag-red" : "tag-gray"}`}>{m.live ? "Canlı" : "Maç öncesi"}</span>,
        })}
        defs={[
          { key: "home", label: "Ev sahibi", half: true }, { key: "away", label: "Deplasman", half: true },
          { key: "league", label: "Lig", half: true },
          { key: "sport", label: "Spor", type: "select", half: true, options: [
            { value: "football", label: "Futbol" }, { value: "basketball", label: "Basketbol" }, { value: "tennis", label: "Tenis" },
            { value: "esports", label: "E-spor" }, { value: "virtual", label: "Sanal" },
          ]},
          { key: "startsAt", label: "Başlangıç", type: "datetime", half: true }, { key: "minute", label: "Dakika", type: "number", half: true },
          { key: "scoreHome", label: "Ev skor", type: "number", half: true }, { key: "scoreAway", label: "Dep skor", type: "number", half: true },
          { key: "odd1", label: "1", type: "number", half: true }, { key: "oddX", label: "X", type: "number", half: true },
          { key: "odd2", label: "2", type: "number", half: true }, { key: "live", label: "Canlı", type: "switch" },
        ]}
      />
    ),
    payments: (
      <Crud<PaymentMethod>
        collection="paymentMethods" items={content.paymentMethods} notify={notify}
        blank={() => ({ id: newId(), name: "", kind: "bank", deposit: true, withdraw: true, minimum: 100, maximum: 100000, description: "", active: true })}
        describe={(p) => ({
          title: p.name || "İsimsiz",
          subtitle: `${p.deposit ? "Yatırım" : ""}${p.deposit && p.withdraw ? " / " : ""}${p.withdraw ? "Çekim" : ""} · ${money(p.minimum)}–${money(p.maximum)}`,
          tag: <span className={`tag ${p.active !== false ? "tag-green" : "tag-gray"}`}>{p.active !== false ? "Açık" : "Kapalı"}</span>,
        })}
        defs={[
          { key: "name", label: "Ad", half: true },
          { key: "kind", label: "Tür", type: "select", half: true, options: [
            { value: "bank", label: "Banka" }, { value: "wallet", label: "Cüzdan" }, { value: "crypto", label: "Kripto" }, { value: "card", label: "Kart" },
          ]},
          { key: "minimum", label: "Alt limit", type: "number", half: true }, { key: "maximum", label: "Üst limit", type: "number", half: true },
          { key: "description", label: "Açıklama" },
          { key: "deposit", label: "Yatırım", type: "switch" }, { key: "withdraw", label: "Çekim", type: "switch" }, { key: "active", label: "Açık", type: "switch" },
        ]}
      />
    ),
    pages: <Pages />,
    support: <Support notify={notify} />,
    employees: <EmployeesPanel notify={notify} />,
    affiliates: <AffiliatesPanel notify={notify} />,
    settings: <Settings notify={notify} />,
    backup: <Backup fileRef={fileRef} notify={notify} />,
  };

  return (
    <div className="adm">
      <div className={`adm-overlay ${menu ? "show" : ""}`} onClick={() => setMenu(false)} />
      <div className="adm-shell">
        <aside className={`adm-side ${menu ? "open" : ""}`}>
          <div className="adm-side-brand">
            <img src={emblemUrl} alt="" />
            <div><strong>SHALOM BET</strong><span>Yönetim v1.0</span></div>
          </div>
          {NAV.map((g) => {
            const items = g.items.filter((item) => allowed.includes(item.id as PermissionId));
            if (!items.length) return null;
            return (
            <div className="adm-group" key={g.group}>
              <div className="adm-group-title">{g.group}</div>
              {items.map((item) => (
                <button key={item.id} className={`adm-nav-btn ${section === item.id ? "on" : ""}`} onClick={() => go(item.id)}>
                  <i>{item.icon}</i> {item.label}
                  {item.id === "finance" && pending.length > 0 && <span className="count">{pending.length}</span>}
                  {item.id === "players" && members.length > 0 && <span className="count">{members.length}</span>}
                  {item.id === "affiliates" && affiliates.length > 0 && <span className="count">{affiliates.length}</span>}
                  {item.id === "employees" && employees.length > 0 && <span className="count">{employees.length}</span>}
                </button>
              ))}
            </div>
            );
          })}
          <div className="adm-side-foot">
            <div className="who"><b>{staffSession?.role === "owner" ? "Yönetici" : "Çalışan"}</b><span>{staffSession?.role === "employee" ? (employees.find((e) => e.id === staffSession.employeeId)?.username || "") : settings.admin.username}</span></div>
            <button className="adm-nav-btn" onClick={onExit}>← Siteye dön</button>
            <button className="adm-nav-btn" onClick={() => setStaffSession(null)}>Çıkış yap</button>
          </div>
        </aside>
        <div className="adm-main">
          <header className="adm-top">
            <div className="adm-top-left">
              <button className="adm-burger" onClick={() => setMenu(true)} aria-label="Menü">☰</button>
              <h1>{head.title}<small>{head.sub}</small></h1>
            </div>
            <div className="adm-top-actions">
              <a className="btn btn-white btn-sm" href="#/dosyalar">PHP dosyaları</a>
              <a className="btn btn-white btn-sm" href="#/" onClick={onExit}>Siteyi görüntüle</a>
              <button className="btn btn-navy btn-sm" onClick={() => setStaffSession(null)}>Kilitle</button>
            </div>
          </header>
          <div className="adm-body">{body[section]}</div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Players({ members, notify }: { members: StoredMember[]; notify: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const list = useMemo(() => members.filter((m) => `${m.username} ${m.firstName} ${m.lastName} ${m.email} ${m.phone}`.toLocaleLowerCase("tr-TR").includes(q.toLocaleLowerCase("tr-TR"))), [members, q]);
  return (
    <>
      <div className="stats">
        <div className="stat on"><span>Tümü</span><b>{members.length}</b></div>
        <div className="stat"><span>Aktif</span><b>{members.filter((m) => m.status === "active").length}</b></div>
        <div className="stat"><span>Askıda</span><b>{members.filter((m) => m.status === "blocked").length}</b></div>
        <div className="stat"><span>Bakiye</span><b>{members.reduce((s, m) => s + m.balance, 0).toLocaleString("tr-TR")}</b></div>
      </div>
      <div className="toolbar"><div className="search"><span>⌕</span><input placeholder="Ad, kullanıcı, telefon" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <div className="panel">
        {list.length === 0 ? <div className="empty"><b>Oyuncu yok</b><p>Siteden kayıt olanlar burada listelenir.</p></div> : (
          <table className="tbl">
            <thead><tr><th>Oyuncu</th><th>İletişim</th><th>Bakiye</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              {list.map((m) => (
                <Fragment key={m.id}>
                  <tr>
                    <td><strong>{m.username}</strong><span className="sub">{m.firstName} {m.lastName}</span></td>
                    <td>{m.phone || "—"}<span className="sub">{m.email}</span></td>
                    <td>{money(m.balance)}</td>
                    <td><span className={`tag ${m.status === "active" ? "tag-green" : "tag-red"}`}>{m.status === "active" ? "Aktif" : "Askıda"}</span></td>
                    <td><button className="btn btn-white btn-sm" onClick={() => { setOpen(open === m.id ? null : m.id); setAmount(""); setReason(""); }}>{open === m.id ? "Kapat" : "Yönet"}</button></td>
                  </tr>
                  {open === m.id && (
                    <tr key={`${m.id}-edit`}><td colSpan={5}>
                      <div className="form" style={{ padding: "4px 0 8px" }}>
                        <div className="g2">
                          <div className="field"><label>Bakiye (TRY)</label><input type="number" value={amount} placeholder="500 veya -250" onChange={(e) => setAmount(e.target.value)} /></div>
                          <div className="field"><label>Açıklama</label><input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                        </div>
                        <div className="actions">
                          <button className="btn btn-blue btn-sm" onClick={() => {
                            const v = Number(amount);
                            if (!Number.isFinite(v) || v === 0) { notify("Geçerli tutar girin."); return; }
                            adjustBalance(m.id, v, reason); setAmount(""); notify("Bakiye güncellendi.");
                          }}>Uygula</button>
                          <button className="btn btn-white btn-sm" onClick={() => { updateMember(m.id, { status: m.status === "active" ? "blocked" : "active" }); notify(m.status === "active" ? "Askıya alındı." : "Aktifleştirildi."); }}>
                            {m.status === "active" ? "Askıya al" : "Aktifleştir"}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm("Silinsin mi?")) { deleteMember(m.id); notify("Silindi."); } }}>Sil</button>
                        </div>
                        <div className="note">Kayıt: {new Date(m.createdAt).toLocaleString("tr-TR")}</div>
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Finance({ members, records, notify }: { members: StoredMember[]; records: { id: string; memberId: string; kind: string; title: string; date: string; status: string; amount?: number }[]; notify: (m: string) => void }) {
  const list = records.filter((r) => r.kind === "transaction");
  return (
    <div className="panel">
      <div className="panel-h"><h3>Yatırım / çekim</h3></div>
      {list.length === 0 ? <div className="empty"><b>Hareket yok</b></div> : (
        <table className="tbl">
          <thead><tr><th>Oyuncu</th><th>İşlem</th><th>Tutar</th><th>Durum</th><th></th></tr></thead>
          <tbody>
            {list.map((r) => {
              const u = members.find((m) => m.id === r.memberId);
              const tag = r.status === "pending" ? "tag-amber" : r.status === "completed" ? "tag-green" : "tag-red";
              return (
                <tr key={r.id}>
                  <td>{u?.username || "—"}<span className="sub">{new Date(r.date).toLocaleString("tr-TR")}</span></td>
                  <td>{r.title}</td>
                  <td>{typeof r.amount === "number" ? money(r.amount) : "—"}</td>
                  <td><span className={`tag ${tag}`}>{r.status === "pending" ? "Bekliyor" : r.status === "completed" ? "Tamam" : "İptal"}</span></td>
                  <td><div className="acts">
                    {r.status === "pending" && <>
                      <button className="btn btn-blue btn-sm" onClick={() => { resolveRequest(r.id, true); notify("Onaylandı."); }}>Onayla</button>
                      <button className="btn btn-white btn-sm" onClick={() => { resolveRequest(r.id, false); notify("Reddedildi."); }}>Reddet</button>
                    </>}
                    <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm("Silinsin mi?")) { deleteRecord(r.id); notify("Silindi."); } }}>Sil</button>
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Bets({ members, records }: { members: StoredMember[]; records: { id: string; memberId: string; title: string; description: string; date: string; status: string; amount?: number }[] }) {
  return (
    <div className="panel">
      <div className="panel-h"><h3>Bahis kuponları</h3><span className="tag tag-gray">{records.length}</span></div>
      {records.length === 0 ? <div className="empty"><b>Bahis yok</b></div> : (
        <table className="tbl">
          <thead><tr><th>Oyuncu</th><th>Kupon</th><th>Tutar</th><th>Durum</th></tr></thead>
          <tbody>
            {records.map((r) => {
              const u = members.find((m) => m.id === r.memberId);
              return (
                <tr key={r.id}>
                  <td>{u?.username || "—"}<span className="sub">{new Date(r.date).toLocaleString("tr-TR")}</span></td>
                  <td>{r.title}<span className="sub">{r.description}</span></td>
                  <td>{typeof r.amount === "number" ? money(r.amount) : "—"}</td>
                  <td><span className="tag tag-blue">{r.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Pages() {
  const { content } = useStore();
  const keys = [
    { key: "about", label: "Hakkımızda" },
    { key: "terms", label: "Kullanım şartları" },
    { key: "privacy", label: "Gizlilik" },
    { key: "responsible", label: "Sorumlu oyun" },
  ];
  return (
    <>
      {keys.map((p) => {
        const v = content.pages[p.key] || { title: p.label, body: "" };
        return (
          <div className="panel" key={p.key}>
            <div className="panel-h"><h3>{p.label}</h3><span className={`tag ${v.body ? "tag-green" : "tag-gray"}`}>{v.body ? "Dolu" : "Boş"}</span></div>
            <div className="panel-b">
              <div className="form">
                <div className="field"><label>Başlık</label><input value={v.title} onChange={(e) => updatePage(p.key, { ...v, title: e.target.value })} /></div>
                <div className="field"><label>Metin</label><textarea value={v.body} onChange={(e) => updatePage(p.key, { ...v, body: e.target.value })} /></div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function Support({ notify: _n }: { notify: (m: string) => void }) {
  const { content, settings } = useStore();
  return (
    <>
      <div className="panel">
        <div className="panel-h"><h3>İletişim</h3></div>
        <div className="panel-b"><div className="form">
          <div className="g2">
            <div className="field"><label>E-posta</label><input value={content.support.email} onChange={(e) => updateSupport({ ...content.support, email: e.target.value })} /></div>
            <div className="field"><label>Telefon</label><input value={content.support.phone} onChange={(e) => updateSupport({ ...content.support, phone: e.target.value })} /></div>
          </div>
          <div className="field"><label>Telegram</label><input value={settings.telegram} onChange={(e) => updateSettings({ telegram: e.target.value })} placeholder="https://t.me/..." /></div>
          <div className="field"><label>Harici destek adresi</label><input value={content.support.url} onChange={(e) => updateSupport({ ...content.support, url: e.target.value })} /></div>
        </div></div>
      </div>
      <div className="panel">
        <div className="panel-h"><h3>Tawk.to</h3></div>
        <div className="panel-b"><div className="form">
          <div className="field"><label>Sağlayıcı</label>
            <select value={settings.chat.provider} onChange={(e) => updateSettings({ chat: { ...settings.chat, provider: e.target.value as "none" | "tawk" } })}>
              <option value="none">Yok</option><option value="tawk">Tawk.to</option>
            </select>
          </div>
          {settings.chat.provider === "tawk" && (
            <div className="g2">
              <div className="field"><label>Property ID</label><input value={settings.chat.propertyId} onChange={(e) => updateSettings({ chat: { ...settings.chat, propertyId: e.target.value.trim() } })} /></div>
              <div className="field"><label>Widget ID</label><input value={settings.chat.widgetId} onChange={(e) => updateSettings({ chat: { ...settings.chat, widgetId: e.target.value.trim() } })} /></div>
            </div>
          )}
          <label className="check"><input type="checkbox" checked={settings.chat.bubble} onChange={(e) => updateSettings({ chat: { ...settings.chat, bubble: e.target.checked } })} /><span>Sitede sohbet düğmesi</span></label>
        </div></div>
      </div>
      <Crud<HelpArticle>
        collection="helpArticles" items={content.helpArticles} notify={_n}
        blank={() => ({ id: newId(), title: "", body: "" })}
        describe={(a) => ({ title: a.title || "Soru", subtitle: a.body.slice(0, 80) })}
        defs={[{ key: "title", label: "Soru" }, { key: "body", label: "Cevap", type: "textarea" }]}
      />
    </>
  );
}

function Settings({ notify }: { notify: (m: string) => void }) {
  const { settings } = useStore();
  const [user, setUser] = useState(settings.admin.username);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [rep, setRep] = useState("");
  const [err, setErr] = useState("");
  const savePass = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const saved = settings.admin.passwordHash;
    const valid = saved ? (await hashText(cur)) === saved : cur === DEFAULT_ADMIN_PASSWORD;
    if (!valid) { setErr("Mevcut şifre hatalı."); return; }
    if (next.length < 8) { setErr("Yeni şifre en az 8 karakter."); return; }
    if (next !== rep) { setErr("Şifreler eşleşmiyor."); return; }
    updateSettings({ admin: { username: user.trim() || "admin", passwordHash: await hashText(next) } });
    setCur(""); setNext(""); setRep(""); notify("Yönetici güncellendi.");
  };
  return (
    <>
      <div className="panel">
        <div className="panel-h"><h3>Marka</h3></div>
        <div className="panel-b"><div className="form">
          <div className="g2">
            <div className="field"><label>Marka adı</label><input value={settings.brandName} onChange={(e) => updateSettings({ brandName: e.target.value })} /></div>
            <div className="field"><label>Alt yazı</label><input value={settings.brandSub} onChange={(e) => updateSettings({ brandSub: e.target.value })} /></div>
            <div className="field"><label>Slogan</label><input value={settings.tagline} onChange={(e) => updateSettings({ tagline: e.target.value })} /></div>
            <div className="field"><label>Yıl rozeti</label><input value={settings.yearsBadge} onChange={(e) => updateSettings({ yearsBadge: e.target.value })} /></div>
            <div className="field"><label>Casino çevrim içi</label><input type="number" value={settings.casinoOnline} onChange={(e) => updateSettings({ casinoOnline: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>Spor çevrim içi</label><input type="number" value={settings.sportsOnline} onChange={(e) => updateSettings({ sportsOnline: Number(e.target.value) || 0 })} /></div>
          </div>
          <div className="field"><label>Duyuru şeridi</label><input value={settings.announcement} onChange={(e) => updateSettings({ announcement: e.target.value })} /></div>
          <label className="check"><input type="checkbox" checked={settings.announcementActive} onChange={(e) => updateSettings({ announcementActive: e.target.checked })} /><span>Duyuru görünsün</span></label>
        </div></div>
      </div>
      <div className="panel">
        <div className="panel-h"><h3>Yönetici şifresi</h3></div>
        <form className="panel-b form" onSubmit={savePass}>
          <div className="field"><label>Yönetici adı</label><input value={user} onChange={(e) => setUser(e.target.value)} /></div>
          <div className="field"><label>Mevcut şifre</label><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div className="g2">
            <div className="field"><label>Yeni şifre</label><input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
            <div className="field"><label>Tekrar</label><input type="password" value={rep} onChange={(e) => setRep(e.target.value)} /></div>
          </div>
          {err && <div className="note warn">{err}</div>}
          <button className="btn btn-blue" type="submit">Güncelle</button>
        </form>
      </div>
    </>
  );
}

function Backup({ fileRef, notify }: { fileRef: React.RefObject<HTMLInputElement | null>; notify: (m: string) => void }) {
  return (
    <>
      <div className="panel"><div className="panel-b">
        <div className="actions">
          <button className="btn btn-blue" onClick={() => {
            const blob = new Blob([exportState()], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `shalom-bet-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
            notify("Yedek indirildi.");
          }}>Yedeği indir</button>
          <button className="btn btn-white" onClick={() => fileRef.current?.click()}>Geri yükle</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { importState(await f.text()); notify("Yüklendi."); } catch { notify("Dosya okunamadı."); }
            e.target.value = "";
          }} />
        </div>
      </div></div>
      <div className="panel"><div className="panel-h"><h3>Örnek içerik</h3></div><div className="panel-b">
        <div className="actions">
          <button className="btn btn-blue" onClick={() => { loadSampleContent(); notify("Örnek yüklendi."); }}>Örnek yükle</button>
          <button className="btn btn-white" onClick={() => { if (confirm("İçerik silinsin mi?")) { clearContent(); notify("Temizlendi."); } }}>İçeriği temizle</button>
        </div>
      </div></div>
      <div className="panel"><div className="panel-h"><h3>Tam sıfırlama</h3></div><div className="panel-b">
        <div className="note warn">Tüm veriler silinir.</div>
        <button className="btn btn-danger" style={{ marginTop: 12 }} onClick={() => { if (confirm("Emin misiniz?")) { resetAll(); notify("Sıfırlandı."); } }}>Sıfırla</button>
      </div></div>
    </>
  );
}
