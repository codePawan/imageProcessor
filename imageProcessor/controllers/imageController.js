const express = require("express");
const multer = require("multer");
const { processCSV, getRequestStatus } = require("../services/imageService");
const { validateCSVFormat, saveCsvFile } = require("../services/csvService");

const router = express.Router();

// Multer setup for file upload
const upload = multer({ dest: "uploads/" });

// API to upload file and start processing
router.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    const filePath = `uploads/${req.file.filename}`;
    const requestId = Date.now().toString();
    try {
        // Validate CSV format
        await validateCSVFormat(filePath);
        await saveCsvFile(requestId, filePath);
        processCSV(filePath, requestId);
        res.status(200).json({ requestId });
    } catch (error) {
        console.log("error", error.message);
        res.status(500).json({
            error: "Error processing file: " + error.message,
        });
    }
});

// API to get status of a request
router.get("/status/:requestId", async (req, res) => {
    const { requestId } = req.params;
    try {
        const status = await getRequestStatus(requestId);
        if (status.length > 0) {
            res.json({ requestId, details: status });
        } else {
            res.status(404).json({ error: "Request not found" });
        }
    } catch (error) {
        res.status(500).json({
            error: "Error fetching status: " + error.message,
        });
    }
});

module.exports = router;
