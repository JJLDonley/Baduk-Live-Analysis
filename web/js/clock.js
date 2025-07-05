import { BLACK_CLOCK, WHITE_CLOCK } from "./domElements.js";

// Clock time objects
export const BLACK_TIME = {};
export const WHITE_TIME = {};

// Clock state management
let countdownInterval;
let lastUpdateTime = 0;
let clockStartTime = 0;
let currentPlayer = null;
let clockState = {
    black: {},
    white: {},
    driftCorrection: 0
};

export function clockSetUp(black, white) {
    Object.assign(BLACK_TIME, black);
    Object.assign(WHITE_TIME, white);

    if (BLACK_CLOCK) {
        BLACK_CLOCK.innerText = `${BLACK_TIME.minutes}:${BLACK_TIME.addZero}${BLACK_TIME.seconds}`;
    }
    if (WHITE_CLOCK) {
        WHITE_CLOCK.innerText = `${WHITE_TIME.minutes}:${WHITE_TIME.addZero}${WHITE_TIME.seconds}`;
    }
}

export function evaluateTimeLeft(TIME) {
    const seconds = Math.floor(TIME.thinking_time % 60);
    const addZero = seconds < 10 ? "0" : "";
    const minutes = Math.floor(TIME.thinking_time / 60);

    TIME.seconds = seconds;
    TIME.addZero = addZero;
    TIME.minutes = minutes;
}

export function startCountdown(current, black, white) {
    // Clear any existing interval
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    // Record when we received this clock update
    const receiveTime = Date.now();
    
    // If this is the same player continuing, calculate drift correction
    if (currentPlayer === current && lastUpdateTime > 0) {
        const timeSinceLastUpdate = receiveTime - lastUpdateTime;
        // Apply drift correction if it's been more than 1.5 seconds since last update
        if (timeSinceLastUpdate > 1500) {
            const driftSeconds = Math.floor((timeSinceLastUpdate - 1000) / 1000);
            console.log(`Correcting clock drift: ${driftSeconds} seconds`);
            
            // Subtract drift from current player's time
            if (current === "black" && black.thinking_time > 0) {
                black.thinking_time = Math.max(0, black.thinking_time - driftSeconds);
            } else if (current === "white" && white.thinking_time > 0) {
                white.thinking_time = Math.max(0, white.thinking_time - driftSeconds);
            }
        }
    }

    // Update state
    currentPlayer = current;
    lastUpdateTime = receiveTime;
    clockStartTime = receiveTime;
    
    // Create deep copies to avoid reference issues
    clockState.black = JSON.parse(JSON.stringify(black));
    clockState.white = JSON.parse(JSON.stringify(white));

    // Start precision countdown
    startPrecisionCountdown();
}

function startPrecisionCountdown() {
    let expectedTime = clockStartTime + 1000; // First tick should be 1 second after start
    
    const tick = () => {
        const now = Date.now();
        const drift = now - expectedTime;
        
        // Update clock state
        updateClockState();
        
        // Update display
        updateClock(currentPlayer, clockState.black, clockState.white);
        
        // Schedule next tick, adjusting for drift
        expectedTime += 1000;
        const nextTickDelay = Math.max(0, 1000 - drift);
        
        countdownInterval = setTimeout(tick, nextTickDelay);
    };
    
    // Start the first tick
    countdownInterval = setTimeout(tick, 1000);
}

function updateClockState() {
    if (!currentPlayer) return;
    
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - clockStartTime) / 1000);
    
    // Calculate how much time should have elapsed
    const targetTime = clockStartTime + (elapsedSeconds * 1000);
    const actualElapsed = now - clockStartTime;
    
    // Apply time to current player
    if (currentPlayer === "black") {
        if (clockState.black.thinking_time > 0) {
            clockState.black.thinking_time = Math.max(0, clockState.black.thinking_time - elapsedSeconds);
        } else {
            if (clockState.black.period_time_left > 0) {
                clockState.black.period_time_left = Math.max(0, clockState.black.period_time_left - elapsedSeconds);
            } else if (clockState.black.periods > 0) {
                clockState.black.periods--;
                clockState.black.period_time_left = Math.max(0, clockState.black.period_time - elapsedSeconds);
            }
        }
        
        // Reset white's period time if they still have periods left
        if (clockState.white.periods > 0 && clockState.white.thinking_time === 0) {
            clockState.white.period_time_left = clockState.white.period_time;
        }
    } else if (currentPlayer === "white") {
        if (clockState.white.thinking_time > 0) {
            clockState.white.thinking_time = Math.max(0, clockState.white.thinking_time - elapsedSeconds);
        } else {
            if (clockState.white.period_time_left > 0) {
                clockState.white.period_time_left = Math.max(0, clockState.white.period_time_left - elapsedSeconds);
            } else if (clockState.white.periods > 0) {
                clockState.white.periods--;
                clockState.white.period_time_left = Math.max(0, clockState.white.period_time - elapsedSeconds);
            }
        }
        
        // Reset black's period time if they still have periods left
        if (clockState.black.periods > 0 && clockState.black.thinking_time === 0) {
            clockState.black.period_time_left = clockState.black.period_time;
        }
    }
    
    // Update start time to current moment for next calculation
    clockStartTime = now;
}

function updateClock(current, black, white) {
    // Format the time for black
    const blackSeconds = Math.floor(black.thinking_time % 60);
    const blackMinutes = Math.floor(black.thinking_time / 60);
    const blackDisplay = black.thinking_time > 0
        ? `${blackMinutes}:${blackSeconds < 10 ? "0" : ""}${blackSeconds}`
        : black.period_time_left > 0
        ? `${black.period_time_left.toFixed(0) < 10 ? "0" : ""}${black.period_time_left.toFixed(0)}<span class="small-text"> x${black.periods} </span>`
        : black.periods > 0
        ? `-0 <span class="small-text"> x${black.periods} </span>`
        : `-0 <span class="small-text"> -0 </span>`;

    // Update black clock display
    if (BLACK_CLOCK) {
        BLACK_CLOCK.innerHTML = blackDisplay;
    }

    // Format the time for white
    const whiteSeconds = Math.floor(white.thinking_time % 60);
    const whiteMinutes = Math.floor(white.thinking_time / 60);
    const whiteDisplay = white.thinking_time > 0
        ? `${whiteMinutes}:${whiteSeconds < 10 ? "0" : ""}${whiteSeconds}`
        : white.period_time_left > 0
        ? `${white.period_time_left.toFixed(0) < 10 ? "0" : ""}${white.period_time_left.toFixed(0)}<span class="small-text"> x${white.periods} </span>`
        : white.periods > 0
        ? `-0 <span class="small-text"> x${white.periods} </span>`
        : `-0 <span class="small-text"> -0 </span>`;

    // Update white clock display
    if (WHITE_CLOCK) {
        WHITE_CLOCK.innerHTML = whiteDisplay;
    }
}

// Stop the clock (useful for game end or pause)
export function stopClock() {
    if (countdownInterval) {
        clearTimeout(countdownInterval);
        countdownInterval = null;
    }
    currentPlayer = null;
    lastUpdateTime = 0;
    clockStartTime = 0;
}

// Get current clock state for debugging
export function getClockState() {
    return {
        currentPlayer,
        clockState: JSON.parse(JSON.stringify(clockState)),
        lastUpdateTime,
        clockStartTime,
        isRunning: countdownInterval !== null
    };
}
