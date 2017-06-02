'use strict';

let express = require('express');
let bodyParser = require('body-parser');

let app = express();
app.use(bodyParser.json({ type: 'application/json' }));
console.log("app.js created an express app");

app.get('/', function (req, res) {
    res.send('app is running, hi!');
})

app.post('/', function (req, res) {
    console.log('>>>>>>>>>>>>>>>>>>>>');
})

app.post('/fulfillment', function (req, res) {
    console.log('app.post/fulfillment. body=', JSON.stringify(req.body));
    res.send("app is running");
});

var port = process.env.port || process.env.PORT || 3000;
app.listen(port, () => { console.log('Chatbot application Running on port .' + port) });