# Project 3: Steps 0 to 6 (Safia, Jade, Heta)

This extends the supplied `index.html`, `style.css` and D3 `main.js` with year animation and a measure selector. The matching `combined-fourteen-countries.csv` is included.

## Run

On Windows, extract the entire ZIP, double-click **`Start-Project.cmd`**, and keep its window open. Then open **http://127.0.0.1:8765/** in your browser to use the chart. This uses the included PowerShell server and does not require Python or Node. Closing the server window stops the site.

To run the optional browser check, visit **http://127.0.0.1:8765/tests/browser-check.html**. It usually takes 40–60 seconds and now shows its progress. Keep that tab visible and do not operate its chart while the checks run. Do not double-click `browser-check.html`: local-file browser restrictions prevent the check from working normally.

Alternatively, serve the folder using **Open with Live Server** on `index.html` in VS Code. If Python is installed, run `python -m http.server 8000` in this folder and visit `http://localhost:8000`.

On a Mac, open Terminal in this folder and run `python3 -m http.server 8000`, then visit `http://localhost:8000`.

Opening the HTML directly by double-clicking can block the CSV request. Internet access is required for the existing D3 CDN import.

## Step 0: project setup (Safia)

- Created the project files in the repository: `index.html`, `style.css` and `main.js`.
- Loaded `combined-fourteen-countries.csv` with D3.
- Added the page title, team names, research question and project description.

## Step 1: data preparation (Safia)

All data preparation happens in `main.js`.

- **Countries and regions:** 14 countries grouped into three regions. Europe: Bulgaria, Denmark, France, Germany, Netherlands, Romania, Sweden. Latin America: Brazil, Colombia, Dominican Republic, Ecuador, Mexico, Uruguay. United States.
- **Years:** filtered to 2004 through 2018, with one row per country and year.
- **Variables:** government expenditure per secondary student (% of GDP per capita), GDP per capita (constant 2010 US$), and female, male and total upper-secondary attainment for adults 25+. Empty or invalid values are stored as missing.
- **Missing data:** gaps of at most two consecutive years are filled by linear interpolation, only when a real observation exists both before and after the gap. Applied to expenditure and the three attainment rates. Missing values at the start or end of a country's series are not extrapolated, and GDP per capita is not interpolated. Every interpolated value is flagged as estimated so the chart can show it.
- **Gender gap:** female minus male attainment, in percentage points. Positive means higher female attainment, negative means higher male attainment, zero means no gap. The gap is calculated only when both rates are available.
- **Missing values after interpolation:** expenditure 61, GDP per capita 0, female 20, male 20, total 20, gender gap 20.

## Step 2: static bubble chart (Safia)

Inspired by Mike Bostock's The Wealth & Health of Nations.

- **Bubbles:** one per country.
- **X-axis:** government expenditure per secondary student (% of GDP per capita).
- **Y-axis:** gender gap in percentage points, with a symmetric range and a dashed zero reference line.
- **Bubble size:** GDP per capita. A square-root scale makes bubble area proportional to GDP per capita.
- **Color:** region (Europe, Latin America, United States), with a legend.
- **Fixed scales:** axes and bubble sizes stay the same across years so years can be compared.
- Gridlines, axis labels and responsive layout are styled in `style.css`.

## Step 3: year animation (Jade)

- The slider covers every year from 2004 through 2018 and starts at 2004.
- Play advances one year per second; Pause stops further advancement after the current transition finishes.
- Playback stops at 2018. Pressing Play at 2018 restarts from 2004.
- Moving the slider pauses playback. Keyboard arrow keys also change the year.
- Bubble position and size transition smoothly. Countries enter or leave as the required data becomes available or missing.
- Rapid changes interrupt previous transitions. The chart respects the browser's reduced-motion preference and pauses playback when its tab is hidden.

## Step 4: attainment measures (Jade)

The Show selector offers gender gap, female attainment, male attainment and total attainment. It preserves the selected year and also works during playback. The vertical axis, explanation, bubble positions and tooltips update together.

Gender gap is female minus male attainment in **percentage points**, with a symmetric axis and a dashed zero reference line. Each attainment view uses the same **0–100%** axis. Total attainment uses the supplied total column. The horizontal axis still shows government expenditure per secondary student (% of GDP per capita); bubble area still represents GDP per capita.

The supplied data preparation is retained: only missing gaps of at most two years bounded by observations are interpolated for expenditure and attainment. Longer gaps and endpoints remain missing; GDP is not interpolated. A country appears only when expenditure, GDP and the selected measure are available. Tooltips identify estimated values, and the caption reports the number of countries shown. Axes and the GDP size scale stay fixed across years.

## Step 5: tooltips, highlighting and region filters (Heta)

- **Tooltips:** hovering (or keyboard-focusing) a bubble shows a styled card with the country, region, year, the selected measure, and all other values. Interpolated values are marked with an asterisk. The tooltip stays in sync during playback and hides with Escape.
- **Country highlighting:** hovering a bubble dims the others. Clicking a bubble (or Enter/Space when focused), or choosing a country from the Highlight menu, pins that country: it stays outlined and labeled through year and measure changes. Clicking it again, choosing None, or clicking empty chart space clears it. If the pinned country has no data for a year, the status line says so.
- **Region filters:** the legend items are toggle buttons. Clicking a region hides or shows its countries, and the status line reports how many are hidden by the filter.
- The browser check now also covers tooltips, highlighting and region filters.

## Step 6: key findings and linked line chart (Heta)

- **Key findings:** six buttons above the chart walk readers through the main patterns. Each one sets the year and measure, labels the countries involved in both charts, and shows a short explanation:
  1. Gaps moved toward women in 10 of 14 countries.
  2. In 2014, men led in all 7 European countries, while women led in 4 of 6 Latin American countries.
  3. Uruguay and Romania spent almost the same in 2016 but had opposite gaps.
  4. Germany's male lead shrank from 14.9 to 6.8 points, the largest change.
  5. Sweden is the only country that moved clearly toward men.
  6. Dominican Republic's rise: spending per secondary student rose from 7.9% to 14.9% between 2012 and 2016, while attainment rose, with the largest increase between 2015 and 2016.
- **Linked line chart:** shows every country's selected measure from 2004 to 2018, with a marker for the current year. Hovering a line shows the tooltip, clicking a line highlights that country in both charts, and clicking elsewhere jumps to that year. It follows the measure selector, region filters and highlight.
- The browser check now also covers the line chart and key findings.

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
