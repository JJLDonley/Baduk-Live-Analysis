import { scoreBarRenderer } from "./scoreBarRenderer.js";

export function setScoreBar(blackScores, whiteScores) {
    console.log({ blackScores, whiteScores });
    scoreBarRenderer.updateScoreBar(blackScores, whiteScores);
}