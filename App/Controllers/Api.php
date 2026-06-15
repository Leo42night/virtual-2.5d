<?php
namespace App\Controllers;

use App\Core\Controller;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=utf-8");

class Api extends Controller
{

  public function index()
  {
    echo "API Kelas PBO 2025";
  }

  // get rating of each project (name, avg_rate, total_rate)
  public function ratings()
  {
    $data = $this->model("Rating_model")->getRatingProjects();
    echo json_encode($data);
  }

  public function me()
  {
    // header("Content-Type: application/json; charset=utf-8");

    $u = self::getAuthUser();

    if (!$u) {
      http_response_code(401);
      echo json_encode(['error' => 'unauthenticated', 'message' => 'User not logged in']);
      return;
    }

    echo json_encode([
      'id' => $u->sub,
      'email' => $u->email,
      'name' => $u->name,
      'picture' => $u->picture,
    ]);
  }

  public function getMyRate()
  {
    $req = json_decode(file_get_contents('php://input'), true);
    $project_id = $req['project_id'] ?? null;
    $user_id = $req['user_id'] ?? null;
    if (!$project_id || !$user_id) {
      echo json_encode(['success' => false, 'message' => 'project_id & user_id is required']);
      return;
    }
    $data = $this->model("Rating_model")->getRate($project_id, $user_id);
    echo json_encode($data);
  }

  public function rateThis()
  {
    // if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    //   http_response_code(405);
    //   echo json_encode(['error' => 'method_not_allowed', 'message' => 'Method not allowed']);
    //   return;
    // }

    // $req = json_decode(file_get_contents('php://input'), true);
    // $project_id = $req['project_id'] ?? null;
    // $rate = $req['rating'] ?? null;

    // // if (!$project_id || !is_numeric($project_id)) {
    // //   echo json_encode(['success' => true, 'message' => 'project_id required and must be numeric']);
    // //   return;
    // // }
    // try {
    //   $user_id = $this->getAuthUser()->sub ?? null;

    //   $ok = $this->model("Rating_model")->getRate($project_id, $user_id);
    //   if ($ok) { // update
    //     $result = $this->model("Rating_model")->update($user_id, $project_id, $rate);
    //     http_response_code(201);
    //     echo json_encode(['success' => true, 'message' => 'Rating updated', 'data' => $result]);
    //   } else {
    //     $data = $this->model("Rating_model")->store($user_id, $project_id, $rate);
    //     http_response_code(200);
    //     echo json_encode(['success' => true, 'message' => 'Rating saved', 'data' => $data]);
    //   }
    // } catch (\Exception $e) {
    //   http_response_code(500);
    //   echo json_encode(['error' => 'internal_server_error', 'message' => $e->getMessage()]);
    // }

    // START: DEBUG MODE
    // ✅ tracking id dari frontend
    $requestId = $_SERVER['HTTP_X_REQUEST_ID'] ?? bin2hex(random_bytes(8));

    // ✅ pastikan selalu JSON
    header('Content-Type: application/json; charset=utf-8');

    // ✅ handle method
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
      $this->jsonResponse(405, [
        'success' => false,
        'error' => 'method_not_allowed',
        'message' => 'Method not allowed',
        'request_id' => $requestId,
      ]);
      return;
    }

    try {
      // ✅ parse JSON body
      $raw = file_get_contents('php://input') ?: '';
      $req = json_decode($raw, true);

      if (!is_array($req)) {
        $this->jsonResponse(400, [
          'success' => false,
          'error' => 'invalid_json',
          'message' => 'Body must be valid JSON',
          'request_id' => $requestId,
          'debug' => [
            'raw_preview' => substr($raw, 0, 200),
            'json_error' => json_last_error_msg(),
          ]
        ]);
        return;
      }

      $project_id = $req['project_id'] ?? null;
      $rate = $req['rating'] ?? null;

      // ✅ auth
      $auth = $this->getAuthUser();
      $user_id = $auth->sub ?? null;

      if (!$user_id) {
        $this->jsonResponse(401, [
          'success' => false,
          'error' => 'unauthenticated',
          'message' => 'User not logged in',
          'request_id' => $requestId,
        ]);
        return;
      }

      // ✅ validate input
      if (!$project_id || !is_numeric($project_id)) {
        $this->jsonResponse(422, [
          'success' => false,
          'error' => 'invalid_project_id',
          'message' => 'project_id is required',
          'request_id' => $requestId,
        ]);
        return;
      }

      if ($rate === null || !is_numeric($rate) || (int) $rate < 1 || (int) $rate > 5) {
        $this->jsonResponse(422, [
          'success' => false,
          'error' => 'invalid_rating',
          'message' => 'rating must be 1..5',
          'request_id' => $requestId,
        ]);
        return;
      }

      $project_id = (int) $project_id;
      $rate = (int) $rate;

      // ✅ upsert logic
      $exists = $this->model("Rating_model")->getRate($project_id, $user_id);

      if ($exists) {
        $result = $this->model("Rating_model")->update($user_id, $project_id, $rate);
        $this->jsonResponse(200, [
          'success' => true,
          'message' => 'Rating updated',
          'data' => $result,
          'request_id' => $requestId,
        ]);
        return;
      }

      $data = $this->model("Rating_model")->store($user_id, $project_id, $rate);
      $this->jsonResponse(201, [
        'success' => true,
        'message' => 'Rating saved',
        'data' => $data,
        'request_id' => $requestId,
      ]);
      return;

    } catch (\Throwable $e) {
      // ✅ log server-side
      error_log("[/api/rate][$requestId] " . $e->getMessage() . "\n" . $e->getTraceAsString());

      $this->jsonResponse(500, [
        'success' => false,
        'error' => 'server_error',
        'message' => 'Internal server error',
        'request_id' => $requestId,
        // optional saat dev:
        'debug' => [
          'exception' => $e->getMessage(),
          'file' => $e->getFile(),
          'line' => $e->getLine(),
        ]
      ]);
      return;
    }

    // END: DEBUG MODE
  }

  // utilities for this class
  private static function getAuthUser()
  {
    if (!isset($_COOKIE['auth_token']))
      return null;

    try {
      $secret = JWT_SECRET;
      return JWT::decode($_COOKIE['auth_token'], new Key($secret, 'HS256'));
    } catch (\Exception $e) {
      return null;
    }
  }
}