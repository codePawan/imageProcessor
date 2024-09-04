mysql -u root 
CREATE DATABASE imageProcessor;

use imageProcessor;

create table product_image_details(
    id INT AUTO_INCREMENT PRIMARY KEY,
    requestId VARCHAR(255) ,
    productCode VARCHAR(255), 
    serialNo VARCHAR(255),
    unProcessedUrl JSON ,
    processedUrl JSON, 
    status ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED') DEFAULT 'PENDING'
);
CREATE INDEX idx_requestId_productCode ON product_image_details(requestId, productCode);





