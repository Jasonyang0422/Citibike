'use strict';

const STATION_INFO_URI = "https://gbfs.citibikenyc.com/gbfs/en/station_information.json";
const STATION_STATUS_URI = "https://gbfs.citibikenyc.com/gbfs/en/station_status.json";

let express = require('express');
let bodyParser = require('body-parser');
let rp = require('request-promise');
let Promise = require('bluebird');

const sessionsManager = require('./sessionsManager');

let app = express();


app.use(bodyParser.json({ type: 'application/json' }));
console.log("app.js created an express app");

app.all('/fb', sessionsManager.inboundFacebookEvent);

app.post('/fulfillment', function (req, res) {
    console.log('app.post/fulfillment. body=', JSON.stringify(req.body));
    
    if (req.body.result.action == 'call.api.specific.stations') {
        // Asynschronous call
        // call_api_specifc_stations(req, res, apiResult);
        setTimeout(call_api_specifc_stations.bind(this, req, res), 2000);
        
        var response = {
            speech: "I'am calling Citibike API. please hold on...",
            source: "apiai-citibike",
            displayText: "I'am calling Citibike API. please hold on..."
        }
        res.json(response);
    }
    else if (req.body.result.action == 'call.api.nearby.stations') {
        setTimeout(call_api_nearby_stations.bind(this, req, res), 2000);
        
        var response = {
            speech: "I'am calling Citibike API. please hold on...",
            source: "apiai-citibike",
            displayText: "I'am calling Citibike API. please hold on..."
        }
        res.json(response); 
    }
    else if (req.body.result.action == 'stations.quick.reply') {
        process_station_quick_reply(req, res);
    }
    else if (req.body.result.action == 'send.specific.stations') {
        send_specifc_stations(req, res);
    }
    else if (req.body.result.action == 'send.nearby.stations') {
        send_nearby_stations(req, res);
    }
    else if (req.body.result.action == 'test') {
        var response = {
            // speech: "testing message",
            // source: "apiai-citibike",
            // displayText: "testing message"
            cool: 'anything'
        };
        res.json(response);    
    }

});

var port = process.env.port || process.env.PORT || 3000;
app.listen(port, () => { console.log('Chatbot application Running on port .' + port) });




function process_station_quick_reply(req, res) {
    var stationId = req.body.result.parameters.stationId;
    var stations;

    rp(STATION_INFO_URI)
        .then(function (data) {
            var obj = JSON.parse(data);
            stations = [get_station_by_id(stationId, obj.data['stations'])];
            return rp(STATION_STATUS_URI);
        })
        .then(function (data) {
            var obj = JSON.parse(data);
            var status = get_status_by_id([stationId], obj.data['stations']);
            return process_status_message(stations, status);
        })
        .then(function (message) {
            var response = {
                speech: message,
                source: "apiai-citibike",
                displayText: message
            };
            res.json(response);
        })
        .catch(function (err) {
            console.log(err);
        });
}

function get_station_by_id(id, stations) {
    for (var i = 0; i < stations.length; i++) {
        if (stations[i].station_id == id) {
            return stations[i];
        }
    }
}

function call_api_nearby_stations(req, res) {
    var user_shared_location = req.body.result.contexts[2];
    if(user_shared_location.name == "user_shared_location") {
        var coordinates = user_shared_location.parameters.coordinates.split(',');
    }

    var stations;
    rp(STATION_INFO_URI)
        .then(function (data) {
            var obj = JSON.parse(data);
            return get_nearby_stations(coordinates, obj.data['stations']);
        })
        .then(function (stations) {
            var sessionId = req.body.sessionId;

            // trigger the event
            sessionsManager.handleEvent(sessionId, {type: "SEND_NEARBY_STATIONS", data: {nearby_stations: stations}});
        })
        .catch(function (err) {
            console.log(err);
        });    
}

