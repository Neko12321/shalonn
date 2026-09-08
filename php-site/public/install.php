<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/install.php';
security_headers(true);
$error = ''; $success = false; $csrf = '';
try {
    init_session(); $csrf = $_SESSION['csrf'];
    if (installed()) { header('Location: admin.php'); exit; }
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        csrf_check();
        $expected = config()['setup_key'];
        if (!is_string($expected) || strlen($expected) < 32) abort_api('config.php içinde en az 32 karakterlik setup_key belirleyin.');
        if (!hash_equals($expected, (string)($_POST['setup_key'] ?? ''))) abort_api('Kurulum anahtarı hatalı.', 403);
        $password = (string)($_POST['password'] ?? '');
        if ($password !== ($_POST['repeat'] ?? '')) abort_api('Şifreler eşleşmiyor.');
        install_site(trim((string)($_POST['username'] ?? '')), $password); $success = true;
    }
} catch (ApiError $exception) { $error = $exception->getMessage(); }
catch (Throwable $exception) { $error = 'Kurulum tamamlanamadı. PHP eklentilerini ve storage yazma iznini kontrol edin.'; error_log($exception->getMessage()); }
?>
<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SHALOM BET | Kurulum</title><link rel="stylesheet" href="assets/site.css"></head>
<body class="management"><main class="install-wrap"><section class="login-card"><div class="admin-monogram">S</div><h1>SHALOM BET</h1><p class="muted">PHP site kurulumu</p>
<?php if ($error): ?><div class="notice error" role="alert"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div><?php endif; ?>
<?php if ($success): ?><div class="notice">Kurulum tamamlandı. Kurulum anahtarını config.php dosyasından kaldırabilirsiniz.</div><a class="btn primary full" href="admin.php">Yönetim paneline gir</a>
<?php else: ?><form method="post" class="form"><input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>"><label>Kurulum anahtarı<input name="setup_key" type="password" required autocomplete="off"></label><label>Yönetici adı<input name="username" required minlength="3" maxlength="24" autocomplete="username"></label><label>Şifre<input name="password" type="password" required minlength="12" maxlength="72" autocomplete="new-password"></label><label>Şifre tekrar<input name="repeat" type="password" required minlength="12" autocomplete="new-password"></label><p class="hint">En az 12 karakter, bir harf ve bir rakam kullanın. Sabit veya varsayılan şifre oluşturulmaz.</p><button class="btn primary" type="submit">Kurulumu tamamla</button></form><?php endif; ?>
</section></main></body></html>