<?php
class Rating_model
{
  private $table = 'ratings';
  private $db;

  public function __construct()
  {
    $this->db = new Database;
  }

  public function getRate($project_id, $user_id)
  {
    $rows = $this->db->query(
      "SELECT * FROM {$this->table} WHERE project_id = ? AND user_id = ?",
      [$project_id, $user_id]
    );
    return $rows[0] ?? null;
  }

  public function getRatingProjects()
  {
    $rows = $this->db->query("
        SELECT
            r.project_id,
            r.rate,
            COUNT(*) AS total_raters,
            GROUP_CONCAT(u.picture) AS avatars_raw
        FROM ratings r
        LEFT JOIN users u ON u.id = r.user_id
        GROUP BY r.project_id, r.rate
        ORDER BY r.project_id
    ");

    $grouped = [];
    foreach ($rows as $row) {
      $pid = $row['project_id'];

      $avatars = $row['avatars_raw']
        ? array_slice(explode(',', $row['avatars_raw']), 0, 3)
        : [];

      $grouped[$pid][] = [
        'rate' => (int) $row['rate'],
        'count' => (int) $row['total_raters'],
        'avatars' => $avatars,
      ];
    }

    return $grouped;
  }

  public function store($user_id, $project_id, $rate)
  {
    $result = $this->db->execute([
      [
        'sql' => "INSERT INTO {$this->table} (project_id, user_id, rate) VALUES (?, ?, ?)",
        'args' => $this->db->bindArgs([$project_id, $user_id, $rate]),
      ]
    ]);
    return $result[0]['affected_row_count'] ?? 0;
  }

  public function update($user_id, $project_id, $rate)
  {
    $result = $this->db->execute([
      [
        'sql' => "UPDATE {$this->table} SET rate = ? WHERE project_id = ? AND user_id = ?",
        'args' => $this->db->bindArgs([$rate, $project_id, $user_id]),
      ]
    ]);
    return $result[0]['affected_row_count'] ?? 0;
  }
}