/// <reference lib="es2021.intl" />
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export type { CountryCode };
export { getCountryCallingCode, parsePhoneNumberFromString };

const names = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["tr"], { type: "region" }) : null;
export const COUNTRIES = getCountries().map((code) => ({
  code,
  name: names?.of(code) || code,
  dial: `+${getCountryCallingCode(code)}`,
  flag: String.fromCodePoint(...code.split("").map((letter) => letter.charCodeAt(0) + 127397)),
})).sort((a, b) => a.code === b.code ? 0 : a.code === "TR" ? -1 : b.code === "TR" ? 1 : a.name.localeCompare(b.name, "tr"));

export const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const searchText = (value: string) => value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");

export interface RegistrationData {
  firstName: string;
  middleName: string;
  lastName: string;
  username: string;
  email: string;
  country: CountryCode;
  phone: string;
  day: string;
  month: string;
  year: string;
  password: string;
  confirmPassword: string;
  promoCode: string;
  terms: boolean;
}

export const INITIAL_REGISTRATION: RegistrationData = {
  firstName: "", middleName: "", lastName: "", username: "", email: "", country: "TR",
  phone: "", day: "", month: "", year: "", password: "", confirmPassword: "", promoCode: "", terms: false,
};

export type FormErrors = Record<string, string>;
export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
const validName = (value: string) => /^[\p{L}\p{M}][\p{L}\p{M} '\-]*$/u.test(value.trim());
export const validPassword = (value: string) => value.length >= 8 && /\p{L}/u.test(value) && /\d/.test(value);
const padded = (value: number | string) => String(value).padStart(2, "0");
export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

// Clamp February 29 rather than letting Date roll the cutoff forward to March.
export function adultCutoff(today = new Date()) {
  const year = today.getFullYear() - 18;
  const month = today.getMonth() + 1;
  const day = Math.min(today.getDate(), daysInMonth(year, month));
  return { year, month, day, iso: `${year}-${padded(month)}-${padded(day)}` };
}

export function birthDate(data: Pick<RegistrationData, "year" | "month" | "day">): string | null {
  if (!data.year || !data.month || !data.day) return null;
  const year = Number(data.year), month = Number(data.month), day = Number(data.day);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)
    || year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${padded(month)}-${padded(day)}`;
}

export function nationalPhone(value: string, country: CountryCode): string {
  const parsed = parsePhoneNumberFromString(value, { defaultCountry: country, extract: false });
  return parsed?.isValid() && parsed.countryCallingCode === getCountryCallingCode(country)
    ? parsed.formatInternational().replace(`+${parsed.countryCallingCode}`, "").trim()
    : value;
}

export function isAdult(data: Pick<RegistrationData, "year" | "month" | "day">, today = new Date()) {
  const date = birthDate(data);
  return !!date && date <= adultCutoff(today).iso;
}

export function validateRegistration(data: RegistrationData, step: 1 | 2, today = new Date()): FormErrors {
  const errors: FormErrors = {};
  if (step === 1) {
    if (!validName(data.firstName)) errors.firstName = "Adınızı geçerli Türkçe karakterlerle girin.";
    if (data.middleName.trim() && !validName(data.middleName)) errors.middleName = "İkinci isminizi kontrol edin.";
    if (!validName(data.lastName)) errors.lastName = "Soyadınızı girin.";
    if (!/^[a-zA-Z0-9_.]{3,24}$/.test(data.username.trim())) errors.username = "3-24 karakter kullanın: harf, rakam, nokta veya alt çizgi.";
    if (!validEmail(data.email)) errors.email = "Geçerli bir e-posta adresi girin.";
  } else {
    const phone = parsePhoneNumberFromString(data.phone, { defaultCountry: data.country, extract: false });
    if (!phone?.isValid() || phone.countryCallingCode !== getCountryCallingCode(data.country)) {
      errors.phone = "Seçtiğiniz ülkeye ait geçerli bir telefon numarası girin.";
    }
    if (!birthDate(data)) errors.birthDate = "Gün, ay ve yıl alanlarını eksiksiz doldurun.";
    else if (!isAdult(data, today)) errors.birthDate = "Kayıt olmak için 18 yaşını doldurmuş olmalısınız.";
    if (!validPassword(data.password)) errors.password = "Şifreniz en az 8 karakter, bir harf ve bir rakam içermeli.";
    if (data.password !== data.confirmPassword) errors.confirmPassword = "Şifreler birbiriyle eşleşmiyor.";
    if (!data.terms) errors.terms = "Devam etmek için yaş ve kullanım şartları onayını işaretleyin.";
  }
  return errors;
}

export function registrationPayload(data: RegistrationData) {
  return {
    firstName: data.firstName.trim(), middleName: data.middleName.trim(), lastName: data.lastName.trim(),
    username: data.username.trim(), email: data.email.trim(), country: data.country,
    phone: parsePhoneNumberFromString(data.phone, data.country)?.number,
    birthDate: birthDate(data), password: data.password, promoCode: data.promoCode.trim(), acceptedTerms: data.terms,
  };
}