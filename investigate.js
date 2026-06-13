const fs = require('fs');
const csv = require('csv-parser');

console.log("Opening male_coaches.csv to check headers...");

let isFirstRow = true;

fs.createReadStream('./male_coaches.csv')
  .pipe(csv())
  .on('data', (row) => {
    if (isFirstRow) {
      console.log("--- EXACT COLUMNS FOUND ---");
      console.log(row);
      isFirstRow = false;
    }
  })
  .on('end', () => {
    console.log("---------------------------");
  });