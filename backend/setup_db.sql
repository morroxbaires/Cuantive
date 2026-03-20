CREATE DATABASE IF NOT EXISTS cuantive CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cuantive'@'localhost' IDENTIFIED WITH mysql_native_password BY 'cuantive2026';
GRANT ALL PRIVILEGES ON cuantive.* TO 'cuantive'@'localhost';
FLUSH PRIVILEGES;
SELECT 'DONE' as result;
