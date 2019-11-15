'use strict';
let aws = require('aws-sdk');
let { JSDOM } = require("jsdom")
let MongoClient = require("mongodb").MongoClient
let locations = require("./locations.json")
let lambda = new aws.Lambda();

let sqs = new aws.SQS()

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
  for(let j = 0; j < locations.length; j++){                  
  for (let index = 1; index <= locations[j].count; index++) {
    console.log({ event: locations[j].event, eventNumber: index })
await sendMessageAsync({
  MessageBody:JSON.stringify({ event: locations[j].event, eventNumber: index }),
  QueueUrl: "https://sqs.us-east-1.amazonaws.com/118983564982/web-scraper-queue",
  DelaySeconds: Math.round(Math.random()*900)
})
  //  await invokeAsync({
  //     FunctionName: "web-scraper-dev-specificEvent",
  //     Payload:JSON.stringify({body:{ event: locations[j].event, eventNumber: index }}),
  //     InvocationType: "Event"
  //   });

  }
}
  return {
    statusCode: 200,
    body: event,
  };
};


module.exports.specificEvent = async (event) => {
  console.log(event)
  let { event: eventName, eventNumber: eventNumber } = JSON.parse(event.Records[0].body)

  let url = "https://www.parkrun.org.uk/" + eventName + "/results/weeklyresults/?runSeqNumber=" + eventNumber
  let db = (await getDBAsync("mongodb://yewstock.ddns.net:27017/")).db("parkrun")
  let response = await fetch(url)
  let text = await response.text()
  console.log(url)
  console.log(text)
  const dom = new JSDOM(text)
  await Promise.all([].slice.call(dom.window.document.getElementById("results").lastChild.children).map(async elem => {
    if (elem.children[1].children[0]) {

      let name = elem.children[1].children[0].firstChild.data;
      let athleteNumber = elem.children[1].children[0].href.split("=")[1]
      await insertOneAsync(db.collection(eventName),{
        name: name,
        athleteNumber: athleteNumber
      })
    }



  }))

  db.close()

  return {
    statusCode: 200,
    body: text,
  }

};
function sendMessageAsync(param) {
  return new Promise(function (resolve, reject) {
    sqs.sendMessage(param, function (err, data) {

      if (err !== null) reject(err);
      else resolve(data)
    })
  })
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
function invokeAsync(param) {
  return new Promise(function (resolve, reject) {
    lambda.invoke(param, function (err, data) {
      if (err !== null) reject(err);
      else resolve(data);
    });
  });
}