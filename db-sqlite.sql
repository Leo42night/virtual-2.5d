-- project id using static data
PRAGMA foreign_keys = ON;

-- Hapus tabel lama jika sudah ada agar tidak terjadi error saat skrip dijalankan ulang
DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    picture TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dumping structure for table kelas_pbo.ratings
-- project ada di js file karena data static, jadi project_id bukan relation
CREATE TABLE ratings (
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    rate INTEGER NOT NULL CHECK(rate BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY(user_id, project_id),

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);