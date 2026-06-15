<?php

// Override atura PHP ini.
ini_set('display_errors', 1); // ture
ini_set('display_startup_errors', 1); // true

// set scope error reporting
error_reporting(E_ALL);

spl_autoload_register(function ($class) {
    $prefix = "App\\";
    $base_dir = __DIR__ . '/../App/'; // handle di folder App

    // pastikan class App\Controllers\<Class> → App/controllers/<Class>.php
    if (str_starts_with($class, $prefix)) {
        $relative = str_replace("App\\", "", $class);
        $relative = str_replace("\\", "/", $relative);
        $file = $base_dir . $relative . ".php";

        if (file_exists($file)) {
            require_once $file;
        }
    }
});

// Start APP
require_once __DIR__ . '/../App/init.php';

$app = new App;