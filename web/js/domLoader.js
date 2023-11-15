const svgNS = "http://www.w3.org/2000/svg";
const BOARD_SIZE = 19;
const OFFSET = 50;
const GRID_SIZE = 800;
const CELL_SIZE = GRID_SIZE / (BOARD_SIZE - 1);
const VIEWBOX_SIZE = GRID_SIZE + 2 * OFFSET;

const BLACK_IMAGE = new Image();
BLACK_IMAGE.src = 'https://ai-sensei.com/img/black_small.png'
const WHITE_IMAGE = new Image();
WHITE_IMAGE.src = 'https://ai-sensei.com/img/white_small.png'
const BOARD_IMAGE = new Image();
BOARD_IMAGE.src = 'https://ai-sensei.com/img/kaya14d.jpg'

function createGoBoardSVG() {
  const boardSize = 19;
  const offset = 50; // Space for labels
  const gridSize = 600; // Size of the grid for simplicity
  const viewBoxSize = gridSize + 2 * offset;
  const cellSize = gridSize / (boardSize - 1);

  // Create SVG element
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttributeNS(null, "viewBox", `0 0 ${viewBoxSize} ${viewBoxSize}`);
  svg.setAttributeNS(null, "class", "board");
  svg.setAttributeNS(null, "id", "board"); // Add this line
  svg.style.overflow = "visible";
  svg.style.width = '100%'; // Make it responsive
  svg.style.height = '100%'; // Make it responsive

  // Draw the board background
  const boardBackground = document.createElementNS(svgNS, "rect");
  boardBackground.setAttributeNS(null, "x", offset);
  boardBackground.setAttributeNS(null, "y", offset);
  boardBackground.setAttributeNS(null, "width", gridSize);
  boardBackground.setAttributeNS(null, "height", gridSize);
  boardBackground.setAttributeNS(null, "fill", "rgba(0, 0, 0, 0.05)");
  svg.appendChild(boardBackground);

  // Create the group for labels and lines
  const labelGroup = document.createElementNS(svgNS, "g");
  labelGroup.setAttributeNS(null, "class", "label");
  svg.appendChild(labelGroup);

  const linesGroup = document.createElementNS(svgNS, "g");
  linesGroup.setAttributeNS(null, "class", "lines");
  svg.appendChild(linesGroup);

  // Draw the lines of the board
  for (let i = 0; i < boardSize; i++) {
    const pos = offset + i * cellSize;

    // Horizontal line
    const hLine = document.createElementNS(svgNS, "line");
    hLine.setAttributeNS(null, "x1", offset);
    hLine.setAttributeNS(null, "y1", pos);
    hLine.setAttributeNS(null, "x2", offset + gridSize);
    hLine.setAttributeNS(null, "y2", pos);
    hLine.setAttributeNS(null, "stroke", "#000");
    linesGroup.appendChild(hLine);

    // Vertical line
    const vLine = document.createElementNS(svgNS, "line");
    vLine.setAttributeNS(null, "x1", pos);
    vLine.setAttributeNS(null, "y1", offset);
    vLine.setAttributeNS(null, "x2", pos);
    vLine.setAttributeNS(null, "y2", offset + gridSize);
    vLine.setAttributeNS(null, "stroke", "#000");
    linesGroup.appendChild(vLine);
  }

  // Add star points
  const starPoints = [
    { x: 3, y: 3 }, { x: 9, y: 3 }, { x: 15, y: 3 },
    { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 15, y: 9 },
    { x: 3, y: 15 }, { x: 9, y: 15 }, { x: 15, y: 15 },
  ];
  starPoints.forEach(point => {
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttributeNS(null, "cx", offset + point.x * cellSize);
    circle.setAttributeNS(null, "cy", offset + point.y * cellSize);
    circle.setAttributeNS(null, "r", 5);
    circle.setAttributeNS(null, "fill", "#000");
    svg.appendChild(circle);
  });

  // Add labels
  for (let i = 0; i < boardSize; i++) {
    const pos = offset + i * cellSize;
    const number = boardSize - i;
    const letter = String.fromCharCode('A'.charCodeAt(0) + (i >= 8 ? i + 1 : i)); // Skip 'I'

    // Top letters
    const topText = document.createElementNS(svgNS, "text");
    topText.setAttributeNS(null, "x", pos);
    topText.setAttributeNS(null, "y", offset / 2);
    topText.setAttributeNS(null, "font-size", "21");
    topText.setAttributeNS(null, "text-anchor", "middle");
    topText.setAttributeNS(null, "dy", "0.35em");
    topText.setAttributeNS(null, "stroke", "#080808");
    topText.setAttributeNS(null, "fill", "#080808");
    topText.textContent = letter;
    labelGroup.appendChild(topText);

    // Bottom letters
    const bottomText = topText.cloneNode(true);
    bottomText.setAttributeNS(null, "y", viewBoxSize - offset / 2);
    labelGroup.appendChild(bottomText);

    // Side numbers
    const sideNumberLeft = document.createElementNS(svgNS, "text");
    sideNumberLeft.setAttributeNS(null, "x", offset / 2);
    sideNumberLeft.setAttributeNS(null, "y", pos);
    sideNumberLeft.setAttributeNS(null, "font-size", "21");
    sideNumberLeft.setAttributeNS(null, "text-anchor", "middle");
    sideNumberLeft.setAttributeNS(null, "dy", "0.35em");
    sideNumberLeft.setAttributeNS(null, "stroke", "#080808");
    sideNumberLeft.setAttributeNS(null, "fill", "#080808");
    sideNumberLeft.textContent = number;
    labelGroup.appendChild(sideNumberLeft);

    const sideNumberRight = sideNumberLeft.cloneNode(true);
    sideNumberRight.setAttributeNS(null, "x", viewBoxSize - offset / 2);
    labelGroup.appendChild(sideNumberRight);
  }


  const stonesGroup = document.createElementNS(svgNS, 'g');
  stonesGroup.setAttributeNS(null, 'id', 'stonesGroup');
  svg.appendChild(stonesGroup);

  // Create placeholder stones for each intersection
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      const posX = offset + i * cellSize;
      const posY = offset + j * cellSize;
      const stonePlaceholder = document.createElementNS(svgNS, 'image');

      stonePlaceholder.setAttributeNS(null, 'x', posX - cellSize / 2 * 0.99);
      stonePlaceholder.setAttributeNS(null, 'y', posY - cellSize / 2 * 0.99);
      stonePlaceholder.setAttributeNS(null, 'width', cellSize * 0.99);
      stonePlaceholder.setAttributeNS(null, 'height', cellSize * 0.99);
      stonePlaceholder.setAttributeNS('http://www.w3.org/1999/xlink', 'href', ''); // Empty href at first
      stonePlaceholder.setAttributeNS(null, 'id', `stone-${i}-${j}`); // ID based on position

      stonesGroup.appendChild(stonePlaceholder);
    }
  }

  const boardContainer = document.querySelector('.goboard');
  boardContainer.innerHTML = ''; // Clear any existing content
  boardContainer.appendChild(svg);
}

