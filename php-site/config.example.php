<?php
declare(strict_types=1);

// Copy to config.php. Keep this file and storage outside the web document root.
return [
    'environment' => getenv('SHALOM_ENV') ?: 'production',
    'base_url' => getenv('SHALOM_URL') ?: 'http://localhost:8080',
    'setup_key' => getenv('SHALOM_SETUP_KEY') ?: '',
    'storage' => getenv('SHALOM_STORAGE') ?: __DIR__ . '/storage',
    'timezone' => 'Europe/Istanbul',
    'mail_enabled' => false,
    'mail_from' => '',
    // Exact HTTPS hostnames only; do not put provider secrets in the admin panel.
    'game_api_hosts' => [],
    'game_api_token' => getenv('SHALOM_GAME_TOKEN') ?: '',
];