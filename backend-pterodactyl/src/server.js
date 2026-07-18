const app = require('./app');
const env = require('./config/env');

// Pterodactyl allocates a specific IP:port to the server container.
// Bind 0.0.0.0 and let the panel's allocation route 149.202.84.78:8164 to it.
app.listen(env.port, '0.0.0.0', () => {
  console.log(`WaiseNav API listening on 0.0.0.0:${env.port}`);
});
