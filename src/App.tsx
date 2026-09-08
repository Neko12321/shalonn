/* =========================================================================
   SHALOM BET — UYGULAMA
   Tüm içerik yönetim panelinden (#/admin) gelir.
   ========================================================================= */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import "./ornate.css";
import emblemUrl from "./assets/logo.png";
import cornerUrl from "./assets/corner.png";
import { AccountPage, PaymentMethods } from "./Account";
import { ForgotPage, LoginPage, RegisterPage } from "./Auth";
import Admin from "./Admin";
import DownloadPackage from "./DownloadPackage";
import { AffiliatePortal } from "./Staff";
import { installLocalClient } from "./client";
import { ACCOUNT_PAGES, PAGE_TITLES, ROUTES, href, pageFromHash, type Page } from "./navigation";
import {
  isMember, money, resolveContent, safeUrl, service,
  type Game, type Match, type Member, type Promotion, type SiteContent, type Sport,
} from "./platform";
import { searchText, validEmail } from "./registration";
import { captureAffiliateRef, useStore, type SiteSettings } from "./store";
import { Dialog, EmptyState, Field, Icon, LegalContent, Notice, PageHeading, SearchInput, Spinner, type IconName } from "./ui";

installLocalClient();

const TOP_NAV: { page: Page; label: string }[] = [
  { page: "sports", label: "SPOR BAHİSLERİ" }, { page: "live", label: "CANLI BAHİSLER" },
  { page: "slots", label: "SLOT OYUNLARI" }, { page: "casino", label: "CANLI CASINO" },
  { page: "games", label: "OYUNLAR" }, { page: "virtual", label: "SANAL SPOR" },
];
const MENU_ITEMS: { page: Page; label: string; icon: IconName }[] = [
  { page: "live", label: "Canlı", icon: "live" }, { page: "sports", label: "Sporlar", icon: "sports" },
  { page: "slots", label: "Slotlar", icon: "slots" }, { page: "casino", label: "Canlı Casino", icon: "casino" },
  { page: "games", label: "Oyunlar", icon: "games" }, { page: "aviator", label: "Aviator", icon: "plane" },
  { page: "highflyer", label: "High Flyer", icon: "plane" }, { page: "spaceman", label: "Spaceman", icon: "rocket" },
  { page: "support", label: "Canlı Destek", icon: "support" },
];
const SPORTS: { id: Sport; label: string; icon: IconName }[] = [
  { id: "football", label: "Futbol", icon: "sports" }, { id: "basketball", label: "Basketbol", icon: "live" },
  { id: "tennis", label: "Tenis", icon: "live" }, { id: "esports", label: "E-spor", icon: "games" },
];
const GAME_CATEGORIES = [
  { id: "all", label: "Tüm Oyunlar" }, { id: "slots", label: "Slotlar" },
  { id: "casino", label: "Canlı Casino" }, { id: "games", label: "Masa Oyunları" },
] as const;
const PROMO_CATEGORIES: { id: Promotion["category"] | "all"; label: string; icon: IconName }[] = [
  { id: "all", label: "TÜM BONUSLAR", icon: "gift" }, { id: "sports", label: "SPOR BONUSLARI", icon: "sports" },
  { id: "casino", label: "CASINO BONUSLARI", icon: "slots" }, { id: "deposit", label: "YATIRIM BONUSLARI", icon: "wallet" },
];

interface Selection { match: Match; pick: number; odd: number }
type Go = (page: Page) => void;

/** Oymalı çerçevelerin dört köşe süsü. */
function CornerSet() {
  return <><i className="fx tl" aria-hidden="true" /><i className="fx tr" aria-hidden="true" /><i className="fx bl" aria-hidden="true" /><i className="fx br" aria-hidden="true" /></>;
}

/* ------------------------------------------------------------- YARDIMCI */
const gameArt = (game: Game): CSSProperties => ({
  background: `radial-gradient(120px 90px at 50% 18%, ${game.to || "#8A6B2E"}, ${game.from || "#221B0C"} 78%)`,
});

function GameTile({ game, onOpen }: { game: Game; onOpen: (game: Game) => void }) {
  return (
    <button className="lux-game" onClick={() => onOpen(game)}>
      <span className="lux-game-inner">
        <span
          className="lux-game-art"
          style={game.imageUrl
            ? { backgroundImage: `url("${game.imageUrl}")`, backgroundSize: "cover", backgroundPosition: "center" }
            : gameArt(game)}
        >
          {!game.imageUrl && <span className="game-symbol-fallback">{game.symbol || "7"}</span>}
          {game.badge && <span className="lux-game-badge">{game.badge}</span>}
          <span className="lux-game-play">HEMEN OYNA</span>
        </span>
        <span className="lux-game-foot">
          <small>{game.provider}</small>
          <strong>{game.title}</strong>
        </span>
      </span>
    </button>
  );
}

