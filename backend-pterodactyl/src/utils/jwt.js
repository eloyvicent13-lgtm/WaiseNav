const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signUserToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

module.exports = { signUserToken };
