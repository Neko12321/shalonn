<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/app/install.php';
try {
    fwrite(STDOUT, "Yonetici adi: ");
    $username = trim((string)fgets(STDIN));
    $password = getenv('SHALOM_ADMIN_PASSWORD');
    if (!$password) throw new RuntimeException('Once SHALOM_ADMIN_PASSWORD ortam degiskenini belirleyin.');
    install_site($username, $password);
    fwrite(STDOUT, "Kurulum tamamlandi. Web kok dizini: public/\n");
} catch (Throwable $error) { fwrite(STDERR, $error->getMessage() . "\n"); exit(1); }