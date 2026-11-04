import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Load CSV file
d3.csv("combined-fourteen-countries.csv").then(data => {
    
    console.log(data);

    })