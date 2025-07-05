import { WINRATE_OVER, WINRATE_PIE, WINRATE_TEXT } from "./domElements.js";
import { getColorForValue } from "./board.js";

export function updateWinrate(winrate, lastMoveValue, color = '') {
    const { black, white } = winrate;

    // Convert white percentage to background color based on move value
    WINRATE_OVER.style.backgroundColor = color === '' ? getColorForValue(lastMoveValue) : color;

    // Determine text color based on which player has higher winrate
    const textColor = white > black ? 'white' : 'black';
    WINRATE_TEXT.style.color = textColor;

    // Update winrate text with the higher percentage
    WINRATE_TEXT.innerHTML = white > black ? `${white}%` : `${black}%`;

    // Update pie chart gradient
    WINRATE_PIE.style.backgroundImage = `conic-gradient(white 0%, white ${white}%, black ${white}%, black 100%)`;
}
