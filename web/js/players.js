import { BLACK_NAME, WHITE_NAME } from "./constants.js"
export function updatePlayerInfomation(black_text, white_text) {
    BLACK_NAME.innerText = black_text
    WHITE_NAME.innerText = white_text
}