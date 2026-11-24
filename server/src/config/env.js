// Loads server/.env into process.env. Real environment variables win over the file.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

module.exports = {};
