import { CONFIG, getStoneId } from './config.js';
import { DOM } from './domElements.js';

export class BoardRenderer {
    constructor() {
        this.svgNS = CONFIG.SVG_NS;
        this.boardConfig = CONFIG.BOARD;
        this.starPoints = CONFIG.STAR_POINTS;
    }

    createBoard() {
        const svg = this.createSVGElement();
        this.addBackground(svg);
        this.addGrid(svg);
        this.addStarPoints(svg);
        this.addLabels(svg);
        this.addStonePositions(svg);
        
        this.mountBoard(svg);
        return svg;
    }

    createSVGElement() {
        const svg = document.createElementNS(this.svgNS, "svg");
        svg.setAttributeNS(null, "viewBox", `0 0 ${this.boardConfig.VIEW_BOX_SIZE} ${this.boardConfig.VIEW_BOX_SIZE}`);
        svg.setAttributeNS(null, "class", "board");
        svg.setAttributeNS(null, "id", CONFIG.ELEMENT_IDS.BOARD);
        svg.style.overflow = "visible";
        svg.style.width = "100%";
        svg.style.height = "100%";
        return svg;
    }

    addBackground(svg) {
        const background = document.createElementNS(this.svgNS, "rect");
        background.setAttributeNS(null, "x", this.boardConfig.OFFSET);
        background.setAttributeNS(null, "y", this.boardConfig.OFFSET);
        background.setAttributeNS(null, "width", this.boardConfig.GRID_SIZE);
        background.setAttributeNS(null, "height", this.boardConfig.GRID_SIZE);
        background.setAttributeNS(null, "fill", "rgba(0, 0, 0, 0.05)");
        svg.appendChild(background);
    }

    addGrid(svg) {
        const linesGroup = document.createElementNS(this.svgNS, "g");
        linesGroup.setAttributeNS(null, "class", "lines");
        svg.appendChild(linesGroup);

        for (let i = 0; i < this.boardConfig.SIZE; i++) {
            const pos = this.boardConfig.OFFSET + i * this.boardConfig.CELL_SIZE;

            // Horizontal line
            const hLine = this.createLine(
                this.boardConfig.OFFSET, pos,
                this.boardConfig.OFFSET + this.boardConfig.GRID_SIZE, pos
            );
            linesGroup.appendChild(hLine);

            // Vertical line
            const vLine = this.createLine(
                pos, this.boardConfig.OFFSET,
                pos, this.boardConfig.OFFSET + this.boardConfig.GRID_SIZE
            );
            linesGroup.appendChild(vLine);
        }
    }

    createLine(x1, y1, x2, y2) {
        const line = document.createElementNS(this.svgNS, "line");
        line.setAttributeNS(null, "x1", x1);
        line.setAttributeNS(null, "y1", y1);
        line.setAttributeNS(null, "x2", x2);
        line.setAttributeNS(null, "y2", y2);
        line.setAttributeNS(null, "stroke", "#000");
        return line;
    }

    addStarPoints(svg) {
        this.starPoints.forEach(point => {
            const circle = document.createElementNS(this.svgNS, "circle");
            circle.setAttributeNS(null, "cx", this.boardConfig.OFFSET + point.x * this.boardConfig.CELL_SIZE);
            circle.setAttributeNS(null, "cy", this.boardConfig.OFFSET + point.y * this.boardConfig.CELL_SIZE);
            circle.setAttributeNS(null, "r", 5);
            circle.setAttributeNS(null, "fill", "#000");
            svg.appendChild(circle);
        });
    }

    addLabels(svg) {
        const labelGroup = document.createElementNS(this.svgNS, "g");
        labelGroup.setAttributeNS(null, "class", "label");
        svg.appendChild(labelGroup);

        for (let i = 0; i < this.boardConfig.SIZE; i++) {
            const pos = this.boardConfig.OFFSET + i * this.boardConfig.CELL_SIZE;
            const number = this.boardConfig.SIZE - i;
            const letter = String.fromCharCode("A".charCodeAt(0) + (i >= 8 ? i + 1 : i)); // Skip 'I'

            // Add all four labels (top, bottom, left, right)
            this.addLabelText(labelGroup, pos, this.boardConfig.OFFSET / 2, letter); // Top
            this.addLabelText(labelGroup, pos, this.boardConfig.VIEW_BOX_SIZE - this.boardConfig.OFFSET / 2, letter); // Bottom
            this.addLabelText(labelGroup, this.boardConfig.OFFSET / 2, pos, number); // Left
            this.addLabelText(labelGroup, this.boardConfig.VIEW_BOX_SIZE - this.boardConfig.OFFSET / 2, pos, number); // Right
        }
    }

    addLabelText(parent, x, y, content) {
        const text = document.createElementNS(this.svgNS, "text");
        text.setAttributeNS(null, "x", x);
        text.setAttributeNS(null, "y", y);
        text.setAttributeNS(null, "font-size", "21");
        text.setAttributeNS(null, "text-anchor", "middle");
        text.setAttributeNS(null, "dy", "0.35em");
        text.setAttributeNS(null, "stroke", "#080808");
        text.setAttributeNS(null, "fill", "#080808");
        text.textContent = content;
        parent.appendChild(text);
    }

    addStonePositions(svg) {
        const stonesGroup = document.createElementNS(this.svgNS, "g");
        stonesGroup.setAttributeNS(null, "id", CONFIG.ELEMENT_IDS.STONES_GROUP);
        svg.appendChild(stonesGroup);

        for (let i = 0; i < this.boardConfig.SIZE; i++) {
            for (let j = 0; j < this.boardConfig.SIZE; j++) {
                const posX = this.boardConfig.OFFSET + i * this.boardConfig.CELL_SIZE;
                const posY = this.boardConfig.OFFSET + j * this.boardConfig.CELL_SIZE;
                
                const stonePlaceholder = this.createStoneElement(posX, posY, i, j);
                stonesGroup.appendChild(stonePlaceholder);
            }
        }
    }

    createStoneElement(posX, posY, i, j) {
        const stone = document.createElementNS(this.svgNS, "image");
        const size = this.boardConfig.CELL_SIZE * 0.99;
        
        stone.setAttributeNS(null, "x", posX - size / 2);
        stone.setAttributeNS(null, "y", posY - size / 2);
        stone.setAttributeNS(null, "width", size);
        stone.setAttributeNS(null, "height", size);
        stone.setAttributeNS("http://www.w3.org/1999/xlink", "href", "");
        stone.setAttributeNS(null, "id", getStoneId(i, j));
        
        return stone;
    }

    mountBoard(svg) {
        const boardContainer = DOM.get('goBoard');
        if (boardContainer) {
            boardContainer.innerHTML = "";
            boardContainer.appendChild(svg);
        } else {
            console.error('Board container not found');
        }
    }

    // Utility method to get stone element
    getStoneElement(x, y) {
        return document.getElementById(getStoneId(x, y));
    }

    // Clear all stones from the board
    clearAllStones() {
        for (let i = 0; i < this.boardConfig.SIZE; i++) {
            for (let j = 0; j < this.boardConfig.SIZE; j++) {
                const stone = this.getStoneElement(i, j);
                if (stone) {
                    stone.setAttribute('href', '');
                }
            }
        }
    }
}

// Create and export singleton instance
export const boardRenderer = new BoardRenderer(); 