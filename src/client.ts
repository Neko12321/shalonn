/* =========================================================================
   SHALOM BET — YEREL SERVİS İSTEMCİSİ
   Üyelik, bakiye ve talep işlemlerini yerel depo üzerinde yürütür.
   Gerçek arka uç bağlanacağı zaman uygulama yüklenmeden önce
   window.SHALOM_CLIENT tanımlanması yeterlidir; bu istemci devre dışı kalır.
   Not: Veriler tarayıcıda saklanır, bu bir sunucu güvenliği katmanı değildir.
   ========================================================================= */
import type { Member, ServiceAction, ServiceResponse } from "./platform";
import {
  addRecord, adjustBalance, captureAffiliateRef, findAffiliateByRef, getState, hashText, newId, setState, updateMember,
  type StoredMember,
} from "./store";

const ok = (data?: unknown): ServiceResponse => ({ ok: true, data });
const fail = (error: string): ServiceResponse => ({ ok: false, error });

const publicMember = (member: StoredMember): Member => ({
  id: member.id, username: member.username, firstName: member.firstName, lastName: member.lastName,
  email: member.email, country: member.country, phone: member.phone,
  balance: member.balance, bonusBalance: member.bonusBalance ?? 0,
});

const currentMember = () => {
  const { members, sessionId } = getState();
  return members.find((member) => member.id === sessionId) || null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value as Record<string, unknown> : {});

const asText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : NaN);

