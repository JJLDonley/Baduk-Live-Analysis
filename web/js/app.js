import { setScoreBar } from "./scorebar.js"
import { startCountdown } from "./clock.js"
import { updateBoard, markCurrentMove, updateCurrentMoveColor } from "./board.js"
import { updateWinrate } from "./winrate.js"
import { updatePlayerInfomation } from "./players.js"
export const APP = {}

APP.start = start
APP.setupSocket = setupSocket
APP.previous = {}
APP.current = {black: 50, white: 50}
APP.lastMoveValue

function start() {
  setScoreBar([10, 10, 10, 10, 10, 10, 10, 10, 10, 10], [10, 10, 10, 10, 10, 10, 10, 10, 10, 10] )
  APP.setupSocket();
  //handle ai evaluations
  APP.socket.on(APP.event, (data) =>{
    data = JSON.parse(data).data
    console.log(data)
    setPreviousAndCurrent(data.current.player, data.winrate.human)
    updatePlayerInfomation(data.players.black.name, data.players.white.name)
    setScoreBar(data.confidence.black.values, data.confidence.white.values)
    updateWinrate(data.winrate.human);
    updateCurrentMoveColor(data.last, APP.lastMoveValue)
  })
  //handle clock
  APP.socket.on(APP.clock, (data) =>{
    const jsonData = JSON.parse(data);
    const clockData = jsonData.data;
    const current = clockData.current_player === clockData.black_player_id ? "black" : "white";
    const black = clockData.black_time;
    const white = clockData.white_time;

    startCountdown(current, black, white);
  })
  //handle board
  APP.socket.on(APP.board, (data) =>{
    data = JSON.parse(data)
    updateBoard(data.board);
    markCurrentMove(data.move)
  })
}

function setupSocket() {
  APP.socket = io("0.0.0.0:2468");
  const queryParams = new URLSearchParams(window.location.search);
  const type = queryParams.get('type');
  const id = queryParams.get('id');

  APP.event = `${type}/${id}`
  APP.clock = `clock/${id}`
  APP.board = `board/${id}`
  
  APP.socket.on("connect", () => {
      console.log("connected");
      APP.socket.emit("subscribe", { type: type, id: id });
  });
  
  APP.socket.on("error", (err) => {
      console.log(err);
  });
  
  APP.socket.on("disconnect", () => {
      console.log("disconnected");
  });
  
}

function setPreviousAndCurrent(curent, winrate){
  APP.previous = APP.current
  APP.current = winrate
  APP.player = curent

  let value;

  if (APP.player === "B") {
    value = APP.previous.white - APP.current.white;
  } else {
    value = APP.previous.black - APP.current.black;
  }

  APP.lastMoveValue = value
}
