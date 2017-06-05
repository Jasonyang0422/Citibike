var apiai = require('apiai');
const sessionsManager = require('./sessionsManager');

var app = apiai(process.env.APIAI_TOKEN);

const sendTextMessageToApiAi = (textMessage, sessionId) => {
    return new Promise(function(resolve, reject) {
        let session = sessionsManager.getSessionBySessionId(sessionId);
        let userProfileContext = {
            "name": "user-profile",
            "parameters": {
                "full_name": session.profile.first_name + " " + session.profile.last_name,
                "last_visit": session.lastInboundMessage.toLocaleString()
            },
            "lifespan": 5
        };
        var request = app.textRequest(textMessage, {sessionId: sessionId, contexts: [userProfileContext], timezone: session.profile.timezone});

        request.on('response', function(response) {
            console.log("sendTextMessageToApiAi: response=" + JSON.stringify(response));
            return resolve(response);
        });

        request.on('error', function(error) {
            return reject(error);
        });

        request.end();
    });
}

const sendEventToApiAi = (event, sessionId) => {
    return new Promise(function(resolve, reject) {
        let session = sessionsManager.getSessionBySessionId(sessionId);
        let userProfileContext = {
            "name": "user-profile",
            "parameters": {
                "full_name": session.profile.first_name + " " + session.profile.last_name,
                "last_visit": session.lastInboundMessage.toLocaleString(),
            },
            "lifespan": 5
        };
        let eventArg = {
            "name": event.type,
            "data": event.data, 
        };

        var request = app.eventRequest(eventArg, {sessionId: sessionId, contexts: [userProfileContext]});

        request.on('response', function(response) {
            console.log("sendEventToApiAi: response=" + JSON.stringify(response));
            return resolve(response);
        });

        request.on('error', function(error) {
            return reject(error);
        });

        request.end();
    });
}

module.exports = {sendTextMessageToApiAi, sendEventToApiAi};
