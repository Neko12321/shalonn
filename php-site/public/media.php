<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/bootstrap.php';
security_headers();
try {
    init_session();
    if (!installed()) abort_api('Kurulum gerekli.', 503);
    $id = is_string($_GET['id'] ?? null) ? $_GET['id'] : '';
    if (!preg_match('/^[a-f0-9]{32}$/', $id)) abort_api('Dosya bulunamadı.', 404);
    $file = query('SELECT * FROM files WHERE id=?', [$id])->fetch();
    if (!$file) abort_api('Dosya bulunamadı.', 404);
    if ($file['kind'] === 'identity') require_staff('players');
    $path = realpath(storage_path($file['path']));
    $root = realpath(storage_path()) . DIRECTORY_SEPARATOR;
    if (!$path || !str_starts_with($path, $root) || !is_file($path)) abort_api('Dosya bulunamadı.', 404);
    header("Content-Security-Policy: sandbox; default-src 'none'");
    header('Content-Type: ' . $file['mime']);
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: ' . ($file['kind'] === 'identity' ? 'attachment' : 'inline') . '; filename="' . $file['id'] . '.' . pathinfo($path, PATHINFO_EXTENSION) . '"');
    session_write_close();
    readfile($path);
} catch (ApiError $error) {
    http_response_code($error->status); echo htmlspecialchars($error->getMessage(), ENT_QUOTES, 'UTF-8');
} catch (Throwable $error) {
    http_response_code(500); echo 'Dosya yüklenemedi.'; error_log($error->getMessage());
}