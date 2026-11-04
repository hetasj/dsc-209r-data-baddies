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

    console.log("Original CSV data:", rawData);
    //FILTER THE YEARS WE NEED:
    const filteredData = rawData.filter(d => {
        const year = Number(d[columns.year]);
        return year >= startYear && year <= endYear;
    });
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

    // FILTER DATA FOR THE FIRST YEAR
    // We start by displaying 2004.
    const initialYear = 2004;
    // Only keep countries with all the values needed
    // to draw their bubbles.
    const initialData = chartData.filter(d => {
        return (
            d.year === initialYear &&
            d.expenditure !== null &&
            d.genderGap !== null &&
            d.gdpPerCapita !== null
        );
    });

    // CREATE THE X-AXIS SCALE
    // The X-axis represents government expenditure.
    // We use a linear scale because expenditure is
    // expressed as a percentage.
    const xExtent = d3.extent(
        chartData.filter(d => d.expenditure !== null),
        d => d.expenditure
    );
    // Add a little space at both ends of the axis.
    const xPadding = (xExtent[1] - xExtent[0]) * 0.05;
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
        .attr("role", "img")
        .attr("aria-label", "Bubble chart showing gender gaps in education");

    // Create a group that contains the chart itself.
    // This lets us position everything using margins.
    const plot = svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left},${margin.top})`
        );

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

    plot.append("g")
        .attr("class", "grid")
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

    plot.append("g")
        .call(yAxis);   

    // ADD THE X-AXIS LABEL
    plot.append("text")
        .attr("class", "axis-label")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 60)
        .attr("text-anchor", "middle")
        .text("Government expenditure per secondary student (% of GDP per capita)");

    // ADD THE Y-AXIS LABEL
     plot.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -65)
        .attr("text-anchor", "middle")
        .text("Gender gap in educational attainment (percentage points)");


    // DRAW THE ZERO REFERENCE LINE
    // This line helps us see whether female or male attainment is higher.
    plot.append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "#777")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,5");

    // DRAW THE BUBBLES
    // Create one circle for each country.
    const bubbles = plot.append("g")
        .selectAll("circle")
        .data(
            // Draw larger bubbles first so smaller ones
            // remain visible on top.
            initialData.sort(
                (a, b) => d3.descending(
                    a.gdpPerCapita,
                    b.gdpPerCapita
                )
            ),
            d => d.country
        )
        .join("circle")

        // Position the bubble horizontally.
        .attr("cx", d => x(d.expenditure))

        // Position the bubble vertically.
        .attr("cy", d => y(d.genderGap))

        // Set the bubble radius based on GDP per capita.
        .attr("r", d => radius(d.gdpPerCapita))

        // Set the bubble color based on geographic region.
        .attr("fill", d => color(d.region))

        // Make the bubbles slightly transparent.
        .attr("fill-opacity", 0.72)

        // Add a border around each bubble.
        .attr("stroke", d => d3.color(color(d.region)).darker(0.7))

        .attr("stroke-width", 1.2)

        // Show a pointer when hovering over a bubble.
        .style("cursor", "pointer");

    // ADD TOOLTIP INFORMATION
     // The browser will display this information when
    // someone hovers over a bubble.

    bubbles.append("title")
        .text(d => {

            return [
                d.country,
                "Region: " + d.region,
                "Year: " + d.year,
                "Government expenditure on Education (%GDP): " +
                    d.expenditure.toFixed(2) + "%",
                "Gender gap: " +
                    d.genderGap.toFixed(2) + " percentage points",
                "Female attainment: " +
                    (d.female === null ? "Unavailable" : d.female.toFixed(2) + "%"),
                "Male attainment: " +
                    (d.male === null ? "Unavailable" : d.male.toFixed(2) + "%"),
                "GDP per capita: $" +
                    d.gdpPerCapita.toLocaleString("en-US"),
                "Estimated gender gap: " +
                    (d.estimated.genderGap ? "Yes" : "No")
            ].join("\n");

        });

    // DISPLAY THE CURRENT YEAR
    d3.select("#year-display")
        .text(initialYear);

    // CREATE THE REGION LEGEND
    const regions = [
        "Europe",
        "Latin America",
        "United States"
    ];
    //// Create one legend item for each region
    const legend = d3.select("#legend")
        .selectAll(".legend-item")
        .data(regions)
        .join("div")
        .attr("class", "legend-item");

    //// Add the colored circle.
    legend.append("span")
        .attr("class", "legend-color")
        .style("background-color", d => color(d));

    //// Add the region name.
    legend.append("span")
        .text(d => d);

});

