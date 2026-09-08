<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/app/bootstrap.php';
security_headers();
try {
    init_session();
    if (!installed()) abort_api('Önce kurulum ekranını tamamlayın.', 503);
    require_once dirname(__DIR__) . '/app/api.php';
    $action = is_string($_GET['action'] ?? null) ? $_GET['action'] : '';
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
        if ($action !== 'bootstrap') abort_api('Bu işlem POST isteği gerektirir.', 405);
        $body = [];
    } elseif (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
        csrf_check(); $body = input();
    } else abort_api('İstek yöntemi desteklenmiyor.', 405);
    send_json(['ok' => true, 'data' => dispatch($action, $body)]);
} catch (ApiError $error) {
    send_json(['ok' => false, 'error' => $error->getMessage()], $error->status);
} catch (Throwable $error) {
    error_log('SHALOM API: ' . $error->getMessage());
    send_json(['ok' => false, 'error' => 'İşlem tamamlanamadı. Lütfen daha sonra tekrar deneyin.'], 500);
}