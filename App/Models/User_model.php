<?php
class User_model
{
    private $table = 'users';
    private $db;

    public function __construct()
    {
        $this->db = new Database;
    }

    public function getAll()
    {
        return $this->db->query("SELECT * FROM {$this->table}");
    }

    public function getByEmail($email)
    {
        $rows = $this->db->query(
            "SELECT * FROM {$this->table} WHERE email = ?",
            [$email]
        );
        return $rows[0] ?? null;
    }

    public function store($data)
    {
        $result = $this->db->execute([
            [
                'sql' => "INSERT INTO {$this->table} (name, email, picture) VALUES (?, ?, ?)",
                'args' => $this->db->bindArgs([$data['name'], $data['email'], $data['picture']]),
            ]
        ]);
        return $result[0]['affected_row_count'] ?? 0;
    }
}