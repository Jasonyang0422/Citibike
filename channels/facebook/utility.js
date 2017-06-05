'use strict';

const MAX_GENERIC_TEMPLATE_ELEMENTS = 10;

const
  bodyParser = require('body-parser'),
  crypto = require('crypto'),
  fetch = require('node-fetch');


const sessionsManagerEvents = require("../../sessionsManager").EVENTS;

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = process.env.MESSENGER_APP_SECRET;

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = process.env.MESSENGER_VALIDATION_TOKEN;

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_ACCESS_TOKEN;

const AUTHORIZATION_URL = process.env.AUTHORIZATION_URL;

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN)) {
  console.error("Missing config values");
  process.exit(1);
}

const FACEBOOK_GRAPH_URL = "https://graph.facebook.com/v2.6/me/";

const setChannel = () => {
  setGetStartedButton();
  setPersistentMenu();
}

const setPersistentMenu = () => {
  let fullURL = FACEBOOK_GRAPH_URL + "messenger_profile?access_token=" + PAGE_ACCESS_TOKEN;
  let persistentMenu = {
    "persistent_menu": [
      {
        "locale": "default",
        "composer_input_disabled": false,
        "call_to_actions": [
          // {
          //   "type": "nested",
          //   "title": "About Vonage",
          //   "call_to_actions": [
          //     {
          //       "title": "Our Culture",
          //       "type": "postback",
          //       "payload": JSON.stringify({ type: "ABOUT_VONAGE_MENU_ITEM", data: { about: "culture" } })
          //     },
          //     {
          //       "title": "Our Values",
          //       "type": "postback",
          //       "payload": JSON.stringify({ type: "ABOUT_VONAGE_MENU_ITEM", data: { about: "values" } })
          //     },
          //     {
          //       "title": "Our Benefits",
          //       "type": "postback",
          //       "payload": JSON.stringify({ type: "ABOUT_VONAGE_MENU_ITEM", data: { about: "benefits" } })
          //     }
          //   ]
          // },
          // {
          //   "title": "Our Offices",
          //   "type": "nested",
          //   "call_to_actions": [
          //     {
          //       "title": "Holmdel, NJ",
          //       "type": "postback",
          //       "payload": JSON.stringify({ type: "VONAGE_OFFICE_MENU_ITEM", data: { location: "holmdel" } })
          //     },
          //     {
          //       "title": "Atlanta, GA",
          //       "type": "postback",
          //       "payload": JSON.stringify({ type: "VONAGE_OFFICE_MENU_ITEM", data: { location: "atlanta" } })
          //     },
          //     {
          //       "title": "New York, NY",
          //       "type": "postback",
          //       "payload": JSON.stringify({ type: "VONAGE_OFFICE_MENU_ITEM", data: { location: "new-york" } })
          //     },
          //     {
          //       "title": "London, UK",
          //       "type": "postback",
          //       "payload": JSON.stringify({ type: "VONAGE_OFFICE_MENU_ITEM", data: { location: "london" } })
          //     },
          //     {
          //       "title": "San-Francisco, CA",
          //       "type": "postback",
          //       "payload": JSON.stringify({ type: "VONAGE_OFFICE_MENU_ITEM", data: { location: "san-francisco" } })
          //     },
          //   ]
          // },
          {
            "title": "Explore Vonage",
            "type": "postback",
            "payload": JSON.stringify({ type: "CONTACT_AGENT_MENU_ITEM" })
          },
          {
            "title": "Contact Agent",
            "type": "postback",
            "payload": JSON.stringify({ type: "DISABLE_AGENT_MENU_ITEM" })
          }
        ]
      }
    ]
  }
  fetch(fullURL, { method: "POST", body: JSON.stringify(persistentMenu), headers: { "Content-Type": "application/json" } })
    .then(function (res) {
      return res.json();
    })
    .then(function (json) {
      console.log("setPersistentMenu returned: " + JSON.stringify(json));
    })
    .catch(err => {
      console.log("setPersistentMenu caught error: " + err);
    });
}

const setGetStartedButton = (sessionId, text) => {
  let fullURL = FACEBOOK_GRAPH_URL + "thread_settings?access_token=" + PAGE_ACCESS_TOKEN;
  let getStartedMessage = {
    "setting_type": "call_to_actions",
    "thread_state": "new_thread",
    "call_to_actions": [{
      "payload": sessionsManagerEvents.HRCHATBOT_BOT_GET_STARTED_PAYLOAD
    }]
  };
  fetch(fullURL, { method: "POST", body: JSON.stringify(getStartedMessage), headers: { "Content-Type": "application/json" } })
    .then(function (res) {
      return res.json();
    })
    .then(function (json) {
      console.log("setGetStartedButton returned: " + JSON.stringify(json));
    })
    .catch(err => {
      console.log("setGetStartedButton caught error: " + err);
    });
};

/*
 * This path is used for account linking. The account linking call-to-action
 * (sendAccountLinking) is pointed to this URL. 
 * 
 */
