# Baduk Live Analysis (BLA)

**Baduk Live Analysis (BLA)** is a cutting-edge application that seamlessly marries the capabilities of OGS websockets with KataGo's power to provide unparalleled real-time game analysis.

Harnessing the agility of the Express framework, BLA presents an interactive user experience built on unique URL routes. Each route generates a transient database for its session, guaranteeing efficiency and rapid responsiveness.

## Key Features:

- **Real-time Interaction:** Experience immediate game updates after every move.

- **Comprehensive Analysis:** Stay informed at every game juncture with insights into:
   
  - **Game Details:** 
    - UUID
    - ID
    - Total queries made

  - **Player Insights:** 
    - Current Player's Turn
    - Names for Black and White players

  - **Game Dynamics:** 
    - Current Move Number
    - Blue Move
    - Overall Winrate
    - Individual Winrates for Black and White
    - Value of the Last Move

  - **Scoring Metrics:** 
    - Game Score
    - Territory allocations for Black and White
    - Score differential between competitors

Each interaction with KataGo results in the system dispatching a rich, game-specific analysis, assuring players and spectators are contemporaneously updated. Following this, the frontend client amends its visuals based on the broadcasted data. This ensures dynamic representation of critical metrics: for instance, the game board highlights the blue move with a distinct blue circle, and users can visualize game dynamics through the Winrate bar, Territory bar, Territory estimate, and a textual representation of the Score lead.

## Installing Katago
Go to the [KataGo release page](https://github.com/lightvector/KataGo/releases), find version 1.13.0, and choose `katago-v1.13.0-eigen-windows-x64+bs29.zip` (or your OS equivalent).

Go to `https://katagotraining.org/networks/` and download the highlighted network file. 

Copy the network file to your KataGo folder and update `_.json` in this repo to point to your files

## Running Katago
### Windows
Run ` .\katago.exe benchmark -model default_model.bin.gz -config default_gtp.cfg` in the katago folder. It may take a while.

Once it's finished, run ` .\katago.exe analysis -config default_gtp.cfg -model default_model.bin.gz`. Once it's running, you can close out and run the app.

If you run into issues, you may need to update your `default_gtp.cfg` file. I had to update `numSearchThreads` to `1` and add `numAnalysisThreads = 2`

## Disclaimer

Designed with streamers and live streaming events at its core, BLA seeks to augment the live viewing experience through its real-time analytical offerings. We encourage individual users to leverage BLA, bearing in mind its intended primary application. When incorporating BLA into public broadcasts, we kindly ask for appropriate credits and acknowledgments.
