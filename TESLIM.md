# PHP Dosya Teslimi

- PHP sunucu klasörü: `php-site/`.
- Tarayıcıda ZIP indirme ekranı: `#/dosyalar`.
- Yönetim panelinin üstündeki **PHP dosyaları** veya sitenin altındaki **PHP dosyalarını indir** bağlantısıyla açılır.
- İndirme düğmesi gerçek bir ZIP oluşturur. Şifreler, kullanıcı kayıtları ve tarayıcı verileri arşive eklenmez.
- İsteğe bağlı **React çalışma dosyalarını da ekle** seçeneği, önceki React/Vite projesini ayrı bir kaynak klasörü olarak ekler. PHP kurulumu için bu klasör gerekli değildir.

PHP paketinin kurulumu `php-site/README.md` içinde açıklanmıştır. RAR yerine standart ZIP kullanılır; Windows, macOS, Linux ve cPanel ile açılabilir.

## Komut Satırından ZIP

Proje bağımlılıkları yüklüyken `node scripts/package-php.mjs` çalıştırın. Script PHP/JavaScript sözdizimini ayrıştırır ve `deliverables/shalom-bet-php.zip` oluşturur. Bu, tarayıcıdan indirmeye alternatif bir paketleme yoludur.

## Kontrol Sınırı

Ön yüz derlemesi doğrulanır. ZIP oluşturulurken PHP/JavaScript kaynakları ayrıştırılır. PHP-FPM ve SQLite çalışma zamanı ile gerçek ödeme, oyun ve e-posta sağlayıcıları bu ortamda test edilmemiştir. Paket, sağlayıcı entegrasyonlarının tamamlandığı anlamına gelmez.