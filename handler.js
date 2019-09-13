'use strict';
let aws = require('aws-sdk');
let { JSDOM } = require("jsdom")
let MongoClient = require("mongodb").MongoClient
let locations = require("./locations.json")
let lambda = new aws.Lambda({
  region: 'us-west-2' //change to your region
});
let fetch = require("node-fetch")
module.exports.request = async (event) => {
  let body = JSON.parse(event.body)
  let data = await fetch(body.url)
  let text = await data.text()
  return {
    statusCode: 200,
    body: text,
  };
};


module.exports.delegateEvents = async (event) => {
  for (let index = 1; index < locations.count + 1; index++) {
    lambda.invoke({
      FunctionName: "specificEvent",
      Payload: JSON.stringify({ event: locations.event, eventNumber: i })
    });

  }
  return {
    statusCode: 200,
    body: text,
  };
};


module.exports.specificEvent = async (event) => {
  let { event: eventName, eventNumber: eventNumber } = JSON.parse(event.body)

  let url = "https://www.parkrun.org.uk/" + eventName + "/results/weeklyresults/?runSeqNumber=" + eventNumber
  let db = (await MongoClient.connect(process.env.url)).db("parkrun")

  let response = await fetch(url)

  let text = await response.text()
  const dom = new JSDOM(text)
  await Promise.all([].slice.call(dom.window.document.getElementById("results").lastChild.children).map(async elem => {
    if (elem.children[1].children[0]) {

      let name = elem.children[1].children[0].firstChild.data;
      let athleteNumber = elem.children[1].children[0].href.split("=")[1]

      await db.collection("athleteNumbers").insertOne({
        name: name,
        athleteNumber: athleteNumber
      })
    }

  }))
  db.close
  return {
    statusCode: 200,
    body: text,
  };
};
