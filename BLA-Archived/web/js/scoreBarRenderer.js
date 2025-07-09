import { CONFIG, getConfidencePointId } from './config.js';
import { DOM } from './domElements.js';

export class ScoreBarRenderer {
    constructor() {
        this.svgNS = CONFIG.SVG_NS;
        this.scoreBarConfig = CONFIG.SCORE_BAR;
    }

    createScoreBar() {
        const svg = this.createSVGElement();
        this.addBackdrops(svg);
        this.addConfidenceBoxes(svg);
        this.addCenterLine(svg);
        
        this.mountScoreBar(svg);
        return svg;
    }

    createSVGElement() {
        const svg = document.createElementNS(this.svgNS, "svg");
        svg.setAttributeNS(null, "width", "100%");
        svg.setAttributeNS(null, "height", "100%");
        return svg;
    }

    addBackdrops(svg) {
        // Black backdrop
        const blackGroup = document.createElementNS(this.svgNS, "g");
        svg.appendChild(blackGroup);

        const blackBackdrop = this.createBackdrop(
            CONFIG.ELEMENT_IDS.BLACK_POINTS_BACK,
            "rgb(60, 60, 60)"
        );
        blackGroup.appendChild(blackBackdrop);

        // White backdrop
        const whiteGroup = document.createElementNS(this.svgNS, "g");
        svg.appendChild(whiteGroup);

        const whiteBackdrop = this.createBackdrop(
            CONFIG.ELEMENT_IDS.WHITE_POINTS_BACK,
            "rgb(175, 175, 175)"
        );
        whiteGroup.appendChild(whiteBackdrop);
    }

    createBackdrop(id, fillColor) {
        const backdrop = document.createElementNS(this.svgNS, "rect");
        backdrop.setAttributeNS(null, "x", 0);
        backdrop.setAttributeNS(null, "y", 0);
        backdrop.setAttributeNS(null, "width", 0);
        backdrop.setAttributeNS(null, "height", this.scoreBarConfig.HEIGHT);
        backdrop.setAttributeNS(null, "fill", fillColor);
        backdrop.setAttributeNS(null, "id", id);
        return backdrop;
    }

    addConfidenceBoxes(svg) {
        this.addBlackConfidenceBoxes(svg);
        this.addWhiteConfidenceBoxes(svg);
    }

    addBlackConfidenceBoxes(svg) {
        const blackGroup = svg.querySelector('g'); // First group is black group
        
        for (let i = this.scoreBarConfig.TOTAL_BOXES; i >= 1; i--) {
            const box = this.createConfidenceBox(
                getConfidencePointId('black', i),
                this.calculateBlackBoxColor(i)
            );
            blackGroup.appendChild(box);
        }
    }

    addWhiteConfidenceBoxes(svg) {
        const whiteGroup = svg.querySelectorAll('g')[1]; // Second group is white group
        
        for (let i = 0; i < this.scoreBarConfig.TOTAL_BOXES; i++) {
            const box = this.createConfidenceBox(
                getConfidencePointId('white', i + 1),
                this.calculateWhiteBoxColor(i)
            );
            whiteGroup.appendChild(box);
        }
    }

    createConfidenceBox(id, fillColor) {
        const box = document.createElementNS(this.svgNS, "rect");
        box.setAttributeNS(null, "x", 0);
        box.setAttributeNS(null, "y", 0);
        box.setAttributeNS(null, "width", 0);
        box.setAttributeNS(null, "height", this.scoreBarConfig.HEIGHT);
        box.setAttributeNS(null, "id", id);
        box.setAttributeNS(null, "fill", fillColor);
        return box;
    }

    calculateBlackBoxColor(i) {
        let colorValue = 10 * i + 10; // Increments of 10 from 100% to 10%
        colorValue = Math.min(Math.max(colorValue, 10), 100); // Clamp between 10 and 100
        return `#${colorValue.toString(16).repeat(3)}`;
    }

    calculateWhiteBoxColor(i) {
        let colorValue = 245 - 10 * i; // 245 towards 255 (#FFFFFF)
        return `#${colorValue.toString(16).padStart(2, "0").repeat(3)}`;
    }

    addCenterLine(svg) {
        const centerLine = document.createElementNS(this.svgNS, "line");
        centerLine.setAttributeNS(null, "x1", this.scoreBarConfig.WIDTH / 2);
        centerLine.setAttributeNS(null, "y1", 0);
        centerLine.setAttributeNS(null, "x2", this.scoreBarConfig.WIDTH / 2);
        centerLine.setAttributeNS(null, "y2", this.scoreBarConfig.HEIGHT);
        centerLine.setAttributeNS(null, "stroke", "black");
        centerLine.setAttributeNS(null, "stroke-width", "3px");
        centerLine.setAttributeNS(null, "stroke-dasharray", "3");
        svg.appendChild(centerLine);
    }

    mountScoreBar(svg) {
        const countingContainer = DOM.get('counting');
        if (countingContainer) {
            countingContainer.appendChild(svg);
        } else {
            console.error('Score bar container not found');
        }
    }

    // Update score bar with new confidence values
    updateScoreBar(blackScores, whiteScores) {
        const blackBack = document.getElementById(CONFIG.ELEMENT_IDS.BLACK_POINTS_BACK);
        const whiteBack = document.getElementById(CONFIG.ELEMENT_IDS.WHITE_POINTS_BACK);
        
        if (!blackBack || !whiteBack) {
            console.error('Score bar backdrop elements not found');
            return;
        }

        let blackTotal = 0;
        let whiteTotal = 0;

        // Update black scores
        for (let i = 1; i <= this.scoreBarConfig.TOTAL_BOXES; i++) {
            const rect = document.getElementById(getConfidencePointId('black', i));
            if (rect) {
                const score = blackScores[i - 1];
                const width = (score / this.scoreBarConfig.MAX_SCORE) * this.scoreBarConfig.WIDTH;
                rect.setAttribute('width', width);
                rect.setAttribute('height', this.scoreBarConfig.HEIGHT);
                rect.setAttribute('x', blackTotal);
                blackTotal += width !== 0 ? width - 0.2 : width;
            }
        }

        // Update white scores
        for (let i = 1; i <= this.scoreBarConfig.TOTAL_BOXES; i++) {
            const rect = document.getElementById(getConfidencePointId('white', i));
            if (rect) {
                const score = whiteScores[i - 1];
                const width = (score / this.scoreBarConfig.MAX_SCORE) * this.scoreBarConfig.WIDTH;
                const xPosition = this.scoreBarConfig.WIDTH - whiteTotal - width;
                rect.setAttribute('width', width);
                rect.setAttribute('height', this.scoreBarConfig.HEIGHT);
                rect.setAttribute('x', xPosition);
                whiteTotal += width;
            }
        }

        // Update backdrops
        blackBack.setAttribute('width', blackTotal);
        whiteBack.setAttribute('width', whiteTotal);
        whiteBack.setAttribute('x', this.scoreBarConfig.WIDTH - whiteTotal);

        // Update score text
        this.updateScoreText(blackScores, whiteScores);
    }

    updateScoreText(blackScores, whiteScores) {
        const blackTotal = blackScores.reduce((acc, val) => acc + val, 0);
        const whiteTotal = whiteScores.reduce((acc, val) => acc + val, 0);

        const blackText = DOM.get('blackPoints');
        const whiteText = DOM.get('whitePoints');

        if (blackText) blackText.innerHTML = blackTotal;
        if (whiteText) whiteText.innerHTML = whiteTotal;
    }
}

// Create and export singleton instance
export const scoreBarRenderer = new ScoreBarRenderer(); 