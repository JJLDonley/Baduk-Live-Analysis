const express = require("express");
const { Server } = require("socket.io");
const io = require("socket.io-client");
const http = require("http");
const config = require("./config.js");

const PORT = config.port;
const URL = config.ogsUrl;
const PARAMS = { transports: ["websocket"] };

const APP = express();
const HTTP_SERVER = http.createServer(APP);
const BES = new Server(HTTP_SERVER);
const OGS = io(URL, PARAMS);
const GAMES = {};

const { exe: AIEXE, config: AICONFIG, model: AIMODEL } = config.getKataGoConfig();

module.exports = { 
    APP, 
    AIEXE, 
    AICONFIG, 
    AIMODEL, 
    BES, 
    GAMES, 
    HTTP_SERVER, 
    OGS, 
    PORT 
};
