let fetch = require("node-fetch")
const util = require("util")
let jsdom = require("jsdom");
let aws = require('aws-sdk');
let saa = require("spawn-as-admin")
const exec = util.promisify(require('child_process').exec);
const fs = require("fs").promises
let MongoClient = require("mongodb").MongoClient
const locations = require("./locations.json")
const { JSDOM } = jsdom

var allSettled = require('promise.allsettled');
let errorLocations = require("./errorData.json")
let mysql = require("mysql")

let sqs = new aws.SQS({ region: "us-east-1" })

allSettled.shim();
async function getCountOfEvents(elem) {
  let response = await fetch("https://yxjqtx1lvb.execute-api.us-east-1.amazonaws.com/dev/request", {
    method: "post",
    body: JSON.stringify({ url: "https://www.parkrun.org.uk/" + elem + "/" })
  })
  let text = await response.text()
  const dom = new JSDOM(text)
  let countOfEvents = parseInt(dom.window.document.getElementById("FooterStats").children[2].children[0].firstChild.data.split(":")[1].replace(",", ""))
  console.log(countOfEvents)
  return { event: elem, count: countOfEvents }
}
async function getLocations() {
  console.log("hello?");

  let response = await fetch("https://yxjqtx1lvb.execute-api.us-east-1.amazonaws.com/dev/request", {
    method: "post",
    body: JSON.stringify({ url: "https://www.parkrun.org.uk/results/firstfinishers/" })
  }).catch(e => console.log(e))
  let text = await response.text()
  const dom = new JSDOM(text)
  let links = [].slice.call(dom.window.document.getElementById("results").lastChild.children).map(elem => elem.children[0].children[0].href.split("/")[3]);
  console.log(links)
  links = await Promise.all(links.map(getCountOfEvents))

  await fs.writeFile("./locations.json", JSON.stringify(links))

}
async function fetchEvents() {

  async function fetchEvents({ event: elem, count: count }) {
    console.log("Proccessing " + elem + "...")
    async function urlMap(element) {
      if (run) {
        try {
          let response = await fetch("https://yxjqtx1lvb.execute-api.us-east-1.amazonaws.com/dev/request", {
            method: "post",
            body: JSON.stringify({ url: element })
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
          console.log("Fail on " + element);
          console.log(e);
          if (e.message = "Cannot read property 'lastChild' of null") {
            return await urlMap(element)
          }
          return null;
        }
      }
    }
    let url = "https://www.parkrun.org.uk/" + elem + "/results/weeklyresults/?runSeqNumber="
    let urls = []
    for (let index = 1; index <= count; index++) {
      urls.push(url + index);

    }
    run = true
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
main1()

async function main1() {
  let con = mysql.createPool({
    connectionLimit: 50,
    host: "localhost",
    user: "root",
    password: "abc123",
    database: "parkrun",
    ssl: {
      // DO NOT DO THIS
      // set up your ca correctly to trust the connection
      rejectUnauthorized: false
    }
  })
  //await getLocations()
  let max = errorLocations.length
  do {
  console.log("Starting!")
  let count = 0
  let promises = errorLocations.map(async element => {
    console.log("starting "+JSON.stringify(element))
    errorLocations = errorLocations.filter(elem => elem.event != element.event && elem.count != element.count)
    await delegateEvents(element, true, con).catch(err => console.log("We got an error " + err))
    count++
    console.log(count *100/ max)

    //console.log(errorLocations + " Hi")
  })
  await Promise.allSettled(promises)
  console.log("Done error locations")


  errorLocations = uniqLocations(errorLocations)
} while (errorLocations.length!=0)
// let promises1 = locations.map(async element => {
//   await delegateEvents(element, false, con).catch(err => console.log(err))
//   console.log("Finished " + element.event)
// })
count = 0 
for (let j = 0; j <locations.length; j++) {
  await delegateEvents(locations[j], false, con).catch(err => console.log(err))
  count++
  console.log(count*100/locations.length+"%.")
}
//await Promise.allSettled(promises1)
  await fs.writeFile("./errorData.json", JSON.stringify(errorLocations));
  console.log("Written to file")


}
function uniqLocations(array) {
  var unique = {};
  var distinct = [];
  for (var i in array) {
    if (typeof (unique[array[i].event]) == "undefined" && typeof (unique[array[i].count]) == "undefined") {
      distinct.push(array[i]);
    }
    unique[array[i].event] = 0;
  }
  return distinct;
}

function uniq(array) {
  var unique = {};
  var distinct = [];
  for (var i in array) {
    if (typeof (unique[array[i].athleteNumber]) == "undefined") {
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
function insertIntoDB(connection, sql) {
  return new Promise(function (resolve, reject) {
    connection.query(sql, (error, results, fields) => {
      if (!error) {
        resolve()
      }
      else {
        if (error.code == "ER_DUP_ENTRY") {
          resolve()
        }
        else {

          reject()
        }
      }

    })
  })
}


async function delegateEvents(event, only, con) {
  //console.log("Doing " + event.event)
  let promises = []
  let receptions = 0
  let loadings = 0
  for (let index = event.count<=50?1:event.count-50; index <= event.count; index++) {
    if (only) {
      index = event.count
    }
    promises.push((async (index) => {
      let res = await fetch("https://us-central1-parkrun-latest.cloudfunctions.net/http", {
        method: "POST",
        body: JSON.stringify({ event: event.event, eventNumber: index })
      }).catch(err => { })
      if (res == undefined) { errorLocations.push({ event: event.event, count: index }); return }
      //let clone = undefined

      //clone = res.clone()
      let text = await res.json().catch(err => { })
      //console.log(await clone.text());
      if (text == undefined) { errorLocations.push({ event: event.event, count: index }); return }

      // text = text == undefined ? [] : text

      let expr = text.filter(val => val !== null).map(element => '(' + con.escape(element.name) + ', '
        + element.athleteNumber + ', ' + con.escape(element.ageGroup) + ', '
        + con.escape(element.club) + ', ' + con.escape(element.gender) + ', ' +
        con.escape(event.event) + ')')
      await insertIntoDB(con, "replace athlete_data (name, athleteNumber, ageGroup, club, gender, location) values " + expr.reduce((accumulator, elem) => accumulator + ", " + elem))
      .catch(err => errorLocations.push({ event: event.event, count: index }))

      //console.log(expr)
      receptions++
      //console.log("We recieved data for " + index + ", which means we have recieved " + receptions * 100 / event.count + "% of events for this location")

      //await Promise.all(expr).catch(err => console.log(err))
      loadings++
      //console.log("We have loaded in " + index + " into the database, which means that we have loaded in " + loadings * 100 / event.count + "% of the data for this location")

    }).bind(null, index)())
  }
  let x = await Promise.all(promises).catch(err => {
    console.log("There was an error:" + err); throw err;
  })
  //console.log("ended, " + event.count - loadings / event.count + "% failure rate.")
}
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


function sendMessageAsync(param) {
  return new Promise(function (resolve, reject) {
    sqs.sendMessage(param, function (err, data) {

      if (err !== null) reject(err);
      else resolve(data)
    })
  })
}


let main = async ({ body: body }, res) => {
  body = Object.keys(body).length === 0 ? JSON.stringify({ event: "aberbeeg", eventNumber: 1 }) : body;
  console.log(body)
  let { event: eventName, eventNumber: eventNumber } = JSON.parse(body)

  let url = "https://www.parkrun.org.uk/" + eventName + "/results/weeklyresults/?runSeqNumber=" + eventNumber
  let db = (await getDBAsync("mongodb://yewstock.ddns.net:27017/")).db("parkrun")
  let response = await fetch(url)
  let text = await response.text()
  console.log(url)
  const dom = new JSDOM(text)
  await Promise.all([].slice.call(
    dom.window.document.getElementById("content").children[1].lastChild.lastChild.children).map(async elem => {
      let name = elem.getAttribute("data-name")
      if (name != "Unknown") {

        let ageGroup = elem.getAttribute("data-agegroup")
        let club = elem.getAttribute("data-club")
        let gender = elem.getAttribute("data-gender")
        let athleteNumber = elem.children[1].firstChild.firstChild.href.split("=")[1]
        console.log("done " + name)
        await insertOneAsync(db.collection(eventName), {
          name: name,
          athleteNumber: athleteNumber,
          ageGroup: ageGroup,
          club: club,
          gender: gender
        })
      }



    }))
  console.log("done")
  db.close()

  res.send("done")

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

  //main({})