<?php
declare(strict_types=1);

function admin_state(): array
{
    $staff = session_user('staff');
    if (!$staff) abort_api('Yönetim oturumu gerekli.', 401);
    $allowed = $staff['role'] === 'owner' ? permissions() : decode($staff['permissions']);
    $can = fn(string $name) => in_array($name, $allowed, true);
    $result = ['staff' => user_view($staff, true), 'players' => [], 'employees' => [], 'affiliates' => [], 'transactions' => [], 'bets' => [], 'messages' => [], 'files' => [], 'audit' => [], 'content' => new stdClass(), 'settings' => setting('site', default_settings())];
    if ($can('players') || $can('finance') || $can('bets')) {
        $result['players'] = array_map(fn($row) => user_view($row, true), query("SELECT * FROM users WHERE role='member' ORDER BY created_at DESC LIMIT 2000")->fetchAll());
    }
    if ($can('employees')) $result['employees'] = array_map(fn($row) => user_view($row, true), query("SELECT * FROM users WHERE role='employee' ORDER BY created_at DESC")->fetchAll());
    if ($can('affiliates')) {
        foreach (query("SELECT u.*, (SELECT COUNT(*) FROM users m WHERE m.affiliate_id=u.id AND m.role='member') AS referred_count FROM users u WHERE role='affiliate' ORDER BY created_at DESC")->fetchAll() as $row) {
            $result['affiliates'][] = user_view($row, true) + ['referredCount' => (int)$row['referred_count']];
        }
    }
    if ($can('finance')) $result['transactions'] = transaction_list();
    if ($can('bets')) $result['bets'] = bet_list();
    if ($can('support')) $result['messages'] = query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 1000')->fetchAll();
    if ($can('players')) $result['files'] = query("SELECT f.id,f.original_name,f.status,f.created_at,u.username FROM files f LEFT JOIN users u ON f.user_id=u.id WHERE f.kind='identity' ORDER BY f.created_at DESC LIMIT 500")->fetchAll();
    foreach (['games', 'matches', 'banners', 'paymentMethods', 'pages', 'helpArticles'] as $type) {
        if (!$can(content_permission($type))) continue;
        $result['content']->{$type} = array_map(fn($row) => decode($row['data']) + ['id' => $row['id']], query('SELECT * FROM content WHERE type=? ORDER BY sort_order, updated_at', [$type])->fetchAll());
    }
    if ($staff['role'] === 'owner') $result['audit'] = query('SELECT a.*, u.username FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY created_at DESC LIMIT 150')->fetchAll();
    return $result;
}

function save_staff(array $body): array
{
    $role = field($body, 'role', 20, true);
    if (!in_array($role, ['employee', 'affiliate'], true)) abort_api('Geçersiz hesap türü.');
    $staff = require_staff($role === 'employee' ? 'employees' : 'affiliates', $role === 'employee');
    $id = field($body, 'id', 32) ?: uid();
    if (!preg_match('/^[a-f0-9]{32}$/', $id)) abort_api('Geçersiz hesap.');
    $existing = query('SELECT * FROM users WHERE id=?', [$id])->fetch();
    if ($existing && $existing['role'] !== $role) abort_api('Hesap türü değiştirilemez.', 403);
    $username = field($body, 'username', 24, true);
    if (!preg_match('/^[a-zA-Z0-9_.]{3,24}$/', $username)) abort_api('3-24 karakterlik kullanıcı adı girin.');
    $name = field($body, 'name', 100, true);
    $status = field($body, 'status', 12) ?: 'active';
    if (!in_array($status, ['active', 'blocked'], true)) abort_api('Geçersiz durum.');
    $requested = $body['permissions'] ?? [];
    if (!is_array($requested)) abort_api('Yetki alanını kontrol edin.');
    $perms = $role === 'employee' ? array_values(array_intersect(permissions(), $requested)) : [];
    $promo = null;
    if ($role === 'affiliate') {
        $promo = strtoupper(field($body, 'promoCode', 40)) ?: strtoupper(bin2hex(random_bytes(5)));
        if (!preg_match('/^[A-Z0-9_-]{3,40}$/', $promo)) abort_api('Promo kodunda 3-40 harf, rakam, alt çizgi veya tire kullanın.');
    }
    $hash = $existing['password'] ?? '';
    if (!$existing || !empty($body['password'])) $hash = password_hash(password_input($body, 'password', 12), PASSWORD_DEFAULT);
    atomic(function () use ($id, $existing, $username, $role, $hash, $name, $status, $perms, $promo, $staff) {
        $other = query('SELECT id FROM users WHERE id<>? AND (username=? COLLATE NOCASE OR (promo_code IS NOT NULL AND promo_code=? COLLATE NOCASE))', [$id, $username, $promo])->fetch();
        if ($other) abort_api('Kullanıcı adı veya promo kodu zaten kullanılıyor.', 409);
        if ($existing) query('UPDATE users SET username=?,password=?,first_name=?,status=?,permissions=?,promo_code=?,session_version=session_version+1 WHERE id=?', [$username, $hash, $name, $status, json_string($perms), $promo, $id]);
        else query('INSERT INTO users(id,username,password,role,first_name,status,permissions,promo_code,created_at) VALUES(?,?,?,?,?,?,?,?,?)', [$id, $username, $hash, $role, $name, $status, json_string($perms), $promo, now()]);
        audit($role . '.save', $id, $staff['id']);
    });
    return user_view(query('SELECT * FROM users WHERE id=?', [$id])->fetch(), true);
}

