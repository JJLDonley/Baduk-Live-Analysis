// Clock testing utilities for debugging time drift issues

import { startCountdown, stopClock, getClockState } from './clock.js';

export class ClockTester {
    constructor() {
        this.testResults = [];
        this.testStartTime = 0;
        this.isRunning = false;
    }

    // Simulate a clock update like OGS would send
    simulateClockUpdate(current = "black", blackTime = 600, whiteTime = 600, delay = 0) {
        const clockData = {
            current_player: current === "black" ? "black_player_id" : "white_player_id",
            black_player_id: "black_player_id",
            white_player_id: "white_player_id",
            black_time: {
                thinking_time: blackTime,
                period_time: 30,
                period_time_left: 30,
                periods: 5
            },
            white_time: {
                thinking_time: whiteTime,
                period_time: 30,
                period_time_left: 30,
                periods: 5
            }
        };

        setTimeout(() => {
            console.log(`Simulating clock update with ${delay}ms delay`);
            startCountdown(current, clockData.black_time, clockData.white_time);
        }, delay);

        return clockData;
    }

    // Test drift correction by simulating network delays
    testDriftCorrection() {
        console.log("🧪 Testing clock drift correction...");
        
        this.testStartTime = Date.now();
        this.isRunning = true;
        this.testResults = [];

        // Start with black player having 60 seconds
        this.simulateClockUpdate("black", 60, 600, 0);

        // Simulate network delays causing time updates to arrive late
        setTimeout(() => {
            console.log("📡 Simulating 3-second network delay...");
            this.simulateClockUpdate("black", 55, 600, 3000); // Should arrive 3 seconds late
        }, 2000);

        // Check results after 8 seconds
        setTimeout(() => {
            this.checkDriftResults();
        }, 8000);
    }

    checkDriftResults() {
        const state = getClockState();
        const elapsed = Date.now() - this.testStartTime;
        
        console.log("📊 Drift test results:");
        console.log(`- Test duration: ${elapsed}ms`);
        console.log(`- Clock state:`, state);
        
        if (state.isRunning) {
            const expectedTime = 60 - Math.floor(elapsed / 1000);
            const actualTime = state.clockState.black.thinking_time;
            const drift = Math.abs(expectedTime - actualTime);
            
            console.log(`- Expected time: ~${expectedTime}s`);
            console.log(`- Actual time: ${actualTime}s`);
            console.log(`- Drift: ${drift}s`);
            
            if (drift <= 2) {
                console.log("✅ Drift correction working well (drift ≤ 2s)");
            } else {
                console.log("⚠️ Significant drift detected (drift > 2s)");
            }
        } else {
            console.log("❌ Clock stopped unexpectedly");
        }
        
        this.isRunning = false;
    }

    // Test rapid clock updates (like during byo-yomi)
    testRapidUpdates() {
        console.log("🏃 Testing rapid clock updates...");
        
        stopClock(); // Reset first
        
        let updateCount = 0;
        const interval = setInterval(() => {
            updateCount++;
            const timeLeft = Math.max(0, 30 - updateCount);
            
            this.simulateClockUpdate("black", timeLeft, 600, 0);
            
            if (updateCount >= 30) {
                clearInterval(interval);
                console.log("✅ Rapid update test completed");
            }
        }, 500); // Update every 500ms
    }

    // Test period transitions
    testPeriodTransition() {
        console.log("⏱️ Testing period transition...");
        
        // Start with almost no thinking time
        this.simulateClockUpdate("black", 2, 600, 0);
        
        setTimeout(() => {
            const state = getClockState();
            console.log("Period transition state:", state);
            
            if (state.clockState.black.thinking_time <= 0 && 
                state.clockState.black.period_time_left > 0) {
                console.log("✅ Period transition working correctly");
            } else {
                console.log("⚠️ Period transition may have issues");
            }
        }, 3000);
    }

    // Stop any running tests
    stopTests() {
        stopClock();
        this.isRunning = false;
        console.log("🛑 Clock tests stopped");
    }
}

// Create global instance for easy testing
export const clockTester = new ClockTester();

// Make available globally for browser console testing
if (typeof window !== 'undefined') {
    window.clockTester = clockTester;
    
    // Add convenient test functions
    window.testClockDrift = () => clockTester.testDriftCorrection();
    window.testRapidUpdates = () => clockTester.testRapidUpdates();
    window.testPeriodTransition = () => clockTester.testPeriodTransition();
    window.stopClockTests = () => clockTester.stopTests();
    
    console.log("🧪 Clock testing functions available:");
    console.log("- testClockDrift() - Test drift correction");
    console.log("- testRapidUpdates() - Test rapid updates");
    console.log("- testPeriodTransition() - Test byo-yomi transition");
    console.log("- stopClockTests() - Stop all tests");
} 