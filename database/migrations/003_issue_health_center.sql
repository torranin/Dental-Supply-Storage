ALTER TABLE inventory_documents
 ADD COLUMN health_center_id INT UNSIGNED NULL,
 ADD COLUMN health_center_name VARCHAR(150) NULL,
 ADD CONSTRAINT fk_document_health_center FOREIGN KEY (health_center_id) REFERENCES health_centers(id),
 ADD CONSTRAINT chk_receipt_no_center CHECK (movement_type = 'out' OR health_center_id IS NULL);