function send_nearby_stations(req, res) {
    var contexts = req.body.result.contexts;
    var nearby_stations = [];
    
    contexts.forEach(function(context) {
        //event name is included in contexts key
        if(context.name == "send_nearby_stations") {
            nearby_stations = context.parameters.nearby_stations;
        }
    });

    var fulfillment = {
        speech: '',
        messages: [
            {
                type: 2,
                platform: 'facebook',
                title: 'Please pick specific station',
                replies: []
            }
        ]
    }
    nearby_stations.forEach(function (station) {
        var replyObj = {
            name: station.name,
            content: station.station_id
        }
        fulfillment.messages[0].replies.push(replyObj);
    });
    res.json(fulfillment);
}

function get_nearby_stations(coordinates, stations) {
    var nearbyStations = [];
    stations.forEach(function (station) {
        station.distance = Math.pow(station.lat - coordinates[0], 2) + Math.pow(station.lon - coordinates[1], 2);
        if (nearbyStations.length < 3) {
            nearbyStations.push(station);
            nearbyStations.sort(function (a, b) {
                a.distance - b.distance;
            });
        } else if (nearbyStations[2].distance > station.distance) {
            nearbyStations.pop();
            nearbyStations.push(station);
            nearbyStations.sort(function (a, b) {
                a.distance - b.distance;
            });
        }
    });
    return nearbyStations;
}

function call_api_specifc_stations(req, res, apiResult) {
    var streetArray = req.body.result.parameters['street-address'];
    rp(STATION_INFO_URI)
        .then(function (data) {
            var obj = JSON.parse(data);
            return get_station_by_name(streetArray, obj.data['stations']);
        })
        .then(function (stations) {
            var sessionId = req.body.sessionId;
            
            // trigger the event. event = {type: , data: } 
            sessionsManager.handleEvent(sessionId, {type: "SEND_SPECIFIC_STATIONS", data: {specific_stations: stations}});
        })
        .catch(function (err) {
            console.log(err)
        });
}

function send_specifc_stations(req, res) {
    var contexts = req.body.result.contexts;
    var specific_stations = [];
    
    contexts.forEach(function(context) {
        //event name is included in contexts key
        if(context.name == "send_specific_stations") {
            specific_stations = context.parameters.specific_stations;
        }
    });

    if (specific_stations.length === 0) {
        var response = {
            speech: "Sorry, I can't figure out that address",
            source: "apiai-citibike",
            displayText: "Sorry, I can't figure out that address"
        }
        res.json(response);
    } else {
        var fulfillment = {
            speech: '',
            messages: [
                {
                    type: 2,
                    platform: 'facebook',
                    title: 'Please pick specific station',
                    replies: []
                }
            ]
        }
        specific_stations.forEach(function (station) {
            var replyObj = {
                name: station.name,
                content: station.station_id
            }
            fulfillment.messages[0].replies.push(replyObj);
        });
        res.json(fulfillment);
    }
}

function get_station_by_name(streetArray, stations) {
    return stations.filter(function (station) {
        return test(streetArray, station);
    });
}

function get_status_by_id(ids, allStatus) {
    return allStatus.filter(function (statusObj) {
        if (ids.indexOf(statusObj['station_id']) !== -1) {
            return true;
        } else {
            return false;
        }
    });
}

function test(streetArray, station) {
    var newArray = streetArray.map(function (street) {
        var news = street.replace(/street/gi, 'st').replace(/avenue/gi, 'ave');
        return news;
    });

    for (var i = 0; i < newArray.length; i++) {
        if (station['name'].toLowerCase().indexOf(newArray[i].toLowerCase()) === -1) {
            return false;
        }
    }
    return true;
}

function process_status_message(stations, all_status) {
    var res = '';
    all_status.forEach(function (status, index) {
        res = res + 'Station Name: ' + stations[index]['name'] + '\n';
        res = res + 'Available Bikes: ' + status['num_bikes_available'] + '\n';
        res = res + 'Available Docks: ' + status['num_docks_available'] + '\n';
        res = res + '\n';
    });
    return res;
}