const mysql = require("mysql2/promise");

// Setup MySQL connection pool
const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    database: "image_processing_db",
    password: "",
});

module.exports = {
    pool,
};