function createScoreBarSVG() {
  const width = 524;
  const height = 38;
  const totalBoxes = 10;

  // Create the main SVG element
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttributeNS(null, "width", "100%");
  svg.setAttributeNS(null, "height", "100%");

  // Create a group for black points
  const blackGroup = document.createElementNS(svgNS, "g");
  svg.appendChild(blackGroup);

  // Create a group for white points
  const whiteGroup = document.createElementNS(svgNS, "g");
  svg.appendChild(whiteGroup);


  // Generate black points from left to right (1 to 0.1)
  for (let i = totalBoxes - 1; i >= 0; i--) {
    const box = document.createElementNS(svgNS, "rect");
    box.setAttributeNS(null, "x", i * 0);
    box.setAttributeNS(null, "y", 0);
    box.setAttributeNS(null, "width", 0);
    box.setAttributeNS(null, "height", height);
    box.setAttributeNS(null, "id", `black-points-${i + 1}`)

    // Calculate color value
    let colorValue = (10 - i) * 10 + 10; // Increments of 10 from 100% to 10%
    colorValue = Math.min(Math.max(colorValue, 10), 100); // Clamp value between 10 and 100

    const fillColor = `#${colorValue.toString(16).repeat(3)}`;
    box.setAttributeNS(null, "fill", fillColor);

    blackGroup.appendChild(box);
  }

  // Generate white points from right to left (1 to 0.1)
  for (let i = 0; i < totalBoxes; i++) {
    const box = document.createElementNS(svgNS, "rect");
    box.setAttributeNS(null, "x", (totalBoxes - i - 1) * 0);
    box.setAttributeNS(null, "y", 0);
    box.setAttributeNS(null, "width", 0);
    box.setAttributeNS(null, "height", height);
    box.setAttributeNS(null, "id", `white-points-${i + 1}`)
    
    let colorValue = 228 + i * 2; // 238 corresponds to #EEEEEE, incrementing towards 255 (#FFFFFF)
    const fillColor = `#${colorValue.toString(16).padStart(2, '0').repeat(3)}`;
    box.setAttributeNS(null, "fill", fillColor);

    whiteGroup.appendChild(box);
  }



  // Create a center dashed line
  const centerDashLine = document.createElementNS(svgNS, "line");
  centerDashLine.setAttributeNS(null, "x1", width / 2);
  centerDashLine.setAttributeNS(null, "y1", 0);
  centerDashLine.setAttributeNS(null, "x2", width / 2);
  centerDashLine.setAttributeNS(null, "y2", height);
  centerDashLine.setAttributeNS(null, "stroke", "black");
  centerDashLine.setAttributeNS(null, "stroke-width", "3px");
  centerDashLine.setAttributeNS(null, "stroke-dasharray", "3");
  svg.appendChild(centerDashLine);

  // Append the SVG to the document or a container element
  const countingContainer = document.querySelector('.counting');
  countingContainer.appendChild(svg);
}

document.addEventListener("DOMContentLoaded", function () {
  createGoBoardSVG();
  createScoreBarSVG();
});
