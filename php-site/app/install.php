<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/content.php';

function install_site(string $username, string $password): void
{
    if (!preg_match('/^[a-zA-Z0-9_.]{3,24}$/', $username)) abort_api('3-24 karakterlik yönetici adı girin.');
    password_input(['password' => $password], 'password', 12);
    database();
    $lock = fopen(storage_path('setup.lock'), 'c');
    if (!$lock || !flock($lock, LOCK_EX)) abort_api('Kurulum kilidi alınamadı.', 503);
    try {
        if (installed()) abort_api('Kurulum daha önce tamamlanmış.', 409);
        database()->exec(file_get_contents(__DIR__ . '/schema.sql'));
        atomic(function () use ($username, $password) {
            if ((int)query("SELECT COUNT(*) FROM users WHERE role='owner'")->fetchColumn() > 0) abort_api('Yönetici zaten oluşturulmuş. Sunucu dosyalarını kontrol edin.', 409);
            query('INSERT INTO users(id,username,password,role,first_name,created_at) VALUES(?,?,?,?,?,?)', [uid(), $username, password_hash($password, PASSWORD_DEFAULT), 'owner', 'Yönetici', now()]);
            save_setting('site', default_settings());
        });
        if (file_put_contents(storage_path('installed.lock'), now(), LOCK_EX) === false) abort_api('Kurulum kilidi yazılamadı. storage klasörünü kontrol edin.', 500);
        chmod(storage_path('database.sqlite'), 0600);
        chmod(storage_path('installed.lock'), 0600);
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}