# SHALOM BET PHP Paketi

Bu klasör bağımsız PHP, HTML, CSS ve JavaScript uygulamasıdır. React, Node.js, Java, Composer veya derleme işlemi gerektirmeden PHP sunucusunda çalışacak şekilde hazırlanmıştır. Site siyah/altın; yönetim ve ayrı affiliate paneli beyaz/laciverttir.

## Gereksinimler

- PHP 8.2 veya daha yeni.
- PDO SQLite, fileinfo, session, JSON ve standart PHP uzantıları.
- Oyun başlatma API'si için ayrıca cURL.
- Canlı sunucuda HTTPS.
- PHP kullanıcısının `storage/` klasörüne yazma izni.

SQLite düşük/orta trafikte tek sunuculu kurulum içindir. Yüksek trafik ve gerçek para operasyonları için ayrı veritabanı, kuyruk, izleme ve sağlayıcı mutabakatı gereklidir.

## Klasörler

```text
shalom-bet-php/
  app/                  Sunucu kodu, SQL şeması ve yetki kontrolleri
  bin/install.php       Komut satırı kurulum seçeneği
  public/               Web kök dizini: yalnızca bu klasör yayınlanır
    index.php           Site
    admin.php           Yönetici ve çalışan paneli
    ortak.php           Ayrı affiliate paneli
    install.php         Tek seferlik kurulum ekranı
    api.php             PHP API
    media.php           Kontrollü dosya servisi
    assets/             CSS, JavaScript ve logo
  storage/              SQLite veritabanı, belgeler ve yüklenen görseller
  tests/smoke.php        Geçici veritabanında işlev kontrolleri
  config.example.php    Örnek yapılandırma
  nginx.example.conf    Nginx yapılandırma örneği
```

## Yerel Kurulum

1. `config.example.php` dosyasını `config.php` adıyla kopyalayın.
2. `environment` değerini `local`, `base_url` değerini `http://localhost:8080` yapın.
3. `setup_key` için kendinize özel, en az 32 karakterli rastgele bir anahtar belirleyin. Örneğin `php -r "echo bin2hex(random_bytes(32));"` çıktısını kullanabilirsiniz.
4. Paket kökünde `php -S localhost:8080 -t public` çalıştırın.
5. Tarayıcıda `http://localhost:8080/install.php` açın. Kurulum anahtarını girip yönetici hesabınızı oluşturun.
6. Kurulumdan sonra `setup_key` değerini boşaltın. `storage/installed.lock` dosyasını silmeyin.

Sabit yönetici şifresi yoktur. Yönetici şifresi kurulumda sizin tarafınızdan belirlenir. Kullanıcı şifreleri PHP `password_hash` ile saklanır, API cevaplarında gösterilmez.

## Hosting / cPanel Kurulumu

