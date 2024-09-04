const axios = require("axios");
const fs = require("fs");
const csv = require("csv-parser");
const sharp = require("sharp");
const { pool } = require("../utils/db");
const { PROCESS_STATUS } = require("../constants/constants");
const {
    saveImageDetails,
    saveImageLink,
    updateAllProductDetailsStatusToFailed,
    updateImageDetailsStatus,
} = require("./csvService");

async function processImage(url, requestId, productCode) {
    try {
        const response = await axios({
            url,
            responseType: "arraybuffer",
        });
        const imageBuffer = Buffer.from(response.data, "binary");
        const processedImageBuffer = await sharp(imageBuffer)
            .jpeg({ quality: 50 })
            .toBuffer();

        // const processedUrl = `http://example.com/processed_images/${url
        //     .split("/")
        //     .pop()}`;

        await saveImageLink(productCode, requestId, url, processedImageBuffer);
    } catch (error) {
        throw new Error("Error processing image: " + error.message);
    }
}

async function updateImageDetails(requestId, productCode, status) {
    const conn = await pool.getConnection();
    try {
        await conn.query(
            "UPDATE product_image_details SET status = ? WHERE requestId = ? AND productCode = ?",
            [status, requestId, productCode]
        );
    } catch (error) {
        throw new Error(error);
    }
}

async function processCSV(filePath, requestId) {
    fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", async (row) => {
            const { ProductCode, UnprocessedImageUrls } = row;
            const imageUrls = UnprocessedImageUrls.split(",");
            await updateImageDetails(
                requestId,
                ProductCode,
                PROCESS_STATUS.PROCESSING
            );
            for (const url of imageUrls) {
                try {
                    await processImage(url, requestId, ProductCode);
                } catch (error) {
                    console.error(
                        `Failed to process image ${url}: ${error.message}`
                    );
                    await updateAllProductDetailsStatusToFailed(requestId);
                    return;
                }
            }
        })
        .on("error", async (error) => {
            console.error("Error processing CSV file:", error);
            await updateAllProductDetailsStatusToFailed(requestId);
        });
}

async function triggerWebhook(requestId) {
    try {
        const webhookUrl = "https://example.com/api/webhook"; // Replace with your actual webhook URL
        const payload = {
            requestId,
            status: "completed",
            timestamp: new Date(),
        };

        await axios.post(webhookUrl, payload);
        console.log("Webhook triggered successfully");
    } catch (error) {
        console.error("Error triggering webhook:", error);
        // Optionally handle webhook failures here
    }
}

async function getRequestStatus(requestId) {
    const [conn] = await pool.getConnection();

    try {
        const [rows] = await conn.query(
            "SELECT distinct status FROM ProductImageDetails WHERE requestId = ?",
            [requestId]
        );
        return rows;
    } finally {
        conn.release();
    }
}

module.exports = {
    processCSV,
    getRequestStatus,
};