/** Yatay kaydırmalı oyun rayı: plaka başlık + yuvarlak ok düğmeleri. */
function GameRail({ title, games, onOpen, onAll }: { title: string; games: Game[]; onOpen: (game: Game) => void; onAll: () => void }) {
  const rail = useRef<HTMLDivElement>(null);
  const scroll = (direction: -1 | 1) => rail.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  return (
    <section className="lux-section">
      <div className="lux-section-head">
        <button className="lux-plaque" onClick={onAll}>{title}</button>
        <div className="lux-nav-round">
          <button className="lux-round" onClick={() => scroll(-1)} aria-label="Geri kaydır">←</button>
          <button className="lux-round" onClick={() => scroll(1)} aria-label="İleri kaydır">→</button>
        </div>
      </div>
      {games.length ? (
        <div className="lux-rail" ref={rail}>{games.map((game) => <GameTile key={game.id} game={game} onOpen={onOpen} />)}</div>
      ) : (
        <EmptyState icon="slots" title="Bu kategoride oyun bulunmuyor." description="Oyunlar yönetim panelinden eklendiğinde burada görünür." compact />
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- HEADER */
function Header({ page, member, settings, onClose, onMenu }: {
  page: Page | "notfound"; member: Member | null; settings: SiteSettings; onClose: () => void; onMenu: () => void;
}) {
  const auth = page === "login" || page === "register" || page === "forgot";
  return (
    <header className="lux-header">
      <div className="lux-header-inner">
        <div className="ornate"><CornerSet /><div className="ornate-inner"><div className="lux-header-bar">
          <a className="lux-brand" href={href("home")} aria-label={`${settings.brandName} ${settings.brandSub} ana sayfa`}>
            <img className="brand-emblem" src={emblemUrl} alt="" />
            <span className="lux-brand-text">
              <b>{settings.brandName}</b>
              <span>{settings.brandSub}</span>
            </span>
          </a>
          {settings.yearsBadge && <span className="lux-years">{settings.yearsBadge}</span>}
          <span className="lux-valid" aria-hidden="true">
            <span className="lux-valid-mark">★<i>✓</i></span>
            <span>VALID</span>
          </span>
          <div className="lux-actions">
            {auth ? (
              <>
                {page === "register"
                  ? <a className="lux-login" href={href("login")}>GİRİŞ</a>
                  : <a className="lux-register" href={href("register")}>KAYIT</a>}
                <button className="lux-more" onClick={onClose} aria-label="Kapat">✕</button>
              </>
            ) : member ? (
              <>
                <a className="lux-login" href={href("account")}>{money(member.balance)}</a>
                <a className="lux-register" href={href("deposit")}>PARA YATIR</a>
                <button className="lux-more" onClick={onMenu} aria-label="Menü">⋮</button>
              </>
            ) : (
              <>
                <a className="lux-login" href={href("login")}>GİRİŞ</a>
                <a className="lux-register" href={href("register")}>KAYIT</a>
                <button className="lux-more" onClick={onMenu} aria-label="Menü">⋮</button>
              </>
            )}
          </div>
        </div></div></div>
      </div>
    </header>
  );
}

/* --------------------------------------------------------- HIZLI LİNKLER */
function QuickLinks({ settings, navigate }: { settings: SiteSettings; navigate: Go }) {
  const links = settings.quickLinks.filter((link) => link.active);
  if (!links.length) return null;
  const telegram = safeUrl(settings.telegram);
  return (
    <nav className="lux-quick" aria-label="Hızlı bağlantılar">
      {links.map((link) => link.target === "telegram"
        ? <a key={link.id} href={telegram || href("support")} target={telegram ? "_blank" : undefined} rel="noopener noreferrer">{link.label}</a>
        : <a key={link.id} href={href(link.target as Page)} onClick={(event) => { event.preventDefault(); navigate(link.target as Page); }}>{link.label}</a>)}
    </nav>
  );
}

/* ---------------------------------------------------------------- BANNER */
function BannerCarousel({ content, navigate }: { content: SiteContent; navigate: Go }) {
  const [index, setIndex] = useState(0);
  const banners = content.banners;
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => { if (!document.hidden) setIndex((current) => (current + 1) % count); }, 6500);
    return () => clearInterval(timer);
  }, [count]);

  const banner = count ? banners[index % count] : null;
  const open = () => {
    if (!banner) { navigate("slots"); return; }
    const page = (Object.entries(ROUTES).find(([, route]) => route === banner.destination)?.[0] || "slots") as Page;
    navigate(page);
  };

  return (
    <div className="lux-banner-wrap">
      <div className="ornate"><CornerSet /><div className="ornate-inner">
        <div className="lux-slide">
          {banner ? (
            <>
              <div className="lux-slide-copy">
                {banner.badge && <span className="lux-slide-badge">{banner.badge}</span>}
                <h2>{banner.title}</h2>
                <div className="lux-rule">◆</div>
                <p>{banner.description}</p>
                <button className="lux-detail-btn" onClick={open}>{banner.buttonLabel || "Detaylar!"}</button>
              </div>
              <div className="lux-slide-art" aria-hidden="true"><span>{banner.symbol || "♠"}</span></div>
            </>
          ) : (
            <div className="lux-slide-copy">
              <span className="lux-slide-badge">SHALOM BET</span>
              <h2>OYUNUN ALTIN ÇAĞI</h2>
              <div className="lux-rule">◆</div>
              <p>Banner alanı yönetim panelinden düzenlenir. Eklediğiniz duyurular bu alanda döner.</p>
              <button className="lux-detail-btn" onClick={open}>PROMOSYONLAR</button>
            </div>
          )}
          {count > 1 && (
            <>
              <button className="lux-arrow prev" onClick={() => setIndex((current) => (current - 1 + count) % count)} aria-label="Önceki">‹</button>
              <button className="lux-arrow next" onClick={() => setIndex((current) => (current + 1) % count)} aria-label="Sonraki">›</button>
            </>
          )}
        </div>
      </div></div>
      {count > 1 && (
        <div className="lux-dots">
          {banners.map((item, itemIndex) => (
            <button key={item.id} className={itemIndex === index % count ? "on" : ""}
              onClick={() => setIndex(itemIndex)} aria-label={`${itemIndex + 1}. duyuru`} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ ANA SAYFA */
function HomePage({ content, settings, navigate, onGame }: {
  content: SiteContent; settings: SiteSettings; navigate: Go; onGame: (game: Game) => void;
}) {
  const [query, setQuery] = useState("");
  const results = query.trim()
    ? content.games.filter((game) => searchText(`${game.title} ${game.provider}`).includes(searchText(query)))
    : [];
  const byCategory = (category: Game["category"]) => content.games.filter((game) => game.category === category);

  return (
    <>
      <BannerCarousel content={content} navigate={navigate} />

      <div className="lux-cats">
        <a className="ornate lux-cat-frame" href={href("casino")}>
          <CornerSet />
          <span className="ornate-inner lux-cat">
            <h3>CASINO</h3>
            <span className="lux-cat-art" aria-hidden="true">♠</span>
            {settings.casinoOnline > 0 && <span className="lux-online"><i /> {settings.casinoOnline.toLocaleString("tr-TR")} çevrim içi</span>}
          </span>
        </a>
        <a className="ornate lux-cat-frame" href={href("sports")}>
          <CornerSet />
          <span className="ornate-inner lux-cat">
            <h3>SPOR</h3>
            <span className="lux-cat-art" aria-hidden="true">🏆</span>
            {settings.sportsOnline > 0 && <span className="lux-online"><i /> {settings.sportsOnline.toLocaleString("tr-TR")} çevrim içi</span>}
          </span>
        </a>
      </div>

      <div className="lux-search-wrap">
        <div className="ornate"><CornerSet /><div className="ornate-inner">
          <div className="lux-search">
            <i>⌕</i><span className="sep" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Oyun Arayın" aria-label="Oyun arayın" />
            {query && <button className="lux-round" style={{ width: 30, height: 30, fontSize: 13 }} onClick={() => setQuery("")} aria-label="Temizle">✕</button>}
          </div>
        </div></div>
      </div>

      {query.trim() && (
        <section className="lux-section">
          <div className="lux-section-head"><span className="lux-plaque">Arama Sonuçları</span><span className="result-count">{results.length} OYUN</span></div>
          {results.length
            ? <div className="lux-grid">{results.map((game) => <GameTile key={game.id} game={game} onOpen={onGame} />)}</div>
            : <EmptyState icon="search" title="Aramanıza uygun oyun bulunamadı." compact />}
        </section>
      )}

      <GameRail title="Slot Oyunları" games={byCategory("slots")} onOpen={onGame} onAll={() => navigate("slots")} />
      <GameRail title="Canlı Casino" games={byCategory("casino")} onOpen={onGame} onAll={() => navigate("casino")} />
      <GameRail title="Popüler Oyunlar" games={content.games.slice(0, 12)} onOpen={onGame} onAll={() => navigate("games")} />
    </>
  );
}

/* ------------------------------------------------------------ ALT MENÜ */
function BottomNav({ page, count, onMenu }: { page: Page | "notfound"; count: number; onMenu: () => void }) {
  const item = (target: Page, icon: string, label: string, badge = 0) => (
    <a href={href(target)} className={`lux-bottom-item ${page === target ? "on" : ""}`}>
      <i>{icon}{badge > 0 && <span className="lux-badge-count">{badge}</span>}</i>
      <span>{label}</span>
    </a>
  );
  return (
    <nav className="lux-bottom" aria-label="Alt menü">
      <div className="ornate"><CornerSet /><div className="ornate-inner"><div className="lux-bottom-inner">
        {item("sports", "⚽", "Bahis")}
        {item("coupon", "▤", "Bahis Kuponu", count)}
        <a href={href("slots")} className="lux-bottom-center" aria-label="Slot oyna">
          <span className="lux-coin"><b>777</b><small>SLOT</small></span>
        </a>
        {item("casino", "♠", "Canlı Casino")}
        <button className={`lux-bottom-item ${page === "menu" ? "on" : ""}`} onClick={onMenu} aria-expanded={page === "menu"}>
          <i>☰</i><span>Menü</span>
        </button>
      </div></div></div>
    </nav>
  );
}

/* ---------------------------------------------------------------- MENÜ */
function MenuPage({ onClose, couponCount }: { onClose: () => void; couponCount: number }) {
  return (
    <main className="menu-page page-enter">
      <div className="menu-title-bar"><div className="container"><h1>MENÜ</h1><button onClick={onClose} aria-label="Menüyü kapat"><Icon name="close" size={28} /></button></div></div>
      <div className="container menu-content">
        <nav className="menu-grid" aria-label="Tüm kategoriler">
          {MENU_ITEMS.map((item, index) => (
            <a key={item.page} href={href(item.page)} className="menu-tile" style={{ "--item-index": index } as CSSProperties}>
              <Icon name={item.icon} size={27} /><span>{item.label}</span>
            </a>
          ))}
        </nav>
        <nav className="menu-account-links" aria-label="Hesap işlemleri">
          <a href={href("account")}><Icon name="user" size={19} /> Hesabım</a>
          <a href={href("deposit")}><Icon name="deposit" size={19} /> Para Yatır</a>
          <a href={href("withdraw")}><Icon name="withdraw" size={19} /> Para Çek</a>
          <a href={href("coupon")}><Icon name="ticket" size={19} /> Bahis Kuponu <span className="inline-count">{couponCount}</span></a>
        </nav>
        <a className="menu-home" href={href("home")}><Icon name="home" size={17} /> Ana sayfaya dön</a>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- SPOR */
function Odds({ match, selected, onPick }: { match: Match; selected?: Selection; onPick: (match: Match, pick: number) => void }) {
  return (
    <div className="odds-row">
      {match.odds.map((odd, index) => (
        <button key={index} className={selected?.pick === index ? "selected" : ""} aria-pressed={selected?.pick === index}
          aria-label={`${match.home} ${match.away} ${["1", "X", "2"][index]} oran ${odd.toFixed(2)}`}
          onClick={() => onPick(match, index)}>
          <small>{["1", "X", "2"][index]}</small><strong>{odd.toFixed(2)}</strong>
        </button>
      ))}
    </div>
  );
}

function SportsPage({ page, content, selections, onPick }: {
  page: "sports" | "live" | "virtual"; content: SiteContent; selections: Selection[]; onPick: (match: Match, pick: number) => void;
}) {
  const [sport, setSport] = useState<Sport>(page === "virtual" ? "virtual" : "football");
  const [filter, setFilter] = useState(page === "live" ? "live" : "today");
  const [query, setQuery] = useState("");
  const date = new Date();
  if (filter === "tomorrow") date.setDate(date.getDate() + 1);
  const dateKey = date.toLocaleDateString("tr-TR");
  const matches = content.matches.filter((match) =>
    match.sport === sport
    && (filter === "all" || (filter === "live" ? match.live : new Date(match.startsAt).toLocaleDateString("tr-TR") === dateKey))
    && searchText(`${match.home} ${match.away} ${match.league}`).includes(searchText(query)));
  const leagues = [...new Set(matches.map((match) => match.league))];

  return (
    <>
      <PageHeading title={PAGE_TITLES[page]} eyebrow={page === "live" ? "CANLI KARŞILAŞMALAR" : "SPOR DÜNYASI"}>
        <span className="result-count">{matches.length} KARŞILAŞMA</span>
      </PageHeading>
      <div className="sports-layout">
        {page !== "virtual" && (
          <aside className="sport-sidebar" aria-label="Spor dalları">
            {SPORTS.map((item) => (
              <button key={item.id} onClick={() => setSport(item.id)} className={sport === item.id ? "active" : ""} aria-pressed={sport === item.id}>
                <Icon name={item.icon} size={21} /><span>{item.label}</span>
                <small>{content.matches.filter((match) => match.sport === item.id && (page !== "live" || match.live)).length}</small>
              </button>
            ))}
          </aside>
        )}
        <div className="sports-main">
          <div className="sports-toolbar">
            <div className="filter-tabs">
              {(page === "live" ? [["live", "Canlı"]] : [["today", "Bugün"], ["tomorrow", "Yarın"], ["live", "Canlı"], ["all", "Tümü"]]).map(([id, label]) => (
                <button key={id} className={filter === id ? "active" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
              ))}
            </div>
            <SearchInput value={query} onChange={setQuery} placeholder="Takım veya lig ara" />
          </div>
          {matches.length ? leagues.map((league) => (
            <section key={league} className="league-section">
              <h2><Icon name="sports" size={17} />{league}</h2>
              {matches.filter((match) => match.league === league).map((match) => (
                <div className="match-row" key={match.id}>
                  <div className="match-time">
                    {match.live
                      ? <><span className="live-dot" /><span>{typeof match.minute === "number" && match.minute > 0 ? `${match.minute}'` : "Canlı"}</span></>
                      : new Date(match.startsAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="match-teams"><span>{match.home}</span><span>{match.away}</span></div>
                  {match.live && Array.isArray(match.score) && (
                    <div className="match-score"><span>{match.score[0]}</span><span>{match.score[1]}</span></div>
                  )}
                  <Odds match={match} selected={selections.find((item) => item.match.id === match.id)} onPick={onPick} />
                </div>
              ))}
            </section>
          )) : (
            <EmptyState icon={page === "live" ? "live" : "sports"}
              title={query ? "Aramanıza uygun karşılaşma bulunamadı." : page === "live" ? "Şu anda canlı karşılaşma bulunmuyor." : "Bu filtrede karşılaşma bulunmuyor."}
              description="Karşılaşmalar yönetim panelinden eklendiğinde burada listelenir." />
          )}
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- OYUNLAR */
function GamesPage({ page, content, onGame }: {
  page: "slots" | "casino" | "games" | "aviator" | "highflyer" | "spaceman"; content: SiteContent; onGame: (game: Game) => void;
}) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [category, setCategory] = useState<string>(page === "games" ? "all" : page);
  const providers = [...new Set(content.games.filter((game) => category === "all" || game.category === category).map((game) => game.provider))];
  const games = content.games.filter((game) =>
    (category === "all" || game.category === category)
    && (provider === "all" || game.provider === provider)
    && searchText(game.title).includes(searchText(query)));

  return (
    <>
      <PageHeading title={PAGE_TITLES[page]} eyebrow="SHALOM BET OYUN DÜNYASI"><span className="result-count">{games.length} OYUN</span></PageHeading>
      <div className="games-toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Oyun ara" />
        <select className="simple-select" value={provider} onChange={(event) => setProvider(event.target.value)} aria-label="Oyun sağlayıcısı">
          <option value="all">Tüm sağlayıcılar</option>
          {providers.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {page === "games" && (
        <div className="filter-tabs game-categories">
          {GAME_CATEGORIES.map((item) => (
            <button key={item.id} className={category === item.id ? "active" : ""} aria-pressed={category === item.id}
              onClick={() => { setCategory(item.id); setProvider("all"); }}>{item.label}</button>
          ))}
        </div>
      )}
      {games.length
        ? <div className="lux-grid" style={{ marginTop: 22 }}>{games.map((game) => <GameTile key={game.id} game={game} onOpen={onGame} />)}</div>
        : <EmptyState icon={page === "aviator" || page === "highflyer" ? "plane" : page === "spaceman" ? "rocket" : page === "casino" ? "casino" : "slots"}
            title={query ? "Aramanıza uygun oyun bulunamadı." : "Bu kategoride oyun bulunmuyor."}
            description="Oyunlar yönetim panelinden eklendiğinde burada görünür." />}
    </>
  );
}

/* ---------------------------------------------------------- PROMOSYONLAR */
function PromotionsPage({ content, onOpen }: { content: SiteContent; onOpen: (promo: Promotion) => void }) {
  const [category, setCategory] = useState<Promotion["category"] | "all">("all");
  const items = content.promotions.filter((item) => category === "all" || item.category === category);
  return (
    <>
      <PageHeading title="Promosyonlar" eyebrow="SHALOM BET AYRICALIKLARI" />
      <div className="promotion-tabs">
        {PROMO_CATEGORIES.map((item) => (
          <button className={category === item.id ? "active" : ""} key={item.id} onClick={() => setCategory(item.id)} aria-pressed={category === item.id}>
            <Icon name={item.icon} size={27} /><span>{item.label}</span>
          </button>
        ))}
      </div>
      {items.length ? (
        <div className="promotion-list">
          {items.map((item) => (
            <button className="promotion-banner" onClick={() => onOpen(item)} key={item.id}>
              <span className="eyebrow">{item.badge || "SHALOM BET"}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <span className="promotion-action">DETAYLARI İNCELE <Icon name="arrow" size={19} /></span>
              <Icon name="gift" size={140} className="promotion-watermark" />
            </button>
          ))}
        </div>
      ) : <EmptyState icon="gift" title="Yayında promosyon bulunmuyor." description="Kampanyalar yönetim panelinden eklenir." />}
    </>
  );
}

/* --------------------------------------------------------------- KUPON */
function CouponPage({ selections, onRemove, onClear, member, navigate, notify }: {
  selections: Selection[]; onRemove: (id: string) => void; onClear: () => void;
  member: Member | null; navigate: Go; notify: (message: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const total = selections.reduce((accumulator, item) => accumulator * item.odd, 1);
  const value = Number(amount.replace(",", "."));

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(amount) || !Number.isFinite(value) || value < 1 || value > 100000) {
      setError("1 ile 100.000 TRY arasında geçerli bir tutar girin."); return;
    }
    if (!member) { navigate("login"); return; }
    setBusy(true);
    try {
      await service("placeBet", { stake: value, selections: selections.map((item) => ({ matchId: item.match.id, outcome: ["1", "X", "2"][item.pick], odd: item.odd })) });
      onClear(); setAmount(""); notify("Kuponunuz oluşturuldu.");
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="coupon-page">
      <PageHeading title="Bahis Kuponu" eyebrow="SEÇİMLERİNİZ"><span className="inline-count">{selections.length}</span></PageHeading>
      {selections.length ? (
        <form onSubmit={submit} noValidate className="coupon-form">
          <div className="coupon-heading"><span>{selections.length} karşılaşma</span><button type="button" onClick={onClear}>TÜMÜNÜ TEMİZLE</button></div>
          {selections.map((item) => (
            <div className="coupon-selection" key={item.match.id}>
              <div>
                <small>{item.match.league}</small>
                <strong>{item.match.home} / {item.match.away}</strong>
                <span>Maç Sonucu: {["1", "X", "2"][item.pick]} <b>{item.odd.toFixed(2)}</b></span>
              </div>
              <button type="button" className="icon-button" onClick={() => onRemove(item.match.id)} aria-label="Seçimi kaldır"><Icon name="close" size={17} /></button>
            </div>
          ))}
          <div className="coupon-summary">
            <span>Toplam oran <b>{Number.isFinite(total) ? total.toFixed(2) : "-"}</b></span>
            <Field label="Bahis Tutarı (TRY)" inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <span>Olası kazanç <strong>{Number.isFinite(value * total) && value > 0 ? money(value * total) : money(0)}</strong></span>
            {error && <Notice error>{error}</Notice>}
            <button type="submit" className="button button-gold full-width" disabled={busy}>{busy ? <Spinner /> : "KUPONU ONAYLA"}</button>
          </div>
        </form>
      ) : (
        <EmptyState icon="ticket" title="Kuponunuz şu an boş." description="Karşılaşmalardaki oranları seçerek kuponunuzu oluşturabilirsiniz.">
          <a className="button button-gold" href={href("sports")}>SPOR BAHİSLERİ <Icon name="arrow" size={16} /></a>
        </EmptyState>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- DESTEK */
function SupportPage({ content, settings }: { content: SiteContent; settings: SiteSettings }) {
  const [query, setQuery] = useState("");
  const url = safeUrl(content.support.url);
  const telegram = safeUrl(settings.telegram);
  const articles = content.helpArticles.filter((item) => searchText(`${item.title} ${item.body}`).includes(searchText(query)));
  return (
    <div className="support-page">
      <PageHeading title="Size nasıl yardımcı olabiliriz?" eyebrow="SHALOM BET DESTEK" />
      <SearchInput value={query} onChange={setQuery} placeholder="Yardım konularında ara" />
      {articles.length ? (
        <div className="help-articles">
          {articles.map((item) => (
            <details key={item.id}><summary>{item.title}<Icon name="chevron" size={17} /></summary><p>{item.body}</p></details>
          ))}
        </div>
      ) : <EmptyState icon="support" title={query ? "Bu arama için yardım içeriği bulunamadı." : "Yardım içeriği yayınlanmadı."} description="İletişim seçeneklerini aşağıdan görebilirsiniz." compact />}
      {content.support.email && <a className="support-channel" href={`mailto:${content.support.email}`}><Icon name="mail" /><span>{content.support.email}</span><Icon name="arrow" size={17} /></a>}
      {content.support.phone && <a className="support-channel" href={`tel:${content.support.phone.replace(/[^\d+]/g, "")}`}><Icon name="support" /><span>{content.support.phone}</span><Icon name="arrow" size={17} /></a>}
      {telegram && <a className="support-channel" href={telegram} target="_blank" rel="noopener noreferrer"><Icon name="support" /><span>Telegram destek kanalı</span><Icon name="arrow" size={17} /></a>}
      {url && <a className="support-channel" href={url} target="_blank" rel="noopener noreferrer"><Icon name="support" /><span>Destek ile iletişime geçin</span><Icon name="arrow" size={17} /></a>}
      <a className="support-channel" href={href("contact")}><Icon name="document" /><span>İletişim formu</span><Icon name="arrow" size={17} /></a>
    </div>
  );
}

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (name.trim().length < 2 || !validEmail(email) || !subject || message.trim().length < 10) {
      setError("Adınızı, geçerli e-posta adresinizi, konu ve en az 10 karakterlik mesajınızı girin."); return;
    }
    setBusy(true);
    try { await service("contact", { name: name.trim(), email: email.trim(), subject, message: message.trim() }); setSent(true); setMessage(""); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="contact-page">
      <PageHeading title="İletişim" eyebrow="BİZE ULAŞIN" />
      {sent ? <Notice>Mesajınız alındı. Yanıtımızı belirttiğiniz e-posta adresinden takip edebilirsiniz.</Notice> : (
        <form className="standard-form" noValidate onSubmit={submit}>
          <Field label="Adınız ve Soyadınız" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          <Field label="E-posta" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          <label className="field"><span className="field-label">Konu</span>
            <select className="simple-select" value={subject} onChange={(event) => setSubject(event.target.value)}>
              <option value="">Konu seçin</option><option value="account">Hesap işlemleri</option>
              <option value="payment">Ödeme işlemleri</option><option value="technical">Teknik destek</option><option value="other">Diğer</option>
            </select>
          </label>
          <label className="field"><span className="field-label">Mesajınız</span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} placeholder="Size nasıl yardımcı olabiliriz?" maxLength={4000} />
          </label>
          {error && <Notice error>{error}</Notice>}
          <button className="button button-gold full-width" type="submit" disabled={busy}>{busy ? <Spinner /> : "MESAJI GÖNDER"}</button>
        </form>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- FOOTER */
function Footer({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <a className="lux-brand" href={href("home")}>
            <img className="brand-emblem" src={emblemUrl} alt="" />
            <span className="lux-brand-text"><b>{settings.brandName}</b><span>{settings.brandSub}</span></span>
          </a>
          <p>{settings.tagline}</p>
        </div>
        <div className="footer-column"><h2>KURUMSAL</h2>
          {(["about", "terms", "privacy", "contact"] as Page[]).map((page) => <a key={page} href={href(page)}>{PAGE_TITLES[page]}</a>)}
        </div>
        <div className="footer-column"><h2>HESAP İŞLEMLERİ</h2>
          {(["deposit", "withdraw", "payments", "support"] as Page[]).map((page) => <a key={page} href={href(page)}>{PAGE_TITLES[page]}</a>)}
        </div>
        <div className="footer-responsible">
          <span className="age-badge">18+</span>
          <div><h2>SORUMLU OYUN</h2><p>Yalnızca 18 yaş ve üzeri.<br />Kontrol sizde kalsın.</p>
            <a href={href("responsible")}>Daha fazla bilgi <Icon name="arrow" size={13} /></a></div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} {settings.brandName} {settings.brandSub}. Tüm hakları saklıdır.</span>
        <a href={href("files")} className="footer-language">PHP dosyalarını indir</a>
        <a href={href("admin")} className="footer-language">Yönetim Paneli</a>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------- CANLI DESTEK ALANI */
function LiveChat({ settings }: { settings: SiteSettings }) {
  const { chat } = settings;
  useEffect(() => {
    const host = document.getElementById("canli-destek-alani");
    if (!host) return;
    host.innerHTML = "";
    if (chat.provider !== "tawk") return;
    const property = chat.propertyId.replace(/[^a-zA-Z0-9]/g, "");
    const widget = (chat.widgetId || "default").replace(/[^a-zA-Z0-9]/g, "");
    if (!property) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://embed.tawk.to/${property}/${widget}`;
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    host.appendChild(script);
    return () => { host.innerHTML = ""; };
  }, [chat.provider, chat.propertyId, chat.widgetId]);

  if (!chat.bubble || chat.provider === "tawk") return null;
  return <a className="lux-chat" href={href("support")} aria-label="Canlı destek">💬</a>;
}

/* ------------------------------------------------------------ UYGULAMA */
export default function App() {
  const store = useStore();
  const settings = store.settings;
  const content = useMemo(() => resolveContent(store.content), [store.content]);

  const [page, setPage] = useState<Page | "notfound">(pageFromHash);
  const [member, setMember] = useState<Member | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const lastContentPage = useRef<Page>("home");
  const returnAfterAuth = useRef<Page>("account");
  const previousPage = useRef<Page | "notfound">(page);
  const toastId = useRef(0);
  const main = useRef<HTMLElement>(null);

  const authPage = page === "login" || page === "register" || page === "forgot";
  const adminPage = page === "admin";
  const partnerPage = page === "partner";

  const navigate = useCallback((target: Page) => { window.location.hash = ROUTES[target]; }, []);
  const notify = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-2), { id, text }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3400);
  }, []);

  /* Tema renkleri */
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--bg", settings.theme.bg);
    root.setProperty("--card", settings.theme.card);
    root.setProperty("--gold", settings.theme.gold);
    root.setProperty("--gold-light", settings.theme.goldLight);
    root.setProperty("--gold-dark", settings.theme.goldDark);
    root.setProperty("--text", settings.theme.text);
    root.setProperty("--muted", settings.theme.muted);
  }, [settings.theme]);

  useEffect(() => {
    const update = () => { captureAffiliateRef(); setPage(pageFromHash()); };
    captureAffiliateRef();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  useEffect(() => {
    if (adminPage) return;
    document.title = `${page === "notfound" ? "Sayfa Bulunamadı" : PAGE_TITLES[page]} | ${settings.brandName} ${settings.brandSub}`;
  }, [page, adminPage, settings.brandName, settings.brandSub]);

  useEffect(() => {
    const previous = previousPage.current;
    if (previous !== page) {
      if (authPage && previous !== "notfound" && (ACCOUNT_PAGES.includes(previous) || previous === "coupon")) returnAfterAuth.current = previous;
      window.scrollTo({ top: 0 });
      setGame(null); setPromotion(null); setActionError("");
    }
    if (!authPage && !adminPage && page !== "menu" && page !== "notfound") lastContentPage.current = page;
    previousPage.current = page;
  }, [page, authPage, adminPage]);

  /* Oturum kontrolü */
  useEffect(() => {
    let active = true;
    service<{ member?: unknown }>("session")
      .then((result) => { if (active && isMember(result?.member)) setMember(result.member); })
      .catch(() => {});
    return () => { active = false; };
  }, [store.sessionId, store.members]);

  /* Yayından kalkan seçimleri kupondan düşür */
  useEffect(() => {
    setSelections((current) => current.filter((item) =>
      content.matches.some((match) => match.id === item.match.id && match.odds[item.pick] === item.odd)));
  }, [content.matches]);

  const toggleMenu = () => navigate(page === "menu" ? lastContentPage.current : "menu");

  const onPick = (match: Match, pick: number) => {
    const exists = selections.some((item) => item.match.id === match.id && item.pick === pick);
    setSelections((current) => exists
      ? current.filter((item) => item.match.id !== match.id)
      : [...current.filter((item) => item.match.id !== match.id), { match, pick, odd: match.odds[pick] }]);
    notify(exists ? "Seçim kupondan çıkarıldı." : "Kupona eklendi.");
  };

  const onAuthenticated = (next: Member) => {
    setMember(next); notify("Hesabınıza giriş yaptınız.");
    navigate(returnAfterAuth.current); returnAfterAuth.current = "account";
  };

  const logout = async () => {
    try { await service("logout"); setMember(null); setSelections([]); navigate("home"); notify("Oturumunuz kapatıldı."); }
    catch { notify("Oturum kapatılamadı."); }
  };

  const actOnContent = async () => {
    if (!member) {
      setGame(null); setPromotion(null);
      returnAfterAuth.current = page !== "notfound" && page !== "admin" ? page : "account";
      navigate("login"); return;
    }
    setActionBusy(true); setActionError("");
    try {
      if (game) {
        const result = await service<{ url: string }>("launchGame", { gameId: game.id });
        const url = safeUrl(result?.url);
        if (!url) throw new Error("Oyun adresi doğrulanamadı.");
        window.open(url, "_blank", "noopener,noreferrer");
        setGame(null);
      } else if (promotion) {
        await service("claimPromotion", { promotionId: promotion.id });
        setPromotion(null); notify("Bonus talebiniz alındı.");
      }
    } catch (failure) { setActionError((failure as Error).message); }
    finally { setActionBusy(false); }
  };

  if (adminPage) return <Admin onExit={() => navigate("home")} />;
  if (page === "files") return <DownloadPackage />;
  if (partnerPage) {
    document.title = `Affiliate Paneli | ${settings.brandName}`;
    return <AffiliatePortal />;
  }

  return (
    <div className={`site-shell lux ${authPage ? "is-auth" : ""}`} style={{ "--corner-url": `url(${cornerUrl})` } as CSSProperties}>
      <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); main.current?.focus(); }}>İçeriğe geç</a>
      {settings.announcementActive && settings.announcement && !authPage && (
        <div className="lux-announce">✦ {settings.announcement} ✦</div>
      )}

      <Header page={page} member={member} settings={settings} onClose={() => navigate(lastContentPage.current)} onMenu={toggleMenu} />
      {!authPage && page !== "menu" && <QuickLinks settings={settings} navigate={navigate} />}

      {!authPage && page !== "menu" && (
        <nav className="top-navigation" aria-label="Ana menü">
          <div className="container top-navigation-inner">
            {TOP_NAV.map((item) => (
              <a key={item.page} href={href(item.page)} className={page === item.page ? "active" : ""}
                aria-current={page === item.page ? "page" : undefined}>{item.label}</a>
            ))}
          </div>
        </nav>
      )}

      {page === "menu" ? <MenuPage onClose={toggleMenu} couponCount={selections.length} />
        : authPage ? (
          <>
            {page === "login" && <LoginPage onAuthenticated={onAuthenticated} />}
            {page === "register" && <RegisterPage content={content} onAuthenticated={onAuthenticated} navigate={navigate} notify={notify} />}
            {page === "forgot" && <ForgotPage />}
          </>
        ) : (
          <main ref={main} id="main-content" tabIndex={-1} className={`main-content page-enter ${page === "home" ? "is-home" : "container"}`} key={page}>
            {page !== "home" && (
              <nav className="breadcrumbs" aria-label="Sayfa yolu">
                <a href={href("home")}>Ana Sayfa</a><span>/</span>
                <span>{page === "notfound" ? "Sayfa Bulunamadı" : PAGE_TITLES[page]}</span>
              </nav>
            )}
            {page === "home" && <HomePage content={content} settings={settings} navigate={navigate} onGame={setGame} />}
            {(page === "sports" || page === "live" || page === "virtual") && <SportsPage key={page} page={page} content={content} selections={selections} onPick={onPick} />}
            {(page === "slots" || page === "casino" || page === "games" || page === "aviator" || page === "highflyer" || page === "spaceman") && <GamesPage key={page} page={page} content={content} onGame={setGame} />}
            {page === "promos" && <PromotionsPage content={content} onOpen={setPromotion} />}
            {page === "coupon" && (
              <CouponPage selections={selections} member={member} navigate={navigate} notify={notify}
                onRemove={(id) => setSelections((current) => current.filter((item) => item.match.id !== id))}
                onClear={() => setSelections([])} />
            )}
            {page !== "notfound" && ACCOUNT_PAGES.includes(page) && (
              <AccountPage page={page} content={content} member={member} navigate={navigate} notify={notify}
                onMemberChange={setMember} onLogout={logout} />
            )}
            {page === "support" && <SupportPage content={content} settings={settings} />}
            {page === "contact" && <ContactPage />}
            {page === "payments" && <><PageHeading title="Ödeme Yöntemleri" eyebrow="YATIRIM VE ÇEKİM" /><PaymentMethods content={content} /></>}
            {(["about", "terms", "privacy", "responsible"] as string[]).includes(page) && (
              <div className="document-page">
                <PageHeading title={PAGE_TITLES[page as Page]} eyebrow={`${settings.brandName} ${settings.brandSub}`} />
                <LegalContent title={content.pages[page]?.title || ""} body={content.pages[page]?.body} />
                {page === "responsible" && <a className="button button-outline" href={href("limits")}><Icon name="clock" size={17} /> OYUN LİMİTLERİM</a>}
              </div>
            )}
            {page === "notfound" && (
              <EmptyState icon="search" title="Aradığınız sayfa bulunamadı." description="Sayfa kaldırılmış veya adresi değişmiş olabilir.">
                <a href={href("home")} className="button button-gold">ANA SAYFAYA DÖN</a>
              </EmptyState>
            )}
          </main>
        )}

      {!authPage && page !== "menu" && <Footer settings={settings} />}
      {!authPage && <BottomNav page={page} count={selections.length} onMenu={toggleMenu} />}
      {!authPage && <LiveChat settings={settings} />}

      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div className="toast" key={item.id}>
            <Icon name="check" size={17} /><span>{item.text}</span>
            <button onClick={() => setToasts((current) => current.filter((toast) => toast.id !== item.id))} aria-label="Bildirimi kapat">
              <Icon name="close" size={15} />
            </button>
          </div>
        ))}
      </div>

      {(game || promotion) && (
        <Dialog title={game?.title || promotion!.title} onClose={() => { if (!actionBusy) { setGame(null); setPromotion(null); } }}>
          <div className="content-detail">
            {game?.imageUrl
              ? <img src={game.imageUrl} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8 }} />
              : <Icon name={game ? "slots" : "gift"} size={45} />}
            <span className="eyebrow">{game?.provider || promotion?.badge || "SHALOM BET"}</span>
            {game && (
              <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.7 }}>
                {game.apiEndpoint ? "Bu oyun API üzerinden başlatılır." : game.url ? "Bu oyun bağlantı ile açılır." : "Bu oyun için henüz bağlantı veya API tanımlanmadı."}
              </p>
            )}
            {promotion && (
              <>
                <p>{promotion.description}</p>
                {promotion.terms && <><h3>KATILIM KOŞULLARI</h3><div className="promotion-terms">{promotion.terms}</div></>}
              </>
            )}
            {actionError && <Notice error>{actionError}</Notice>}
            <button className="button button-gold full-width" onClick={actOnContent} disabled={actionBusy}>
              {actionBusy ? <Spinner /> : !member ? "GİRİŞ YAP" : game ? "OYUNU AÇ" : "BONUSA KATIL"}
            </button>
          </div>
        </Dialog>
      )}

      {/* Canlı destek sağlayıcısı yönetim panelinden bağlanır. */}
      <div id="canli-destek-alani" />
    </div>
  );
}
