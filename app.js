'use strict';

const STATION_INFO_URI = "https://gbfs.citibikenyc.com/gbfs/en/station_information.json";
const STATION_STATUS_URI = "https://gbfs.citibikenyc.com/gbfs/en/station_status.json";

let express = require('express');
let bodyParser = require('body-parser');
let rp = require('request-promise');

let app = express();
app.use(bodyParser.json({ type: 'application/json' }));
console.log("app.js created an express app");

app.get('/', function (req, res) {
    res.send('app is running, hi!');
})

app.post('/fulfillment', function (req, res) {
    console.log('app.post/fulfillment. body=', JSON.stringify(req.body));
    var streetArray = req.body.result.parameters['street-address'];
    var stations;
    rp(STATION_INFO_URI)
        .then(function (data) {
            var obj = JSON.parse(data);
            stations = get_station_by_name(streetArray, obj.data['stations']);
        })
        .then(function () {
            return rp(STATION_STATUS_URI);
        })
        .then(function (data) {
            var obj = JSON.parse(data);
            var ids = stations.map(function (station) {
                return station['station_id'];
            });
            var all_status = get_status_by_id(ids, obj.data['stations']);
            var message = process_status_message(stations, all_status);

            var response = {
                speech: message,
                source: "apiai-citibike",
                displayText: message
            }
            console.log(response);
            res.json(response);
        })
        .catch(function (err) {
            console.log(err);
        })

});

var port = process.env.port || process.env.PORT || 3000;
app.listen(port, () => { console.log('Chatbot application Running on port .' + port) });

function get_station_by_name(streetArray, stations) {
    return stations.filter(function(station) {
        return test(streetArray, station);
    });
}

function get_status_by_id(ids, allStatus) {
    return allStatus.filter(function (statusObj) {
        if(ids.indexOf(statusObj['station_id']) !== -1) {
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

    for(var i = 0; i < newArray.length; i ++) {
        if(station['name'].toLowerCase().indexOf(newArray[i].toLowerCase()) === -1) {
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