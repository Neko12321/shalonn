<?php
declare(strict_types=1);

function upload_file(bool $identity = false): array
{
    $user = $identity ? require_member() : session_user('staff');
    if (!$user) abort_api('Giriş yapın.', 401);
    if (!$identity && $user['role'] !== 'owner' && !array_intersect(['games', 'banners'], decode($user['permissions']))) abort_api('Görsel yükleme yetkiniz yok.', 403);
    rate_limit('upload:' . $user['id'], 20, 3600);
    $file = $_FILES['file'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) abort_api('Dosya yüklenemedi.');
    if ($file['size'] < 1 || $file['size'] > 5 * 1024 * 1024) abort_api('En fazla 5 MB dosya yükleyin.');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if ($identity) $types['application/pdf'] = 'pdf';
    if (!isset($types[$mime])) abort_api('JPG, PNG, WEBP' . ($identity ? ' veya PDF' : '') . ' dosyası seçin.');
    if (str_starts_with($mime, 'image/')) {
        $dimensions = getimagesize($file['tmp_name']);
        if (!$dimensions || $dimensions[0] > 6000 || $dimensions[1] > 6000) abort_api('Görsel en fazla 6000x6000 piksel olabilir.');
    }
    $directory = $identity ? 'documents' : 'media';
    if (!is_dir(storage_path($directory))) mkdir(storage_path($directory), 0700, true);
    $id = uid();
    $relative = $directory . '/' . $id . '.' . $types[$mime];
    if (!move_uploaded_file($file['tmp_name'], storage_path($relative))) abort_api('Dosya kaydedilemedi.', 500);
    chmod(storage_path($relative), 0600);
    try {
        query('INSERT INTO files(id,user_id,kind,path,mime,original_name,status,created_at) VALUES(?,?,?,?,?,?,?,?)', [$id, $user['id'], $identity ? 'identity' : 'image', $relative, $mime, substr(basename($file['name']), 0, 200), $identity ? 'pending' : 'completed', now()]);
    } catch (Throwable $error) { unlink(storage_path($relative)); throw $error; }
    audit('file.upload', $id, $user['id']);
    return ['id' => $id, 'url' => 'media.php?id=' . $id];
}

function launch_game(array $body): array
{
    $user = require_member();
    rate_limit('launch:' . $user['id'], 30, 300);
    $id = field($body, 'gameId', 64, true);
    $row = query("SELECT data FROM content WHERE id=? AND type='games' AND active=1", [$id])->fetch();
    if (!$row) abort_api('Oyun bulunamadı.', 404);
    $game = decode($row['data']);
    if (empty($game['apiEndpoint'])) {
        if (!valid_web_url($game['url'] ?? '')) abort_api('Bu oyun için bağlantı tanımlanmadı.');
        return ['url' => $game['url']];
    }
    if (!extension_loaded('curl')) abort_api('Oyun API bağlantısı için cURL gerekli.', 503);
    $url = $game['apiEndpoint'];
    $parts = parse_url($url);
    $host = strtolower($parts['host'] ?? '');
    if (!valid_web_url($url) || ($parts['scheme'] ?? '') !== 'https' || isset($parts['port']) && (int)$parts['port'] !== 443 || !in_array($host, config()['game_api_hosts'], true)) abort_api('Oyun API sunucusuna izin verilmedi. Sunucu yapılandırmasını kontrol edin.', 503);
    $ips = gethostbynamel($host);
    if (!$ips) abort_api('Oyun sunucusunun adresi çözülemedi.', 503);
    foreach ($ips as $ip) if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) abort_api('Özel ağ adreslerine bağlantı engellendi.', 403);
    $output = ''; $tooLarge = false;
    $handle = curl_init($url);
    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    $secret = config()['game_api_token'];
    if (is_string($secret) && $secret !== '' && !preg_match('/[\r\n]/', $secret)) $headers[] = 'Authorization: Bearer ' . $secret;
    curl_setopt_array($handle, [
        CURLOPT_POST => true, CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_string(['gameId' => ($game['providerGameId'] ?? '') ?: $id, 'playerId' => $user['id'], 'currency' => 'TRY', 'language' => 'tr', 'returnUrl' => rtrim(config()['base_url'], '/') . '/index.php']),
        CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 15, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_RESOLVE => [$host . ':443:' . $ips[0]], CURLOPT_PROXY => '',
        CURLOPT_WRITEFUNCTION => function ($curl, string $chunk) use (&$output, &$tooLarge) {
            if (strlen($output) + strlen($chunk) > 65536) { $tooLarge = true; return 0; }
            $output .= $chunk; return strlen($chunk);
        },
    ]);
    $success = curl_exec($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    $data = decode($output);
    $launch = $data['url'] ?? $data['launchUrl'] ?? '';
    if ($success === false || $tooLarge || $status < 200 || $status >= 300 || !is_string($launch) || !valid_web_url($launch)) abort_api('Oyun API servisi geçerli bir adres döndürmedi.', 502);
    return ['url' => $launch];
}