import { CONFIG, getMoveValueColor, getStoneId } from "./config.js";
import { BLACK_IMAGE, WHITE_IMAGE, DOM } from "./domElements.js";

export function clearBoard() {
    for (let i = 0; i < CONFIG.BOARD.SIZE; i++) {
        for (let j = 0; j < CONFIG.BOARD.SIZE; j++) {
            const stone = document.getElementById(getStoneId(i, j));
            if (stone) {
                stone.setAttribute('href', '');
            }
        }
    }
}

export function markCurrentMove(move) {
    const [x, y] = move;
    const stone = document.getElementById(getStoneId(x, y));

    if (!stone) return;

    // Get the SVG container
    const svgContainer = stone.parentNode;
    const stoneImg = stone.getAttribute('href');
    const color = stoneImg === BLACK_IMAGE.src ? "#e8e8e8" : "#111111";
    
    // Remove the old marker, if it exists
    const oldMarker = document.getElementById(CONFIG.ELEMENT_IDS.CURRENT_MOVE_MARKER);
    if (oldMarker) {
        oldMarker.remove();
    }

    // Calculate the radius as half the width of the stone
    const radius = parseFloat(stone.getAttribute("width")) / 2;

    // Create a new circle element
    const circle = document.createElementNS(CONFIG.SVG_NS, "circle");

    // Set attributes for the circle
    const cx = parseFloat(stone.getAttribute("x")) + radius;
    const cy = parseFloat(stone.getAttribute("y")) + radius;
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", radius * 0.5);
    circle.setAttribute("stroke-width", "2.6315789473684212");
    circle.setAttribute("fill", "none");
    circle.setAttribute("class", "circle-label");
    circle.setAttribute("stroke", color);
    circle.setAttribute("id", CONFIG.ELEMENT_IDS.CURRENT_MOVE_MARKER);
    circle.setAttribute("class", `current-move-${x}-${y}`);

    // Append the circle to the SVG container
    svgContainer.appendChild(circle);
}

export function updateBoard(board) {
    // Assuming board is a 19x19 2D array with each cell containing 'b', 'w', or an empty string
    for (let i = 0; i < CONFIG.BOARD.SIZE; i++) {
        for (let j = 0; j < CONFIG.BOARD.SIZE; j++) {
            const stone = document.getElementById(getStoneId(j, i));
            if (!stone) continue; // Skip if the stone element does not exist

            if (board[i][j] === 'b') {
                // Set the stone to black
                stone.setAttribute('href', BLACK_IMAGE.src);
            } else if (board[i][j] === 'w') {
                // Set the stone to white
                stone.setAttribute('href', WHITE_IMAGE.src);
            } else {
                // Clear the stone
                stone.setAttribute('href', '');
            }
        }
    }
}

// Use the new config-based color function
export function getColorForValue(value) {
    return getMoveValueColor(value);
}

export function updateCurrentMoveColor(last, lastMoveValue, color = '') {
    const [player, x, y] = last.move;
    const currentMarkers = document.getElementsByClassName(`current-move-${x}-${y}`);
    
    if (currentMarkers.length > 0) {
        const fillColor = color === '' ? getColorForValue(lastMoveValue) : color;
        currentMarkers[0].setAttribute("fill", fillColor);
    }
}
