import { CONFIDENCE_BLACK_TEXT, CONFIDENCE_WHITE_TEXT } from "./constants.js";

export function setScoreBar(blackScores, whiteScores) {
    const BLACK_BACK = document.getElementById('black-points-back')
    const WHITE_BACK = document.getElementById('white-points-back')
    const boxWidth = 524;
    const height = 38;
  
    let blackTotal = 0;
    let whiteTotal = 0;
  
    // Update black scores
    for (let i = 1; i <= 10; i++) {
      const rect = document.getElementById(`black-points-${i}`);
      const score = blackScores[i - 1];
      const width = (score / 368) * boxWidth;
      rect.setAttribute('width', width);
      rect.setAttribute('height', height);
      rect.setAttribute('x', blackTotal);
      blackTotal += width - 0.2;
    }
  
    // Update white scores
    for (let i = 1; i <= 10; i++) {
      const rect = document.getElementById(`white-points-${i}`);
      const score = whiteScores[i - 1];
      const width = (score / 368) * boxWidth;
      const xPosition = boxWidth - whiteTotal - width;
      rect.setAttribute('width', width);
      rect.setAttribute('height', height);
      rect.setAttribute('x', xPosition);
      whiteTotal += width; 
    }
    BLACK_BACK.setAttribute('width', blackTotal)
    WHITE_BACK.setAttribute('width', whiteTotal)
    WHITE_BACK.setAttribute('x',  boxWidth - whiteTotal);
    CONFIDENCE_BLACK_TEXT.innerHTML = blackScores.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
    CONFIDENCE_WHITE_TEXT.innerHTML = whiteScores.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
  
  }