function set_user_status(array $body): void
{
    $id = field($body, 'id', 32, true);
    $user = query('SELECT * FROM users WHERE id=?', [$id])->fetch();
    if (!$user || $user['role'] === 'owner') abort_api('Bu hesap değiştirilemez.', 403);
    $staff = require_staff(match ($user['role']) { 'employee' => 'employees', 'affiliate' => 'affiliates', default => 'players' }, $user['role'] === 'employee');
    $status = field($body, 'status', 12, true);
    if (!in_array($status, ['active', 'blocked'], true)) abort_api('Durum geçersiz.');
    if ($status === 'active' && $user['excluded_until'] && strtotime($user['excluded_until']) > time()) abort_api('Oyuncunun kendi belirlediği ara verme süresi kaldırılamaz.');
    query('UPDATE users SET status=?,session_version=session_version+1 WHERE id=?', [$status, $id]);
    audit('user.' . $status, $id, $staff['id']);
}

function affiliate_members(?string $id = null): array
{
    if ($id !== null) require_staff('affiliates');
    else {
        $partner = session_user('affiliate');
        if (!$partner) abort_api('Ortak oturumu gerekli.', 401);
        $id = $partner['id'];
    }
    // Immutable affiliate_id prevents reassignment when a promo code is edited.
    return array_map(fn($row) => ['id' => $row['id'], 'username' => $row['username'], 'createdAt' => $row['created_at'], 'status' => $row['status']],
        query("SELECT id,username,created_at,status FROM users WHERE role='member' AND affiliate_id=? ORDER BY created_at DESC LIMIT 5000", [$id])->fetchAll());
}

function export_content(): array
{
    require_staff('backup', true);
    return ['format' => 'shalom-content-v1', 'exportedAt' => now(), 'settings' => setting('site', default_settings()), 'items' => query('SELECT id,type,data,sort_order,active FROM content')->fetchAll()];
}

function import_content(array $body): void
{
    $staff = require_staff('backup', true);
    if (($body['format'] ?? '') !== 'shalom-content-v1' || !is_array($body['items'] ?? null) || count($body['items']) > 1000) abort_api('Geçerli içerik yedeği seçin.');
    $valid = [];
    foreach ($body['items'] as $row) {
        if (!is_array($row)) abort_api('Geçersiz yedek kaydı.');
        $type = field($row, 'type', 32, true); content_permission($type);
        $valid[] = ['type' => $type, 'item' => sanitize_content($type, decode((string)($row['data'] ?? '')))];
    }
    atomic(function () use ($valid, $staff) {
        foreach ($valid as $row) {
            $item = $row['item'];
            query('INSERT INTO content(id,type,data,active,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,data=excluded.data,active=excluded.active,updated_at=excluded.updated_at', [$item['id'], $row['type'], json_string($item), $item['active'] ? 1 : 0, now()]);
        }
        audit('content.import', null, $staff['id']);
    });
}