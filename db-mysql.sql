-- MYSQL
-- Dumping database structure for kelas_pbo
DROP DATABASE IF EXISTS `kelas_pbo`;
CREATE DATABASE IF NOT EXISTS `kelas_pbo`;
USE `kelas_pbo`;

-- Hapus tabel lama jika sudah ada agar tidak terjadi error saat skrip dijalankan ulang
DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `picture` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB;

-- Dumping structure for table kelas_pbo.ratings
CREATE TABLE IF NOT EXISTS `ratings` (
  `user_id` bigint unsigned NOT NULL,
  `project_id` bigint unsigned NOT NULL,
  `rate` tinyint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`project_id`),
  CONSTRAINT `fk_ratings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ratings_chk_1` CHECK ((`rate` between 1 and 5))
) ENGINE=InnoDB;



