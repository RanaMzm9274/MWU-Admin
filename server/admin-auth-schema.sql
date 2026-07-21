CREATE TABLE IF NOT EXISTS admin_users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'content-manager',
  status ENUM('Active', 'Suspended', 'Invited') NOT NULL DEFAULT 'Invited',
  department VARCHAR(160) NULL,
  access_json JSON NOT NULL,
  password_reset_required TINYINT(1) NOT NULL DEFAULT 1,
  invite_token_hash VARCHAR(255) NULL,
  invite_expires_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_admin_users_status (status),
  INDEX idx_admin_users_role (role)
);

CREATE TABLE IF NOT EXISTS admin_user_audit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id CHAR(36) NULL,
  target_user_id CHAR(36) NULL,
  action VARCHAR(80) NOT NULL,
  details_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_user_audit_target (target_user_id),
  INDEX idx_admin_user_audit_actor (actor_user_id)
);

CREATE TABLE IF NOT EXISTS portal_settings (setting_key VARCHAR(80) PRIMARY KEY, settings_json JSON NOT NULL, updated_by CHAR(36) NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS portal_email_templates (id CHAR(36) PRIMARY KEY, name VARCHAR(160) NOT NULL, subject VARCHAR(255) NOT NULL, html_body LONGTEXT NOT NULL, text_body LONGTEXT NULL, created_by CHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS portal_forms (id CHAR(36) PRIMARY KEY, name VARCHAR(160) NOT NULL, shortcode VARCHAR(120) NOT NULL UNIQUE, recipient_email VARCHAR(190) NOT NULL, fields_json JSON NOT NULL, template_id CHAR(36) NULL, success_message VARCHAR(500) NULL, active TINYINT(1) NOT NULL DEFAULT 0, created_by CHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS portal_form_submissions (id CHAR(36) PRIMARY KEY, form_id CHAR(36) NOT NULL, payload_json JSON NOT NULL, email_status VARCHAR(40) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_form_submissions_form (form_id));
CREATE TABLE IF NOT EXISTS portal_backups (id CHAR(36) PRIMARY KEY, name VARCHAR(190) NOT NULL, backup_json LONGTEXT NOT NULL, created_by CHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_portal_backups_created (created_at));
