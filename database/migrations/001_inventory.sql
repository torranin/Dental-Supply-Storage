CREATE TABLE schema_migrations (
 version VARCHAR(100) PRIMARY KEY,
 applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE categories (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL UNIQUE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE units (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE storage_locations (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 code VARCHAR(30) NOT NULL UNIQUE,
 description VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE materials (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 code VARCHAR(30) NOT NULL UNIQUE,
 name VARCHAR(120) NOT NULL,
 category_id INT UNSIGNED NOT NULL,
 unit_id INT UNSIGNED NOT NULL,
 location_id INT UNSIGNED NULL,
 stock INT NOT NULL DEFAULT 0,
 minimum_stock INT NOT NULL DEFAULT 0,
 unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
 expiry_date DATE NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT chk_material_stock CHECK (stock >= 0),
 CONSTRAINT chk_material_min CHECK (minimum_stock >= 0),
 CONSTRAINT chk_material_price CHECK (unit_price >= 0),
 CONSTRAINT fk_material_category FOREIGN KEY (category_id) REFERENCES categories(id),
 CONSTRAINT fk_material_unit FOREIGN KEY (unit_id) REFERENCES units(id),
 CONSTRAINT fk_material_location FOREIGN KEY (location_id) REFERENCES storage_locations(id),
 INDEX idx_material_name (name),
 INDEX idx_material_expiry (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_documents (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 reference_no VARCHAR(50) NOT NULL UNIQUE,
 movement_type ENUM('in','out') NOT NULL,
 performed_by VARCHAR(120) NULL,
 note VARCHAR(500) NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_document_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_movements (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 document_id BIGINT UNSIGNED NOT NULL,
 material_id BIGINT UNSIGNED NOT NULL,
 quantity INT NOT NULL,
 unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
 balance_after INT NOT NULL,
 CONSTRAINT chk_movement_quantity CHECK (quantity > 0),
 CONSTRAINT chk_movement_price CHECK (unit_price >= 0),
 CONSTRAINT chk_movement_balance CHECK (balance_after >= 0),
 CONSTRAINT fk_movement_document FOREIGN KEY (document_id) REFERENCES inventory_documents(id),
 CONSTRAINT fk_movement_material FOREIGN KEY (material_id) REFERENCES materials(id),
 UNIQUE KEY uq_document_material (document_id, material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
