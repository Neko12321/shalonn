<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
security_headers(true);
if (!installed()) { header('Location: install.php'); exit; }
$management = $screen !== 'site';
?>
<!doctype html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="<?= $management ? '#0f2744' : '#0b0c0a' ?>">
    <meta name="description" content="SHALOM BET. Hesap ve oyun yönetimi.">
    <title>SHALOM BET<?= $management ? ' | Yönetim' : '' ?></title>
    <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
    <link rel="stylesheet" href="assets/site.css">
    <script type="module" src="assets/<?= $management ? 'management' : 'site' ?>.js"></script>
</head>
<body class="<?= $management ? 'management' : 'site' ?>" data-screen="<?= $screen ?>">
    <a class="skip" href="#main">İçeriğe geç</a>
    <div id="app"><main id="main" class="loading"><span class="spinner"></span><span>Yükleniyor...</span></main></div>
    <div id="notices" role="status" aria-live="polite"></div>
    <noscript>Bu siteyi kullanabilmek için JavaScript'i etkinleştirin.</noscript>
</body>
</html>