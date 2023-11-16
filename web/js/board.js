import { BLACK_IMAGE, WHITE_IMAGE, CURRENT_MOVE_MARKER_ID } from "./constants.js";

export function clearBoard(){
    for (let i = 0; i < 19; i++) {
        for (let j = 0; j < 19; j++) {
            let stone = document.getElementById(`stone-${i}-${j}`);
            if (stone) {
                stone.setAttribute('href', '');
            }
        }
    }
}

export function markCurrentMove(move) {
    const [x, y] = move;
    let stone = document.getElementById(`stone-${x}-${y}`);

    if (stone) {
        // Get the SVG container
        let svgContainer = stone.parentNode;
        let stoneImg = stone.getAttribute('href')
        const color = stoneImg == BLACK_IMAGE.src ? "#e8e8e8" : "#111111";
        // Remove the old marker, if it exists
        let oldMarker = document.getElementById(CURRENT_MOVE_MARKER_ID);
        if (oldMarker) {
            oldMarker.remove();
        }

        // Calculate the radius as half the width of the stone
        let radius = parseFloat(stone.getAttribute("width")) / 2;

        // Create a new circle element
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");

        // Set attributes for the circle
        let cx = parseFloat(stone.getAttribute("x")) + radius;
        let cy = parseFloat(stone.getAttribute("y")) + radius;
        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("r", radius * 0.5);
        circle.setAttribute("stroke-width", "2.6315789473684212"); // Adjust as needed
        circle.setAttribute("fill", "none");
        circle.setAttribute("class", "circle-label");
        circle.setAttribute("stroke", color);
        circle.setAttribute("id", CURRENT_MOVE_MARKER_ID); // Set the unique ID
        circle.setAttribute("class", `current-move-${x}-${y}`)

        // Append the circle to the SVG container
        svgContainer.appendChild(circle);
    }
}


export function updateBoard(board) {
    // Assuming board is a 19x19 2D array with each cell containing 'b', 'w', or an empty string
    for (let i = 0; i < 19; i++) {
        for (let j = 0; j < 19; j++) {
            let stone = document.getElementById(`stone-${j}-${i}`);
            if (!stone) continue; // Skip if the stone element does not exist

            if (board[i][j] === 'b') {
                // Set the stone to black
                stone.setAttribute('href', BLACK_IMAGE.src); // For SVG images
                // stone.src = BLACK_IMAGE.src; // Use this line if they are <img> elements
            } else if (board[i][j] === 'w') {
                // Set the stone to white
                stone.setAttribute('href', WHITE_IMAGE.src); // For SVG images
                // stone.src = WHITE_IMAGE.src; // Use this line if they are <img> elements
            } else {
                // Clear the stone
                stone.setAttribute('href', '');
                // stone.src = ''; // Use this line if they are <img> elements
            }
        }
    }
}

export function getColorForValue(value) {
    value = Math.abs(value); // Focus on the magnitude

    if (value < 1) {
      return "green";
    } else if (value >= 1 && value < 3) {
      return "yellowgreen";
    } else if (value >= 3 && value < 6) {
      return "rgb(255,206,0)";
    } else if (value >= 6 && value < 12) {
      return "orange";
    } else if (value >= 12 && value < 24) {
      return "red";
    } else {
      return "purple"; // Any value 24 and above
    }

    // The return "gray" will never be reached because of the conditions above,
    // but you can keep it if you want to handle potential future cases.
    return "gray";
  }

  export function updateCurrentMoveColor(last, lastMoveValue, color = '') {
    let [player, x, y ] = last.move;
    let currentMarkers = document.getElementsByClassName(`current-move-${x}-${y}`);
    
    if (currentMarkers.length > 0) {
        currentMarkers[0].setAttribute("fill", color == '' ? getColorForValue(lastMoveValue) : color);
    } else {
        return;
    }
}
