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
    var response = {
        speech: "Today in Boston: Fair, the temperature is 37 F",
        source: "apiai-weather-webhook-sample",
        displayText: "Today in Boston: Fair, the temperature is 37 F"
    }
    rp(STATION_INFO_URI)
        .then(function (data) {
            console.log(data);
        })
        .catch(function (err) {
            console.log(err);
        })
    res.json(response);
});

var port = process.env.port || process.env.PORT || 3000;
app.listen(port, () => { console.log('Chatbot application Running on port .' + port) });