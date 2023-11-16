import { WINRATE_OVER, WINRATE_PIE, WINRATE_TEXT } from "./constants.js";
import { getColorForValue } from "./board.js";
export function updateWinrate(winrate, lastMoveValue, color = '') {
    let { black, white } = winrate;

    // Convert white percentage to grayscale for background
    WINRATE_OVER.style.backgroundColor = color == '' ? getColorForValue(lastMoveValue) : color;

    // Invert grayscale value for text color
    let textColor =  white > black ? `white` : `black`;
    WINRATE_TEXT.style.color = textColor;

    // Update winrate text
    WINRATE_TEXT.innerHTML = white > black ? `${white}%` : `${black}%`;

    // Update pie chart gradient
    WINRATE_PIE.style.backgroundImage = `conic-gradient(white 0%, white ${white}%, black ${white}%, black 100%)`;
}
