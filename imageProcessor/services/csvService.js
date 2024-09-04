const fs = require("fs");
const csv = require("csv-parser");
const { pool } = require("../utils/db");
const { PROCESS_STATUS } = require("../constants/constants");

async function validateCSVFormat(filePath) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on("headers", (headers) => {
                if (
                    headers.length !== 3 ||
                    headers[0] !== "SerialNumber" ||
                    headers[1] !== "ProductCode" ||
                    headers[2] !== "UnprocessedImageUrls"
                ) {
                    return reject(new Error("Invalid CSV format"));
                }
                resolve();
            })
            .on("error", reject);
    });
}

async function saveCsvFile(requestId, filePath) {
    const products = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on("data", async (row) => {
                const { SerialNumber, ProductCode, UnprocessedImageUrls } = row;
                if (!SerialNumber || !ProductCode || !UnprocessedImageUrls) {
                    const errorMessage = `CSV contains blank fields. SerialNumber: ${SerialNumber}, ProductCode: ${ProductCode}, UnprocessedImageUrls: ${UnprocessedImageUrls}`;
                    console.error(errorMessage);
                    throw new Error(errorMessage);
                }
                const imageUrls = UnprocessedImageUrls.split(",");
                products.push({
                    requestId,
                    productCode: ProductCode,
                    serialNo: SerialNumber,
                    unProcessedUrl: imageUrls,
                    status: PROCESS_STATUS.PENDING,
                });
            })
            .on("end", async () => {
                const connection = await pool.getConnection();
                try {
                    const values = products.map((item) => [
                        item.requestId,
                        item.productCode,
                        item.serialNo,
                        item.unProcessedUrl,
                        item.status,
                    ]);
                    await connection.query(
                        "INSERT INTO product_image_details (requestId, productCode, serialNo, unProcessedUrl, processedUrl, status) VALUES ?",
                        [values]
                    );
                    console.log("Bulk insertion completed successfully.");
                    resolve();
                } finally {
                    connection.release();
                }
            })
            .on("error", async (error) => {
                console.error("Error processing CSV file:", error);
                await updateAllProductDetailsStatusToFailed(requestId);
                reject();
            });
    });
}

// Utility function to save image details
async function saveImageDetails(productCode, requestId, serialNo, status) {
    const [conn] = await pool.getConnection();
    try {
        await conn.query(
            "INSERT INTO ProductImageDetails (requestId, productCode, serialNo, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)",
            [requestId, productCode, serialNo, status]
        );
    } finally {
        conn.release();
    }
}

// Utility function to save image link details
async function saveImageLink(productCode, requestId, processedUrl) {
    const [conn] = await pool.getConnection();
    try {
        await conn.query(
            "INSERT INTO product_image_details (productCode, requestId,  processed_url, status) VALUES (?, ?, ?, ?)",
            [productCode, requestId, processedUrl, PROCESS_STATUS.SUCCESS]
        );
    } finally {
        conn.release();
    }
}

// Function to update all product details status to failed
async function updateAllProductDetailsStatusToFailed(requestId) {
    const [conn] = await pool.getConnection();
    try {
        await conn.query(
            "UPDATE product_image_details SET status = ? WHERE requestId = ?",
            [PROCESS_STATUS.FAILED, requestId]
        );
    } finally {
        conn.release();
    }
}

// Utility function to update image details status
async function updateImageDetailsStatus(requestId, productCode, status) {
    const [conn] = await pool.getConnection();
    try {
        await conn.query(
            "UPDATE ProductImageDetails SET status = ? WHERE requestId = ? AND productCode = ?",
            [status, requestId, productCode]
        );
    } finally {
        conn.release();
    }
}

module.exports = {
    validateCSVFormat,
    saveImageDetails,
    saveImageLink,
    updateAllProductDetailsStatusToFailed,
    updateImageDetailsStatus,
    saveCsvFile,
};
