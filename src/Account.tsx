import { useEffect, useState, type FormEvent } from "react";
import { CountrySelect, PhoneField } from "./Auth";
import { ACCOUNT_PAGES, PAGE_TITLES, href, type Page } from "./navigation";
import { COUNTRIES, getCountryCallingCode, nationalPhone, parsePhoneNumberFromString, validEmail, validPassword, type CountryCode } from "./registration";
import { isMember, money, safeUrl, service, validRecords, type AccountRecord, type Member, type PaymentMethod, type SiteContent } from "./platform";
import { Dialog, EmptyState, Field, Icon, Notice, PageHeading, PasswordField, Spinner, type IconName } from "./ui";

const ACCOUNT_ICONS: Partial<Record<Page, IconName>> = {
  account: "user", deposit: "deposit", withdraw: "withdraw", transactions: "history", bets: "ticket",
  bonuses: "gift", settings: "settings", security: "lock", verification: "shield", messages: "mail", limits: "clock",
};
const METHOD_ICONS: Record<PaymentMethod["kind"], IconName> = { bank: "bank", wallet: "wallet", crypto: "coin", card: "card" };

interface AccountProps {
  page: Page;
  content: SiteContent;
  member: Member | null;
  navigate: (page: Page) => void;
  notify: (message: string) => void;
  onMemberChange: (member: Member) => void;
  onLogout: () => void;
}

export function LoginNotice() {
  return <div className="login-notice"><span><Icon name="lock" size={18} /> Hesap işlemleriniz için giriş yapın.</span><a href={href("login")}>GİRİŞ YAP <Icon name="arrow" size={15} /></a></div>;
}

function AccountOverview({ member }: { member: Member | null }) {
  return <><section className="balance-panel"><div><span className="eyebrow">{member ? "KULLANILABİLİR BAKİYE" : "SHALOM BET HESABINIZ"}</span><h2>{member ? money(member.balance) : "Tüm işlemleriniz, tek bir yerde."}</h2><p>{member ? `Hoş geldiniz, ${member.username}` : "Hesabınıza giriş yaparak bakiyenizi ve işlemlerinizi görüntüleyin."}</p></div><div className="balance-actions"><a href={href("deposit")} className="button balance-primary"><Icon name="plus" size={18} /> PARA YATIR</a><a href={href("withdraw")} className="button balance-secondary">PARA ÇEK <Icon name="arrow" size={17} /></a></div><span className="balance-watermark" aria-hidden="true">S</span></section><div className="account-shortcuts">{(["bets", "transactions", "settings", "security", "verification", "messages", "limits"] as Page[]).map((page) => <a key={page} href={href(page)}><Icon name={ACCOUNT_ICONS[page] || "document"} /><span>{PAGE_TITLES[page]}</span><Icon name="arrow" size={17} /></a>)}</div></>;
}

function validIban(input: string) {
  const iban = input.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("TR") && iban.length !== 26) return false;
  const digits = `${iban.slice(4)}${iban.slice(0, 4)}`.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  return [...digits].reduce((remainder, digit) => (remainder * 10 + Number(digit)) % 97, 0) === 1;
}

export function PaymentMethods({ content }: { content: SiteContent }) {
  const methods = content.paymentMethods.filter((method) => method.deposit || method.withdraw);
  return methods.length ? <div className="payment-methods">{methods.map((method) => <a key={method.id} href={href(method.deposit ? "deposit" : "withdraw")} className="payment-method"><span className="method-icon"><Icon name={METHOD_ICONS[method.kind]} size={25} /></span><span><strong>{method.name}</strong><small>{method.description}</small></span><Icon name="arrow" size={19} /></a>)}</div> : <EmptyState icon="wallet" title="Henüz ödeme yöntemi eklenmedi." description="Kullanılabilir ödeme yöntemleri bu alanda listelenecek." />;
}

