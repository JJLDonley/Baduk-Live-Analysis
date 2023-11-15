import { BLACK_CLOCK, WHITE_CLOCK, BLACK_TIME, WHITE_TIME } from "./constants.js";
let countdownInterval
export function clockSetUp(black, white){
    BLACK_TIME = black;
    WHITE_TIME = white;

    BLACK_CLOCK.innerText = `${BLACK_TIME.minutes}:${BLACK_TIME.addZero}${BLACK_TIME.seconds}`
    WHITE_CLOCK.innerText = `${WHITE_TIME.minutes}:${WHITE_TIME.addZero}${WHITE_TIME.seconds}`
}

export function evaluateTimeLeft(TIME) {
    const seconds = Math.floor(TIME.thinking_time % 60);
    const addZero = seconds < 10 ? '0' : '';
    const minutes = Math.floor(TIME.thinking_time / 60);

    TIME.seconds = seconds
    TIME.addZero = addZero
    TIME.minutes = minutes
}

export function startCountdown(current, black, white) {
    if (countdownInterval) clearInterval(countdownInterval); // Clear any existing intervals

    countdownInterval = setInterval(() => {
        // Handle countdown for black player
        if (current === "black") {
            if (black.thinking_time > 0) {
                black.thinking_time--;
            } else {
                if (black.period_time_left > 0) {
                    black.period_time_left--;
                } else if (black.periods > 0) {
                    black.periods--;
                    black.period_time_left = black.period_time;
                }
                // Implement logic for what happens if black runs out of periods
            }
            // Reset white's period time if they still have periods left
            if (white.periods > 0 && white.thinking_time == 0) {
                white.period_time_left = white.period_time;
            }
        }

        // Handle countdown for white player
        if (current === "white") {
            if (white.thinking_time > 0) {
                white.thinking_time--;
            } else {
                if (white.period_time_left > 0) {
                    white.period_time_left--;
                } else if (white.periods > 0) {
                    white.periods--;
                    white.period_time_left = white.period_time;
                }
                // Implement logic for what happens if white runs out of periods
            }
            // Reset black's period time if they still have periods left
            if (black.periods > 0 && black.thinking_time == 0) {
                black.period_time_left = black.period_time;
            }
        }

        // Update the clock display
        updateClock(current, black, white);

        // Add logic to stop the interval when the game ends or a player runs out of periods
    }, 1000);
}

  function updateClock(current, black, white) {
    // Format the time for black
    let blackSeconds = Math.floor(black.thinking_time % 60);
    let blackMinutes = Math.floor(black.thinking_time / 60);
    let blackDisplay = black.thinking_time > 0 ? `${blackMinutes}:${blackSeconds < 10 ? '0' : ''}${blackSeconds}` : `${black.period_time_left.toFixed(0)} : ${black.periods}`;

    // Update black clock display
    BLACK_CLOCK.innerText = blackDisplay;

    // Format the time for white
    let whiteSeconds = Math.floor(white.thinking_time % 60);
    let whiteMinutes = Math.floor(white.thinking_time / 60);
    let whiteDisplay = white.thinking_time > 0 ? `${whiteMinutes}:${whiteSeconds < 10 ? '0' : ''}${whiteSeconds}` : `${white.period_time_left.toFixed(0)} : ${white.periods}`;

    // Update white clock display
    WHITE_CLOCK.innerText = whiteDisplay;
}