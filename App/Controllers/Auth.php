<?php
namespace App\Controllers;

use App\Core\Controller;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class Auth extends Controller
{
  public function index()
  {
    echo "Route Auth Index - API Kelas PBO 2025";
  }

  public function popup() // popup login
  {
    $secret = JWT_SECRET;

    // Generate random state
    $state = bin2hex(random_bytes(16));

    // Payload JWT state
    $payload = [
      'state' => $state,
      'exp' => time() + 300
    ];

    // Encode JWT
    $jwt = JWT::encode($payload, $secret, 'HS256');

    setcookie("oauth_state_token", $jwt, [
      'expires' => time() + 300,
      'httponly' => true,
      'secure' => !IS_LOCAL,
      'path' => '/',
      'samesite' => 'Lax'
    ]);

    $googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth?" . http_build_query([
      'client_id' => GOOGLE_CLIENT_ID,
      'redirect_uri' => GOOGLE_REDIRECT_URI,
      'response_type' => 'code',
      'scope' => 'openid email profile',
      'state' => $state,
      'prompt' => 'select_account'
    ]);

    header('Content-Type: application/json');
    echo json_encode([
      'authUrl' => $googleAuthUrl,
      'expiresIn' => 300
    ]);
  }

  public function recall() // redirect callback
  {
    header("Cross-Origin-Opener-Policy: unsafe-none");
    header("Cross-Origin-Embedder-Policy: unsafe-none");

    $secret = JWT_SECRET;

    $code = $_GET['code'] ?? null;
    $state = $_GET['state'] ?? null;
    $isHttps = !IS_LOCAL;

    function renderClosePage($ok, $payload = [])
    {
      $data = json_encode(['type' => 'oauth_result', 'ok' => $ok] + $payload, JSON_UNESCAPED_SLASHES);
      $origin = BASE_URL;
      header('Content-Type: text/html; charset=utf-8');
      echo "<!doctype html><html><body>
        <script>
          (function(){
            const data = $data;
            const origin = " . json_encode($origin) . ";
            if (window.opener) {
              window.opener.postMessage(data, origin);
            }
            window.close();
          })();
        </script>
        <p>Login selesai. Kamu bisa menutup jendela ini.</p>
        </body></html>";
      exit;
    }

    // Validasi param
    if (!$code || !$state) {
      renderClosePage(false, ['error' => 'missing_code_or_state']);
    }

    // Ambil cookie JWT
    $jwtCookie = $_COOKIE['oauth_state_token'] ?? null;
    if (!$jwtCookie) {
      renderClosePage(false, ['error' => 'missing_state_cookie']);
    }

    // Decode JWT cookie
    try {
      $decoded = JWT::decode($jwtCookie, new Key($secret, 'HS256'));
    } catch (\Exception $e) {
      error_log('COOKIE: ' . json_encode($_COOKIE));
      renderClosePage(false, ['error' => 'invalid_state_token', 'data' => $e->getMessage()]);
    }

    // Cocokkan state
    if (empty($decoded->state) || $decoded->state !== $state) {
      renderClosePage(false, ['error' => 'state_mismatch']);
    }

    // (OPSIONAL) Hapus cookie state setelah dipakai
    setcookie("oauth_state_token", "", [
      'expires' => time() - 3600,
      'path' => '/',
      'httponly' => true,
      'secure' => $isHttps,
      'samesite' => 'Lax'
    ]);

    // Tukar code -> token (contoh pakai curl)
    $tokenEndpoint = "https://oauth2.googleapis.com/token";

    $postData = [
      'code' => $code,
      'client_id' => GOOGLE_CLIENT_ID,
      'client_secret' => GOOGLE_CLIENT_SECRET,
      'redirect_uri' => GOOGLE_REDIRECT_URI,
      'grant_type' => 'authorization_code'
    ];

    $ch = curl_init($tokenEndpoint);
    curl_setopt_array($ch, [
      CURLOPT_POST => true,
      CURLOPT_POSTFIELDS => http_build_query($postData),
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode < 200 || $httpCode >= 300) {
      renderClosePage(false, ['error' => 'token_exchange_failed', 'details' => $response]);
    }

    $token = json_decode($response, true);

    $accessToken = $token['access_token'] ?? null;
    if (!$accessToken) {
      renderClosePage(false, ['error' => 'missing_access_token']);
    }

    // Ambil userinfo dari Google
    $ch = curl_init("https://www.googleapis.com/oauth2/v2/userinfo");
    curl_setopt_array($ch, [
      CURLOPT_HTTPHEADER => ["Authorization: Bearer {$accessToken}"],
      CURLOPT_RETURNTRANSFER => true,
    ]);
    $userInfo = json_decode(curl_exec($ch), true);
    curl_close($ch);
    $email = $userInfo['email'];

    if (empty($email)) {
      renderClosePage(false, ['error' => 'failed_get_userinfo']);
    }


    // JIka ingin hanya email khusus yg bisa login
    // $pattern = '/^H1101\d{2}10\d{2}@student\.untan\.ac\.id$/i';

    // if (!preg_match($pattern, $email)) {
    //   setcookie("auth_token", "", [
    //     'expires' => time() - 3600,
    //     'path' => '/',
    //     'httponly' => true,
    //     'secure' => HTTPS === 'on',
    //     'samesite' => 'Lax'
    //   ]);

    //   // Optional: kalau mau tegas, jangan buat user & jangan set auth_token
    //   renderClosePage(false, [
    //     'error' => 'email_not_allowed',
    //     'message' => 'Email tidak valid. Gunakan email UNTAN: H1101xx10xx@student.untan.ac.id'
    //   ]);
    // }

    // cek user di DB
    $userModel = $this->model('User_model');
    $existing = $userModel->getByEmail($email);

    if (!$existing) {
      $userModel->store($userInfo);
      $flashCard = "User baru berhasil terdaftar";
      $user = $userModel->getByEmail($email);
    } else {
      $flashCard = "User berhasil login";
      $user = $existing;
    }

    // flash card
    setcookie("flash_card", $flashCard, [
      'expires' => time() + 60,
      'path' => '/',
      'samesite' => 'Lax'
    ]);

    // buat JWT login user
    $userPayload = [
      'sub' => $user['id'],
      'email' => $user['email'],
      'name' => $user['name'],
      'picture' => $user['picture'],
      'exp' => time() + 86400,
    ];

    $userJwt = JWT::encode($userPayload, $secret, 'HS256');

    // simpan cookie auth_token (same-origin)
    setcookie("auth_token", $userJwt, [
      'expires' => time() + 86400,
      'httponly' => true,
      'secure' => !IS_LOCAL, // untuk localhost http -> false
      'path' => '/',
      'samesite' => 'None' // ← GANTI dari 'Lax' ke 'None' untuk cross-context popup
    ]);

    // Jangan kirim token google ke frontend
    renderClosePage(true, [
      'message' => 'login_success'
    ]);
  }

  public function logout()
  {
    // Hapus cookie auth_token
    setcookie(
      "auth_token",
      "",
      [
        'expires' => time() - 3600,
        'httponly' => true,
        'secure' => true,
        'path' => '/',
        'samesite' => 'None'
      ]
    );

    // Hapus cookie oauth_state_token apabila masih ada
    setcookie(
      "oauth_state_token",
      "",
      [
        'expires' => time() - 3600,
        'httponly' => true,
        'secure' => !IS_LOCAL,
        'path' => '/',
        'samesite' => 'Lax'
      ]
    );
  }
}