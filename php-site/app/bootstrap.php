<?php
declare(strict_types=1);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

final class ApiError extends RuntimeException
{
    public function __construct(string $message, public int $status = 400)
    {
        parent::__construct($message);
    }
}

function config(): array
{
    static $config;
    if ($config === null) {
        $file = dirname(__DIR__) . '/config.php';
        $config = require (is_file($file) ? $file : dirname(__DIR__) . '/config.example.php');
        date_default_timezone_set($config['timezone'] ?? 'Europe/Istanbul');
    }
    return $config;
}

function storage_path(string $suffix = ''): string
{
    return rtrim((string)config()['storage'], '/\\') . ($suffix === '' ? '' : '/' . $suffix);
}

function now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }
function uid(): string { return bin2hex(random_bytes(16)); }
function json_string(mixed $value): string { return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR); }
function decode(string $value, mixed $fallback = []): mixed { return json_decode($value, true) ?? $fallback; }
function abort_api(string $message, int $status = 400): never { throw new ApiError($message, $status); }

function database(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;
    if (!extension_loaded('pdo_sqlite')) abort_api('Sunucuda PDO SQLite eklentisi gerekli.', 503);
    if (!is_dir(storage_path()) && !mkdir(storage_path(), 0700, true)) abort_api('Veri klasörü oluşturulamadı.', 503);
    $pdo = new PDO('sqlite:' . storage_path('database.sqlite'), null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    return $pdo;
}

function query(string $sql, array $params = []): PDOStatement
{
    $statement = database()->prepare($sql);
    $statement->execute($params);
    return $statement;
}

// SQLite immediate transactions serialize all balance and request decisions.
function atomic(callable $operation): mixed
{
    $db = database();
    $db->exec('BEGIN IMMEDIATE');
    try {
        $result = $operation();
        $db->exec('COMMIT');
        return $result;
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
}

function installed(): bool { return is_file(storage_path('installed.lock')); }

function init_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    if (config()['environment'] !== 'local' && !$https) abort_api('HTTPS gerekli. Yerel kurulum için environment değerini local yapın.', 403);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.gc_maxlifetime', '43200');
    session_name('shalom_session');
    $path = parse_url((string)config()['base_url'], PHP_URL_PATH) ?: '/';
    session_set_cookie_params(['lifetime' => 0, 'path' => rtrim($path, '/') . '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}

function security_headers(bool $html = false): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header('Cache-Control: no-store');
    if (config()['environment'] !== 'local' && !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') header('Strict-Transport-Security: max-age=31536000');
    if ($html) header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'");
}

function csrf_check(): void
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf'] ?? '';
    if (!is_string($token) || !hash_equals($_SESSION['csrf'], $token)) abort_api('Oturum doğrulanamadı. Sayfayı yenileyin.', 419);
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $base = parse_url((string)config()['base_url']);
        $expected = ($base['scheme'] ?? '') . '://' . ($base['host'] ?? '') . (isset($base['port']) ? ':' . $base['port'] : '');
        if (!hash_equals($expected, $origin)) abort_api('İstek kaynağına izin verilmiyor.', 403);
    }
}

function input(): array
{
    if (!empty($_FILES)) return $_POST;
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 1048576) abort_api('İstek çok büyük.', 413);
    $body = file_get_contents('php://input');
    $value = $body !== '' ? json_decode($body, true) : [];
    if (!is_array($value)) abort_api('Geçersiz istek.');
    return $value;
}

function field(array $body, string $key, int $max = 255, bool $required = false): string
{
    $value = $body[$key] ?? '';
    if (!is_string($value)) abort_api('Geçersiz alan: ' . $key);
    $value = trim($value);
    if (strlen($value) > $max || ($required && $value === '')) abort_api('Alanı kontrol edin: ' . $key);
    return $value;
}

function password_input(array $body, string $key = 'password', int $minimum = 8): string
{
    $value = $body[$key] ?? '';
    if (!is_string($value) || strlen($value) < $minimum || strlen($value) > 72 || !preg_match('/[\p{L}]/u', $value) || !preg_match('/[0-9]/', $value)) {
        abort_api('Şifre en az ' . $minimum . ' karakter, bir harf ve bir rakam içermelidir.');
    }
    return $value;
}

function cents(mixed $amount, bool $signed = false): int
{
    $value = str_replace(',', '.', (string)$amount);
    if (!preg_match($signed ? '/^-?[0-9]{1,9}(\.[0-9]{1,2})?$/' : '/^[0-9]{1,9}(\.[0-9]{1,2})?$/', $value)) abort_api('Geçerli bir tutar girin.');
    $result = (int)round((float)$value * 100);
    if ($result === 0 || (!$signed && $result < 0)) abort_api('Tutar sıfırdan büyük olmalıdır.');
    return $result;
}

function rate_limit(string $scope, int $limit, int $seconds): void
{
    $key = hash('sha256', $scope . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'local'));
    $time = time();
    $allowed = atomic(function () use ($key, $time, $limit, $seconds) {
        query('DELETE FROM rate_limits WHERE expires_at < ?', [$time]);
        $row = query('SELECT * FROM rate_limits WHERE id = ?', [$key])->fetch();
        if ($row && (int)$row['attempts'] >= $limit) return false;
        query('INSERT INTO rate_limits(id, attempts, expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts = attempts + 1', [$key, $time + $seconds]);
        return true;
    });
    if (!$allowed) abort_api('Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.', 429);
}

