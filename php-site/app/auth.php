<?php
declare(strict_types=1);

function login_user(array $body, string $slot): array
{
    rate_limit('login:' . $slot, 15, 900);
    $username = field($body, 'username', 24, true);
    $password = $body['password'] ?? '';
    $user = query('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [$username])->fetch();
    $allowed = $user && match ($slot) {
        'staff' => in_array($user['role'], ['owner', 'employee'], true),
        'affiliate' => $user['role'] === 'affiliate',
        default => $user['role'] === 'member',
    };
    if (!$allowed || !is_string($password) || !password_verify($password, $user['password']) || $user['status'] !== 'active') {
        abort_api('Kullanıcı adı veya şifre hatalı.', 401);
    }
    if ($user['excluded_until'] && strtotime($user['excluded_until']) > time()) abort_api('Hesabınızın ara verme süresi henüz dolmadı.', 403);
    session_regenerate_id(true);
    $_SESSION[$slot] = ['id' => $user['id'], 'version' => (int)$user['session_version'], 'started' => time()];
    query('UPDATE users SET last_login = ? WHERE id = ?', [now(), $user['id']]);
    if (password_needs_rehash($user['password'], PASSWORD_DEFAULT)) query('UPDATE users SET password = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    audit('login.' . $slot, $user['id'], $user['id']);
    return user_view($user, true);
}

function resolve_referral(string $code): ?array
{
    $code = strtoupper(trim($code));
    unset($_SESSION['referral']);
    if ($code === '') return null;
    if (!preg_match('/^[A-Z0-9_-]{3,40}$/', $code)) abort_api('Ortaklık kodu geçersiz.', 422);
    $partner = query("SELECT id, first_name, username, promo_code FROM users WHERE role='affiliate' AND status='active' AND promo_code = ? COLLATE NOCASE", [$code])->fetch();
    if (!$partner) abort_api('Ortaklık bağlantısı bulunamadı veya devre dışı.', 404);
    $_SESSION['referral'] = ['id' => $partner['id'], 'expires' => time() + 2592000];
    return ['code' => $partner['promo_code'], 'name' => $partner['first_name'] ?: $partner['username']];
}

function current_referral(): ?array
{
    $saved = $_SESSION['referral'] ?? null;
    if (!$saved || ($saved['expires'] ?? 0) < time()) { unset($_SESSION['referral']); return null; }
    $partner = query("SELECT id, first_name, username, promo_code FROM users WHERE id=? AND role='affiliate' AND status='active'", [$saved['id']])->fetch();
    if (!$partner) { unset($_SESSION['referral']); return null; }
    return $partner;
}

function register_member(array $body): array
{
    rate_limit('register', 10, 3600);
    $username = field($body, 'username', 24, true);
    if (!preg_match('/^[a-zA-Z0-9_.]{3,24}$/', $username)) abort_api('Kullanıcı adında 3-24 harf, rakam, nokta veya alt çizgi kullanın.');
    $first = field($body, 'firstName', 100, true);
    $last = field($body, 'lastName', 100, true);
    foreach ([$first, $last] as $name) if (!preg_match("/^[\p{L}\p{M}][\p{L}\p{M} '\-]*$/u", $name)) abort_api('Ad ve soyad bilgilerini kontrol edin.');
    $email = strtolower(field($body, 'email', 254, true));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) abort_api('Geçerli bir e-posta adresi girin.');
    $phone = field($body, 'phone', 20, true);
    if (!preg_match('/^\+[1-9][0-9]{7,14}$/', $phone)) abort_api('Telefonu ülke koduyla birlikte girin.');
    $country = field($body, 'country', 2, true);
    if (!preg_match('/^[A-Z]{2}$/', $country)) abort_api('Ülke seçin.');
    $birth = field($body, 'birthDate', 10, true);
    $dob = DateTimeImmutable::createFromFormat('!Y-m-d', $birth);
    $today = new DateTimeImmutable('today');
    if (!$dob || $dob->format('Y-m-d') !== $birth || $dob > $today || $dob < new DateTimeImmutable('1900-01-01') || $dob->diff($today)->y < 18) abort_api('Kayıt olmak için 18 yaşını doldurmuş olmalısınız.');
    if (($body['acceptedTerms'] ?? false) !== true) abort_api('Kullanım şartlarını onaylayın.');
    $password = password_input($body);
    $partner = current_referral();
    $manualCode = field($body, 'promoCode', 40);
    if (!$partner && $manualCode !== '') { resolve_referral($manualCode); $partner = current_referral(); }
    $id = uid();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    atomic(function () use ($id, $username, $hash, $first, $last, $email, $country, $phone, $birth, $partner) {
        if (query('SELECT id FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE', [$username, $email])->fetch()) abort_api('Bu kullanıcı adı veya e-posta adresi kullanılıyor.', 409);
        query('INSERT INTO users(id,username,password,role,first_name,last_name,email,country,phone,birth_date,affiliate_id,referral_code,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
            $id, $username, $hash, 'member', $first, $last, $email, $country, $phone, $birth,
            $partner['id'] ?? null, $partner['promo_code'] ?? '', now(),
        ]);
        audit('register', $id, $id);
    });
    unset($_SESSION['referral']);
    session_regenerate_id(true);
    $_SESSION['member'] = ['id' => $id, 'version' => 1, 'started' => time()];
    return user_view(query('SELECT * FROM users WHERE id=?', [$id])->fetch(), true);
}

