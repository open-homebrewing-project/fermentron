var Cylon = require('cylon'),
    fs = require('fs'),
    StatsD = require('node-statsd'),
    client = new StatsD(),
    Twitter = require('twitter'),
    twit = new Twitter({
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
      access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    }),
    celsiusToFahrenheit = function (c) {
      var f = c * 9/5 + 32
      return f;
    }
    parseProbResults = function (data) {
      return (parseInt(data.split("t=")[1])) / 1000;
    };

Cylon.robot({
  probPath: "/home/pi/temp2",
  name: "FermentTron",
  recipe: {
    name: "Weizenbock Halfie",
    url: "https://www.brewtoad.com/recipes/weizenbock-halfie-jz",
    fermentTime: 7
  },
  notify: {
    name: "@AgentO3"
  },
  currentTemp: 0,
  currentStep: "startup",
  connections: {
    robot: { adaptor: "loopback" }
  },

  work: function(my) {

    //Sample the temp every x seconds
    every((10).seconds(), function(){
      my.sampleTemp(my);


      my.when(my.currentStep === "startup", function(){
          my.robot.emit(my.currentStep);

      });

      client.gauge('fermentation_temperature', my.currentTemp);

      console.log("Current step is " + my.currentStep);
      console.log("Current temp is " + my.currentTemp);

    });

    every((86400).seconds(), function(){
      my.sendMessage("The current fermentation temp of " +
      my.recipe.name + " is " + my.currentTemp + "℉." + my.notify.name);
    });

    my.robot.once("startup", function(){
      my.sendMessage("Starting FermentTron.");
      my.currentStep = "ferment-primary";
      my.robot.emit(my.currentStep);
    });

    my.robot.once("ferment-primary", function(){
      my.sendMessage("Starting fermentation of " + my.recipe.name + " in primary fermentor for " + my.recipe.fermentTime + " days." + my.notify.name);
      after((my.recipe.fermentTime * 86400).seconds(), function(){
        my.sendMessage("Fermentation of " + my.recipe.name + " complete. Time to move to secondary fermentor. " + my.notify.name);
        my.currentStep = "ferment-secondary";
        my.robot.emit(my.currentStep);
      });

    });

    my.robot.once("ferment-secondary", function(){
      my.sendMessage("Starting fermentation of " + my.recipe.name + " in secondary fermentor for " + my.recipe.fermentTime + " days." + my.notify.name);
      after((my.recipe.fermentTime * 86400).seconds(), function(){
        my.sendMessage("Fermentation of " + my.recipe.name + " is done. Time to move it to the keg. " + my.notify.name);
        my.currentStep = "ferment-done";
        my.robot.emit(my.currentStep);
      });

    });

    my.robot.once("ferment-done", function(){
      console.log("Fermentation process is done shutting down FermentTron.");
      Cylon.halt();
    });
  },

  when: function(exp, callBack){
    if (exp) {
      callBack()
    };
  },

  sampleTemp: function(my) {
    var data = fs.readFileSync(my.probPath, 'utf8');

    if (data.indexOf("NO") > -1) {
        console.log("Unable to read sensor");
    } else {
      var tempCelsius = parseProbResults(data),
      tempFahrenheit = celsiusToFahrenheit(tempCelsius);

      my.currentTemp = tempFahrenheit;
    }

  },

  sendMessage: function(msg) {
    console.log(msg);
    twit.post('statuses/update', {status: msg},  function(error, params, response){

      if(error) {
        console.log(error)
      }

    });
  },

  sleep: function sleep(ms) {
    var start = Date.now(),
        i;

    while(Date.now() < start + ms) {
      i = 0;
    }
  },
}).start();
