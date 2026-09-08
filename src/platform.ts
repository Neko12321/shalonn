/* =========================================================================
   SHALOM BET — VERİ SÖZLEŞMELERİ VE SERVİS KÖPRÜSÜ
   Tüm içerik yönetim panelinden gelir. Bu dosya yalnızca tipleri,
   doğrulamayı ve servis çağrısı köprüsünü tanımlar.
   ========================================================================= */

export type GameCategory = "slots" | "casino" | "games" | "aviator" | "highflyer" | "spaceman";
export type Sport = "football" | "basketball" | "tennis" | "esports" | "virtual";

export interface Game {
  id: string;
  title: string;
  provider: string;
  category: GameCategory;
  symbol?: string;
  from?: string;
  to?: string;
  badge?: string;
  imageUrl?: string;
  url?: string;
  apiEndpoint?: string;
  active?: boolean;
  order?: number;
}

export interface Match {
  id: string;
  home: string;
  away: string;
  league: string;
  sport: Sport;
  startsAt: string;
  live: boolean;
  minute?: number;
  score?: [number, number];
  odds: [number, number, number];
}

export interface Banner {
  id: string;
  title: string;
  description: string;
  buttonLabel: string;
  destination: string;
  badge?: string;
  symbol?: string;
  active?: boolean;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  category: "sports" | "casino" | "deposit";
  terms: string;
  badge?: string;
  symbol?: string;
  active?: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  kind: "bank" | "wallet" | "crypto" | "card";
  deposit: boolean;
  withdraw: boolean;
  minimum: number;
  maximum: number;
  description: string;
  active?: boolean;
}

export interface HelpArticle {
  id: string;
  title: string;
  body: string;
}

export interface SiteContent {
  banners: Banner[];
  games: Game[];
  matches: Match[];
  promotions: Promotion[];
  paymentMethods: PaymentMethod[];
  helpArticles: HelpArticle[];
  pages: Record<string, { title: string; body: string }>;
  support: { email: string; phone: string; url: string };
}

export interface Member {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  phone: string;
  balance: number;
  bonusBalance?: number;
}

export interface AccountRecord {
  id: string;
  title: string;
  description: string;
  date: string;
  status: "pending" | "completed" | "cancelled" | "unread";
  amount?: number;
}

export type ServiceAction =
  | "login" | "register" | "logout" | "session" | "resetPassword"
  | "deposit" | "withdraw" | "transactions" | "bets" | "bonuses" | "messages"
  | "updateProfile" | "updatePassword" | "verifyIdentity" | "updateLimits"
  | "selfExclude" | "contact" | "launchGame" | "claimPromotion" | "placeBet";

export interface ServiceResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

declare global {
  interface Window {
    SHALOM_CONTENT?: Partial<SiteContent>;
    SHALOM_CLIENT?: {
      request: (action: ServiceAction, payload?: unknown) => Promise<ServiceResponse>;
    };
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const identified = (value: unknown): value is Record<string, unknown> =>
  record(value) && text(value.id) && value.id.length > 0;

/** Yayınlanan içeriği doğrular; geçersiz kayıtlar arayüze düşmez. */
export function resolveContent(value: unknown): SiteContent {
  const input = record(value) ? value : {};
  const filter = <T,>(key: string, validate: (item: unknown) => boolean): T[] => {
    const items = input[key];
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    return items.filter((item) => {
      if (!identified(item) || seen.has(item.id as string) || !validate(item)) return false;
      seen.add(item.id as string);
      return true;
    }) as T[];
  };
  const pages: SiteContent["pages"] = Object.create(null);
  if (record(input.pages)) {
    Object.entries(input.pages).forEach(([key, page]) => {
      if (record(page) && text(page.title) && text(page.body)) {
        pages[key] = { title: page.title, body: page.body };
      }
    });
  }
  const support = record(input.support) ? input.support : {};
  return {
    banners: filter<Banner>("banners", (item) => identified(item) && text(item.title) && item.active !== false),
    games: filter<Game>("games", (item) => identified(item) && text(item.title) && text(item.provider)
      && ["slots", "casino", "games", "aviator", "highflyer", "spaceman"].includes(String(item.category)) && item.active !== false),
    matches: filter<Match>("matches", (item) => identified(item) && text(item.home) && text(item.away) && text(item.league)
      && text(item.startsAt) && Number.isFinite(Date.parse(item.startsAt))
      && ["football", "basketball", "tennis", "esports", "virtual"].includes(String(item.sport))
      && typeof item.live === "boolean"
      && Array.isArray(item.odds) && item.odds.length === 3
      && item.odds.every((odd) => typeof odd === "number" && Number.isFinite(odd) && odd >= 1)),
    promotions: filter<Promotion>("promotions", (item) => identified(item) && text(item.title) && text(item.description)
      && ["sports", "casino", "deposit"].includes(String(item.category)) && item.active !== false),
    paymentMethods: filter<PaymentMethod>("paymentMethods", (item) => identified(item) && text(item.name)
      && ["bank", "wallet", "crypto", "card"].includes(String(item.kind))
      && typeof item.minimum === "number" && typeof item.maximum === "number"
      && item.minimum > 0 && item.maximum >= item.minimum && item.active !== false),
    helpArticles: filter<HelpArticle>("helpArticles", (item) => identified(item) && text(item.title) && text(item.body)),
    pages,
    support: {
      email: text(support.email) ? support.email : "",
      phone: text(support.phone) ? support.phone : "",
      url: text(support.url) ? support.url : "",
    },
  };
}

/** Servis köprüsü: gerçek bir arka uç bağlanana kadar yerel istemci kullanılır. */
export async function service<T>(action: ServiceAction, payload?: unknown): Promise<T> {
  const client = window.SHALOM_CLIENT;
  if (!client) throw new Error("Bu işlem şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let response: ServiceResponse;
  try {
    response = await Promise.race([
      client.request(action, payload),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.")), 20000);
      }),
    ]);
  } catch (failure) {
    throw failure instanceof Error ? failure : new Error("İşlem tamamlanamadı. Lütfen tekrar deneyin.");
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!response || response.ok !== true) {
    throw new Error(response?.error || "İşlem tamamlanamadı. Bilgilerinizi kontrol edip tekrar deneyin.");
  }
  return response.data as T;
}

export function isMember(value: unknown): value is Member {
  return record(value) && text(value.id) && value.id.length > 0 && text(value.username) && text(value.firstName)
    && text(value.lastName) && text(value.email) && text(value.country) && text(value.phone)
    && typeof value.balance === "number" && Number.isFinite(value.balance);
}

export function validRecords(value: unknown): AccountRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => identified(item) && text(item.title) && text(item.description)
    && text(item.date) && Number.isFinite(Date.parse(item.date))
    && (item.amount === undefined || (typeof item.amount === "number" && Number.isFinite(item.amount)))
    && ["pending", "completed", "cancelled", "unread"].includes(String(item.status))) as AccountRecord[];
}

export function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export const money = (value: number) => new Intl.NumberFormat("tr-TR", {
  style: "currency", currency: "TRY", minimumFractionDigits: 2,
}).format(value);
