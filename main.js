import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

//STEP 1: ###Data Preparation###///
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


//# Load our CSV dataset
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

    // SORT THE DATA
    // Sort first by country and then by year.
    chartData.sort((a, b) => {
        return (
            d3.ascending(a.country, b.country) ||
            d3.ascending(a.year, b.year)
        );

    });


    // CHECK THE FINAL DATA

    console.log("Cleaned chart data:", chartData);

    console.log("Number of observations:", chartData.length);

    console.log("Countries:", countries);

    // Print the first 20 observations.
    console.table(chartData.slice(0, 20));

    // Count the missing values after interpolation.
    console.log("Missing values after interpolation:");

    ["expenditure", "gdpPerCapita", "female", "male", "total", "genderGap"]
        .forEach(field => {

            const missing = chartData.filter(d => d[field] === null).length;

            console.log(field + ":", missing);

        });

}).catch(error => {

    // Display an error if the CSV cannot be loaded.
    console.error("Error loading CSV:", error);

});

