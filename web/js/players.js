import { BLACK_NAME, WHITE_NAME } from "./domElements.js";

export function updatePlayerInfomation(black_text, white_text) {
    if (BLACK_NAME) BLACK_NAME.innerText = black_text;
    if (WHITE_NAME) WHITE_NAME.innerText = white_text;
}