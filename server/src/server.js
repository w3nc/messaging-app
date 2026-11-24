// Starts the HTTP server. The app itself is built in app.js.
require('./config/env');
const app = require('./app');

const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`Quickchat API listening on http://localhost:${port}`);
});
