# SHALOM BET — Kurulum ve Yönetim Notları

## Yönetim Paneli

Adres: **`#/admin`** (site altbilgisindeki “Yönetim Paneli” bağlantısı da buraya gider).

İlk giriş bilgileri:

| Alan | Değer |
| --- | --- |
| Yönetici adı | `admin` |
| Şifre | `shalom2026` |

İlk girişten sonra **Yönetici Ayarları** bölümünden şifreyi değiştirin. Şifre SHA-256 özeti olarak saklanır, açık metin tutulmaz.

> Bu doğrulama yalnızca tarayıcı tarafındadır. Yayına alırken panel sunucu tarafında korunmalı; oturum, yetki ve CSRF kontrolleri sunucuda yapılmalıdır.

### Panel bölümleri

| Bölüm | Ne yapar |
| --- | --- |
| Genel Bakış | Üye, bakiye, talep ve içerik sayıları; bekleyen talepleri tek tıkla onaylama |
| Üyeler | Kayıtlı üyeler, bakiye ekleme/düşme, hesabı askıya alma, silme |
| Talepler & Finans | Tüm yatırım/çekim/bahis/bonus hareketleri, onay–ret |
| Ödeme Yöntemleri | Yöntem ekleme, tür, alt/üst limit, yatırıma/çekime açık olma durumu |
| Bannerlar | Ana sayfa döner banner’ları, etiket, sembol, hedef sayfa, sıralama |
| Oyunlar | Slot/casino/masa/Aviator/High Flyer/Spaceman oyunları, sağlayıcı, rozet, kapak renkleri, oyun adresi |
| Maçlar & Oranlar | Karşılaşma, lig, spor dalı, başlangıç saati, canlı durum, skor ve 1/X/2 oranları |
| Promosyonlar | Kampanya başlığı, açıklaması, kategorisi ve katılım koşulları |
| Sayfa İçerikleri | Hakkımızda, Kullanım Şartları, Gizlilik Politikası, Sorumlu Oyun |
| Yardım / SSS | Destek sayfasındaki soru-cevaplar |
| Destek & Sohbet | E-posta, telefon, Telegram, harici destek adresi ve **Tawk.to** kimlikleri |
| Görünüm & Menü | Marka adı, slogan, yıl rozeti, duyuru şeridi, hızlı bağlantılar, çevrim içi sayaçları, renk paleti |
| Yedek & Sıfırlama | JSON yedek indirme/geri yükleme, örnek içerik yükleme, içerik temizleme, tam sıfırlama |
| Yönetici Ayarları | Panel kullanıcı adı ve şifresi |

### Canlı destek (Tawk.to)

**Destek & Sohbet → Sağlayıcı → Tawk.to** seçip Tawk panelinizdeki `embed.tawk.to/PROPERTY_ID/WIDGET_ID` değerlerini girin. Widget site açıldığında `#canli-destek-alani` içine yüklenir. Sağlayıcı “Yok” iken sitede destek sayfasına giden bir düğme gösterilir (isteğe bağlı kapatılabilir).

## Veri Saklama

Tüm içerik, ayarlar, üyeler ve işlem kayıtları tarayıcının `localStorage` alanında `shalom-bet-v1` anahtarıyla tutulur (`src/store.ts`). Aynı tarayıcıda açık sekmeler otomatik eşitlenir.

Bu, tek başına çalışan bir ön yüz kurulumudur: veriler cihazda kalır, farklı cihazlar arasında paylaşılmaz. Gerçek çok kullanıcılı işletim için sunucu bağlantısı gerekir.

## Gerçek Arka Uca Bağlama

Uygulama yüklenmeden önce `window.SHALOM_CLIENT` tanımlanırsa yerel istemci devre dışı kalır ve tüm işlemler sizin sunucunuza gider:

```js
window.SHALOM_CLIENT = {
  async request(action, payload) {
    const response = await fetch(`/api/${action}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json(); // { ok: true, data } | { ok: false, error: "mesaj" }
  },
};
```

İçerik de aynı şekilde dışarıdan beslenebilir: `window.SHALOM_CONTENT` ile ilk yükleme, `shalom:content-updated` CustomEvent’i ile canlı güncelleme.

### Eylemler

`login`, `register`, `logout`, `session`, `resetPassword`, `deposit`, `withdraw`, `transactions`, `bets`, `bonuses`, `messages`, `updateProfile`, `updatePassword`, `verifyIdentity`, `updateLimits`, `selfExclude`, `contact`, `launchGame`, `claimPromotion`, `placeBet`

- `login`, `register`, `session`, `updateProfile` → `data.member` (bkz. `Member` tipi)
- `transactions`, `bets`, `bonuses`, `messages` → `AccountRecord[]`
- `launchGame` → `data.url`
- `deposit`, `withdraw` → isteğe bağlı `data.redirectUrl` ve güncel `data.member`
- `verifyIdentity` → `FormData`, diğerleri JSON

Eylem adları bu arayüzün iç sözleşmesidir; bir sağlayıcının (ör. BetConstruct) gerçek uç noktalarına eşleme sunucu tarafında yapılmalıdır.

## Kayıt ve Yaş Kontrolü

- İki adımlı kayıt; geri dönüldüğünde alanlar korunur.
- Yıl listesi her zaman içinde bulunulan yıldan 18 yıl geriden başlar; gün ve ay da denetlenir (artık yıl dahil).
- Ülke seçimi telefon alanındaki bayrak ve arama kodunu birlikte değiştirir; numara ülke planına göre doğrulanır ve sunucuya E.164 biçiminde gider.

## Başlangıç Durumu

Site sıfır içerikle açılır: oyun, maç, banner, promosyon, ödeme yöntemi ve kurumsal metin yoktur; boş alanlar bilgilendirme kutusu gösterir. Hızlı başlangıç için **Yedek & Sıfırlama → Örnek İçeriği Yükle** tek tıkla dolu bir set ekler, **İçeriği Temizle** ile geri alınır.