const altAuthorizeHandler = (req, res) => {
  var accountLinkingToken = req.query.account_linking_token;
  var redirectURI = req.query.redirect_uri;

  // Authorization Code should be generated per user by the developer. This will 
  // be passed to the Account Linking callback.
  var authCode = "1234567890";

  // Redirect users to this URI on successful login
  var redirectURISuccess = redirectURI + "&authorization_code=" + authCode;

  res.render('authorize', {
    accountLinkingToken: accountLinkingToken,
    redirectURI: redirectURI,
    redirectURISuccess: redirectURISuccess
  });
};

/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an 
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
      .update(buf)
      .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to 
 * Messenger" plugin, it is the 'data-ref' field. Read more at 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
function receivedAuthentication(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the 
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger' 
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam,
    timeOfAuth);

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.
  sendTextMessage(senderID, "Authentication successful");
}

/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */

function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  /*if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s", messageID);
    });
  }*/

}


/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 * 
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  /*console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);*/
}

/*
 * Account Link Event
 *
 * This event is called when the Link Account or UnLink Account action has been
 * tapped.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/account-linking
 * 
 */
function receivedAccountLink(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  var status = event.account_linking.status;
  var authCode = event.account_linking.authorization_code;

  console.log("Received account link event with for user %d with status %s " +
    "and auth code %s ", senderID, status, authCode);
}

function sendImageMessage(recipientId, url) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: url
        }
      }
    }
  };

  callSendAPI(messageData);
}


function sendAudioMessage(recipientId, attachmentId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "audio",
        payload: {
          attachment_id: attachmentId
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendVideoMessage(recipientId, attachmentId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "video",
        payload: {
          attachment_id: attachmentId
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendTextMessage(recipientId, text) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: text,
      metadata: "HRCHATBOT_METADATA"
    }
  };

  callSendAPI(messageData);
}

function sendButtonMessage(recipientId, text, buttons) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: text,
          buttons: buttons
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendGenericMessage(recipientId, title, subtitle, imageUrl, buttons) {
  let element = {
    title: title,
    image_url: imageUrl,
  };
  if (subtitle) element.subtitle = subtitle;
  if (buttons && buttons.length > 0) element.buttons = buttons;

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [element]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendCustomMessage(recipientId, messageObject) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: messageObject
  }

  callSendAPI(messageData);
}


function sendQuickReply(recipientId, text, quickReplyButtons) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: text,
      quick_replies: quickReplyButtons.map(function (quickReply) {
        if (typeof (quickReply) === "string") {
          return {
            content_type: "text",
            title: quickReply,
            payload: quickReply
          }
        }
        else {
          return quickReply;
        }
      })
    }
  }

  callSendAPI(messageData);
}

function sendReadReceipt(recipientId) {
  console.log("Sending a read receipt to mark message as seen");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "mark_seen"
  };

  callSendAPI(messageData);
}

function sendTypingOn(recipientId) {
  console.log("Turning typing indicator on");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_on"
  };

  callSendAPI(messageData);
}

function sendTypingOff(recipientId) {
  console.log("Turning typing indicator off");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_off"
  };

  callSendAPI(messageData);
}

/*
 * Send a message with the account linking call-to-action
 *
 */
function sendAccountLinking(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Welcome. Link your account.",
          buttons: [{
            type: "account_link",
            url: process.env.AUTHORIZATION_URL
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}


/*
 * Call the User Profile API. USER_ID and fields are part of query string. 
 * If successful, we'll get the user name, profile pic, locale, timezone, gender, is_payment_enabled,
 */
function getUserProfile(userId) {
  return new Promise(function (resolve, reject) {
    let qs = "?fields=first_name,last_name,profile_pic,locale,timezone,gender,is_payment_enabled&access_token=" + PAGE_ACCESS_TOKEN
    fetch('https://graph.facebook.com/v2.6/' + userId + qs)
      .then(function (res) {
        return res.json();
      })
      .then(function (json) {
        return resolve(json);
      })
      .catch(err => {
        console.log("facebook/utility getUserProfile caught an error: " + err);
        return reject(err);
      })
  })
}


/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 * TODO: To get email: https://developers.facebook.com/docs/graph-api/reference/user. Requires pages_messaging permission to manage the object.
 */
function callSendAPI(messageData) {
  let qs = "?access_token=" + PAGE_ACCESS_TOKEN;
  fetch('https://graph.facebook.com/v2.6/me/messages' + qs,
    {
      method: 'POST',
      body: JSON.stringify(messageData),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    .then(function (res) {
      return res.json();
    })
    .then(function (json) {
      var recipientId = json.recipient_id;
      var messageId = json.message_id;

    })
    .catch(err => {
      console.error("Failed calling Send API", err); /// show status code, status message and error
    })
}

var verifySubscription = (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
}

/***************************************************/

const buildShareLocationButton = () => {
  return {
    "text": "Please share your location:",
    "quick_replies": [
      {
        "content_type": "location",
      }
    ]
  };
}

module.exports = {
  setChannel, getUserProfile, sendTextMessage, sendQuickReply, sendGenericMessage, sendCustomMessage, verifySubscription,
  receivedDeliveryConfirmation, receivedMessageRead, sendImageMessage, sendAudioMessage, sendVideoMessage,
   /*buildLocationQuickReplies, buildRoleTypeQuickReplies,*/ buildShareLocationButton
};