# Project 3 — Steps 3 and 4 (Jade)

This extends the supplied `index.html`, `style.css` and D3 `main.js` with year animation and a measure selector. The matching `combined-fourteen-countries.csv` is included.

## Run

On Windows, extract the entire ZIP, double-click **`Start-Project.cmd`**, and keep its window open. Then open **http://127.0.0.1:8765/** in your browser to use the chart. This uses the included PowerShell server and does not require Python or Node. Closing the server window stops the site.

To run the optional browser check, visit **http://127.0.0.1:8765/tests/browser-check.html**. It usually takes 40–60 seconds and now shows its progress. Keep that tab visible and do not operate its chart while the checks run. Do not double-click `browser-check.html`: local-file browser restrictions prevent the check from working normally.

Alternatively, serve the folder using **Open with Live Server** on `index.html` in VS Code. If Python is installed, run `python -m http.server 8000` in this folder and visit `http://localhost:8000`.

Opening the HTML directly by double-clicking can block the CSV request. Internet access is required for the existing D3 CDN import.

## Step 3: year animation

- The slider covers every year from 2004 through 2018 and starts at 2004.
- Play advances one year per second; Pause stops further advancement after the current transition finishes.
- Playback stops at 2018. Pressing Play at 2018 restarts from 2004.
- Moving the slider pauses playback. Keyboard arrow keys also change the year.
- Bubble position and size transition smoothly. Countries enter or leave as the required data becomes available or missing.
- Rapid changes interrupt previous transitions. The chart respects the browser's reduced-motion preference and pauses playback when its tab is hidden.

## Step 4: attainment measures

The Show selector offers gender gap, female attainment, male attainment and total attainment. It preserves the selected year and also works during playback. The vertical axis, explanation, bubble positions and tooltips update together.

Gender gap is female minus male attainment in **percentage points**, with a symmetric axis and a dashed zero reference line. Each attainment view uses the same **0–100%** axis. Total attainment uses the supplied total column. The horizontal axis still shows government expenditure per secondary student (% of GDP per capita); bubble area still represents GDP per capita.

The supplied data preparation is retained: only missing gaps of at most two years bounded by observations are interpolated for expenditure and attainment. Longer gaps and endpoints remain missing; GDP is not interpolated. A country appears only when expenditure, GDP and the selected measure are available. Tooltips identify estimated values, and the caption reports the number of countries shown. Axes and the GDP size scale stay fixed across years.

## Files and checks

- `index.html`: original page plus labeled year and measure controls.
- `style.css`: original colors and typography plus responsive control styles.
- `main.js`: data preparation, shared chart updates, playback and measure selection. Changes are marked Step 3 / Step 4.
- `combined-fourteen-countries.csv`: original dataset copied unchanged from the workspace.
- `Start-Project.cmd` and `Start-Project.ps1`: Windows launcher and a local server restricted to this project's web assets on your own computer.
- `tests/browser-check.html`: browser checks for all 60 year/measure combinations, plotted values, missing data, transitions, pause/restart and rapid control changes. Serve the folder and visit this page to run them; keep the tab visible until it reports PASS or FAIL.
- `tests/run-browser-check.ps1`: optional Windows runner using an installed Chrome or Edge in headless mode. Run `./tests/run-browser-check.ps1` from this folder. It uses an isolated browser profile and writes a preview image to the temporary directory.

The browser check reports loading failures and stops after a timeout instead of remaining on RUNNING. It also explains how to start the server if opened as a local file.

Validation covers all 60 year/measure combinations, playback, transitions and page widths of 375, 768 and 1100 pixels. The included CSV matches the original file byte for byte.
