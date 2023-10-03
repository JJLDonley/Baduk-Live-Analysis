# Baduk-Live-Analysis

Baduk Live Analysis (BLA)
Baduk Live Analysis, or BLA for short, is a dynamic application that integrates OGS websockets with KataGo to offer users real-time game analysis.

Utilizing the power of the Express framework, BLA crafts a user experience centered around URL routes. These routes give rise to ephemeral databases unique to each session, ensuring a streamlined and responsive user experience.

Key Features:
Real-time Interaction: BLA provides instant game updates on every move.
Dynamic Analysis: At every stage of the game, players can access:
  Game Details:
    UUID
    ID
  Total queries made
    Player Info:
    Current Player's Turn
    Player Names for both Black and White
  Game Progress:
    Current Move Number
    Blue Move
    Winrate
    Individual Winrates for Black and White players
    Value of the Last Move
  Scoring:
    Overall Score
    Territory holdings for both Black and White
    Score difference between players
With each query to KataGo, the system broadcasts the detailed analysis specific to that game, ensuring all players and viewers are updated in real-time.
