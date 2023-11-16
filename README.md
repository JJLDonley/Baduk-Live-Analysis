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

## Setting Up KataGo

This is program is meant to run with GPU

You can download and manuall install KataGo for CPU here [KataGo v1.13.0 Release](https://github.com/lightvector/KataGo/releases/tag/v1.13.0)

Choose between `Eigen-windows` for your CPU KataGo, commands are all the same, so if you follow the steps below after replacing the katago folder it should work.

### On Windows:

1. **Initial Setup**:

   > The provided KataGo in this project is a basic version. Before you start using it, generate a configuration file specific to your system.

   ```bash
   npm run setup
   ```

2. **Manual Analysis with KataGo**:

   > If you wish to run KataGo's analysis engine manually, use the following command in the terminal:

   ```bash
   katago.exe analysis -model <PATH_TO_NEURALNET>.bin.gz -config <PATH_TO_CONFIGURATION>.cfg
   ```

   - Replace `<NEURALNET>` and `<CONFIGURATION>` with your specific paths.

3. **Automatic Analysis**:
   - Replace `<PATH_TO_NEURALNET>` and `<PATH_TO_CONFIGURATION>` with `default_model` and `default_config` for the program to run.
     > For a hands-free experience with katago, this project is configured to run the analysis engine automatically.
   ```bash
   npm start
   ```
   - Ensure you've already run `npm run setup` before the first use of `npm start`.

## Linux
### EC2
Use Ubuntu 20.04 and security group "BLA"
- Worked: t2.2xlarge
- Did not work: t2.micro

### libzip5

`wget http://mirrors.kernel.org/ubuntu/pool/universe/libz/libzip/libzip5_1.5.1-0ubuntu1_amd64.deb`

`sudo apt install ./libzip5_1.5.1-0ubuntu1_amd64.deb`

### KataGo

`wget https://github.com/lightvector/KataGo/releases/download/v1.13.0/katago-v1.13.0-eigen-linux-x64.zip`

### git

`sudo apt install git-all`

`git clone https://github.com/WeiQiPro/Baduk-Live-Analysis.git`

### npm

`sudo apt install npm`

### process

- Once you unzip the KataGo folder, rename the unzipped folder to `katago-linux` and then move it to the `Baduk-Live-Analysis` repo
- Go into the `katago` folder and copy the `default_config.cfg` and `default_model.bin.gz` file to the `katago-linux` folder
- Run the app using the command `npm run start/linux`
- Once the app is running, use one of the public IP addresses, but change the protocol to `http` (from `https`) and add the port number (`2468`)

Note: Haven't tested, but may need to change instances of `localhost` to `0.0.0.0`

## Disclaimer

Designed with streamers and live streaming events at its core, BLA seeks to augment the live viewing experience through its real-time analytical offerings. We encourage individual users to leverage BLA, bearing in mind its intended primary application. When incorporating BLA into public broadcasts, we kindly ask for appropriate credits and acknowledgments.

## Credit

`Quentin Rendu, Leo Wagner, Katie Oh, Devin Fraze, Jeremiah Donley`
