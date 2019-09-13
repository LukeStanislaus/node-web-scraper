let fetch = require("node-fetch")
const util = require("util")
let jsdom = require("jsdom");
let saa = require("spawn-as-admin")
const exec = util.promisify(require('child_process').exec);
const fs = require("fs").promises
var MongoClient = require('mongodb').MongoClient
const locations = require("./locations.json")
const { JSDOM } = jsdom

async function getCountOfEvents(elem){
    let response = await fetch("https://eq5uyfrtjj.execute-api.us-east-1.amazonaws.com/dev/request",{
        method:"post",
        body:JSON.stringify({url: "https://www.parkrun.org.uk/"+elem+"/"})
                        })
    let text = await response.text()
    const dom = new JSDOM(text)
    let countOfEvents = dom.window.document.getElementById("FooterStats").children[2].children[0].firstChild.data.split(":")[1].trim()

    return {event: elem, count: countOfEvents}
}
async function getLocations() {


    let response = await fetch("https://eq5uyfrtjj.execute-api.us-east-1.amazonaws.com/dev/request",{
        method:"post",
        body:JSON.stringify({url: "https://www.parkrun.org.uk/results/firstfinishers/"})
                        })
    let text = await response.text()
    const dom = new JSDOM(text)
    let links = [].slice.call(dom.window.document.getElementById("results").lastChild.children).map(elem => elem.children[0].children[0].href.split("/")[3]);

    links = await Promise.all(links.map(getCountOfEvents))
    
    await fs.writeFile("./locations.json", JSON.stringify(links))

}
async function main() {

    async function fetchEvents({event: elem, count: count}) {
        console.log("Proccessing "+elem+ "...")
        async function urlMap(element){
            if(run){try {
                let response = await fetch("https://eq5uyfrtjj.execute-api.us-east-1.amazonaws.com/dev/request",{
method:"post",
body:JSON.stringify({url: element})
                })
                let text = await response.text()
                const dom = new JSDOM(text)
                return [].slice.call(dom.window.document.getElementById("results").lastChild.children).map(elem => {
                    if (elem.children[1].children[0]) {

                        let name = elem.children[1].children[0].firstChild.data;
                        let athleteNumber = elem.children[1].children[0].href.split("=")[1]

                        return {
                            name: name,
                            athleteNumber: athleteNumber
                        }
                    }
                    return null
        
                })
            }
            catch (e) {
                console.log("Fail on "+ element);             
                console.log(e);
                if (e.message = "Cannot read property 'lastChild' of null") {
                    return await urlMap(element)
                }
                return null;
            }}
        }
        let url = "https://www.parkrun.org.uk/" + elem + "/results/weeklyresults/?runSeqNumber="
        let urls = []
        for (let index = 1; index <= count; index++) {
            urls.push(url + index);

        }
        run=true
        urls = urls.map(urlMap)
        let athleteNumbers = await Promise.all(urls)
        return {
            location: elem,
            data: uniq(([].concat.apply([], athleteNumbers)).filter(elem => elem !== null))
        }
    }


    let data = await Promise.all([locations[0]].map(fetchEvents))
    await fs.writeFile("./athleteNumberData.json", JSON.stringify(data))
}

main()
function uniq(array) {
    var unique = {};
    var distinct = [];
        for( var i in array ){
         if( typeof(unique[array[i].athleteNumber]) == "undefined"){
          distinct.push(array[i]);
         }
         unique[array[i].athleteNumber] = 0;
        }
        return distinct;
}
function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}
