/* =========================================================================
   SHALOM BET — VERİ DEPOSU
   Tüm site içeriği, üyeler ve işlemler bu depoda tutulur ve tarayıcı
   deposuna (localStorage) yazılır. Yönetim paneli bu depoyu düzenler,
   site anında güncellenir. Gerçek bir arka uç bağlanacaksa aynı sözleşme
   window.SHALOM_CLIENT üzerinden değiştirilebilir (bkz. INTEGRATION.md).
   ========================================================================= */
import { useSyncExternalStore } from "react";
import type {
  AccountRecord, Banner, Game, HelpArticle, Match, Member,
  PaymentMethod, Promotion, SiteContent,
} from "./platform";

const KEY = "shalom-bet-v1";

/* ------------------------------------------------------------- TİPLER */
export interface StoredMember extends Member {
  passwordHash: string;
  status: "active" | "blocked";
  createdAt: string;
  birthDate?: string;
  promoCode?: string;
  affiliateId?: string;
  note?: string;
}

export interface StoredRecord extends AccountRecord {
  memberId: string;
  kind: "transaction" | "bet" | "bonus" | "message";
  direction?: "deposit" | "withdraw" | "manual";
  method?: string;
}

export interface QuickLink { id: string; label: string; target: string; active: boolean }

export const STAFF_PERMISSIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "players", label: "Oyuncular" },
  { id: "finance", label: "Talepler" },
  { id: "bets", label: "Bahisler" },
  { id: "games", label: "Oyunlar" },
  { id: "banners", label: "Bannerlar" },
  { id: "matches", label: "Maçlar" },
  { id: "payments", label: "Ödeme yöntemleri" },
  { id: "pages", label: "Sayfalar" },
  { id: "support", label: "Destek" },
  { id: "employees", label: "Çalışanlar" },
  { id: "affiliates", label: "Affiliate" },
  { id: "settings", label: "Ayarlar" },
  { id: "backup", label: "Yedekleme" },
] as const;
export type PermissionId = typeof STAFF_PERMISSIONS[number]["id"];

export interface Employee {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  permissions: PermissionId[];
  status: "active" | "blocked";
  createdAt: string;
}

export interface Affiliate {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  promoCode: string;
  status: "active" | "blocked";
  createdAt: string;
}

export type StaffSession =
  | { role: "owner" }
  | { role: "employee"; employeeId: string }
  | { role: "affiliate"; affiliateId: string };

export interface SiteSettings {
  brandName: string;
  brandSub: string;
  tagline: string;
  yearsBadge: string;
  announcement: string;
  announcementActive: boolean;
  ornate: boolean;
  casinoOnline: number;
  sportsOnline: number;
  quickLinks: QuickLink[];
  theme: { bg: string; card: string; gold: string; goldLight: string; goldDark: string; text: string; muted: string };
  chat: { provider: "none" | "tawk"; propertyId: string; widgetId: string; bubble: boolean };
  telegram: string;
  admin: { username: string; passwordHash: string };
}

export interface StoreState {
  content: SiteContent;
  settings: SiteSettings;
  members: StoredMember[];
  records: StoredRecord[];
  employees: Employee[];
  affiliates: Affiliate[];
  sessionId: string | null;
  staffSession: StaffSession | null;
}

/* ------------------------------------------------ VARSAYILAN DURUM */
export const DEFAULT_ADMIN_PASSWORD = "shalom2026";

const EMPTY_CONTENT: SiteContent = {
  banners: [], games: [], matches: [], promotions: [], paymentMethods: [],
  helpArticles: [], pages: {}, support: { email: "", phone: "", url: "" },
};

