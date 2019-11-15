let locations = require("./locations.json")
let count = 0
locations.forEach(element => {
    count+=element.count
});
console.log(count);