async function handle(action: ServiceAction, payload?: unknown): Promise<ServiceResponse> {
  const body = payload instanceof FormData ? {} : asRecord(payload);
  const member = currentMember();

  switch (action) {
    /* ------------------------------------------------------------ OTURUM */
    case "session":
      return member ? ok({ member: publicMember(member) }) : fail("Oturum bulunamadı.");

    case "login": {
      const username = asText(body.username).toLocaleLowerCase("tr-TR");
      const found = getState().members.find((entry) => entry.username.toLocaleLowerCase("tr-TR") === username);
      if (!found) return fail("Kullanıcı adı veya şifre hatalı.");
      if (found.status === "blocked") return fail("Hesabınız askıya alınmış. Lütfen destek ile iletişime geçin.");
      const hash = await hashText(asText(body.password));
      if (hash !== found.passwordHash) return fail("Kullanıcı adı veya şifre hatalı.");
      setState((current) => ({ ...current, sessionId: found.id }));
      return ok({ member: publicMember(found) });
    }

    case "register": {
      const username = asText(body.username);
      const email = asText(body.email);
      const members = getState().members;
      if (members.some((entry) => entry.username.toLocaleLowerCase("tr-TR") === username.toLocaleLowerCase("tr-TR"))) {
        return fail("Bu kullanıcı adı zaten kullanılıyor.");
      }
      if (members.some((entry) => entry.email.toLocaleLowerCase("tr-TR") === email.toLocaleLowerCase("tr-TR"))) {
        return fail("Bu e-posta adresi ile daha önce hesap oluşturulmuş.");
      }
      const promo = asText(body.promoCode) || captureAffiliateRef();
      const partner = findAffiliateByRef(promo);
      const created: StoredMember = {
        id: newId(), username, email,
        firstName: asText(body.firstName), lastName: asText(body.lastName),
        country: asText(body.country) || "TR", phone: asText(body.phone),
        balance: 0, bonusBalance: 0,
        passwordHash: await hashText(asText(body.password)),
        status: "active", createdAt: new Date().toISOString(),
        birthDate: asText(body.birthDate),
        promoCode: partner?.promoCode || promo,
        affiliateId: partner?.id,
      };
      setState((current) => ({ ...current, members: [created, ...current.members], sessionId: created.id }));
      addRecord({
        memberId: created.id, kind: "message", title: "SHALOM BET'e hoş geldiniz",
        description: "Hesabınız oluşturuldu. Para Yatır sayfasından ilk yatırımınızı yapabilirsiniz.",
        date: new Date().toISOString(), status: "unread",
      });
      return ok({ member: publicMember(created) });
    }

    case "logout":
      setState((current) => ({ ...current, sessionId: null }));
      return ok();

    case "resetPassword":
      return asText(body.email) ? ok() : fail("Geçerli bir e-posta adresi girin.");

    /* ------------------------------------------------------------ FİNANS */
    case "deposit":
    case "withdraw": {
      if (!member) return fail("Bu işlem için giriş yapmalısınız.");
      const method = getState().content.paymentMethods.find((entry) => entry.id === asText(body.methodId));
      if (!method) return fail("Seçilen ödeme yöntemi bulunamadı.");
      const amount = asNumber(body.amount);
      if (!Number.isFinite(amount) || amount < method.minimum || amount > method.maximum) {
        return fail("Girilen tutar yöntem limitleri dışında.");
      }
      if (action === "withdraw" && amount > member.balance) return fail("Kullanılabilir bakiyeniz yeterli değil.");
      addRecord({
        memberId: member.id, kind: "transaction", direction: action, method: method.name,
        title: action === "deposit" ? `Yatırım talebi / ${method.name}` : `Çekim talebi / ${method.name}`,
        description: action === "deposit"
          ? `${method.name} ile yatırım talebiniz alındı ve onay bekliyor.`
          : `${method.name} ile çekim talebiniz alındı ve onay bekliyor.`,
        date: new Date().toISOString(), status: "pending",
        amount: action === "deposit" ? amount : -amount,
      });
      return ok({ member: publicMember(member) });
    }

    /* ------------------------------------------------------------ LİSTELER */
    case "transactions":
    case "bets":
    case "bonuses":
    case "messages": {
      if (!member) return fail("Bu bilgileri görüntülemek için giriş yapmalısınız.");
      const kind = action === "transactions" ? "transaction" : action === "bets" ? "bet" : action === "bonuses" ? "bonus" : "message";
      const list = getState().records
        .filter((entry) => entry.memberId === member.id && entry.kind === kind)
        .map(({ id, title, description, date, status, amount }) => ({ id, title, description, date, status, amount }));
      return ok(list);
    }

    /* ------------------------------------------------------------- HESAP */
    case "updateProfile": {
      if (!member) return fail("Bu işlem için giriş yapmalısınız.");
      updateMember(member.id, {
        firstName: asText(body.firstName), lastName: asText(body.lastName),
        email: asText(body.email), country: asText(body.country), phone: asText(body.phone),
      });
      const updated = currentMember();
      return updated ? ok({ member: publicMember(updated) }) : fail("Bilgiler güncellenemedi.");
    }

    case "updatePassword": {
      if (!member) return fail("Bu işlem için giriş yapmalısınız.");
      if (await hashText(asText(body.currentPassword)) !== member.passwordHash) return fail("Mevcut şifreniz hatalı.");
      updateMember(member.id, { passwordHash: await hashText(asText(body.newPassword)) });
      return ok();
    }

    case "verifyIdentity": {
      if (!member) return fail("Bu işlem için giriş yapmalısınız.");
      const file = payload instanceof FormData ? payload.get("document") : null;
      addRecord({
        memberId: member.id, kind: "message", title: "Kimlik doğrulama talebi",
        description: `Belgeniz incelenmek üzere alındı${file instanceof File ? ` (${file.name})` : ""}.`,
        date: new Date().toISOString(), status: "pending",
      });
      return ok();
    }

    case "updateLimits": {
      if (!member) return fail("Bu işlem için giriş yapmalısınız.");
      addRecord({
        memberId: member.id, kind: "message", title: "Oyun limitleri güncellendi",
        description: `Günlük yatırım limiti: ${asNumber(body.depositLimit) || 0} TRY / Oturum süresi: ${asNumber(body.sessionMinutes) || 0} dakika.`,
        date: new Date().toISOString(), status: "completed",
      });
      return ok();
    }

    case "selfExclude": {
      if (!member) return fail("Bu işlem için giriş yapmalısınız.");
      updateMember(member.id, { status: "blocked", note: "Kullanıcı talebiyle oyuna ara verildi." });
      setState((current) => ({ ...current, sessionId: null }));
      return ok();
    }

    case "contact":
      if (!asText(body.message)) return fail("Mesajınızı yazın.");
      addRecord({
        memberId: member?.id || "guest", kind: "message",
        title: `İletişim: ${asText(body.subject) || "Genel"}`,
        description: `${asText(body.name)} (${asText(body.email)}): ${asText(body.message)}`,
        date: new Date().toISOString(), status: "unread",
      });
      return ok();

    /* ------------------------------------------------------------- OYUN */
    case "launchGame": {
      if (!member) return fail("Oyunu başlatmak için giriş yapmalısınız.");
      const game = getState().content.games.find((entry) => entry.id === asText(body.gameId));
      if (!game) return fail("Oyun bulunamadı.");
      if (game.apiEndpoint) {
        try {
          const endpoint = new URL(game.apiEndpoint);
          if (!["https:", "http:"].includes(endpoint.protocol)) return fail("API adresi geçersiz.");
          const response = await fetch(endpoint.href, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ gameId: game.id, memberId: member.id, username: member.username }),
          });
          const data = await response.json().catch(() => ({}));
          const launch = typeof data === "object" && data && (data.url || data.launchUrl);
          if (typeof launch === "string" && /^https?:\/\//.test(launch)) return ok({ url: launch, via: "api" });
          return fail("Oyun API'si geçerli bir adres döndürmedi.");
        } catch {
          return fail("Oyun API'sine ulaşılamadı. Bağlantı adresini kontrol edin.");
        }
      }
      if (game.url && /^https?:\/\//.test(game.url)) return ok({ url: game.url, via: "link" });
      return fail("Bu oyun için bağlantı veya API tanımlanmadı.");
    }

    case "claimPromotion": {
      if (!member) return fail("Bonusa katılmak için giriş yapmalısınız.");
      const promotion = getState().content.promotions.find((entry) => entry.id === asText(body.promotionId));
      if (!promotion) return fail("Kampanya bulunamadı.");
      addRecord({
        memberId: member.id, kind: "bonus", title: promotion.title,
        description: `${promotion.description}\n\nKatılım koşulları: ${promotion.terms}`,
        date: new Date().toISOString(), status: "pending",
      });
      return ok();
    }

    case "placeBet": {
      if (!member) return fail("Kupon oynamak için giriş yapmalısınız.");
      const stake = asNumber(body.stake);
      const selections = Array.isArray(body.selections) ? body.selections : [];
      if (!selections.length) return fail("Kuponunuzda seçim bulunmuyor.");
      if (!Number.isFinite(stake) || stake <= 0) return fail("Geçerli bir bahis tutarı girin.");
      if (stake > member.balance) return fail("Kullanılabilir bakiyeniz yeterli değil.");
      const total = selections.reduce((accumulator: number, item: unknown) => {
        const odd = asNumber(asRecord(item).odd);
        return accumulator * (Number.isFinite(odd) ? odd : 1);
      }, 1);
      adjustBalance(member.id, -stake, "Bahis kuponu tutarı");
      addRecord({
        memberId: member.id, kind: "bet", title: `${selections.length} maçlı kupon`,
        description: `Toplam oran ${total.toFixed(2)} / Olası kazanç ${(total * stake).toFixed(2)} TRY`,
        date: new Date().toISOString(), status: "pending", amount: -stake,
      });
      return ok();
    }

    default:
      return fail("Bu işlem şu anda kullanılamıyor.");
  }
}

/** Gerçek arka uç tanımlı değilse yerel istemciyi devreye alır. */
export function installLocalClient() {
  if (typeof window === "undefined" || window.SHALOM_CLIENT) return;
  window.SHALOM_CLIENT = {
    request: (action, payload) =>
      new Promise((resolve) => {
        setTimeout(() => { handle(action, payload).then(resolve).catch(() => resolve(fail("İşlem tamamlanamadı."))); }, 220);
      }),
  };
}
