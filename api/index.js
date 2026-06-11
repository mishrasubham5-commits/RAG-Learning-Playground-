const serverModule = require("../dist/server.cjs");

const app = serverModule.app || serverModule.default || serverModule;

module.exports = app;
