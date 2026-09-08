<?php
declare(strict_types=1);

function default_settings(): array
{
    return ['brandName' => 'SHALOM', 'brandSub' => 'BET', 'tagline' => 'Oyunun altın çağı.',
        'announcement' => '', 'announcementActive' => false, 'telegram' => '',
        'supportEmail' => '', 'supportPhone' => '', 'supportUrl' => ''];
}

function published_content(): array
{
    $result = ['games' => [], 'matches' => [], 'banners' => [], 'paymentMethods' => [], 'helpArticles' => [], 'pages' => new stdClass()];
    foreach (query('SELECT * FROM content WHERE active=1 ORDER BY sort_order,updated_at')->fetchAll() as $row) {
        $item = decode($row['data']);
        if ($row['type'] === 'pages') { $result['pages']->{$row['id']} = $item; continue; }
        if (!array_key_exists($row['type'], $result)) continue;
        if ($row['type'] === 'games') {
            $item['launchMode'] = !empty($item['apiEndpoint']) ? 'api' : 'link';
            unset($item['apiEndpoint'], $item['url']);
        }
        $result[$row['type']][] = $item + ['id' => $row['id']];
    }
    return $result;
}

function content_permission(string $type): string
{
    return match ($type) {
        'games' => 'games', 'matches' => 'matches', 'banners' => 'banners',
        'paymentMethods' => 'payments', 'pages' => 'pages', 'helpArticles' => 'support',
        default => throw new ApiError('Geçersiz içerik türü.'),
    };
}

function sanitize_content(string $type, array $input): array
{
    $id = field($input, 'id', 64) ?: uid();
    if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $id)) abort_api('Geçersiz kayıt kimliği.');
    $out = ['id' => $id, 'active' => ($input['active'] ?? true) === true];
    $keys = match ($type) {
        'games' => ['title', 'provider', 'category', 'imageUrl', 'url', 'apiEndpoint', 'providerGameId'],
        'matches' => ['home', 'away', 'league', 'sport', 'startsAt'],
        'banners' => ['title', 'description', 'imageUrl', 'buttonLabel', 'destination'],
        'paymentMethods' => ['name', 'kind', 'description'],
        'pages', 'helpArticles' => ['title', 'body'],
        default => throw new ApiError('Geçersiz içerik türü.'),
    };
    foreach ($keys as $key) $out[$key] = field($input, $key, $key === 'body' ? 30000 : ($key === 'description' ? 4000 : 2048));
    if (trim($out['title'] ?? $out['name'] ?? $out['home'] ?? '') === '') abort_api('Başlık veya ad alanını doldurun.');
    foreach (['url', 'apiEndpoint', 'imageUrl'] as $key) {
        if (empty($out[$key])) continue;
        if ($key === 'imageUrl' && preg_match('/^media\.php\?id=[a-f0-9]{32}$/', $out[$key])) continue;
        if (!valid_web_url($out[$key])) abort_api('Geçerli bir HTTP/HTTPS adresi girin.');
    }
    if ($type === 'games' && !in_array($out['category'], ['slots', 'casino', 'games', 'aviator', 'highflyer', 'spaceman'], true)) abort_api('Oyun kategorisini seçin.');
    if ($type === 'banners' && !preg_match('~^#/[a-z0-9/_-]*$~', $out['destination'] ?: '#/oyunlar')) abort_api('Banner hedefi site içi adres olmalıdır.');
    if ($type === 'matches') {
        if (!in_array($out['sport'], ['football', 'basketball', 'tennis', 'esports', 'virtual'], true) || !strtotime($out['startsAt']) || !$out['away'] || !$out['league']) abort_api('Karşılaşma bilgilerini kontrol edin.');
        $out['startsAt'] = gmdate('Y-m-d\TH:i:s\Z', strtotime($out['startsAt']));
        $out['live'] = ($input['live'] ?? false) === true;
        $out['minute'] = max(0, min(200, (int)($input['minute'] ?? 0)));
        $odds = $input['odds'] ?? [];
        if (!is_array($odds) || count($odds) !== 3) abort_api('Üç oran girin.');
        foreach ($odds as $odd) if (!is_numeric($odd) || (float)$odd < 1 || (float)$odd > 10000) abort_api('Oranlar 1-10000 aralığında olmalıdır.');
        $out['odds'] = array_map('floatval', array_values($odds));
        $out['score'] = [max(0, (int)($input['score'][0] ?? 0)), max(0, (int)($input['score'][1] ?? 0))];
    }
    if ($type === 'paymentMethods') {
        if (!in_array($out['kind'], ['bank', 'wallet', 'crypto', 'card'], true)) abort_api('Ödeme türü seçin.');
        $out['minimum'] = cents($input['minimum'] ?? '') / 100;
        $out['maximum'] = cents($input['maximum'] ?? '') / 100;
        if ($out['maximum'] < $out['minimum']) abort_api('Üst limit alt limitten küçük olamaz.');
        $out['deposit'] = ($input['deposit'] ?? false) === true;
        $out['withdraw'] = ($input['withdraw'] ?? false) === true;
    }
    return $out;
}

function save_content(array $body): array
{
    $type = field($body, 'type', 32, true);
    $staff = require_staff(content_permission($type));
    $item = sanitize_content($type, is_array($body['item'] ?? null) ? $body['item'] : []);
    atomic(function () use ($type, $item, $staff) {
        $existing = query('SELECT type FROM content WHERE id=?', [$item['id']])->fetch();
        if ($existing && $existing['type'] !== $type) abort_api('Kayıt türü değiştirilemez.');
        query('INSERT INTO content(id,type,data,active,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,active=excluded.active,updated_at=excluded.updated_at', [$item['id'], $type, json_string($item), $item['active'] ? 1 : 0, now()]);
        audit('content.save', $item['id'], $staff['id']);
    });
    return $item;
}

function save_site_settings(array $body): void
{
    $staff = require_staff('settings', true);
    $out = default_settings();
    foreach ($out as $key => $value) $out[$key] = is_bool($value) ? ($body[$key] ?? false) === true : field($body, $key, 1000);
    foreach (['telegram', 'supportUrl'] as $key) if ($out[$key] && !valid_web_url($out[$key])) abort_api('Geçerli bir adres girin.');
    if ($out['supportEmail'] && !filter_var($out['supportEmail'], FILTER_VALIDATE_EMAIL)) abort_api('Geçerli destek e-postası girin.');
    if (!$out['brandName']) abort_api('Marka adı boş olamaz.');
    save_setting('site', $out);
    audit('settings.save', null, $staff['id']);
}