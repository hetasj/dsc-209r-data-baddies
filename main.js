import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

//*********STEP 1: ###Data Preparation###************///


//Define the CSV columns
const columns = {
    Country: "Country Name",
    countryCode: "Country Code",
    year: "Year",
    expenditure: "average_value_Government expenditure per student, secondary (% of GDP per capita)",
    gdp: "average_value_GDP per capita (constant 2010 US$)",
    female: "average_value_Educational attainment, at least completed upper secondary, population 25+, female (%) (cumulative)",
    male: "average_value_Educational attainment, at least completed upper secondary, population 25+, male (%) (cumulative)",
    total: "average_value_Educational attainment, at least completed upper secondary, population 25+, total (%) (cumulative)"
};

//# Define the countries and their regions
const regionByCountry = {
    // Europe
    "Bulgaria": "Europe",
    "Denmark": "Europe",
    "France": "Europe",
    "Germany": "Europe",
    "Netherlands": "Europe",
    "Romania": "Europe",
    "Sweden": "Europe",

    // Latin America
    "Brazil": "Latin America",
    "Colombia": "Latin America",
    "Dominican Republic": "Latin America",
    "Ecuador": "Latin America",
    "Mexico": "Latin America",
    "Uruguay": "Latin America",

    // United States
    "United States": "United States"
};

//# Define the years we want to visualize
const startYear = 2004;
const endYear = 2018;
//Create an array containing every year from 2004 to 2018
const years = d3.range(startYear, endYear + 1);

//# Convert CSV values into numbers
function parseNumber(value) {
    // Check whether the value is missing.
    if (value === undefined || value === null || value.trim() === "") {
        return null;
    }
    // Convert the string into a number.
    const number = Number(value);
    // Return null if the conversion is unsuccessful.
    return Number.isFinite(number) ? number : null;
}

//# Interpolate short missing gaps (We only interpolate gaps of
// maximum two consecutive years). The missing value must have a real observation
// before and after it. We also record which values have been estimated.

function interpolateShortGaps(rows, field, maxGap = 2) {
    // Start at the first year.
    let i = 0;
    // Continue until we reach the end of the country data.
    while (i < rows.length) {
        // If the value exists, move to the next year.
        if (rows[i][field] !== null) {
            i++;
            continue;
        }
        // Remember where the missing gap begins.
        const gapStart = i;
        // Move forward until we find an available value.
        while (
            i < rows.length &&
            rows[i][field] === null
        ) {
            i++;
        }
        // Calculate the number of consecutive missing years.
        const gapLength = i - gapStart;
        // Check whether the gap is short enough to interpolate.
        const hasPreviousValue = gapStart > 0;
        const hasNextValue = i < rows.length;
        if (
            hasPreviousValue &&
            hasNextValue &&
            gapLength <= maxGap
        ) {
            // Get the real observation before the gap.
            const previousValue = rows[gapStart - 1][field];
            // Get the real observation after the gap.
            const nextValue = rows[i][field];
            // Interpolate only if both observations are available.
            if (
                previousValue !== null &&
                nextValue !== null
            ) {

                // Fill each missing year.
                for (let j = 1; j <= gapLength; j++) {

                    // Calculate the interpolation position.
                    const t = j / (gapLength + 1);

                    // Calculate the estimated value.
                    const estimatedValue =
                        previousValue +
                        (nextValue - previousValue) * t;

                    // Store the estimated value.
                    rows[gapStart + j - 1][field] = estimatedValue;

                    // Mark this value as estimated.
                    rows[gapStart + j - 1].estimated[field] = true;
                }
            }
        }
    }

    // Return the country data with short gaps filled.
    return rows;
}

