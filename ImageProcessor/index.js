const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');
const mysql = require('mysql2/promise');
const { PROCESS_STATUS } = require('./Constants');

const app = express();
const port = 3000;

// Setup MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  database: 'image_processing_db',
  password: 'password',
});

// Multer setup for file upload
const upload = multer({ dest: 'uploads/' });

// Utility function to save image details
async function saveImageDetails(productCode, requestId, serialNo, status) {
  const [conn] = await pool.getConnection();
  try {
    await conn.query(
      'INSERT INTO ProductImageDetails (requestId, productCode, serialNo, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)',
      [requestId, productCode, serialNo, status]
    );
  } finally {
    conn.release();
  }
}

// Utility function to save image link details
async function saveImageLink(productCode, requestId, unprocessedUrl, processedUrl) {
  const [conn] = await pool.getConnection();
  try {
    await conn.query(
      'INSERT INTO ProductImageLinks (productCode, requestId, unprocessed_url, processed_url) VALUES (?, ?, ?, ?)',
      [productCode, requestId, unprocessedUrl, processedUrl]
    );
  } finally {
    conn.release();
  }
}

// Function to process images
async function processImage(url, requestId, productCode) {
  try {
    const response = await axios({
      url,
      responseType: 'arraybuffer',
    });
    const imageBuffer = Buffer.from(response.data, 'binary');
    
    const processedImageBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 50 })
      .toBuffer();
    
    const processedUrl = `http://example.com/processed_images/${url.split('/').pop()}`;
    
    await saveImageLink(productCode, requestId, url, processedUrl);
  } catch (error) {
    throw new Error('Error processing image: ' + error.message);
  }
}

// Function to update all product details status to failed
async function updateAllProductDetailsStatusToFailed(requestId) {
  const [conn] = await pool.getConnection();
  try {
    await conn.query(
      'UPDATE ProductImageDetails SET status = ? WHERE requestId = ?',
      [PROCESS_STATUS.FAILED, requestId]
    );
  } finally {
    conn.release();
  }
}

// Function to process CSV
async function processCSV(filePath, requestId) {
  const products = {};

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', async (row) => {
      const { SerialNumber, ProductCode, UnprocessedImageUrls } = row;

      // Check for blank fields
      if (!SerialNumber || !ProductCode || !UnprocessedImageUrls) {
        const errorMessage = `CSV contains blank fields. SerialNumber: ${SerialNumber}, ProductCode: ${ProductCode}, UnprocessedImageUrls: ${UnprocessedImageUrls}`;
        console.error(errorMessage);
        await updateAllProductDetailsStatusToFailed(requestId);
        throw new Error(errorMessage);
      }

      const imageUrls = UnprocessedImageUrls.split(',');

      if (!products[ProductCode]) {
        await saveImageDetails(ProductCode, requestId, SerialNumber, PROCESS_STATUS.PROCESSING);
        products[ProductCode] = true;
      }

      for (const url of imageUrls) {
        try {
          await processImage(url, requestId, ProductCode);
        } catch (error) {
          console.error(`Failed to process image ${url}: ${error.message}`);
          await updateAllProductDetailsStatusToFailed(requestId);
          return; // Stop processing further images
        }
      }
    })
    .on('end', async () => {
      // If no image processing failed, update status to completed for all products
      const [conn] = await pool.getConnection();
      try {
        await conn.query(
          'UPDATE ProductImageDetails SET status = ? WHERE requestId = ?',
          [PROCESS_STATUS.SUCCESS, requestId]
        );
      } finally {
        conn.release();
      }
      console.log('CSV file processed successfully');
    })
    .on('error', async (error) => {
      console.error('Error processing CSV file:', error);
      await updateAllProductDetailsStatusToFailed(requestId);
    });
}

// Utility function to update image details status
async function updateImageDetailsStatus(requestId, productCode, status) {
  const [conn] = await pool.getConnection();
  try {
    await conn.query(
      'UPDATE ProductImageDetails SET status = ? WHERE requestId = ? AND productCode = ?',
      [status, requestId, productCode]
    );
  } finally {
    conn.release();
  }
}

// API to upload file and start processing
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = `uploads/${req.file.filename}`;
  const requestId = Date.now().toString(); // Generate a unique request ID based on timestamp

  try {
    // Validate CSV format
    await validateCSVFormat(filePath);

    // Start processing the CSV
    await processCSV(filePath, requestId);

    res.json({ requestId });
  } catch (error) {
    res.status(500).json({ error: 'Error processing file: ' + error.message });
  }
});

// API to get status of a request
app.get('/status/:requestId', async (req, res) => {
  const { requestId } = req.params;
  const [conn] = await pool.getConnection();

  try {
    const [rows] = await conn.query(
      'SELECT distinct status FROM ProductImageDetails WHERE requestId = ?',
      [requestId]
    );
    if (rows.length > 0) {
      res.json({ requestId, details: rows });
    } else {
      res.status(404).json({ error: 'Request not found' });
    }
  } finally {
    conn.release();
  }
});

// Validate CSV format
async function validateCSVFormat(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headers) => {
        if (headers.length !== 3 || headers[0] !== 'SerialNumber' || headers[1] !== 'ProductCode' || headers[2] !== 'UnprocessedImageUrls') {
          return reject(new Error('Invalid CSV format'));
        }
        resolve();
      })
      .on('error', reject);
  });
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
