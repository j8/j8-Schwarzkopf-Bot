'use strict';
/*


 WIT_TOKEN=WIB3WAYUG5VMOHWUYCO7TXPKCHBWTVUO FB_APP_SECRET=74ca1b2643830f027b815aa1fcf7c45d FB_PAGE_TOKEN=EAAEkJtdsO5QBALwbGq9hMdAud5FB1WXlxOl8roLm8MxrXbbHwJCXaX4eIIRtlnFXY2dBR2SD1kPBkneABooq9f2ry7WtDnUXZBE6pRkcgx3kEQ1g3TYo1lJpJZC5p6wX1hZAk6NCmT0jrMo5MbZCs9DB4QUTFAO632qxfqzB8oiT7eEfAJ67 node messenger.js

 */

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!
const config = require('config');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');

let Wit = null;
let log = null;
try {
  // if running from repo
  Wit = require('../').Wit;
  log = require('../').log;
} catch (e) {
  Wit = require('node-wit').Wit;
  log = require('node-wit').log;
}

// URL where the app is running (include protocol). Used to point to scripts and 
// assets located at this address. 
const SERVER_URL = (process.env.SERVER_URL) ? (process.env.SERVER_URL) : config.get('SERVER_URL');

// Webserver parameter
const PORT = process.env.PORT || 8445;

// Wit.ai parameters
const WIT_TOKEN = (process.env.WIT_TOKEN) ? (process.env.WIT_TOKEN) : config.get('WIT_TOKEN');

// Messenger API parameters
const FB_PAGE_TOKEN = config.get('FB_PAGE_TOKEN');
if (!FB_PAGE_TOKEN) { throw new Error('missing FB_PAGE_TOKEN') }
const FB_APP_SECRET = config.get('FB_APP_SECRET');
if (!FB_APP_SECRET) { throw new Error('missing FB_APP_SECRET') }

// let FB_VERIFY_TOKEN = 'efd56ae384246f69';

// Arbitrary value used to validate a webhook
const FB_VERIFY_TOKEN = config.get('FB_VERIFY_TOKEN');

// crypto.randomBytes(8, (err, buff) => {
//   if (err) throw err;
//   FB_VERIFY_TOKEN = buff.toString('hex');
//   console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
// });

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: { id },
    message: { text },
  });
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/v2.6/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

// Our bot actions
const actions = {
  send({sessionId}, {text}) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
      return fbMessage(recipientId, text)
      .then(() => null)
      .catch((err) => {
        console.error(
          'Oops! An error occurred while forwarding the response to',
          recipientId,
          ':',
          err.stack || err
        );
      });
    } else {
      console.error('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve()
    }
  },
  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart
};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});


// Call method

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: FB_PAGE_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s", 
        recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });  
}

// Send video message

function sendVideoMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "video",
        payload: {
          url: SERVER_URL + "/assets/allofus480.mp4"
        }
      }
    }
  };

  callSendAPI(messageData);
}

function callUs(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    "message":{
      "attachment":{
        "type":"template",
           "payload":{
              "template_type":"button",
              "text":"Need further assistance? Talk to a representative",
              "buttons":[
                 {
                    "type":"phone_number",
                    "title":"Call Representative",
                    "payload":"+495364219"
                 }
              ]
           }
      }
    }
  };

  callSendAPI(messageData);
}


// Show QA