const DEFAULT_SETTINGS: SiteSettings = {
  brandName: "SHALOM",
  brandSub: "BET",
  tagline: "Oyunun altın çağı.",
  yearsBadge: "",
  announcement: "SHALOM BET'E HOŞ GELDİNİZ — PREMIUM OYUN DENEYİMİ",
  announcementActive: true,
  ornate: true,
  casinoOnline: 0,
  sportsOnline: 0,
  quickLinks: [
    { id: "q1", label: "Canlı Destek", target: "support", active: true },
    { id: "q2", label: "Telegram", target: "telegram", active: true },
    { id: "q3", label: "Para Yatır", target: "deposit", active: true },
    { id: "q4", label: "Para Çek", target: "withdraw", active: true },
  ],
  theme: {
    bg: "#0B0C0A", card: "#171914", gold: "#C7A75C", goldLight: "#ECD484",
    goldDark: "#7E6938", text: "#F7F3E8", muted: "#99988F",
  },
  chat: { provider: "none", propertyId: "", widgetId: "default", bubble: true },
  telegram: "",
  admin: { username: "admin", passwordHash: "" },
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function baseState(): StoreState {
  return {
    content: clone(EMPTY_CONTENT), settings: clone(DEFAULT_SETTINGS),
    members: [], records: [], employees: [], affiliates: [],
    sessionId: null, staffSession: null,
  };
}

/* ------------------------------------------------------ KALICI DEPO */
function readStorage(): StoreState {
  const fallback = baseState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    return {
      content: { ...fallback.content, ...(parsed.content || {}) },
      settings: {
        ...fallback.settings,
        ...(parsed.settings || {}),
        theme: { ...fallback.settings.theme, ...(parsed.settings?.theme || {}) },
        chat: { ...fallback.settings.chat, ...(parsed.settings?.chat || {}) },
        admin: { ...fallback.settings.admin, ...(parsed.settings?.admin || {}) },
        quickLinks: Array.isArray(parsed.settings?.quickLinks) ? parsed.settings.quickLinks : fallback.settings.quickLinks,
      },
      members: Array.isArray(parsed.members) ? parsed.members : [],
      records: Array.isArray(parsed.records) ? parsed.records : [],
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      affiliates: Array.isArray(parsed.affiliates) ? parsed.affiliates : [],
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : null,
      staffSession: parsed.staffSession && typeof parsed.staffSession === "object" ? parsed.staffSession : null,
    };
  } catch {
    return fallback;
  }
}

let state: StoreState = typeof localStorage === "undefined" ? baseState() : readStorage();
const listeners = new Set<() => void>();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* kota dolu olabilir */ }
}

export function getState(): StoreState { return state; }

export function setState(updater: (current: StoreState) => StoreState) {
  state = updater(state);
  persist();
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/* Sekmeler arası eşitleme */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    state = readStorage();
    listeners.forEach((listener) => listener());
  });
}

