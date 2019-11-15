let { JSDOM } = require("jsdom")
let MongoClient = require("mongodb").MongoClient

let fetch = require("node-fetch")

  module.exports = async ({body:body={event: "aberbeeg", eventNumber: 1}}) => {
    context.log(body)
    let { event: eventName, eventNumber: eventNumber } = JSON.parse(body)
  
    let url = "https://www.parkrun.org.uk/" + eventName + "/results/weeklyresults/?runSeqNumber=" + eventNumber
    let db = (await getDBAsync("mongodb://yewstock.ddns.net:27017/")).db("parkrun")
    let response = await fetch(url)
    let text = await response.text()
    context.log(url)
    context.log(text)
    const dom = new JSDOM(text)
    await Promise.all([].slice.call(
      dom.window.document.getElementById("content").children[1].lastChild.lastChild.children).map(async elem => {
      let name = elem.getAttribute("data-name")
        if (name != "Unknown") {
  
        let ageGroup =  elem.getAttribute("data-agegroup")
        let club = elem.getAttribute("data-club")
        let gender = elem.getAttribute("data-gender")
        let athleteNumber = elem.children[1].firstChild.firstChild.href.split("=")[1]
        await insertOneAsync(db.collection(eventName),{
          name: name,
          athleteNumber: athleteNumber,
          ageGroup: ageGroup,
          club: club,
          gender: gender
        })
      }
  
  
  
    }))
  
    db.close()
  
    return {
      statusCode: 200,
      body: text,
    }
  
  };
  
  function insertOneAsync(collection, param) {
    return new Promise(function (resolve, reject) {
      collection.insertOne(param, function (err, data) {
  
        if (err !== null) reject(err);
        else resolve(data)
      })
    })
  }
  function getDBAsync(param) {
    return new Promise(function (resolve, reject) {
      MongoClient.connect(param, function (err, data) {
        if (err !== null) reject(err);
        else resolve(data);
      });
    });
  }
  
  