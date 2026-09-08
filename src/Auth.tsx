import { useEffect, useRef, useState, type FormEvent } from "react";
import emblemUrl from "./assets/logo.png";
import { COUNTRIES, INITIAL_REGISTRATION, MONTHS, adultCutoff, birthDate, daysInMonth, getCountryCallingCode, parsePhoneNumberFromString, registrationPayload, searchText, validateRegistration, validEmail, type CountryCode, type FormErrors, type RegistrationData } from "./registration";
import { isMember, service, type Member, type SiteContent } from "./platform";
import { href, type Page } from "./navigation";
import { captureAffiliateRef, findAffiliateByRef } from "./store";
import { Dialog, Field, Icon, LegalContent, Notice, PasswordField, Spinner } from "./ui";

export function CountrySelect({ value, onChange, compact = false, disabled = false }: { value: CountryCode; onChange: (value: CountryCode) => void; compact?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const country = COUNTRIES.find((item) => item.code === value) || COUNTRIES[0];
  const choices = COUNTRIES.filter((item) => searchText(`${item.name} ${item.code} ${item.dial}`).includes(searchText(query)));
  return <>
    <button type="button" className={compact ? "phone-prefix" : "country-select"} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={`${compact ? "Telefon ülkesi" : "Ülke"}: ${country.name}, ${country.dial}`} onClick={() => { setQuery(""); setOpen(true); }}>
      <span className="country-flag" aria-hidden="true">{country.flag}</span>
      <span>{compact ? country.dial : country.name}</span>
      {!compact && <span className="country-dial">{country.dial}</span>}
      <Icon name="chevron" size={16} />
    </button>
    {open && <Dialog title="Ülke Seçin" onClose={() => setOpen(false)} className="country-dialog">
      <div className="country-search"><Icon name="search" size={19} /><input data-autofocus type="search" placeholder="Ülke veya telefon kodu ara" aria-label="Ülke veya telefon kodu ara" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); document.querySelector<HTMLButtonElement>(".country-options button")?.focus(); } }} /></div>
      <div className="country-options" role="listbox" aria-label="Ülkeler" onKeyDown={(event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }}>
        {choices.map((item) => <button key={item.code} type="button" role="option" aria-selected={item.code === value} onClick={() => { onChange(item.code); setOpen(false); }}><span className="country-flag" aria-hidden="true">{item.flag}</span><span>{item.name}</span><span className="country-dial">{item.dial}</span>{item.code === value && <Icon name="check" size={18} />}</button>)}
        {choices.length === 0 && <p className="no-results">Aramanızla eşleşen ülke bulunamadı.</p>}
      </div>
    </Dialog>}
  </>;
}

export function PhoneField({ country, phone, onCountryChange, onChange, error, disabled = false }: { country: CountryCode; phone: string; onCountryChange: (country: CountryCode) => void; onChange: (phone: string) => void; error?: string; disabled?: boolean }) {
  return <div className="field"><label className="field-label" htmlFor="phone-number">Telefon Numarası</label><div className={`phone-control ${error ? "invalid" : ""}`}><CountrySelect compact value={country} onChange={onCountryChange} disabled={disabled} /><input id="phone-number" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="Telefon numaranız" value={phone} disabled={disabled} maxLength={23} aria-invalid={!!error} aria-describedby={error ? "phone-error" : undefined} onChange={(event) => {
    const value = event.target.value.replace(/[^\d\s()+-]/g, "");
    const prefix = `+${getCountryCallingCode(country)}`;
    onChange(value.startsWith(prefix) ? value.slice(prefix.length).trimStart() : value);
  }} onPaste={(event) => {
    const value = event.clipboardData.getData("text").trim().replace(/^00/, "+");
    if (!value.startsWith("+")) return;
    const parsed = parsePhoneNumberFromString(value);
    if (!parsed?.isValid() || !parsed.country) return;
    event.preventDefault();
    onCountryChange(parsed.country);
    onChange(parsed.formatInternational().replace(`+${parsed.countryCallingCode}`, "").trim());
  }} onBlur={() => {
    const parsed = parsePhoneNumberFromString(phone, { defaultCountry: country, extract: false });
    if (parsed?.isValid() && parsed.countryCallingCode === getCountryCallingCode(country)) onChange(parsed.formatInternational().replace(`+${parsed.countryCallingCode}`, "").trim());
  }} /></div>{error && <span className="field-error" id="phone-error">{error}</span>}</div>;
}

