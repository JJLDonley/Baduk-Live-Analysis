const express = require("express");
const { Server } = require("socket.io");
const io = require("socket.io-client");
const http = require("http");

const PORT = 2468;
const URL = "https://online-go.com"; // OGS URL
const PARAMS = { transports: ["websocket"] }; // OGS PARAMS

const APP = express();
const HTTP_SERVER = http.createServer(APP);
const BES = new Server(HTTP_SERVER); // Using Server constructor backend server
const OGS = io(URL, PARAMS); // OGS connection using 'io'
const GAMES = {};

const isLinux = process.env.IS_LINUX;
const AIEXE = isLinux ? "./katago-linux/katago" : "./katago/katago.exe";
const AICONFIG = isLinux ? "./katago-linux/default_config.cfg" : "./katago/default_config.cfg";
const AIMODEL = isLinux ? "./katago-linux/default_model.bin.gz" : "./katago/default_model.bin.gz";

module.exports = { APP, AIEXE, AICONFIG, AIMODEL, BES, GAMES, HTTP_SERVER, OGS, PORT };
