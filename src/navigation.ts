export const ROUTES = {
  home: "/", menu: "/menu", sports: "/spor-bahisleri", live: "/canli-bahis",
  slots: "/slot-oyunlari", casino: "/canli-casino", games: "/oyunlar",
  aviator: "/aviator", highflyer: "/high-flyer", spaceman: "/spaceman", virtual: "/sanal-spor",
  promos: "/promosyonlar", coupon: "/bahis-kuponu", login: "/giris", register: "/kayit",
  forgot: "/sifremi-unuttum", account: "/hesabim", deposit: "/para-yatir", withdraw: "/para-cek",
  transactions: "/islem-gecmisi", bets: "/bahis-gecmisi", bonuses: "/bonuslarim",
  settings: "/hesap-ayarlari", security: "/guvenlik", verification: "/hesap-dogrulama",
  messages: "/mesajlar", limits: "/oyun-limitleri", about: "/hakkimizda",
  terms: "/kullanim-sartlari", privacy: "/gizlilik-politikasi", responsible: "/sorumlu-oyun",
  contact: "/iletisim", support: "/canli-destek", payments: "/odeme-yontemleri",
  admin: "/admin",
  partner: "/ortak",
  files: "/dosyalar",
} as const;

export type Page = keyof typeof ROUTES;
export const href = (page: Page) => `#${ROUTES[page]}`;
export const pageFromHash = (): Page | "notfound" => {
  const path = window.location.hash.slice(1).split("?")[0].replace(/\/$/, "") || "/";
  if (path.startsWith("/r/")) return "register";
  return (Object.entries(ROUTES).find(([, route]) => route === path)?.[0] as Page) || "notfound";
};

export const PAGE_TITLES: Record<Page, string> = {
  home: "Ana Sayfa", menu: "Menü", sports: "Spor Bahisleri", live: "Canlı Bahis", slots: "Slot Oyunları",
  casino: "Canlı Casino", games: "Oyunlar", aviator: "Aviator", highflyer: "High Flyer", spaceman: "Spaceman",
  virtual: "Sanal Spor", promos: "Promosyonlar", coupon: "Bahis Kuponu", login: "Giriş", register: "Kayıt",
  forgot: "Şifre Yenileme", account: "Hesabım", deposit: "Para Yatır", withdraw: "Para Çek",
  transactions: "İşlem Geçmişi", bets: "Bahis Geçmişi", bonuses: "Bonuslarım", settings: "Hesap Ayarları",
  security: "Güvenlik", verification: "Hesap Doğrulama", messages: "Mesajlar", limits: "Oyun Limitleri",
  about: "Hakkımızda", terms: "Kullanım Şartları", privacy: "Gizlilik Politikası", responsible: "Sorumlu Oyun",
  contact: "İletişim", support: "Canlı Destek", payments: "Ödeme Yöntemleri",
  admin: "Yönetim Paneli",
  partner: "Affiliate Paneli",
  files: "PHP Dosyalarını İndir",
};

export const ACCOUNT_PAGES: Page[] = ["account", "deposit", "withdraw", "transactions", "bets", "settings", "security", "verification", "messages", "limits"];