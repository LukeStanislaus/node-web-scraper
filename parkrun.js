let fetch = require("node-fetch")
const util = require("util")
let jsdom = require("jsdom");
let saa = require("spawn-as-admin")
const exec = util.promisify(require('child_process').exec);
const fs = require("fs").promises
const locations = require("./locations.json")
const { JSDOM } = jsdom
async function getLocations() {


    let response = await fetch("https://www.parkrun.org.uk/results/firstfinishers/")
    let text = await response.text()
    const dom = new JSDOM(text)
    let links = [].slice.call(dom.window.document.getElementById("results").lastChild.children).map(elem => elem.children[0].children[0].href.split("/")[3]);
    console.log(links);
    await fs.writeFile("./locations.json", JSON.stringify(links))

}
async function main() {
    //let proc = saa('npx', ["easyvpn"])
    await sleep(25000)

    async function fetchEvents(elem) {
        async function urlMap(element){
            try {
                console.log(elem);
                console.log(object);
                let response = await fetch(element)
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
                console.log(e);
                if (e.message = "Cannot read property 'lastChild' of null") {
                    //proc.kill([0])
                    //proc = saa('npx', ["easyvpn"])
                    await sleep(25000)
                    return urlMap(element)
                }
                return null;
            }
        }
        let url = "https://www.parkrun.org.uk/" + elem + "/results/weeklyresults/?runSeqNumber="
        let urls = []
        for (let index = 0; index < 1000; index++) {
            urls.push(url + index);

        }
        urls = urls.map(urlMap)
        let athleteNumbers = await Promise.all(urls)
        return {
            location: elem,
            data: athleteNumbers.filter(elem => elem !== null)
        }
    }


    let data = await Promise.all(locations.map(fetchEvents))
    await fs.writeFile("./athleteNumberData.json", JSON.stringify(data))
}


main()
function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}