/* ------------------------------------------------------- YARDIMCILAR */
export const newId = () =>
  (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

export async function hashText(value: string): Promise<string> {
  const data = new TextEncoder().encode(`shalom::${value}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

type Collection = "banners" | "games" | "matches" | "promotions" | "paymentMethods" | "helpArticles";

export function upsertItem<T extends { id: string }>(collection: Collection, item: T) {
  setState((current) => {
    const list = [...(current.content[collection] as unknown as T[])];
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index >= 0) list[index] = item; else list.push(item);
    return { ...current, content: { ...current.content, [collection]: list } };
  });
}

export function removeItem(collection: Collection, id: string) {
  setState((current) => ({
    ...current,
    content: {
      ...current.content,
      [collection]: (current.content[collection] as { id: string }[]).filter((entry) => entry.id !== id),
    },
  }));
}

export function moveItem(collection: Collection, id: string, direction: -1 | 1) {
  setState((current) => {
    const list = [...(current.content[collection] as { id: string }[])];
    const index = list.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return current;
    [list[index], list[target]] = [list[target], list[index]];
    return { ...current, content: { ...current.content, [collection]: list } };
  });
}

export function updateSettings(patch: Partial<SiteSettings>) {
  setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
}

export function updatePage(key: string, page: { title: string; body: string }) {
  setState((current) => ({
    ...current,
    content: { ...current.content, pages: { ...current.content.pages, [key]: page } },
  }));
}

export function updateSupport(support: SiteContent["support"]) {
  setState((current) => ({ ...current, content: { ...current.content, support } }));
}

/* ------------------------------------------------------------- ÜYELER */
export function updateMember(id: string, patch: Partial<StoredMember>) {
  setState((current) => ({
    ...current,
    members: current.members.map((member) => (member.id === id ? { ...member, ...patch } : member)),
  }));
}

export function deleteMember(id: string) {
  setState((current) => ({
    ...current,
    members: current.members.filter((member) => member.id !== id),
    records: current.records.filter((entry) => entry.memberId !== id),
    sessionId: current.sessionId === id ? null : current.sessionId,
  }));
}

export function addRecord(entry: Omit<StoredRecord, "id">) {
  const record: StoredRecord = { ...entry, id: newId() };
  setState((current) => ({ ...current, records: [record, ...current.records] }));
  return record;
}

export function updateRecord(id: string, patch: Partial<StoredRecord>) {
  setState((current) => ({
    ...current,
    records: current.records.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
  }));
}

export function deleteRecord(id: string) {
  setState((current) => ({ ...current, records: current.records.filter((entry) => entry.id !== id) }));
}

export function adjustBalance(memberId: string, amount: number, reason: string) {
  setState((current) => ({
    ...current,
    members: current.members.map((member) =>
      member.id === memberId ? { ...member, balance: Math.round((member.balance + amount) * 100) / 100 } : member),
  }));
  addRecord({
    memberId, kind: "transaction", direction: "manual",
    title: amount >= 0 ? "Bakiye yüklemesi" : "Bakiye düşümü",
    description: reason || "Yönetim tarafından yapılan bakiye düzenlemesi.",
    date: new Date().toISOString(), status: "completed", amount,
  });
}

/** Bekleyen yatırım/çekim talebini sonuçlandırır ve bakiyeyi günceller. */
export function resolveRequest(recordId: string, approve: boolean) {
  const entry = getState().records.find((item) => item.id === recordId);
  if (!entry || entry.status !== "pending") return;
  if (approve && typeof entry.amount === "number") {
    setState((current) => ({
      ...current,
      members: current.members.map((member) => member.id === entry.memberId
        ? { ...member, balance: Math.round((member.balance + entry.amount!) * 100) / 100 }
        : member),
    }));
  }
  updateRecord(recordId, { status: approve ? "completed" : "cancelled" });
}

/* ---------------------------------------------------- YEDEK / SIFIRLA */
export function exportState(): string {
  const { sessionId: _session, ...rest } = getState();
  void _session;
  return JSON.stringify(rest, null, 2);
}

export function importState(json: string) {
  const parsed = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) throw new Error("Dosya okunamadı.");
  const fallback = baseState();
  setState(() => ({
    content: { ...fallback.content, ...(parsed.content || {}) },
    settings: {
      ...fallback.settings, ...(parsed.settings || {}),
      theme: { ...fallback.settings.theme, ...(parsed.settings?.theme || {}) },
      chat: { ...fallback.settings.chat, ...(parsed.settings?.chat || {}) },
      admin: { ...fallback.settings.admin, ...(parsed.settings?.admin || {}) },
    },
    members: Array.isArray(parsed.members) ? parsed.members : [],
    records: Array.isArray(parsed.records) ? parsed.records : [],
    employees: Array.isArray(parsed.employees) ? parsed.employees : [],
    affiliates: Array.isArray(parsed.affiliates) ? parsed.affiliates : [],
    sessionId: null,
    staffSession: null,
  }));
}

export function setStaffSession(session: StaffSession | null) {
  setState((current) => ({ ...current, staffSession: session }));
}

export function upsertEmployee(employee: Employee) {
  setState((current) => {
    const list = [...current.employees];
    const index = list.findIndex((item) => item.id === employee.id);
    if (index >= 0) list[index] = employee; else list.push(employee);
    return { ...current, employees: list };
  });
}

export function deleteEmployee(id: string) {
  setState((current) => ({
    ...current,
    employees: current.employees.filter((item) => item.id !== id),
    staffSession: current.staffSession?.role === "employee" && current.staffSession.employeeId === id ? null : current.staffSession,
  }));
}

export function upsertAffiliate(affiliate: Affiliate) {
  setState((current) => {
    const list = [...current.affiliates];
    const index = list.findIndex((item) => item.id === affiliate.id);
    if (index >= 0) list[index] = affiliate; else list.push(affiliate);
    return { ...current, affiliates: list };
  });
}

export function deleteAffiliate(id: string) {
  setState((current) => ({
    ...current,
    affiliates: current.affiliates.filter((item) => item.id !== id),
    staffSession: current.staffSession?.role === "affiliate" && current.staffSession.affiliateId === id ? null : current.staffSession,
  }));
}

export function makePromoCode(username: string) {
  const clean = username.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8) || "AFF";
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${clean}${tail}`;
}

export function affiliatePublicLink(promoCode: string) {
  const origin = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}`;
  return `${origin}/#/r/${encodeURIComponent(promoCode.trim())}`;
}

export function partnerLoginLink() {
  const origin = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}`;
  return `${origin}/#/ortak`;
}

