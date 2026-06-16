<?php

require_once __DIR__ . '/../../vendor/autoload.php';
use Dotenv\Dotenv;

$envPath = dirname(__DIR__, 2); // /app

if (file_exists($envPath . '/.env')) {
  $dotenv = Dotenv::createImmutable($envPath);
  $dotenv->load();
}

$host = $_SERVER['HTTP_HOST'];

$isLocal = strpos($host, 'localhost') !== false;

$base_url = $isLocal ? "http://$host" : "https://$host"; // pakai !== false, karena handle bug 0

// ?? will skip error
// ?: will show if key doesn't exist
define('IS_LOCAL', $isLocal);
define('BASE_URL', $base_url);
define('GOOGLE_REDIRECT_URI', getenv('GOOGLE_REDIRECT_URI') ?: $_ENV['GOOGLE_REDIRECT_URI'] ?? "$base_url/auth/recall");
define('DB_URL', getenv('DB_URL') ?: $_ENV['DB_URL'] ?? '');
define('DB_TOKEN', getenv('DB_TOKEN') ?: $_ENV['DB_TOKEN'] ?? '');

// Auth Secret
define('GOOGLE_CLIENT_ID', getenv('GOOGLE_CLIENT_ID') ?: $_ENV['GOOGLE_CLIENT_ID'] ?? '');
define('GOOGLE_CLIENT_SECRET', getenv('GOOGLE_CLIENT_SECRET') ?: $_ENV['GOOGLE_CLIENT_SECRET'] ?? '');
define('JWT_SECRET', getenv('JWT_SECRET') ?: $_ENV['JWT_SECRET'] ?? '');
// echo getenv('TEST') ?? 'gagal'; // untuk dev jika ingin test .env ter load
// var_dump(getenv('HTTPS') ? getenv('HTTPS') : $_ENV['HTTPS'] ?? 'gagal');
// die();
// die();