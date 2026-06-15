<?php
// pakai HTTP API Turso 

class Database
{
  private string $url;
  private string $token;

  public function __construct()
  {
    $this->url = DB_URL;   // libsql://... → dikonversi ke https://...
    $this->token = DB_TOKEN;
  }

  // Eksekusi single statement, return rows
  public function query(string $sql, array $params = []): array
  {
    $result = $this->execute([['sql' => $sql, 'args' => $this->bindArgs($params)]]);
    return $result[0]['rows'] ?? [];
  }

  // Eksekusi single statement, return affected rows / last insert id
  public function execute(array $statements): array
  {
    $endpoint = str_replace('libsql://', 'https://', $this->url) . '/v2/pipeline';

    $body = [
      'requests' => array_map(fn($stmt) => [
        'type' => 'execute',
        'stmt' => $stmt,
      ], $statements),
    ];
    $body['requests'][] = ['type' => 'close'];

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $this->token,
        'Content-Type: application/json',
      ],
      CURLOPT_POSTFIELDS => json_encode($body),
    ]);

    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($httpCode !== 200) {
      $err = json_decode($raw, true);
      throw new \RuntimeException('Turso error: ' . ($err['message'] ?? $raw));
    }

    $decoded = json_decode($raw, true);
    $results = [];

    foreach ($decoded['results'] as $res) {
      if (($res['type'] ?? '') === 'error') {
        throw new \RuntimeException('Turso query error: ' . $res['error']['message']);
      }
      if (($res['type'] ?? '') === 'ok') {
        $results[] = $this->parseResult($res['response']['result'] ?? []);
      }
    }

    return $results;
  }

  // Konversi hasil Turso → array assoc seperti PDO::FETCH_ASSOC
  private function parseResult(array $result): array
  {
    $cols = array_column($result['cols'] ?? [], 'name');
    $rows = [];

    foreach ($result['rows'] ?? [] as $row) {
      $assoc = [];
      foreach ($row as $i => $cell) {
        $assoc[$cols[$i]] = $cell['value'] ?? null;
      }
      $rows[] = $assoc;
    }

    return [
      'rows' => $rows,
      'affected_row_count' => $result['affected_row_count'] ?? 0,
      'last_insert_rowid' => $result['last_insert_rowid'] ?? null,
    ];
  }

  // Bind args: Turso butuh format [{"type":"text","value":"..."}]
  public function bindArgs(array $params): array
  {
    return array_map(function ($v) {
      if (is_null($v))
        return ['type' => 'null'];
      if (is_int($v))
        return ['type' => 'integer', 'value' => (string) $v];
      if (is_float($v))
        return ['type' => 'float', 'value' => (string) $v];
      return ['type' => 'text', 'value' => (string) $v];
    }, array_values($params));
  }
}

// HOW To Use
// $db = new Database();

// // SELECT
// $users = $db->query('SELECT * FROM users WHERE active = ?', [1]);

// // INSERT
// $result = $db->execute([[
//   'sql'  => 'INSERT INTO users (name, email) VALUES (?, ?)',
//   'args' => $db->bindArgs(['Budi', 'budi@example.com']), // bisa expose bindArgs jika perlu
// ]]);
// $lastId = $result[0]['last_insert_rowid'];

// // Batch / transaksi atomik (satu request HTTP)
// $db->execute([
//   ['sql' => 'UPDATE accounts SET balance = balance - ? WHERE id = ?', 'args' => [['type'=>'integer','value'=>'100'], ['type'=>'integer','value'=>'1']]],
//   ['sql' => 'UPDATE accounts SET balance = balance + ? WHERE id = ?', 'args' => [['type'=>'integer','value'=>'100'], ['type'=>'integer','value'=>'2']]],
// ]);