1. Paket klasörünü sunucuya yükleyin. Domainin document root ayarını paketin **public/** klasörüne yönlendirin.
2. `app/`, `config.php`, `storage/` ve `tests/` web kökünün dışında kalmalıdır. Tüm paketi doğrudan public_html altında herkese açık yayınlamayın.
3. `config.php` içinde `environment=production`, `base_url=https://siteniz.com` belirleyin. Alt dizinde kullanacaksanız adresi `https://siteniz.com/klasor` biçiminde girin; sonuna `index.php` eklemeyin.
4. HTTPS'nin PHP'ye doğru iletildiğinden emin olun. Proxy kullanıyorsanız HTTPS bilgisi web sunucusu yapılandırmasında güvenilir şekilde aktarılmalıdır; uygulama rastgele forwarded başlıklarına güvenmez.
5. `storage/` yazılabilir olmalıdır. Gereksiz `777` izinleri vermeyin. Aynı kullanıcıyla çalışan PHP için `700` dizin / `600` dosya izinleri yeterlidir.
6. `install.php` üzerinden tek seferlik kurulum yapın. Kurulum kilidi yeniden yönetici oluşturulmasını engeller.

Document root değiştirilemiyorsa `public/` içeriği public_html içine, diğer dosyalar public_html dışındaki üst klasöre taşınabilir. Bu durumda giriş dosyalarındaki `dirname(__DIR__) . '/app/...'` yollarını gerçek konuma göre güncelleyin. En kolay ve önerilen yöntem document root ayarıdır.

## Kullanım

- Site: `index.php`.
- Yönetici ve çalışan girişi: `admin.php`.
- Affiliate ortağı girişi: `ortak.php`.
- Çalışan ve affiliate oluşturma: yönetim panelindeki ilgili bölüm.
- Ortak linki: `index.php?ref=ORTAK_KODU#/kayit`. Kod sunucuda doğrulanır; kayıt formunda otomatik dolar.
- Bir başka ortağın linki açılırsa son geçerli link esas alınır. Üye oluşturulduğunda ortağın değişmeyen kimliği (`affiliate_id`) kaydedilir. Promo kodu sonradan düzenlense bile önceki üyeler kaybolmaz.
- Site, yönetim ve ortak oturumları birbirinden ayrı tutulur. Ortak paneli yalnızca o ortağın üyelerini gösterir; üyelerin şifre, telefon ve bakiye bilgilerini göstermez.
- Kayıt, içerik, finans ve ortak verileri cihazda değil SQLite veritabanında tutulur. Yeni bir gizli pencere veya başka cihaz aynı sunucuya bağlandığında aynı kayıt kaynağını kullanır.
- Paket sıfır içerikle başlar. Maç, oyun, kullanıcı, promosyon veya ödeme yöntemi doldurulmamıştır. Bonus sistemi eklenmemiştir; kayıt formundaki ortak kodu yalnızca affiliate ilişkilendirmesi içindir.

## Oyunlar ve Görseller

Yönetim panelinde oyun adı, sağlayıcı, kategori, görsel URL veya görsel dosyası, oyun bağlantısı ve API adresi girilebilir. Görsel yüklemelerinde JPG/PNG/WEBP kabul edilir; PHP/SVG gibi çalıştırılabilir içerik yüklenemez.

Bağlantı tanımlıysa oyun o adreste açılır. API adresi varsa önceliklidir. API yalnızca config.php içindeki `game_api_hosts` listesinde yer alan **tam HTTPS sunucu adlarına** istek yapabilir. Gizli Bearer anahtar `game_api_token` veya `SHALOM_GAME_TOKEN` ortam değişkeninde tutulur; tarayıcıya gönderilmez.

Genel API istek sözleşmesi: `gameId`, `playerId`, `currency`, `language`, `returnUrl` alanlarıyla POST JSON. Dönüş: `{ "url": "https://..." }` veya `{ "launchUrl": "https://..." }`.

Bu sözleşme BetConstruct veya başka bir sağlayıcının hazır entegrasyonu değildir. Gerçek sağlayıcı parametreleri, imzalama, oyun cüzdanı, callback ve mutabakat işlemleri o sağlayıcının belgelerine göre ayrıca eşlenmelidir. Paket bu servislerin hesap veya anahtarlarını içermez.

## Ödeme ve Bahis Sınırları

Yatırım/çekim ekranları talep oluşturur. **Gerçek banka transferi, kart tahsilatı veya kripto transferi yapılmaz.** Yönetim onayı yalnızca sistem içindeki bakiye kaydını günceller. Gerçek para işlemini doğrulamadan talebi onaylamayın.

Çekim talebinde tutar rezerve edilir. Onayda bakiye düşer; ret halinde rezerv serbest kalır. İşlem kimlikleri ve veritabanı işlemleri yinelenen talep/onayı engeller. Meblağlar tam sayı kuruş olarak saklanır.

Kupon, yayınlanan karşılaşmaların güncel oranlarına göre doğrulanır. Sağlayıcıdan otomatik sonuç servisi yoktur; yalnızca ana yönetici manuel sonuçlandırabilir. Gerçek bir spor veri akışı veya casino oyun motoru pakete dahil değildir.

## E-posta ve Kimlik Belgeleri

Şifre yenileme için `mail_enabled=true`, geçerli `mail_from` ve sunucuda çalışan PHP mail servisi gereklidir. Kurumsal yayında SPF/DKIM ve bir SMTP servisi önerilir. E-posta servisi kapalıyken uygulama başarılı gönderim iddiasında bulunmaz.

Kimlik belgeleri public dizininin dışında saklanır. Belgeleri yalnızca oyuncu yönetimi yetkili personel indirebilir. Yasal veri saklama süresi, silme politikası ve yedek şifrelemesi işletim sırasında ayrıca belirlenmelidir.

## Yedekleme

Panelden yalnızca **içerik yedeği** indirilebilir; hesaplar ve finansal kayıtlar bu JSON'da yer almaz. Tam sunucu yedeği için uygulamayı bakım moduna alarak `storage/` klasörünü ve özel `config.php` dosyasını güvenli konuma kopyalayın. SQLite Backup API veya `.backup` komutu ile canlı veritabanı tutarlılığı korunabilir. Yedekleri public dizinine koymayın.

## Kontrol Komutları

- PHP sözdizimi: `find app public bin tests -name '*.php' -exec php -l {} \;`
- İşlev kontrolleri: `php tests/smoke.php`
- JavaScript sözdizimi, Node varsa: `node --check public/assets/site.js` ve `node --check public/assets/management.js`

`smoke.php` işletim sisteminin geçici klasöründe ayrı bir veritabanı kurar. Kurulum, kayıt, affiliate ilişkilendirmesi, kod değişimi, ödeme rezervi, tekrar onay engeli ve personel yetkisini sınar. Yapılandırma geçici klasöre izin vermiyorsa teste başlamadan durur; üretim veritabanına yazmaz.

## Doğrulama Durumu

PHP kaynakları ve kurulum dosyaları hazırlanmıştır. Bu paketin üretildiği ortamda PHP-FPM/SQLite sunucusu çalıştırma imkanı bulunmadığı için PHP çalışma zamanı, hosting kurulumu, e-posta ve harici sağlayıcılar uçtan uca doğrulanmamıştır. Önce yerel ortamda yukarıdaki kontrolleri çalıştırın.

Bu paket güvenlik denetimi, lisans, düzenleyici uygunluk, KYC/AML hizmeti veya gerçek para işletimine hazır sertifikasyon anlamına gelmez. Canlı yayın öncesinde güvenlik ve yük testleri ile sağlayıcı entegrasyonları tamamlanmalıdır.

## Sohbet

Sohbet balonu veya Tawk.to betiği dahil değildir. Destek bağlantısı yönetimden ayarlanabilir. Üçüncü taraf widget eklenirse gizlilik politikası ve Content-Security-Policy ilgili sağlayıcının belgelerine göre ayrıca düzenlenmelidir.