function focusFirstError(form: HTMLFormElement | null, errors: FormErrors) {
  const first = Object.keys(errors)[0];
  if (!first) return;
  const name = first === "birthDate" ? "year" : first;
  requestAnimationFrame(() => form?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus());
}

function BirthDateFields({ data, onChange, error }: { data: RegistrationData; onChange: (patch: Partial<RegistrationData>) => void; error?: string }) {
  const cutoff = adultCutoff();
  const years = Array.from({ length: cutoff.year - 1899 }, (_, index) => cutoff.year - index);
  const latestYear = Number(data.year) === cutoff.year;
  const dayCount = daysInMonth(Number(data.year) || 2000, Number(data.month) || 1);
  const update = (part: "day" | "month" | "year", value: string) => {
    const next = { ...data, [part]: value };
    if (Number(next.year) === cutoff.year && Number(next.month) > cutoff.month) { next.month = ""; next.day = ""; }
    if (Number(next.day) > daysInMonth(Number(next.year) || 2000, Number(next.month) || 1)) next.day = "";
    if (Number(next.year) === cutoff.year && Number(next.month) === cutoff.month && Number(next.day) > cutoff.day) next.day = "";
    onChange({ day: next.day, month: next.month, year: next.year });
  };
  return <fieldset className="birth-field"><legend className="field-label">Doğum Tarihi</legend><div className={`date-selects ${error ? "invalid" : ""}`}>
    <label><span className="sr-only">Doğum günü</span><select name="day" aria-invalid={!!error} autoComplete="bday-day" value={data.day} onChange={(event) => update("day", event.target.value)}><option value="">Gün</option>{Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => <option key={day} value={day} disabled={latestYear && Number(data.month) === cutoff.month && day > cutoff.day}>{day}</option>)}</select><Icon name="chevron" size={16} /></label>
    <label><span className="sr-only">Doğum ayı</span><select name="month" aria-invalid={!!error} autoComplete="bday-month" value={data.month} onChange={(event) => update("month", event.target.value)}><option value="">Ay</option>{MONTHS.map((month, index) => <option key={month} value={index + 1} disabled={latestYear && index + 1 > cutoff.month}>{month}</option>)}</select><Icon name="chevron" size={16} /></label>
    <label><span className="sr-only">Doğum yılı</span><select name="year" aria-invalid={!!error} autoComplete="bday-year" value={data.year} onChange={(event) => update("year", event.target.value)}><option value="">Yıl</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select><Icon name="chevron" size={16} /></label>
  </div><input type="hidden" name="birthDate" value={birthDate(data) || ""} />{error ? <span className="field-error">{error}</span> : <span className="field-help">Kayıt olmak için 18 yaşını doldurmuş olmalısınız.</span>}</fieldset>;
}

export function SupportLink() {
  return <a className="auth-support" href={href("support")}><Icon name="support" size={20} /><span>DESTEK İLE İLETİŞİME GEÇİN</span></a>;
}

function AuthBrand() {
  return (
    <header className="auth-brand">
      <img src={emblemUrl} alt="" />
      <span className="auth-brand-text"><b>SHALOM</b><i>BET</i></span>
    </header>
  );
}

interface AuthProps {
  content: SiteContent;
  onAuthenticated: (member: Member) => void;
  navigate: (page: Page) => void;
  notify: (message: string) => void;
}

export function LoginPage({ onAuthenticated }: Pick<AuthProps, "onAuthenticated">) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: FormErrors = {};
    if (!username.trim()) next.username = "Kullanıcı adınızı girin.";
    if (!password) next.password = "Şifrenizi girin.";
    setErrors(next); setError("");
    if (Object.keys(next).length) { focusFirstError(form.current, next); return; }
    setBusy(true);
    try {
      const result = await service<{ member: unknown }>("login", { username: username.trim(), password, remember });
      if (!isMember(result?.member)) throw new Error("Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.");
      setPassword("");
      onAuthenticated(result.member);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  return <main className="auth-page login-page"><div className="auth-content"><AuthBrand /><div className="auth-intro"><p>Hesabınız var mı?</p><h1>HEMEN GİRİŞ YAPIN!</h1></div><form ref={form} noValidate onSubmit={submit} className="auth-form" aria-busy={busy}>
    <Field name="username" label="Kullanıcı Adı" placeholder="Kullanıcı Adı" hideLabel autoComplete="username" autoCapitalize="none" value={username} onChange={(event) => { setUsername(event.target.value); setErrors({ ...errors, username: "" }); }} error={errors.username} />
    <PasswordField name="password" label="Şifre" placeholder="Şifre" hideLabel autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors({ ...errors, password: "" }); }} error={errors.password} />
    <label className="checkbox-label"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Beni hatırla</span></label>
    {error && <Notice error>{error}</Notice>}
    <button className="button button-gold auth-submit" type="submit" disabled={busy}>{busy ? <><Spinner /> GİRİŞ YAPILIYOR</> : "GİRİŞ"}</button>
    <a href={href("forgot")} className="forgot-link">ŞİFRENİZİ Mİ UNUTTUNUZ?</a>
  </form></div><SupportLink /></main>;
}

