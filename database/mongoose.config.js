require('dotenv').config();

const config = {
  development: {
    uri: process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/nlsql_dev',
    options: {
      authSource: 'admin',
    }
  },
  
  production: {
    uri: process.env.MONGODB_URI,
    options: {
      authSource: 'admin',
      ssl: true,
    }
  }
};

module.exports = config;