function showHelp(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
      attachment:{
        type:"template",
        payload:{
          "template_type":"button",
          "text":"How we can help you?",
          "buttons":[
            {
              "type":"postback",
              "title":"Am I able to mix 2 different hair colors?",
              "payload":"USER_DEFINED_PAYLOAD"
            },
            {
              "type":"postback",
              "title":"Can I use the color to color my eyelashes and eyebrows?",
              "payload":"USER_DEFINED_PAYLOAD"
            },
            {
              "type":"postback",
              "title":"Can I color my hair when it is wet?",
              "payload":"USER_DEFINED_PAYLOAD"
            }
          ]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendReceiptMessage(recipientId) {
  // Generate a random receipt ID as the API requires a unique ID
  var receiptId = "order" + Math.floor(Math.random()*1000);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
      attachment: {
        type: "template",
        payload: {
          template_type: "receipt",
          recipient_name: "Peter Chang",
          order_number: receiptId,
          currency: "EUR",
          payment_method: "Visa 1234",        
          timestamp: "1428444852", 
          elements: [{
            title: "Light Blonde",
            subtitle: "Vibrant Lightening In High Definition",
            quantity: 1,
            price: 5.00,
            currency: "EUR",
            image_url: "http://www.schwarzkopf.com/content/dam/skus/home/Products/ProductImages/Color/ColorUltime1920x2160/10-1_PD_CoUl_1920x2160.scale.050.jpg"
          }, {
            title: "Ruby Red",
            subtitle: "Especially developed for brilliant, vibrant color results",
            quantity: 1,
            price: 4.99,
            currency: "EUR",
            image_url: "http://www.schwarzkopf.com/content/dam/skus/home/Products/ProductImages/Color/ColorUltime1920x2160/5-22_PD_CoUl_1920x2160.scale.050.jpg"
          }],
          address: {
            street_1: "Am Langen Weiher 34, 40589 ",
            street_2: "",
            city: "Düsseldorf",
            postal_code: "40589",
            state: "DE",
            country: "DE"
          },
          summary: {
            subtotal: 9.99,
            shipping_cost: 10.00,
            total_tax: 5.67,
            total_cost: 19.99
          },
          adjustments: [{
            name: "New Customer Discount",
            amount: -4
          }, {
            name: "1EUR Off Coupon",
            amount: -1
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

// Use generic API

function sendBlondeHair(recipientId) {

  console.log('Sending blonde message', recipientId);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Light Blonde",
            subtitle: "Vibrant Lightening In High Definition",
            item_url: "http://www.schwarzkopf.com/skus/en/home/brands/color/colorUltime/10-1_Light_Blonde.html",               
            image_url: "http://www.schwarzkopf.com/content/dam/skus/home/Products/ProductImages/Color/ColorUltime1920x2160/10-1_PD_CoUl_1920x2160.scale.050.jpg",
            buttons: [{
              type: "web_url",
              url: "http://www.schwarzkopf.com/skus/en/home/brands/color/colorUltime/10-1_Light_Blonde.html",
              title: "Buy"
            }],
          },
          {
            title: "Light Pearl Blonde",
            subtitle: "Especially developed for ageless color for younger looking hair",
            item_url: "http://www.schwarzkopf.com/skus/en/home/brands/color/colorUltime/10-1_Light_Blonde.html",               
            image_url: "http://www.schwarzkopf.com/content/dam/skus/home/Products/ProductImages/Color/KeratinColor1920x2160/12-0_PD_FOCUS_Keratin_1920x2160.scale.050.jpg",
            buttons: [{
              type: "web_url",
              url: "http://www.schwarzkopf.com/skus/en/home/brands/color/KeratinColor/12-0_Light_Pearl_Blonde.html",
              title: "Buy"
            }],
          }
          ]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

function sendRedHair(recipientId) {

  console.log('Sending blonde message', recipientId);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Ruby Red",
            subtitle: "Especially developed for brilliant, vibrant color results",
            item_url: "http://www.schwarzkopf.com/skus/en/home/brands/color/colorUltime/5-22_Ruby_Red.html",               
            image_url: "http://www.schwarzkopf.com/content/dam/skus/home/Products/ProductImages/Color/ColorUltime1920x2160/5-22_PD_CoUl_1920x2160.scale.050.jpg",
            buttons: [{
              type: "web_url",
              url: "http://www.schwarzkopf.com/skus/en/home/brands/color/colorUltime/5-22_Ruby_Red.html",
              title: "Buy"
            }],
          },
          {
            title: "5.6 Warm Mahogany",
            subtitle: "Especially developed for ageless color for younger looking hair",
            item_url: "http://www.schwarzkopf.com/skus/en/home/brands/color/KeratinColor/5-6_Warm_Mahogany.html",               
            image_url: "http://www.schwarzkopf.com/content/dam/skus/home/Products/ProductImages/Color/KeratinColor1920x2160/5-6_PD_FOCUS_Keratin_1920x2160.scale.050.jpg",
            buttons: [{
              type: "web_url",
              url: "http://www.schwarzkopf.com/skus/en/home/brands/color/KeratinColor/5-6_Warm_Mahogany.html",
              title: "Buy"
            }],
          }
          ]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

// Send video message

function sendQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },    "message":{
      "text":"I’m OA, Schwarzkopf bot who will help you find your hair color match. How can I help you?",
      "quick_replies":[
        {
          "content_type":"text",
          "title":"Get colored matched",
          "payload":"ACTION_COLOR_MATCHING"
        },
        {
          "content_type":"text",
          "title":"Chat with Color Team",
          "payload":"ACTION_CHAT"
        }
      ]
    }
  };

  callSendAPI(messageData);
}


// Starting our webserver and putting it all together
const app = express();
app.use(({method, url}, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));

// Webhook setup
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message && !event.message.is_echo) {
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;

          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          const sessionId = findOrCreateSession(sender);

          // We retrieve the message content
          const {text, attachments} = event.message;

          // if (attachments && current.context = 'upload') {
          if (attachments && sessions[sessionId].context == 'upload') {
            // We received an attachment
            // Let's reply with an automatic message
            console.log('attachment', attachments, sessions[sessionId])

            fbMessage(sender, 'Beautiful pic! I\'ve looked and determined your current hair is Dark Red')

            var messageData = {
              recipient: {
                id: sender
              },    "message":{
                "text":"Is that correct?",
                "quick_replies":[
                  {
                    "content_type":"text",
                    "title":"Yes",
                    "payload":"COLOR_MATCHED"
                  },
                  {
                    "content_type":"text",
                    "title":"No",
                    "payload":"COLOR_NOT_MATCHED"
                  }
                ]
              }
            };

            setTimeout(function(){callSendAPI(messageData)},200)

          } else if (text) {
            // We received a text message

            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do

            // Custom code

            console.log('I receive this message: ', text);

            switch(event.message.quick_reply.payload) {
              // case 'show me products for blonde hair':
              //   sendBlondeHair(sender);
              //   break;
              // case 'show me products for red hair':
              //   sendRedHair(sender);
              //   break;
              // case 'show me how to color my hair':
              //   sendVideoMessage(sender);
              //   break;
              // case 'help':
              //   showHelp(sender);
              //   break;
              // case 'receipt':
              //   sendReceiptMessage(sender);
              //   break;
              // case 'call':
              //   callUs(sender);
              //   break;
              case 'ACTION_COLOR_MATCHING':
                sessions[sessionId].context = 'upload'
                setTimeout(function(){fbMessage(sender, 'Gorgeous! Upload a photo or snap a selfie ')}, 0);
                setTimeout(function(){fbMessage(sender, 'Hint: show your face and hair from roots to ends in natural lighting. Avoid areas too bright or too dim.')}, 200);
                break;
              case 'COLOR_MATCHED':
                sessions[sessionId].context = 'matched'

                var messageData = {
                  recipient: {
                    id: sender
                  },    "message":{
                    "text":"Is your hair color treated?",
                    "quick_replies":[
                      {
                        "content_type":"text",
                        "title":"Yes",
                        "payload":"COLOR_THREATED"
                      },
                      {
                        "content_type":"text",
                        "title":"No",
                        "payload":"COLOR_NOT_THREATED"
                      }
                    ]
                  }
                };

                callSendAPI(messageData);

                break;

                case 'COLOR_THREATED':
                  sessions[sessionId].context = 'threated'

                  var messageData = {
                    recipient: {
                      id: sender
                    },    "message":{
                      "text":"What color is your natural hair (not including gray)?",
                      "quick_replies":[
                        {
                          "content_type":"text",
                          "title":"Brown",
                          // "payload":"OG_COLOR_BROWN"
                          "payload":"COLOR_NOT_THREATED"
                        },
                        {
                          "content_type":"text",
                          "title":"Blonde",
                          // "payload":"OG_COLOR_BLONDE"
                          "payload":"COLOR_NOT_THREATED"

                        },
                        {
                          "content_type":"text",
                          "title":"Red",
                          // "payload":"OG_COLOR_RED"
                          "payload":"COLOR_NOT_THREATED"

                        },
                        {
                          "content_type":"text",
                          "title":"Black",
                          // "payload":"OG_COLOR_BLACK"
                          "payload":"COLOR_NOT_THREATED"

                        },
                      ]
                    }
                  };

                  callSendAPI(messageData);

                  break;

                case 'COLOR_NOT_THREATED':
                    sessions[sessionId].context = 'gray_color'

                    var messageData = {
                      recipient: {
                        id: sender
                      },    "message":{
                        "text":"Do you have any gray hair?",
                        "quick_replies":[
                          {
                            "content_type":"text",
                            "title":"None (0-10%)",
                            "payload":"GREY_NONE"
                          },
                          {
                            "content_type":"text",
                            "title":"Some (10-50%)",
                            "payload":"GREY_SOME"
                          },
                          {
                            "content_type":"text",
                            "title":"Most (50-80%)",
                            "payload":"GREY_SOME_MOST"
                          },
                          {
                            "content_type":"text",
                            "title":"All (80-100%)",
                            "payload":"GREY_SOME_ALL"
                          },
                        ]
                      }
                    };

                    callSendAPI(messageData);

                    break;


              case 'GREY_NONE':
              case 'GREY_SOME':
              case 'GREY_SOME_MOST':
              case 'GREY_SOME_ALL':
                  sessions[sessionId].context = 'gray_color'

                  var messageData = {
                    recipient: {
                      id: sender
                    },    "message":{
                      "text":"Would you like to go lighter, darker, or stay the same as your current color?",
                      "quick_replies":[
                        {
                          "content_type":"text",
                          "title":"Lighter",
                          "payload":"RECOMMEND_LIGHTER"
                        },
                        {
                          "content_type":"text",
                          "title":"Darker",
                          "payload":"RECOMMEND_DARKER"
                        },
                        {
                          "content_type":"text",
                          "title":"Stay the same",
                          "payload":"RECOMMEND_SAME"
                        }
                      ]
                    }
                  };

                  callSendAPI(messageData);

                  break;

              case 'RECOMMEND_LIGHTER':
              case 'RECOMMEND_DARKER':
              case 'RECOMMEND_SAME':
                  sessions[sessionId].context = 'recommend_color'
                  sendRedHair(sender);
                  setTimeout(function(){fbMessage(sender, 'Is there anything else I can help you with?)')}, 500);
                  setTimeout(function(){sendQuickReply(sender)}, 1000);
                  break;

              default:
              console.log('text...', event.message)
                // wit.runActions(
                //   sessionId, // the user's current session
                //   text, // the user's message
                //   sessions[sessionId].context // the user's current session state
                // ).then((context) => {
                //   // Our bot did everything it has to do.
                //   // Now it's waiting for further messages to proceed.
                //   console.log('Waiting for next user messages');

                //   // Based on the session state, you might want to reset the session.
                //   // This depends heavily on the business logic of your bot.
                //   // Example:
                //   // if (context['done']) {
                //   //   delete sessions[sessionId];
                //   // }

                //   // Updating the user's current session state
                //   sessions[sessionId].context = context;
                // })
                // .catch((err) => {
                //   console.error('Oops! Got an error from Wit: ', err.stack || err);
                // });
            }

          }
        } else {
          const sender = event.sender.id;
          console.log('received event', JSON.stringify(event));
          setTimeout(function(){fbMessage(sender, 'Hello O:)')}, 100);
          setTimeout(function(){sendQuickReply(sender)}, 1000);
        }
      });
    });
  }
  res.sendStatus(200);
});

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

    var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

app.listen(PORT);
console.log('Listening on :' + PORT + '...');