export function RegisterPage({ content, onAuthenticated, navigate, notify }: AuthProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const affiliate = findAffiliateByRef(captureAffiliateRef());
  const [data, setData] = useState<RegistrationData>({ ...INITIAL_REGISTRATION, promoCode: affiliate?.promoCode || "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    const found = findAffiliateByRef(captureAffiliateRef());
    if (found) setData((prev) => ({ ...prev, promoCode: found.promoCode }));
  }, []);
  useEffect(() => {
    if (previousStep.current !== step) {
      form.current?.querySelector<HTMLElement>(step === 1 ? '[name="firstName"]' : 'button[aria-haspopup="dialog"]')?.focus({ preventScroll: true });
      previousStep.current = step;
    }
  }, [step]);
  const change = (patch: Partial<RegistrationData>) => {
    setData((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => {
      const next = { ...previous };
      Object.keys(patch).forEach((key) => delete next[key]);
      if ("country" in patch) delete next.phone;
      if ("day" in patch || "month" in patch || "year" in patch) delete next.birthDate;
      return next;
    });
    setError("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = validateRegistration(data, step);
    setErrors(next); setError("");
    if (Object.keys(next).length) { focusFirstError(form.current, next); return; }
    if (step === 1) { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const firstStepErrors = validateRegistration(data, 1);
    if (Object.keys(firstStepErrors).length) { setStep(1); setErrors(firstStepErrors); return; }
    setBusy(true);
    try {
      const locked = findAffiliateByRef(captureAffiliateRef());
      const result = await service<{ member?: unknown }>("register", registrationPayload({ ...data, promoCode: locked?.promoCode || data.promoCode }));
      setData({ ...INITIAL_REGISTRATION });
      if (isMember(result?.member)) onAuthenticated(result.member);
      else { notify("Kaydınız oluşturuldu. Hesabınıza giriş yapabilirsiniz."); navigate("login"); }
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  return <main className="auth-page register-page"><div className="auth-content"><AuthBrand /><div className="auth-intro"><p>Yeni üye misiniz?</p><h1>ŞİMDİ KAYDOLUN, HER ŞEY ÇOK KOLAY!</h1></div>
    {affiliate && <p className="identity-note">Ortak kaydı: {affiliate.name} · Kod {affiliate.promoCode}</p>}
    <h2 className="registration-step">KAYIT ADIMI {step}</h2><p className="identity-note">{step === 1 ? "İsminizi kimlikte göründüğü gibi eksiksiz ve Türkçe karakterlerle giriniz." : "İletişim bilgilerinizi tamamlayın ve hesabınız için güvenli bir şifre belirleyin."}</p>
    <form ref={form} noValidate className="auth-form" onSubmit={submit} aria-busy={busy}>
      {step === 1 ? <>
        <Field name="firstName" label="Adı" placeholder="Adı" hideLabel autoComplete="given-name" value={data.firstName} onChange={(event) => change({ firstName: event.target.value })} error={errors.firstName} maxLength={60} />
        <Field name="middleName" label="İkinci İsim (Varsa)" placeholder="İkinci İsim (Varsa)" hideLabel autoComplete="additional-name" value={data.middleName} onChange={(event) => change({ middleName: event.target.value })} error={errors.middleName} maxLength={60} />
        <Field name="lastName" label="Soyadı" placeholder="Soyadı" hideLabel autoComplete="family-name" value={data.lastName} onChange={(event) => change({ lastName: event.target.value })} error={errors.lastName} maxLength={60} />
        <Field name="username" label="Kullanıcı Adı" placeholder="Kullanıcı Adı" hideLabel autoComplete="username" autoCapitalize="none" value={data.username} onChange={(event) => change({ username: event.target.value })} error={errors.username} maxLength={24} />
        <Field name="email" label="E-posta" placeholder="E-posta" type="email" hideLabel autoComplete="email" autoCapitalize="none" value={data.email} onChange={(event) => change({ email: event.target.value })} error={errors.email} maxLength={254} />
      </> : <>
        <div className="field"><span className="field-label">Ülke</span><CountrySelect value={data.country} onChange={(country) => change({ country })} /></div>
        <PhoneField country={data.country} phone={data.phone} onCountryChange={(country) => change({ country })} onChange={(phone) => change({ phone })} error={errors.phone} />
        <BirthDateFields data={data} onChange={change} error={errors.birthDate} />
        <PasswordField name="password" label="Şifre" placeholder="Şifre" hideLabel autoComplete="new-password" value={data.password} onChange={(event) => change({ password: event.target.value })} error={errors.password} maxLength={128} />
        <PasswordField name="confirmPassword" label="Şifre Tekrar" placeholder="Şifre Tekrar" hideLabel autoComplete="new-password" value={data.confirmPassword} onChange={(event) => change({ confirmPassword: event.target.value })} error={errors.confirmPassword} maxLength={128} />
        <Field name="promoCode" label="Promosyon Kodu (Varsa)" placeholder="Promosyon Kodu (Varsa)" hideLabel autoComplete="off" value={data.promoCode} onChange={(event) => { if (!affiliate) change({ promoCode: event.target.value }); }} maxLength={40} readOnly={!!affiliate} />
        {affiliate && <p className="field-help">Bu kayıt <b>{affiliate.name}</b> ortaklığı ile açılıyor. Promo kodu: {affiliate.promoCode}</p>}
        <div><label className="checkbox-label terms-check"><input type="checkbox" name="terms" checked={data.terms} onChange={(event) => change({ terms: event.target.checked })} aria-invalid={!!errors.terms} /><span>18 yaşını doldurduğumu, <button type="button" onClick={(event) => { event.preventDefault(); setLegal("terms"); }}>Kullanım Şartları</button> ve <button type="button" onClick={(event) => { event.preventDefault(); setLegal("privacy"); }}>Gizlilik Politikası</button>'nı kabul ettiğimi onaylıyorum.</span></label>{errors.terms && <span className="field-error">{errors.terms}</span>}</div>
      </>}
      {error && <Notice error>{error}</Notice>}
      <div className="registration-footer"><div className="registration-actions">{step === 2 && <button type="button" className="button button-outline" disabled={busy} onClick={() => { setStep(1); setErrors({}); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Icon name="back" size={17} /> GERİ</button>}<button type="submit" className="button button-gold auth-submit" disabled={busy}>{busy ? <><Spinner /> BEKLEYİNİZ</> : step === 1 ? "SONRAKİ" : "KAYDI TAMAMLA"}</button></div><div className="registration-progress" role="progressbar" aria-label="Kayıt ilerlemesi" aria-valuenow={step * 50} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${step * 50}%` }} /></div></div>
    </form>
  </div><SupportLink />{legal && <Dialog title={legal === "terms" ? "Kullanım Şartları" : "Gizlilik Politikası"} onClose={() => setLegal(null)}><LegalContent title={content.pages[legal]?.title || ""} body={content.pages[legal]?.body} /></Dialog>}</main>;
}

export function ForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (!validEmail(email)) { setError("Geçerli bir e-posta adresi girin."); return; }
    setBusy(true);
    try { await service("resetPassword", { email: email.trim() }); setSent(true); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  return <main className="auth-page"><div className="auth-content"><AuthBrand /><div className="auth-intro"><p>Hesabınıza yeniden erişin</p><h1>ŞİFRENİZİ YENİLEYİN</h1></div>{sent ? <Notice>Bu e-posta adresine kayıtlı bir hesap varsa şifre yenileme bağlantısı gönderilecektir.</Notice> : <form className="auth-form" noValidate onSubmit={submit}><p className="form-description">Hesabınızda kullandığınız e-posta adresini girin.</p><Field label="E-posta" placeholder="E-posta" hideLabel type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />{error && <Notice error>{error}</Notice>}<button type="submit" className="button button-gold auth-submit" disabled={busy}>{busy ? <Spinner /> : "YENİLEME BAĞLANTISI GÖNDER"}</button></form>}<a className="back-link" href={href("login")}><Icon name="back" size={17} /> Giriş sayfasına dön</a></div><SupportLink /></main>;
}