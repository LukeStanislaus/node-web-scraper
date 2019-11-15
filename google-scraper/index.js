let { JSDOM } = require("jsdom")

let fetch = require("node-fetch")

module.exports.http = async ({ body: body}, res) => {
  body = Object.keys(body).length === 0 ? JSON.stringify({ event: "aberbeeg", eventNumber: 1 }) : body;
  console.log(body)
  let { event: eventName, eventNumber: eventNumber } = JSON.parse(body)

  let url = "https://www.parkrun.org.uk/" + eventName + "/results/weeklyresults/?runSeqNumber=" + eventNumber
  let response = await fetch(url)
  let text = await response.text()
  console.log(text)
  const dom = new JSDOM(text)
  let items = await Promise.all([].slice.call(
    dom.window.document.getElementById("content").children[1].lastChild.lastChild.children).map(async elem => {
    let name = elem.getAttribute("data-name")
      if (name != "Unknown") {

      let ageGroup =  elem.getAttribute("data-agegroup")
      let club = elem.getAttribute("data-club")
      let gender = elem.getAttribute("data-gender")
      let athleteNumber = elem.children[1].firstChild.firstChild.href.split("=")[1]
      return {
        name: name,
        athleteNumber: athleteNumber,
        ageGroup: ageGroup,
        club: club,
        gender: gender
      }
    }



  }))


res.status(200).send(JSON.stringify(items.filter(val=>val!==null)))

};