function change_password(array $body, string $slot): void
{
    $user = $slot === 'staff' ? require_staff('settings') : ($slot === 'affiliate' ? session_user('affiliate') : require_member());
    if (!$user) abort_api('Giriş yapın.', 401);
    $current = $body['currentPassword'] ?? '';
    if (!is_string($current) || !password_verify($current, $user['password'])) abort_api('Mevcut şifreniz hatalı.');
    $next = password_input($body, 'newPassword', $slot === 'staff' ? 12 : 8);
    query('UPDATE users SET password=?,session_version=session_version+1 WHERE id=?', [password_hash($next, PASSWORD_DEFAULT), $user['id']]);
    $_SESSION[$slot]['version']++;
    session_regenerate_id(true);
    audit('password.changed', $user['id'], $user['id']);
}

function request_reset(array $body): void
{
    rate_limit('reset', 5, 3600);
    if (!config()['mail_enabled'] || !filter_var(config()['mail_from'], FILTER_VALIDATE_EMAIL)) abort_api('E-posta servisi henüz yapılandırılmadı. Destek ile iletişime geçin.', 503);
    $email = field($body, 'email', 254, true);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) abort_api('Geçerli bir e-posta adresi girin.');
    $user = query("SELECT id FROM users WHERE email=? COLLATE NOCASE AND role='member' AND status='active'", [$email])->fetch();
    if (!$user) return;
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);
    query('DELETE FROM password_resets WHERE user_id=? OR expires_at<?', [$user['id'], time()]);
    query('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)', [$tokenHash, $user['id'], time() + 1800]);
    $url = rtrim(config()['base_url'], '/') . '/index.php#/sifre-yenile/' . $token;
    $sent = mail($email, 'SHALOM BET - Sifre yenileme', "Şifrenizi yenilemek için bağlantıyı açın. Bağlantı 30 dakika geçerlidir.\n\n" . $url,
        ['From' => config()['mail_from'], 'Content-Type' => 'text/plain; charset=UTF-8']);
    if (!$sent) { query('DELETE FROM password_resets WHERE token_hash=?', [$tokenHash]); abort_api('E-posta gönderilemedi. Lütfen daha sonra deneyin.', 503); }
}

function complete_reset(array $body): void
{
    rate_limit('complete-reset', 10, 900);
    $token = field($body, 'token', 64, true);
    $hash = password_hash(password_input($body), PASSWORD_DEFAULT);
    atomic(function () use ($token, $hash) {
        $reset = query('SELECT * FROM password_resets WHERE token_hash=? AND used=0 AND expires_at>?', [hash('sha256', $token), time()])->fetch();
        if (!$reset) abort_api('Bağlantının süresi dolmuş veya bağlantı geçersiz.');
        query('UPDATE users SET password=?,session_version=session_version+1 WHERE id=?', [$hash, $reset['user_id']]);
        query('UPDATE password_resets SET used=1 WHERE token_hash=?', [$reset['token_hash']]);
    });
}