function PaymentPage({ mode, content, member, navigate, onMemberChange }: { mode: "deposit" | "withdraw" } & Pick<AccountProps, "content" | "member" | "navigate" | "onMemberChange">) {
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const methods = content.paymentMethods.filter((method) => method[mode]);
  const method = methods.find((item) => item.id === methodId);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setSuccess("");
    if (!member) { navigate("login"); return; }
    if (!method) { setError("Bir ödeme yöntemi seçin."); return; }
    const value = Number(amount.replace(",", "."));
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(amount) || !Number.isFinite(value) || value < method.minimum || value > method.maximum) { setError(`Tutar ${money(method.minimum)} ile ${money(method.maximum)} arasında olmalıdır.`); return; }
    if (mode === "withdraw" && value > member.balance) { setError("Kullanılabilir bakiyeniz bu tutar için yeterli değil."); return; }
    if (mode === "withdraw" && method.kind === "bank" && !validIban(destination)) { setError("Geçerli bir IBAN girin."); return; }
    if (mode === "withdraw" && ["crypto", "wallet"].includes(method.kind) && destination.trim().length < 6) { setError("Alıcı hesap bilgilerinizi eksiksiz girin."); return; }
    setBusy(true);
    try {
      const result = await service<{ redirectUrl?: string; member?: unknown }>(mode, { methodId, amount: value, destination: mode === "withdraw" ? destination.trim() : undefined });
      if (result?.redirectUrl) {
        const url = safeUrl(result.redirectUrl);
        if (!url) throw new Error("Ödeme adresi doğrulanamadı. Lütfen tekrar deneyin.");
        window.location.assign(url);
      } else {
        setSuccess(mode === "deposit" ? "Yatırım talebiniz alındı. İşlem geçmişinden takip edebilirsiniz." : "Çekim talebiniz alındı. İşlem geçmişinden takip edebilirsiniz.");
        setAmount(""); setDestination("");
      }
      if (isMember(result?.member)) onMemberChange(result.member);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  if (!methods.length) return <><EmptyState icon={mode === "deposit" ? "bank" : "withdraw"} title={mode === "deposit" ? "Aktif yatırım yöntemi bulunmuyor." : "Aktif çekim yöntemi bulunmuyor."} description="Kullanılabilir ödeme yöntemleri eklendiğinde burada görüntülenecek." /><div className="page-bottom-link"><a href={href("transactions")}>İşlem geçmişini görüntüle <Icon name="arrow" size={17} /></a></div></>;
  return <form className="payment-form" noValidate onSubmit={submit}><h2 className="small-heading">ÖDEME YÖNTEMİ SEÇİN</h2><div className="payment-methods">{methods.map((item) => <button type="button" className={`payment-method ${methodId === item.id ? "selected" : ""}`} key={item.id} aria-pressed={methodId === item.id} onClick={() => { setMethodId(item.id); setDestination(""); setError(""); setSuccess(""); }}><span className="method-icon"><Icon name={METHOD_ICONS[item.kind]} size={25} /></span><span><strong>{item.name}</strong><small>{item.description}</small></span><Icon name={methodId === item.id ? "check" : "arrow"} size={19} /></button>)}</div>{method && <div className="payment-fields"><Field label="İşlem Tutarı" placeholder="0,00" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} suffix={<span className="input-currency">TRY</span>} /><span className="field-help">Alt limit: {money(method.minimum)} / Üst limit: {money(method.maximum)}</span>{mode === "withdraw" && method.kind !== "card" && <Field label={method.kind === "bank" ? "IBAN" : method.kind === "crypto" ? "Alıcı Cüzdan Adresi" : "Alıcı Hesap Numarası"} placeholder={method.kind === "bank" ? "IBAN numaranızı girin" : "Alıcı bilgilerini girin"} value={destination} onChange={(event) => setDestination(event.target.value)} autoComplete="off" />}{error && <Notice error>{error}</Notice>}{success && <Notice>{success}</Notice>}<button className="button button-gold full-width" type="submit" disabled={busy}>{busy ? <Spinner /> : mode === "deposit" ? "PARA YATIR" : "ÇEKİM TALEBİ OLUŞTUR"}</button><p className="field-help">İşlemler yalnızca adınıza kayıtlı ödeme hesaplarıyla yapılabilir.</p></div>}</form>;
}

