const express = require("express");
require("dotenv").config();
const imageController = require("./controllers/imageController");
const webhookRouter = require("./controllers/webhookController");
const { pool } = require("./utils/db");

const app = express();

// Middleware setup
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies

// Routes
app.use("/api/v1/csv", imageController);
app.use("/api", webhookRouter);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    try {
        const conn = await pool.getConnection();
        await conn.release();
        console.log(`Server is running on port ${PORT}`);
    } catch (error) {
        console.log("error", error.message);
    }
});
