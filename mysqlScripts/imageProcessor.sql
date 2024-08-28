mysql -u root 
CREATE DATABASE imageProcessor;

use imageProcessor;

-- Create Products Table
CREATE TABLE Products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    serial_number VARCHAR(255) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL
);

-- Create Images Table
CREATE TABLE Images (
    image_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    original_url TEXT NOT NULL,
    processed_url TEXT,
    status ENUM('Pending', 'InProgress', 'Completed') DEFAULT 'Pending',
    FOREIGN KEY (product_id) REFERENCES Products(product_id)
);

-- Create Requests Table
CREATE TABLE Requests (
    request_id VARCHAR(255) PRIMARY KEY,
    product_id INT,
    status ENUM('Pending', 'Processing', 'Completed') DEFAULT 'Pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);