//*********STEP 2: ###Bubble chart Creation###************///
//# Load and prepare the CSV dataset (step 1)
d3.csv("combined-fourteen-countries.csv").then(rawData => {

    // Fail clearly if a different dataset was supplied.
    if (!Object.values(columns).every(column => rawData.columns.includes(column))) {
        throw new Error("The CSV does not contain the expected education columns.");
    }
    //FILTER THE YEARS WE NEED:
    const filteredData = rawData.filter(d => {
        const year = Number(d[columns.year]);
        return year >= startYear && year <= endYear &&
            Object.hasOwn(regionByCountry, d[columns.Country]);
    });
    if (filteredData.length === 0) {
        throw new Error("No observations were found for 2004 through 2018.");
    }
    //GROUP DATA BY COUNTRY: create separate groups for each country
    const groupedData = d3.group(filteredData, d => d[columns.Country]);
    // TRANSFORM THE DATA: create a simpler data structure for D3
    const countries = Array.from(groupedData.keys());
    const chartData = [];
    countries.forEach(country => {
        // Get all observations for the current country.
        const countryRows = groupedData.get(country);
        // Get the country's region.
        const region = regionByCountry[country] || "Unassigned";
        // Create a map to find observations by year.
        const rowsByYear = new Map(
            countryRows.map(d => [
                Number(d[columns.year]),
                d
            ])
        );

        // Create one observation for every year.
        const rows = years.map(year => {
            // Find the original CSV row for this year.
            const source = rowsByYear.get(year);
            // Return the cleaned observation.
            return {
                country: country,
                countryCode:
                    source ? source[columns.countryCode] : "",
                region: region,
                year: year,
                expenditure: parseNumber(
                    source ? source[columns.expenditure] : null
                ),
                gdpPerCapita: parseNumber(
                    source ? source[columns.gdp] : null
                ),
                female: parseNumber(
                    source ? source[columns.female] : null
                ),
                male: parseNumber(
                    source ? source[columns.male] : null
                ),
                total: parseNumber(
                    source ? source[columns.total] : null
                ),
                // Keep track of interpolated values.
                estimated: {}
            };
        });
       
        // INTERPOLATE SHORT MISSING GAPS
        // Interpolate government expenditure.
        interpolateShortGaps(rows, "expenditure", 2);
        // Interpolate female educational attainment.
        interpolateShortGaps(rows, "female", 2);
        // Interpolate male educational attainment.
        interpolateShortGaps(rows, "male", 2);
        // Interpolate total educational attainment.
        interpolateShortGaps(rows, "total", 2);
       
        //CALCULATE THE GENDER GAP
        rows.forEach(d => {
            // Calculate the gap only if both values exist.
            if (d.female !== null && d.male !== null) {
                // Positive = female attainment is higher.
                // Negative = male attainment is higher.
                d.genderGap = d.female - d.male;
                // Record whether either input was estimated.
                d.estimated.genderGap =
                    d.estimated.female === true ||
                    d.estimated.male === true;
            } else {
                // Keep the gender gap unavailable if either
                // female or male attainment is missing.
                d.genderGap = null;

            }
        });

        // ADD THE COUNTRY DATA TO OUR MAIN ARRAY
        // Add all 15 years for this country.
        chartData.push(...rows);
    });

    // CHART DIMENSIONS: (step 2)
    // Width and height of the SVG drawing area
    const width = 800;
    const height = 460;

    // Space around the chart.
    const margin = {
        top: 35,
        right: 35,
        bottom: 85,
        left: 95
    };
    // Available width after removing margins.
    const innerWidth = width - margin.left - margin.right;

    // Available height after removing margins.
    const innerHeight = height - margin.top - margin.bottom;

    // COLOR SCALE: (step 2)
    // Assign a different color to each geographic region.
    const color = d3.scaleOrdinal()
        .domain(["Europe", "Latin America", "United States"])
        .range(["#B4469C", "#70A9CE", "#D7A34E"]);

    // Steps 3 and 4 share one year and one selected measure.
    let currentYear = startYear;
    let currentMeasure = "genderGap";
    let playbackTimer = null;
    const yearInterval = 1000;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const yearSlider = d3.select("#year-slider");
    const playButton = d3.select("#play-pause");
    const measureSelect = d3.select("#measure-select");

    // Step 5 state: region filters, a highlighted (pinned) country and the
    // country currently under the pointer or keyboard focus.
    const regions = ["Europe", "Latin America", "United States"];
    const activeRegions = new Set(regions);
    let highlightedCountry = null;
    let hoveredCountry = null;
    const highlightSelect = d3.select("#highlight-select");
    const tooltip = d3.select("body").append("div")
        .attr("class", "chart-tooltip")
        .attr("id", "chart-tooltip")
        .attr("aria-hidden", "true");

    const measures = {
        genderGap: {
            label: "Gender gap",
            axisLabel: "Gender gap in educational attainment (percentage points)",
            unit: " percentage points",
            description: "Female minus male attainment, in percentage points. Positive values mean higher female attainment."
        },
        female: {
            label: "Female attainment",
            axisLabel: "Female upper-secondary attainment (%)",
            unit: "%",
            description: "Percentage of women aged 25+ who have completed at least upper secondary education."
        },
        male: {
            label: "Male attainment",
            axisLabel: "Male upper-secondary attainment (%)",
            unit: "%",
            description: "Percentage of men aged 25+ who have completed at least upper secondary education."
        },
        total: {
            label: "Total attainment",
            axisLabel: "Total upper-secondary attainment (%)",
            unit: "%",
            description: "Percentage of all adults aged 25+ who have completed at least upper secondary education, using the dataset's total rate."
        }
    };

    // CREATE THE X-AXIS SCALE
    // The X-axis represents government expenditure.
    // We use a linear scale because expenditure is
    // expressed as a percentage.
    const xExtent = d3.extent(
        chartData.filter(d => Number.isFinite(d.expenditure)),
        d => d.expenditure
    );
    if (!xExtent.every(Number.isFinite)) {
        throw new Error("No government expenditure values are available to plot.");
    }
    // Add a little space at both ends of the axis.
    const xPadding = (xExtent[1] - xExtent[0]) * 0.05 || 1;
    const x = d3.scaleLinear()
        .domain([
            Math.max(0, xExtent[0] - xPadding),
            xExtent[1] + xPadding
        ])
        .range([0, innerWidth])
        .nice();
    // CREATE THE Y-AXIS SCALE
    // The Y-axis represents the gender gap in educational attainment
    // We include zero so positive and negative gaps can be compared.
    const validGaps = chartData
        .filter(d => d.genderGap !== null)
        .map(d => d.genderGap);

    const maxGap = d3.max(validGaps.map(d => Math.abs(d))) || 1;

    const y = d3.scaleLinear()
        .domain([-maxGap * 1.1, maxGap * 1.1])
        .range([innerHeight, 0])
        .nice();
    // Keep the same domain across all years for meaningful comparisons.
    const gapDomain = y.domain();
       
    // CREATE THE BUBBLE SIZE SCALE
    // GDP per capita determines the bubble size.
    // A square-root scale makes circle AREA proportional
    // to GDP per capita.
    const maxGDP = d3.max(
        chartData,
        d => d.gdpPerCapita
    ) || 1;

    const radius = d3.scaleSqrt()
        .domain([0, maxGDP])
        .range([0, 32]);        

    // CREATE THE SVG CANVAS
     // Select the chart container in index.html.
    const svg = d3.select("#bubble-chart")
        .append("svg")

        // Define the size of the chart.
        .attr("viewBox", `0 0 ${width} ${height}`)

        // Make the SVG accessible.
        .attr("role", "group")
        .attr("aria-label", "Bubble chart showing gender gaps in education");

    // Create a group that contains the chart itself.
    // This lets us position everything using margins.
    const plot = svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left},${margin.top})`
        );
    // Large year displayed in the background
    const backgroundYear = plot.append("text")
    .attr("class", "background-year")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .text(currentYear);

    // CREATE THE GRIDLINES
    // Vertical gridlines follow the X-axis ticks.
    const xGrid = d3.axisBottom(x)
        .ticks(8)
        .tickSize(innerHeight)
        .tickFormat("");

    plot.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,0)`)
        .call(xGrid)
        .call(g => g.select(".domain").remove());

    // Horizontal gridlines follow the Y-axis ticks.
    const yGrid = d3.axisLeft(y)
        .ticks(8)
        .tickSize(-innerWidth)
        .tickFormat("");

    const yGridGroup = plot.append("g")
        .attr("class", "grid y-grid")
        .call(yGrid)
        .call(g => g.select(".domain").remove());

    // DRAW THE X-AXIS
    const xAxis = d3.axisBottom(x)
        .ticks(8);

    plot.append("g")
        .attr(
            "transform",
            `translate(0,${innerHeight})`
        )
        .call(xAxis);

    // DRAW THE Y-AXIS
    const yAxis = d3.axisLeft(y)
        .ticks(8);

    const yAxisGroup = plot.append("g")
        .attr("class", "y-axis")
        .call(yAxis);

    // ADD THE X-AXIS LABEL
    plot.append("text")
        .attr("class", "axis-label")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 60)
        .attr("text-anchor", "middle")
        .text("Government expenditure on education per secondary student (% of GDP per capita)");

    // ADD THE Y-AXIS LABEL
    const yAxisLabel = plot.append("text")
        .attr("class", "axis-label y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -65)
        .attr("text-anchor", "middle")
        .text("Gender gap in educational attainment (percentage points)");


    // DRAW THE ZERO REFERENCE LINE
    // This line helps us see whether female or male attainment is higher.
    const zeroLine = plot.append("line")
        .attr("class", "zero-line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "#777")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,5");

    const bubbleLayer = plot.append("g").attr("class", "bubbles");
    // Step 5: name label that follows the highlighted country.
    const labelLayer = plot.append("g").attr("class", "country-labels");
    const emptyMessage = plot.append("text")
        .attr("class", "empty-message")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight / 2)
        .style("display", "none")
        .text("No countries have all required values for this year and measure.");

    // Tooltip values must follow the current year and selected measure.
    function formatValue(d, field, unit) {
        if (!Number.isFinite(d[field])) return "Unavailable";
        return d[field].toFixed(2) + unit +
            (d.estimated[field] ? " (estimated)" : "");
    }

    function tooltipText(d) {
        const measure = measures[currentMeasure];
        return [
            d.country,
            "Region: " + d.region,
            "Year: " + d.year,
            "Selected measure: " + measure.label + " = " +
                formatValue(d, currentMeasure, measure.unit),
            "Government expenditure per secondary student (% of GDP per capita): " +
                formatValue(d, "expenditure", "%"),
            "Gender gap: " + formatValue(d, "genderGap", " percentage points"),
            "Female attainment: " + formatValue(d, "female", "%"),
            "Male attainment: " + formatValue(d, "male", "%"),
            "Total attainment: " + formatValue(d, "total", "%"),
            "GDP per capita: $" + d.gdpPerCapita.toLocaleString("en-US")
        ].join("\n");
    }

    //********* STEP 5: Tooltips, country highlighting and region filters *********//
    const formatGdp = d3.format(",.0f");
    const signed = d3.format("+.2f");

    // Format one tooltip value, marking interpolated values with an asterisk.
    function tipValue(d, field) {
        if (!Number.isFinite(d[field])) return "n/a";
        const text = field === "genderGap"
            ? signed(d[field]) + " pp"
            : d[field].toFixed(2) + "%";
        return text + (d.estimated[field] ? "*" : "");
    }

    function tooltipHTML(d) {
        const measure = measures[currentMeasure];
        const anyEstimated = ["expenditure", "genderGap", "female", "male", "total"]
            .some(field => d.estimated[field]);
        const rows = [
            ["Spending per secondary student", tipValue(d, "expenditure")],
            ["Gender gap (F minus M)", tipValue(d, "genderGap")],
            ["Female attainment", tipValue(d, "female")],
            ["Male attainment", tipValue(d, "male")],
            ["Total attainment", tipValue(d, "total")],
            ["GDP per capita", "$" + formatGdp(d.gdpPerCapita)]
        ];
        return `
            <div class="tt-head">
                <span class="tt-country">${d.country}</span>
                <span class="tt-meta"><span class="tt-dot" style="background:${color(d.region)}"></span>${d.region} · ${d.year}</span>
            </div>
            <div class="tt-main">${measure.label}: <strong>${tipValue(d, currentMeasure)}</strong></div>
            <table class="tt-table">${rows.map(([label, value]) =>
                `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}</table>
            ${anyEstimated ? '<div class="tt-note">* Estimated by interpolation</div>' : ""}
            <div class="tt-note">${d.country === highlightedCountry
                ? "Click to stop following this country" : "Click to follow this country over time"}</div>`;
    }

    // Keep the tooltip near the pointer without running off the screen.
    function positionTooltip(clientX, clientY) {
        const node = tooltip.node();
        const w = node.offsetWidth, h = node.offsetHeight;
        let left = clientX + 16;
        let top = clientY + 16;
        if (left + w > window.innerWidth - 8) left = clientX - w - 16;
        if (top + h > window.innerHeight - 8) top = clientY - h - 16;
        tooltip.style("left", Math.max(8, left) + "px")
            .style("top", Math.max(8, top) + "px");
    }

    function showTooltip(d, clientX, clientY) {
        hoveredCountry = d.country;
        tooltip.html(tooltipHTML(d)).classed("visible", true);
        positionTooltip(clientX, clientY);
        applyHighlight();
    }

    function hideTooltip() {
        hoveredCountry = null;
        tooltip.classed("visible", false);
        applyHighlight();
    }

    // Dim every bubble except the hovered or highlighted country.
    // Step 6: countries featured by the selected key finding.
    let storyCountries = [];

    // Countries that stay emphasized: the hovered one, otherwise the pinned
    // country plus any countries featured by the current key finding.
    function focusSet() {
        if (hoveredCountry) return new Set([hoveredCountry]);
        const set = new Set(storyCountries);
        if (highlightedCountry) set.add(highlightedCountry);
        return set;
    }

    function labeledCountries() {
        const set = new Set(storyCountries);
        if (highlightedCountry) set.add(highlightedCountry);
        return set;
    }

    // Dim every bubble and line except the focused countries.
    function applyHighlight() {
        const focus = focusSet();
        bubbleLayer.classed("has-focus", focus.size > 0);
        bubbleLayer.selectAll("circle")
            .classed("is-focus", d => focus.has(d.country))
            .classed("is-pinned", d => d.country === highlightedCountry);
        styleLines();
    }

    function setHighlight(country) {
        highlightedCountry = country;
        storyCountries = [];
        clearStorySelection();
        highlightSelect.property("value", country || "");
        updateChart(300);
    }

    //********* STEP 6: Linked line chart of each country over time *********//
    const lineWidth = 800;
    const lineHeight = 300;
    const lineMargin = { top: 20, right: 140, bottom: 45, left: 95 };
    const lineInnerWidth = lineWidth - lineMargin.left - lineMargin.right;
    const lineInnerHeight = lineHeight - lineMargin.top - lineMargin.bottom;

    const lx = d3.scaleLinear().domain([startYear, endYear]).range([0, lineInnerWidth]);
    const ly = d3.scaleLinear().range([lineInnerHeight, 0]);
    const seriesByCountry = d3.group(chartData, d => d.country);

    const lineSvg = d3.select("#line-chart").append("svg")
        .attr("viewBox", `0 0 ${lineWidth} ${lineHeight}`)
        .attr("role", "group")
        .attr("aria-label", "Line chart of each country's selected measure from 2004 to 2018");
    const lplot = lineSvg.append("g")
        .attr("transform", `translate(${lineMargin.left},${lineMargin.top})`);

    // Background that sets the year when clicked.
    lplot.append("rect")
        .attr("class", "line-background")
        .attr("width", lineInnerWidth)
        .attr("height", lineInnerHeight)
        .on("click", event => {
            event.stopPropagation();
            const year = Math.round(lx.invert(d3.pointer(event)[0]));
            pausePlayback();
            currentYear = Math.max(startYear, Math.min(endYear, year));
            updateChart(300);
        });

    const lineYGrid = lplot.append("g").attr("class", "grid");
    lplot.append("g")
        .attr("transform", `translate(0,${lineInnerHeight})`)
        .call(d3.axisBottom(lx).ticks(8).tickFormat(d3.format("d")));
    const lineYAxis = lplot.append("g");
    const lineYLabel = lplot.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -lineInnerHeight / 2)
        .attr("y", -65)
        .attr("text-anchor", "middle");
    lplot.append("text")
        .attr("class", "axis-label")
        .attr("x", lineInnerWidth / 2)
        .attr("y", lineInnerHeight + 40)
        .attr("text-anchor", "middle")
        .text("Year");
    const lineZero = lplot.append("line")
        .attr("class", "zero-line")
        .attr("x1", 0).attr("x2", lineInnerWidth)
        .attr("stroke", "#777").attr("stroke-width", 1.5).attr("stroke-dasharray", "5,5");
    const yearMarker = lplot.append("line")
        .attr("class", "year-marker")
        .attr("y1", 0).attr("y2", lineInnerHeight);
    const lineLayer = lplot.append("g").attr("class", "lines");
    const lineLabelLayer = lplot.append("g").attr("class", "line-labels");

    const lineGenerator = d3.line()
        .defined(d => Number.isFinite(d[currentMeasure]))
        .x(d => lx(d.year))
        .y(d => ly(d[currentMeasure]));

    function styleLines() {
        const focus = focusSet();
        lineLayer.classed("has-focus", focus.size > 0);
        lineLayer.selectAll(".country-line-group")
            .classed("is-focus", d => focus.has(d[0]))
            .filter(d => focus.has(d[0])).raise();

        // Label each focused line at its last available point.
        const labeled = [...focus].map(country => {
            const points = (seriesByCountry.get(country) || [])
                .filter(d => Number.isFinite(d[currentMeasure]) && activeRegions.has(d.region));
            return points.length ? points[points.length - 1] : null;
        }).filter(Boolean);
        lineLabelLayer.selectAll("text")
            .data(labeled, d => d.country)
            .join("text")
            .attr("class", "line-label")
            .attr("x", d => lx(d.year) + 6)
            .attr("y", d => ly(d[currentMeasure]) + 4)
            .attr("fill", d => d3.color(color(d.region)).darker(0.8))
            .text(d => d.country);
    }

    function updateLineChart() {
        const isGap = currentMeasure === "genderGap";
        ly.domain(y.domain());
        lineYAxis.call(d3.axisLeft(ly).ticks(6)
            .tickFormat(isGap ? d3.format(".0f") : value => value + "%"));
        lineYGrid.call(d3.axisLeft(ly).ticks(6).tickSize(-lineInnerWidth).tickFormat(""))
            .call(g => g.select(".domain").remove());
        lineYLabel.text(isGap ? "Gender gap (percentage points)" : measures[currentMeasure].label + " (%)");
        lineZero.attr("y1", ly(0)).attr("y2", ly(0)).attr("opacity", isGap ? 1 : 0);
        yearMarker.attr("x1", lx(currentYear)).attr("x2", lx(currentYear));

        const series = [...seriesByCountry]
            .filter(([, rows]) => activeRegions.has(rows[0].region));
        const groups = lineLayer.selectAll(".country-line-group")
            .data(series, d => d[0])
            .join(enter => {
                const g = enter.append("g").attr("class", "country-line-group");
                g.append("path").attr("class", "country-line");
                // Wider invisible path makes thin lines easy to hover and click.
                g.append("path").attr("class", "line-hit")
                    .on("pointermove", (event, [country, rows]) => {
                        const year = Math.round(lx.invert(d3.pointer(event, lplot.node())[0]));
                        const datum = rows.find(d => d.year === year && Number.isFinite(d[currentMeasure]));
                        hoveredCountry = country;
                        if (datum) {
                            tooltip.html(tooltipHTML(datum)).classed("visible", true);
                            positionTooltip(event.clientX, event.clientY);
                        }
                        applyHighlight();
                    })
                    .on("pointerleave", hideTooltip)
                    .on("click", (event, [country]) => {
                        event.stopPropagation();
                        toggleHighlight(country);
                    });
                return g;
            });
        groups.select(".country-line")
            .attr("stroke", ([, rows]) => color(rows[0].region))
            .attr("d", ([, rows]) => lineGenerator(rows));
        groups.select(".line-hit")
            .attr("d", ([, rows]) => lineGenerator(rows));
        styleLines();
    }

    function toggleHighlight(country) {
        setHighlight(highlightedCountry === country ? null : country);
    }

    //********* STEP 3: Year animation and smooth chart updates *********//
    // This same update function also handles the measure selector (step 4).
    function updateChart(duration = 600) {
        if (reducedMotion.matches) duration = 0;
        const measure = measures[currentMeasure];
        const isGap = currentMeasure === "genderGap";
        const availableData = chartData.filter(d =>
            d.year === currentYear &&
            Number.isFinite(d.expenditure) &&
            Number.isFinite(d[currentMeasure]) &&
            Number.isFinite(d.gdpPerCapita) && d.gdpPerCapita >= 0
        );
        // Step 5: the region filter removes countries from deselected regions.
        const yearData = availableData
            .filter(d => activeRegions.has(d.region))
            .sort((a, b) => d3.descending(a.gdpPerCapita, b.gdpPerCapita));

        // Cancel stale transitions so rapid scrubbing never queues old years.
        svg.interrupt("chart");
        svg.selectAll("*").interrupt("chart");
        y.domain(isGap ? gapDomain : [0, 100]);
        yAxis.tickFormat(isGap ? d3.format(".0f") : value => value + "%");
        const transition = duration > 0
            ? svg.transition("chart").duration(duration).ease(d3.easeCubicInOut)
            : null;
        const animate = selection => transition ? selection.transition(transition) : selection;

        animate(yAxisGroup).call(yAxis);
        animate(yGridGroup).call(yGrid);
        yGridGroup.select(".domain").remove();
        yAxisLabel.text(measure.axisLabel);
        animate(zeroLine)
            .attr("y1", y(0)).attr("y2", y(0))
            .attr("opacity", isGap ? 1 : 0);

        // A stable country key moves existing bubbles and fades missing ones.
        const bubbles = bubbleLayer.selectAll("circle")
            .data(yearData, d => d.country);
        animate(bubbles.exit().style("pointer-events", "none")
            .attr("tabindex", -1).attr("aria-hidden", "true"))
            .attr("r", 0).attr("opacity", 0).remove();

        const entering = bubbles.enter().append("circle")
            .attr("class", "country-bubble")
            .attr("cx", d => x(d.expenditure))
            .attr("cy", d => y(d[currentMeasure]))
            .attr("r", 0)
            .attr("opacity", 0)
            .attr("fill", d => color(d.region))
            .attr("fill-opacity", 0.72)
            .attr("stroke", d => d3.color(color(d.region)).darker(0.7))
            .attr("stroke-width", 1.2)
            .style("cursor", "pointer")
            // Step 5: details on demand and click-to-highlight.
            .on("pointerenter", (event, d) => showTooltip(d, event.clientX, event.clientY))
            .on("pointermove", event => positionTooltip(event.clientX, event.clientY))
            .on("pointerleave", event => {
                // On touch screens keep the tooltip until the user taps elsewhere.
                if (event.pointerType !== "touch") hideTooltip();
            })
            .on("focus", function (event, d) {
                const box = this.getBoundingClientRect();
                showTooltip(d, box.right, box.top);
            })
            .on("blur", hideTooltip)
            .on("click", (event, d) => {
                event.stopPropagation();
                toggleHighlight(d.country);
            })
            .on("keydown", (event, d) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleHighlight(d.country);
                }
            });

        const activeBubbles = entering.merge(bubbles).order()
            .style("pointer-events", "auto")
            .attr("tabindex", 0).attr("role", "img").attr("aria-hidden", null)
            .attr("aria-label", tooltipText)
            .attr("data-country", d => d.country)
            .attr("data-year", currentYear)
            .attr("data-measure", currentMeasure);
        animate(activeBubbles)
            .attr("cx", d => x(d.expenditure))
            .attr("cy", d => y(d[currentMeasure]))
            .attr("r", d => radius(d.gdpPerCapita))
            .attr("opacity", 1);

        // Step 5: draw the highlighted country on top and label it.
        const labeled = labeledCountries();
        activeBubbles.filter(d => labeled.has(d.country)).raise();
        const labels = labelLayer.selectAll("text")
            .data(yearData.filter(d => labeled.has(d.country)), d => d.country);
        labels.exit().remove();
        const labelY = d => y(d[currentMeasure]) - radius(d.gdpPerCapita) - 6;
        const enteringLabels = labels.enter().append("text")
            .attr("class", "country-label")
            .attr("x", d => x(d.expenditure))
            .attr("y", labelY)
            .text(d => d.country);
        animate(enteringLabels.merge(labels))
            .attr("x", d => x(d.expenditure))
            .attr("y", labelY);
        // Step 6: keep the linked line chart in sync.
        updateLineChart();
        applyHighlight();

        // Keep an open tooltip in sync with the new year or measure.
        if (hoveredCountry !== null) {
            const hovered = yearData.find(d => d.country === hoveredCountry);
            if (hovered) tooltip.html(tooltipHTML(hovered));
            else hideTooltip();
        }

        d3.select("#year-display").text(currentYear);
        backgroundYear.text(currentYear);
        yearSlider.property("value", currentYear).attr("aria-valuetext", String(currentYear));
        d3.select("#measure-description").text(measure.description);
        svg.attr("aria-label", measure.label + " by government expenditure in " + currentYear);
        emptyMessage
            .text(activeRegions.size === 0
                ? "Select at least one region in the legend to show countries."
                : "No countries have all required values for this year and measure.")
            .style("display", yearData.length ? "none" : null);
        let status = yearData.length + " of " + countries.length + " countries shown for " +
            currentYear + ". Countries missing expenditure, GDP per capita or " +
            measure.label.toLowerCase() + " are omitted.";
        const filteredOut = availableData.length - yearData.length;
        if (filteredOut > 0) {
            status += " " + filteredOut + (filteredOut === 1 ? " country is" : " countries are") +
                " hidden by the region filter.";
        }
        if (highlightedCountry !== null &&
            !availableData.some(d => d.country === highlightedCountry)) {
            status += " " + highlightedCountry + " has no data for this view in " + currentYear + ".";
        }
        d3.select("#chart-status").text(status);
    }

    function pausePlayback() {
        window.clearInterval(playbackTimer);
        playbackTimer = null;
        playButton.text("Play").attr("aria-pressed", "false")
            .attr("aria-label", "Play year animation");
    }

    playButton.on("click", () => {
        if (playbackTimer !== null) {
            pausePlayback();
            return;
        }
        if (currentYear === endYear) {
            currentYear = startYear;
            updateChart(0);
        }
        playButton.text("Pause").attr("aria-pressed", "true")
            .attr("aria-label", "Pause year animation");
        playbackTimer = window.setInterval(() => {
            currentYear = Math.min(currentYear + 1, endYear);
            updateChart(750);
            if (currentYear === endYear) pausePlayback();
        }, yearInterval);
    });

    yearSlider.on("input", event => {
        pausePlayback();
        currentYear = Number(event.target.value);
        updateChart(200);
    });

    //********* STEP 4: Switch the attainment measure *********//
    measureSelect.on("change", event => {
        currentMeasure = event.target.value;
        updateChart();
    });

    // Avoid advancing through unseen years when the tab is in the background.
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pausePlayback();
    });
    window.addEventListener("pagehide", pausePlayback);
    pausePlayback();
    updateChart(0);
    yearSlider.property("disabled", false);
    playButton.property("disabled", false);
    measureSelect.property("disabled", false);

    // CREATE THE REGION LEGEND
    // Step 5: each legend item is also a toggle button that filters by region.
    const countriesPerRegion = d3.rollup(countries, v => v.length, c => regionByCountry[c]);
    const legend = d3.select("#legend")
        .selectAll(".legend-item")
        .data(regions)
        .join("button")
        .attr("type", "button")
        .attr("class", "legend-item")
        .attr("aria-pressed", "true")
        .attr("title", d => "Show or hide " + d)
        .on("click", function (event, region) {
            if (activeRegions.has(region)) activeRegions.delete(region);
            else activeRegions.add(region);
            d3.select(this).attr("aria-pressed", activeRegions.has(region));
            updateChart(400);
        });

    //// Add the colored circle.
    legend.append("span")
        .attr("class", "legend-color")
        .style("background-color", d => color(d))
        .style("border-color", d => color(d));

    //// Add the region name and its number of countries.
    legend.append("span")
        .attr("class", "legend-label")
        .text(d => d + " (" + (countriesPerRegion.get(d) || 0) + ")");

    // Step 5: country highlight menu, sorted alphabetically.
    highlightSelect.selectAll("option.country-option")
        .data([...countries].sort(d3.ascending))
        .join("option")
        .attr("class", "country-option")
        .attr("value", d => d)
        .text(d => d);
    highlightSelect
        .on("change", event => setHighlight(event.target.value || null))
        .property("disabled", false);

    //********* STEP 6: Key findings (guided story) *********//
    // Each finding sets the year, measure and featured countries, then
    // explains what to look for. All numbers come from the World Bank data.
    const stories = [
        {
            label: "Gaps moved toward women",
            year: 2016, measure: "genderGap", countries: [],
            text: "Between each country's first and last available year, the gender gap moved toward women in 10 of the 14 countries. The United States, Ecuador and the Dominican Republic stayed within half a point, and Sweden moved toward men. In the line chart below, most lines slope upward."
        },
        {
            label: "Europe vs. Latin America",
            year: 2014, measure: "genderGap", countries: [],
            text: "In 2014, men had higher attainment in all 7 European countries, while women had higher attainment in 4 of the 6 Latin American countries. In the line chart, the European lines sit below the zero line."
        },
        {
            label: "Same spending, opposite gaps",
            year: 2016, measure: "genderGap", countries: ["Uruguay", "Romania"],
            text: "In 2016, Uruguay and Romania spent almost the same per secondary student (15.9% and 15.2% of GDP per capita). Yet women led by 7.1 points in Uruguay, while men led by 10.7 points in Romania. Spending alone does not predict the gap."
        },
        {
            label: "Germany's big shift",
            year: 2006, measure: "genderGap", countries: ["Germany"],
            text: "Men in Germany led by 14.9 percentage points in 2004. By 2018, the lead had shrunk to 6.8 points, the largest change of any country in our data. Press Play to watch Germany move up, or follow its line in the chart below."
        },
        {
            label: "Sweden, the exception",
            year: 2004, measure: "genderGap", countries: ["Sweden"],
            text: "Sweden is the only country that moved clearly toward men: from women ahead by 3.2 points in 2004 to men ahead by 0.7 points in 2017. Press Play to watch it move down, or follow its line in the chart below."
        },
        {
            label: "Dominican Republic's rise",
            year: 2016, measure: "female", countries: ["Dominican Republic"],
            text: "In the Dominican Republic, spending per secondary student rose from 7.9% of GDP per capita in 2012 to 14.9% in 2016. Over the same period, female attainment rose from 35.8% to 50.9% and male attainment from 29.2% to 46.1%, with the largest increase between 2015 and 2016."
        }
    ];
    const defaultCaption = d3.select("#story-caption").text();

    const storyButtons = d3.select("#story-buttons")
        .selectAll("button")
        .data(stories)
        .join("button")
        .attr("type", "button")
        .attr("class", "story-button")
        .attr("aria-pressed", "false")
        .text(d => d.label)
        .on("click", (event, story) => {
            const isActive = d3.select(event.currentTarget).attr("aria-pressed") === "true";
            if (isActive) {
                clearStory();
                return;
            }
            pausePlayback();
            regions.forEach(region => activeRegions.add(region));
            legend.attr("aria-pressed", "true");
            highlightedCountry = null;
            highlightSelect.property("value", "");
            storyCountries = story.countries;
            currentYear = story.year;
            currentMeasure = story.measure;
            measureSelect.property("value", story.measure);
            storyButtons.attr("aria-pressed", d => d === story);
            d3.select("#story-caption").text(story.text);
            d3.select("#story-reset").property("hidden", false);
            updateChart(600);
        });

    function clearStorySelection() {
        storyButtons.attr("aria-pressed", "false");
        d3.select("#story-caption").text(defaultCaption);
        d3.select("#story-reset").property("hidden", true);
    }

    function clearStory() {
        storyCountries = [];
        clearStorySelection();
        updateChart(300);
    }

    d3.select("#story-reset").on("click", clearStory);
    updateChart(0);

    // Clicking empty chart space clears the highlight and any touch tooltip.
    svg.on("click", () => {
        hideTooltip();
        if (highlightedCountry !== null) setHighlight(null);
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") hideTooltip();
    });

}).catch(error => {
    console.error("Unable to load the education chart:", error);
    d3.selectAll("#year-slider, #play-pause, #measure-select, #highlight-select").property("disabled", true);
    d3.select("#chart-status").attr("role", "alert").text(
        "The chart could not load. Keep combined-fourteen-countries.csv beside index.html " +
        "and main.js, and open the project through a local web server. " + error.message
    );
});
