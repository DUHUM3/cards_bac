const express = require('express');
const pool = require('./db');
const routes = require('./routes');

const app = express();
const PORT = 3000;

// Middleware for parsing data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// استخدام جميع الراوتات
app.use('/api', routes);

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});