function session_user(string $slot): ?array
{
    $saved = $_SESSION[$slot] ?? null;
    if (!is_array($saved)) return null;
    $user = query('SELECT * FROM users WHERE id = ?', [$saved['id'] ?? ''])->fetch();
    $roleAllowed = $user && match ($slot) {
        'member' => $user['role'] === 'member',
        'staff' => in_array($user['role'], ['owner', 'employee'], true),
        'affiliate' => $user['role'] === 'affiliate',
        default => false,
    };
    $timeout = $slot === 'member' && $user ? min(43200, max(1800, (int)$user['session_minutes'] * 60)) : 7200;
    if (!$roleAllowed || $user['status'] !== 'active' || (int)$user['session_version'] !== (int)($saved['version'] ?? 0) || time() - (int)($saved['started'] ?? 0) > $timeout || ($user['excluded_until'] && strtotime($user['excluded_until']) > time())) {
        unset($_SESSION[$slot]);
        return null;
    }
    return $user;
}

function require_member(): array
{
    return session_user('member') ?: throw new ApiError('Bu işlem için giriş yapın.', 401);
}

function permissions(): array
{
    return ['dashboard', 'players', 'finance', 'bets', 'games', 'banners', 'matches', 'payments', 'pages', 'support', 'employees', 'affiliates', 'settings', 'backup'];
}

function require_staff(string $permission, bool $ownerOnly = false): array
{
    $user = session_user('staff');
    if (!$user) abort_api('Yönetim oturumu gerekli.', 401);
    if ($user['role'] !== 'owner' && ($ownerOnly || !in_array($permission, decode($user['permissions']), true))) abort_api('Bu işlem için yetkiniz yok.', 403);
    return $user;
}

function user_view(array $user, bool $private = false): array
{
    $view = [
        'id' => $user['id'], 'username' => $user['username'], 'name' => trim($user['first_name'] . ' ' . $user['last_name']),
        'firstName' => $user['first_name'], 'lastName' => $user['last_name'], 'role' => $user['role'],
        'status' => $user['status'], 'createdAt' => $user['created_at'],
    ];
    if ($private) $view += [
        'email' => $user['email'] ?? '', 'phone' => $user['phone'], 'country' => $user['country'],
        'balance' => ((int)$user['balance'] - (int)$user['reserved']) / 100,
        'totalBalance' => (int)$user['balance'] / 100, 'reserved' => (int)$user['reserved'] / 100,
        'promoCode' => $user['promo_code'] ?: $user['referral_code'], 'affiliateId' => $user['affiliate_id'],
        'birthDate' => $user['birth_date'],
        'permissions' => $user['role'] === 'owner' ? permissions() : decode($user['permissions']),
    ];
    return $view;
}

function audit(string $action, ?string $target = null, ?string $actor = null): void
{
    query('INSERT INTO audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)', [uid(), $actor, $action, $target, now()]);
}

function setting(string $key, mixed $fallback = []): mixed
{
    $row = query('SELECT value FROM settings WHERE key = ?', [$key])->fetch();
    return $row ? decode($row['value'], $fallback) : $fallback;
}

function save_setting(string $key, mixed $value): void
{
    query('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [$key, json_string($value)]);
}

function valid_web_url(string $url): bool
{
    $parts = parse_url($url);
    return $parts !== false && filter_var($url, FILTER_VALIDATE_URL) !== false
        && in_array($parts['scheme'] ?? '', ['https', 'http'], true) && !isset($parts['user']) && !isset($parts['pass']);
}

function send_json(mixed $data = null, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_string($data);
    exit;
}