function HistoryPage({ kind, member }: { kind: "transactions" | "bets" | "bonuses" | "messages"; member: Member | null }) {
  const [items, setItems] = useState<AccountRecord[]>([]);
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [opened, setOpened] = useState<AccountRecord | null>(null);
  useEffect(() => {
    let active = true;
    setItems([]); setError(""); setStatus("all");
    if (!member) { setLoading(false); return; }
    setLoading(true);
    service<unknown>(kind).then((result) => { if (active) setItems(validRecords(result)); }).catch((failure) => { if (active) setError((failure as Error).message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, member?.id, retry]);
  const statuses = kind === "messages" ? [["all", "Tümü"], ["unread", "Okunmamış"]] : [["all", "Tümü"], ["pending", "Bekleyen"], ["completed", "Tamamlanan"], ["cancelled", "İptal Edilen"]];
  const visible = items.filter((item) => (status === "all" || item.status === status) && (period === "all" || Date.parse(item.date) >= Date.now() - Number(period) * 86400000));
  const empty: Record<typeof kind, { icon: IconName; title: string }> = { transactions: { icon: "history", title: "Henüz bir işlem bulunmuyor." }, bets: { icon: "ticket", title: "Henüz bir bahis bulunmuyor." }, bonuses: { icon: "gift", title: "Aktif bonusunuz bulunmuyor." }, messages: { icon: "mail", title: "Henüz mesajınız bulunmuyor." } };
  return <><div className="history-filters"><div className="filter-tabs">{statuses.map(([id, label]) => <button type="button" key={id} aria-pressed={status === id} className={status === id ? "active" : ""} onClick={() => setStatus(id)}>{label}</button>)}</div><select className="simple-select" aria-label="Tarih aralığı" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option><option value="all">Tüm geçmiş</option></select></div>{loading ? <div className="loading-state"><Spinner /><span>Bilgileriniz yükleniyor.</span></div> : error ? <><Notice error>{error}</Notice><button className="button button-outline" onClick={() => setRetry(retry + 1)}>TEKRAR DENE</button></> : visible.length ? <div className="record-list">{visible.map((item) => <button className="record-row" key={item.id} onClick={() => setOpened(item)}><span><strong>{item.title}</strong><small>{new Date(item.date).toLocaleDateString("tr-TR")} / {statuses.find(([id]) => id === item.status)?.[1]}</small></span>{typeof item.amount === "number" && <b>{money(item.amount)}</b>}<Icon name="arrow" size={17} /></button>)}</div> : <EmptyState {...empty[kind]} description={member ? "Kayıtlarınız bu alanda görüntülenecek." : "Bilgilerinizi görüntülemek için hesabınıza giriş yapın."} />}{opened && <Dialog title={opened.title} onClose={() => setOpened(null)}><p className="form-description">{opened.description}</p><span className="field-help">{new Date(opened.date).toLocaleString("tr-TR")}</span></Dialog>}</>;
}

function ProfileForm({ member, onMemberChange }: Pick<AccountProps, "member" | "onMemberChange">) {
  const [firstName, setFirstName] = useState(member?.firstName || "");
  const [lastName, setLastName] = useState(member?.lastName || "");
  const [email, setEmail] = useState(member?.email || "");
  const [country, setCountry] = useState<CountryCode>(COUNTRIES.some((item) => item.code === member?.country) ? member!.country as CountryCode : "TR");
  const [phone, setPhone] = useState(nationalPhone(member?.phone || "", country));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (!member) return;
    const selectedCountry = COUNTRIES.some((item) => item.code === member.country) ? member.country as CountryCode : "TR";
    setFirstName(member.firstName); setLastName(member.lastName); setEmail(member.email);
    setCountry(selectedCountry); setPhone(nationalPhone(member.phone, selectedCountry));
  }, [member]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setSuccess(false);
    if (!member) return;
    const number = parsePhoneNumberFromString(phone, { defaultCountry: country, extract: false });
    if (!firstName.trim() || !lastName.trim() || !validEmail(email) || !number?.isValid() || number.countryCallingCode !== getCountryCallingCode(country)) { setError("Ad, soyad, e-posta ve telefon bilgilerinizi kontrol edin."); return; }
    setBusy(true);
    try {
      const result = await service<{ member: unknown }>("updateProfile", { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), country, phone: parsePhoneNumberFromString(phone, country)?.number });
      if (!isMember(result?.member)) throw new Error("Bilgileriniz doğrulanamadı. Lütfen tekrar deneyin.");
      onMemberChange(result.member); setSuccess(true);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  return <form className="standard-form" onSubmit={submit} noValidate><fieldset disabled={!member || busy}><div className="form-two-columns"><Field label="Adı" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" /><Field label="Soyadı" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" /></div><Field label="Kullanıcı Adı" value={member?.username || ""} readOnly /><Field label="E-posta" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" /><div className="field"><span className="field-label">Ülke</span><CountrySelect value={country} onChange={setCountry} disabled={!member || busy} /></div><PhoneField country={country} phone={phone} onCountryChange={setCountry} onChange={setPhone} disabled={!member || busy} />{error && <Notice error>{error}</Notice>}{success && <Notice>Hesap bilgileriniz güncellendi.</Notice>}<button className="button button-gold full-width" type="submit">{busy ? <Spinner /> : "DEĞİŞİKLİKLERİ KAYDET"}</button></fieldset></form>;
}

function SecurityForm({ member }: { member: Member | null }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setSuccess(false);
    if (!current || !validPassword(password)) { setError("Mevcut şifrenizi girin. Yeni şifreniz en az 8 karakter, bir harf ve bir rakam içermeli."); return; }
    if (password !== repeat) { setError("Yeni şifreler birbiriyle eşleşmiyor."); return; }
    if (current === password) { setError("Yeni şifreniz mevcut şifrenizden farklı olmalıdır."); return; }
    setBusy(true);
    try { await service("updatePassword", { currentPassword: current, newPassword: password }); setCurrent(""); setPassword(""); setRepeat(""); setSuccess(true); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  return <form className="standard-form" noValidate onSubmit={submit}><p className="form-description">Hesabınızı korumak için güçlü ve size özel bir şifre kullanın.</p><fieldset disabled={!member || busy}><PasswordField label="Mevcut Şifre" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} /><PasswordField label="Yeni Şifre" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><PasswordField label="Yeni Şifre Tekrar" autoComplete="new-password" value={repeat} onChange={(event) => setRepeat(event.target.value)} />{error && <Notice error>{error}</Notice>}{success && <Notice>Şifreniz güncellendi.</Notice>}<button type="submit" className="button button-gold full-width">{busy ? <Spinner /> : "ŞİFREYİ GÜNCELLE"}</button></fieldset></form>;
}

function VerificationForm({ member }: { member: Member | null }) {
  const [kind, setKind] = useState("identity");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setSuccess(false);
    if (!file) { setError("Yüklemek istediğiniz belgeyi seçin."); return; }
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("En fazla 5 MB boyutunda JPG, PNG veya PDF dosyası seçin."); return; }
    setBusy(true);
    try { const payload = new FormData(); payload.append("kind", kind); payload.append("document", file); await service("verifyIdentity", payload); setSuccess(true); setFile(null); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  return <form className="standard-form" noValidate onSubmit={submit}><p className="form-description">Kimlik doğrulaması için adınıza düzenlenmiş, okunaklı bir belge yükleyin.</p><fieldset disabled={!member || busy}><label className="field"><span className="field-label">Belge Türü</span><select className="simple-select" value={kind} onChange={(event) => setKind(event.target.value)}><option value="identity">Kimlik kartı</option><option value="passport">Pasaport</option><option value="license">Sürücü belgesi</option></select></label><label className="upload-field"><Icon name="upload" size={30} /><strong>{file?.name || "Belge seçmek için tıklayın"}</strong><span>JPG, PNG veya PDF / En fazla 5 MB</span><input key={success ? "sent" : "new"} type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => { setFile(event.target.files?.[0] || null); setSuccess(false); }} aria-label="Kimlik belgesi seç" /></label>{error && <Notice error>{error}</Notice>}{success && <Notice>Belgeniz inceleme için alındı.</Notice>}<button className="button button-gold full-width" type="submit">{busy ? <Spinner /> : "BELGEYİ GÖNDER"}</button></fieldset></form>;
}

function LimitsForm({ member, onLogout }: Pick<AccountProps, "member" | "onLogout">) {
  const [deposit, setDeposit] = useState("");
  const [duration, setDuration] = useState("");
  const [exclusion, setExclusion] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setSuccess(false);
    if (!deposit || !/^\d+(?:[.,]\d{1,2})?$/.test(deposit) || Number(deposit.replace(",", ".")) <= 0 || !duration) { setError("Geçerli bir günlük yatırım limiti ve oturum süresi seçin."); return; }
    setBusy(true);
    try { await service("updateLimits", { depositLimit: Number(deposit.replace(",", ".")), sessionMinutes: Number(duration) }); setSuccess(true); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  const exclude = async () => {
    if (!confirmed) return;
    setBusy(true); setError("");
    try { await service("selfExclude", { days: 30 }); setExclusion(false); onLogout(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  return <><form className="standard-form" onSubmit={save} noValidate><p className="form-description">Oyun kontrolü sizde kalsın. Kendinize zaman ve bütçe sınırları belirleyin.</p><fieldset disabled={!member || busy}><Field label="Günlük Yatırım Limiti (TRY)" placeholder="Tutar girin" inputMode="decimal" value={deposit} onChange={(event) => setDeposit(event.target.value)} /><label className="field"><span className="field-label">Oturum Süresi</span><select className="simple-select" value={duration} onChange={(event) => setDuration(event.target.value)}><option value="">Süre seçin</option><option value="30">30 dakika</option><option value="60">1 saat</option><option value="120">2 saat</option></select></label>{!exclusion && error && <Notice error>{error}</Notice>}{success && <Notice>Limitleriniz güncellendi.</Notice>}<button className="button button-gold full-width" type="submit">{busy ? <Spinner /> : "LİMİTLERİ KAYDET"}</button></fieldset></form><div className="self-exclude"><h2>Oyuna ara verin</h2><p>Hesabınıza erişimi 30 gün boyunca kısıtlamak için ara verme talebi oluşturabilirsiniz.</p><button className="button button-outline" disabled={!member} onClick={() => { setConfirmed(false); setError(""); setExclusion(true); }}>ARA VERME TALEBİ</button></div>{exclusion && <Dialog title="Oyuna Ara Ver" onClose={() => { if (!busy) setExclusion(false); }}><p className="form-description">Onaylanan talep sonrasında hesabınıza 30 gün boyunca giriş yapamazsınız. Bu süre içinde kısıtlama kaldırılamaz.</p><label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>30 gün ara vermek istediğimi onaylıyorum.</span></label>{error && <Notice error>{error}</Notice>}<button className="button button-gold full-width" disabled={!confirmed || busy} onClick={exclude}>{busy ? <Spinner /> : "TALEBİ ONAYLA"}</button></Dialog>}</>;
}

export function AccountPage(props: AccountProps) {
  const { page, member, onLogout } = props;
  return <section className="account-layout"><aside className="account-sidebar"><div className="account-sidebar-heading"><Icon name="user" /><span>{member?.username || "HESAP İŞLEMLERİ"}</span></div><nav aria-label="Hesap menüsü">{ACCOUNT_PAGES.map((item) => <a key={item} href={href(item)} className={page === item ? "active" : ""} aria-current={page === item ? "page" : undefined}><Icon name={ACCOUNT_ICONS[item] || "document"} size={19} /><span>{PAGE_TITLES[item]}</span></a>)}</nav>{member && <button className="account-logout" onClick={onLogout}><Icon name="logout" size={19} /> Çıkış Yap</button>}</aside><div className="account-main"><PageHeading title={PAGE_TITLES[page]} eyebrow="HESAP İŞLEMLERİ" />{!member && <LoginNotice />}{page === "account" && <AccountOverview member={member} />}{(page === "deposit" || page === "withdraw") && <PaymentPage key={page} mode={page} {...props} />}{(["transactions", "bets", "bonuses", "messages"] as Page[]).includes(page) && <HistoryPage key={page} kind={page as "transactions" | "bets" | "bonuses" | "messages"} member={member} />}{page === "settings" && <ProfileForm {...props} />}{page === "security" && <SecurityForm member={member} />}{page === "verification" && <VerificationForm member={member} />}{page === "limits" && <LimitsForm member={member} onLogout={onLogout} />}</div></section>;
}