export function readAffiliateRef(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash || "";
  const path = hash.replace(/^#/, "").split("?")[0];
  const rest = path.match(/^\/r\/([^/]+)/i);
  if (rest?.[1]) return decodeURIComponent(rest[1]).trim();
  const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const fromHash = new URLSearchParams(hashQuery).get("ref") || new URLSearchParams(hashQuery).get("aff");
  if (fromHash) return fromHash.trim();
  const fromSearch = new URLSearchParams(window.location.search).get("ref") || new URLSearchParams(window.location.search).get("aff");
  if (fromSearch) return fromSearch.trim();
  try { return (sessionStorage.getItem("shalom-aff-ref") || "").trim(); } catch { return ""; }
}

export function captureAffiliateRef(): string {
  const fromUrl = readAffiliateRef();
  if (fromUrl) {
    try { sessionStorage.setItem("shalom-aff-ref", fromUrl); } catch { /* */ }
  }
  try { return (sessionStorage.getItem("shalom-aff-ref") || fromUrl || "").trim(); } catch { return fromUrl; }
}

export function findAffiliateByRef(ref: string) {
  const code = (ref || "").trim().toUpperCase();
  if (!code) return null;
  return getState().affiliates.find((item) => item.status === "active" && item.promoCode.toUpperCase() === code) || null;
}

export function membersOfAffiliate(affiliate: Affiliate) {
  return getState().members.filter((member) =>
    member.affiliateId === affiliate.id
    || (member.promoCode || "").toUpperCase() === affiliate.promoCode.toUpperCase());
}

export function resetAll() {
  setState(() => baseState());
}

export function clearContent() {
  setState((current) => ({ ...current, content: clone(EMPTY_CONTENT) }));
}

/* ------------------------------------------------------ ÖRNEK İÇERİK */
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();

export function loadSampleContent() {
  const games: Game[] = [
    { id: newId(), title: "Golden Sun", provider: "Shalom Games", category: "slots", symbol: "☀", from: "#4A3312", to: "#C98F23", badge: "POPÜLER", active: true },
    { id: newId(), title: "Temple of Gold", provider: "Shalom Games", category: "slots", symbol: "⛩", from: "#3B2E12", to: "#B39247", badge: "", active: true },
    { id: newId(), title: "Mystic Aurora", provider: "Nova Studio", category: "slots", symbol: "✦", from: "#2A1B41", to: "#6C4BA6", badge: "YENİ", active: true },
    { id: newId(), title: "Sweet Harvest", provider: "Nova Studio", category: "slots", symbol: "✿", from: "#3A1230", to: "#B0567F", badge: "", active: true },
    { id: newId(), title: "Emerald Wilds", provider: "Green Spin", category: "slots", symbol: "❖", from: "#12281C", to: "#2F7A52", badge: "", active: true },
    { id: newId(), title: "Royal Roulette", provider: "Lucky Studio", category: "casino", symbol: "◉", from: "#20180B", to: "#8A6B2E", badge: "CANLI", active: true },
    { id: newId(), title: "Blackjack Lounge", provider: "Lucky Studio", category: "casino", symbol: "♠", from: "#161A16", to: "#3E5A44", badge: "", active: true },
    { id: newId(), title: "Baccarat Salon", provider: "Shalom Games", category: "casino", symbol: "♦", from: "#2A1214", to: "#7A3A3E", badge: "", active: true },
    { id: newId(), title: "Altın Tavla", provider: "Shalom Games", category: "games", symbol: "▦", from: "#241D0E", to: "#8A7233", badge: "", active: true },
    { id: newId(), title: "Aviator", provider: "Nova Studio", category: "aviator", symbol: "✈", from: "#1A2430", to: "#4B6E86", badge: "TREND", active: true },
    { id: newId(), title: "High Flyer", provider: "Green Spin", category: "highflyer", symbol: "☄", from: "#2B1A10", to: "#8A5A2E", badge: "", active: true },
    { id: newId(), title: "Spaceman", provider: "Nova Studio", category: "spaceman", symbol: "✦", from: "#141A2E", to: "#4A5AA0", badge: "", active: true },
  ];

  const matches: Match[] = [
    { id: newId(), home: "Galatasaray", away: "Beşiktaş", league: "Süper Lig", sport: "football", startsAt: hoursFromNow(-1), live: true, minute: 67, score: [2, 1], odds: [1.42, 4.1, 6.75] },
    { id: newId(), home: "Fenerbahçe", away: "Trabzonspor", league: "Süper Lig", sport: "football", startsAt: hoursFromNow(3), live: false, odds: [1.88, 3.25, 4.2] },
    { id: newId(), home: "Arsenal", away: "Chelsea", league: "Premier Lig", sport: "football", startsAt: hoursFromNow(5), live: false, odds: [1.65, 3.8, 5.1] },
    { id: newId(), home: "Real Madrid", away: "Sevilla", league: "La Liga", sport: "football", startsAt: hoursFromNow(-0.5), live: true, minute: 34, score: [1, 0], odds: [1.24, 6.4, 9.8] },
    { id: newId(), home: "Anadolu Efes", away: "Fenerbahçe Beko", league: "Basketbol Süper Ligi", sport: "basketball", startsAt: hoursFromNow(6), live: false, odds: [1.75, 15, 2.1] },
    { id: newId(), home: "Sinner", away: "Alcaraz", league: "ATP Turnuvası", sport: "tennis", startsAt: hoursFromNow(8), live: false, odds: [1.95, 20, 1.85] },
    { id: newId(), home: "Galakticos", away: "Nova Esports", league: "E-spor Ligi", sport: "esports", startsAt: hoursFromNow(2), live: false, odds: [1.6, 8, 2.3] },
    { id: newId(), home: "Sanal Kartallar", away: "Sanal Aslanlar", league: "Sanal Futbol Ligi", sport: "virtual", startsAt: hoursFromNow(0.2), live: true, minute: 12, score: [0, 0], odds: [2.1, 3.2, 3.3] },
  ];

  const banners: Banner[] = [
    { id: newId(), badge: "Kayıp Bonusu", title: "KAYIPSIZ BONUS ÖZEL FIRSAT", description: "Slot kayıplarınıza özel çevrimsiz iade avantajı sizi bekliyor.", buttonLabel: "Detaylar!", destination: "/promosyonlar", symbol: "♛", active: true },
    { id: newId(), badge: "Hoş Geldin", title: "%150 İLK YATIRIM BONUSU", description: "İlk yatırımınıza özel 15.000₺'ye kadar hoş geldin paketi.", buttonLabel: "Detaylar!", destination: "/promosyonlar", symbol: "✦", active: true },
    { id: newId(), badge: "Canlı Casino", title: "GERÇEK KRUPİYELER, GERÇEK HEYECAN", description: "Rulet, blackjack ve baccarat masalarında 7/24 canlı aksiyon.", buttonLabel: "Masaya Otur", destination: "/canli-casino", symbol: "♠", active: true },
  ];

  const promotions: Promotion[] = [
    { id: newId(), badge: "Promosyon", title: "3 Yatırım Yap, 4. Bizden", description: "Ardışık üç yatırımını tamamla, dördüncü yatırım bonusu hesabına tanımlansın.", category: "deposit", terms: "Bonus çevrim şartı 15x'tir. Kampanya hesap başına bir kez geçerlidir.", symbol: "✦", active: true },
    { id: newId(), badge: "Bonus", title: "%20 Anlık Yatırım Bonusu", description: "Her yatırımınıza anında %20 ekstra bakiye ekleniyor.", category: "deposit", terms: "Alt limit 250₺'dir. Bonus çevrim şartı 10x olarak uygulanır.", symbol: "₺", active: true },
    { id: newId(), badge: "Spor", title: "Kombine Oran Yükseltme", description: "5 ve üzeri maç içeren kuponlarda %40'a varan oran yükseltme.", category: "sports", terms: "Minimum oran 1.40 olmalıdır. Sistem kuponları kampanyaya dahil değildir.", symbol: "⚽", active: true },
    { id: newId(), badge: "Casino", title: "Günlük %25 Çevrimsiz İade", description: "Slot oyunlarındaki günlük kayıplarınıza çevrimsiz iade.", category: "casino", terms: "İade her gün 12:00'de hesaplanır ve çevrimsiz olarak yatırılır.", symbol: "7", active: true },
  ];

  const paymentMethods: PaymentMethod[] = [
    { id: newId(), name: "Papara", kind: "wallet", deposit: true, withdraw: true, minimum: 100, maximum: 50000, description: "Anında işlem. 7/24 yatırım ve çekim.", active: true },
    { id: newId(), name: "Havale / EFT", kind: "bank", deposit: true, withdraw: true, minimum: 250, maximum: 250000, description: "Tüm bankalar. Ortalama 5-30 dakika.", active: true },
    { id: newId(), name: "Kripto Para", kind: "crypto", deposit: true, withdraw: true, minimum: 200, maximum: 500000, description: "USDT, BTC ve ETH ağları desteklenir.", active: true },
    { id: newId(), name: "Kredi Kartı", kind: "card", deposit: true, withdraw: false, minimum: 100, maximum: 20000, description: "Anında yatırım. Tüm kartlar geçerlidir.", active: true },
  ];

  const helpArticles: HelpArticle[] = [
    { id: newId(), title: "Nasıl para yatırabilirim?", body: "Hesabınıza giriş yaptıktan sonra Para Yatır sayfasından size uygun yöntemi seçin, tutarı girin ve talimatları izleyin. İşlemleriniz İşlem Geçmişi sayfasından takip edilebilir." },
    { id: newId(), title: "Para çekme talebim ne kadar sürede sonuçlanır?", body: "Çekim talepleri kontrol edildikten sonra sonuçlandırılır. Yöntemin işlem süresi ilgili ödeme yöntemi kartında belirtilir." },
    { id: newId(), title: "Hesabımı nasıl doğrularım?", body: "Hesap Doğrulama sayfasından adınıza düzenlenmiş kimlik belgenizi yükleyin. Belgeniz incelendikten sonra hesabınız doğrulanır." },
    { id: newId(), title: "Oyun nasıl açılır?", body: "Oyuna tıklayın. Yönetimde tanımlanan bağlantı veya API üzerinden oyun başlar." },
  ];

  const pages = {
    about: { title: "Hakkımızda", body: "SHALOM BET; spor bahisleri, canlı casino ve slot oyunlarını tek çatı altında sunan bir oyun platformudur. Amacımız güvenli, hızlı ve şeffaf bir oyun deneyimi sağlamaktır.\n\nTüm ödeme işlemleri kontrollü şekilde yürütülür, kullanıcı bilgileri gizlilik politikamız kapsamında korunur." },
    terms: { title: "Kullanım Şartları", body: "1. Platforma yalnızca 18 yaşını doldurmuş kişiler üye olabilir.\n2. Her kullanıcı yalnızca bir hesap açabilir. Mükerrer hesaplar kapatılır.\n3. Hesap bilgilerinin gizliliği kullanıcının sorumluluğundadır.\n4. Ödeme işlemleri yalnızca hesap sahibi adına kayıtlı yöntemlerle yapılabilir.\n5. Kampanya kuralları ilgili promosyon sayfasında belirtilir." },
    privacy: { title: "Gizlilik Politikası", body: "Kişisel verileriniz yalnızca üyelik, ödeme ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir.\n\nVerileriniz izinsiz üçüncü taraflarla paylaşılmaz. Talebiniz halinde hesabınıza ait verilerin silinmesi için başvuruda bulunabilirsiniz." },
    responsible: { title: "Sorumlu Oyun", body: "Oyun bir eğlence aracıdır, gelir kaynağı değildir.\n\nOyun Limitleri sayfasından günlük yatırım limiti ve oturum süresi belirleyebilir, dilediğiniz zaman hesabınıza ara verebilirsiniz. Kontrolü kaybettiğinizi düşünüyorsanız destek ekibimizle iletişime geçin." },
  };

  setState((current) => ({
    ...current,
    content: {
      banners, games, matches, promotions, paymentMethods, helpArticles, pages,
      support: { email: "destek@shalombet.com", phone: "+90 850 000 00 00", url: "" },
    },
    settings: { ...current.settings, casinoOnline: 1212, sportsOnline: 2182, yearsBadge: "7. Yıl" },
  }));
}
