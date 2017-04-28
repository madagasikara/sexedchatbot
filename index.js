    //https://dashboard.heroku.com/apps/rocky-beyond-32293/logs
    'use strict'

    const token = process.env.PAGE_ACCESS_TOKEN
    const vtoken = process.env.VERIFICATION_TOKEN

    const express = require('express')
    const bodyParser = require('body-parser')
    const request = require('request')
    const app = express()
    var Promise = require('promise');
    var userData = {};
    var mongoose = require("mongoose");
    var db = mongoose.connect(process.env.MONGODB_URI);

    var globalvars= {sendRequest: sendRequest, userData: userData}
    //for messages sequence

    var tolotrafunctions = require('./tolotrafunctions')
    var Users = require("./content/users");
    // Process application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({extended: false}))
    // Process application/json
    app.use(bodyParser.json())
    app.set('port', (process.env.PORT || 5000))

    // Index route
    app.get('/', function (req, res) {
        res.send('Hello world, I am a chat bot')
    })

    // for Facebook verification
    app.get('/webhook/', function (req, res) {
        if (req.query['hub.verify_token'] === vtoken) {
            res.send(req.query['hub.challenge'])
        }
        res.send('No sir')
    })

    // Spin up the server
    app.listen(app.get('port'), function () {
        console.log('running on port', app.get('port'))
    })

    app.post('/webhook/', function (req, res) {
        var data = req.body;
        console.log('IT STARTS HERE')
        //Make sure its a page subscription
        if (data.object==='page'){
            let messaging_events = data.entry[0].messaging
            //iterate over each messaging events
            for (let i = 0; i < messaging_events.length; i++) {
                let event = data.entry[0].messaging[i]
                let sender = event.sender.id

                if (event.message && event.message.text) {
                    let text = event.message.text
                    decideMessagePlainText(sender, text)
                    receivedMessageLog(event)
                }

                else if (event.postback) {
                    let text = event.postback.payload
                    decideMessagePostBack(sender, text) 
                }
            }
        }
        res.sendStatus(200)
    })

    //Functions 
    function UserMeetsCriteria(sender) {
        var userInDatabase = isUserInDatabase(sender);
    }

    function isUserInDatabase(senderId) {
        Users.findOne({user_id: senderId}, function (err, user) {
            if (err) {
                console.log(senderId, "user not found or something weirder");
                askGender(senderId)
                return false; // user not found or something weirder

            } else {
                if (user) {
                    console.log(user, "user found on database");
                    hasCompleteInformation(senderId, user)
                    return true; //user found
                } else {
                    console.log('no result from database for', senderId)
                    askGender(senderId)
                    return false;
                }
            }
        })
    }

    function askGender(sender) {
        console.log('gender asked to ', sender)
        
        let messageData = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "button",
                    "text": "What is your gender?",
                    "buttons": [
                    {
                        "type": "postback",
                        "title": "Male",
                        "payload": "registration-gender-male"
                    },
                    {
                        "type": "postback",
                        "title": "Female",
                        "payload": "registration-gender-female"
                    },
                    {
                        "type": "postback",
                        "title": "I prefer not to say",
                        "payload": "registration-gender-undefined"
                    }
                    ]
                }
            }
        }
        sendRequest(sender, messageData)
        
       // sendQuickReply(sender, "What is your gender?", "text", "Male", "text", "Female")
    }

    function checkMinor(sender){
        console.log('check if minor or major')
        sendQuickReply(sender, "Check which applies", "text", "I am under 18.", "minor", "text", "I am above 18.", "major")
    }

    function hasCompleteInformation(sender, userInDatabase) {
        if (typeof (userInDatabase['sexe']) === 'undefined' || userInDatabase['sexe'] === '') {
            askGender(sender)
        }
        if (typeof (userInDatabase['minor']) === 'undefined' || userInDatabase['minor'] === '') {
            //askAge(sender)
            checkMinor(sender)
        }
       // if (typeof (userInDatabase['sexe']) != 'undefined' || userInDatabase['sexe'] != '') {
        else {
            //age and gender saved.
            tolotrafunctions.senderLearnOrQuestionButton(sender)
            //sendTopics(sender)
        }
    }

    function surveyToRegister(senderId, update) {
        console.log('update user ' + senderId, JSON.stringify(update))

        var query = {user_id: senderId};
        var options = {upsert: true};

        Users.findOneAndUpdate(query, update, options, function (err, mov) {
            if (err) {
                console.log("Database error: " + err);
            } else {
                console.log("Database sucess");
            }
        })
    }

    function insertToSession(sender) {
        if (typeof (userData.sender) === 'undefined') {
            userData.sender = {userdId: sender}
        }
    }
    //To gather information about received messages
    function receivedMessageLog(event) {
        var senderID = event.sender.id;
        var recipientID = event.recipient.id;
        var timeOfMessage = event.timestamp;
        var message = event.message || event.postback;
        var news;

        console.log("Received message for user %d and page %d at %d with message:", senderID, recipientID, timeOfMessage);
        console.log(JSON.stringify(event));
    }

    function decideMessagePostBack(sender, raw_postback) {
        var postbackText = JSON.stringify(raw_postback)
        console.log('message postback', postbackText)

        //post back will always contain a prefix (as key) referring to its category, a dash separate post back key, sub key to value     f
        var postback = raw_postback.split("-");
        var postbackcategory = postback[0];
        var postbacksubcategory = postback[1];
        var postbackvalue = postback[2];
        console.log(postback, 'post back')

        if(raw_postback == 'get_started') {  
            request({
                url: "https://graph.facebook.com/v2.6/" + sender,
                qs: {
                    access_token: token,
                    fields: "first_name"
                },
                method: "GET"
            }, function(error, response, body) {
                var greeting = "";
                if (error) {
                    console.log("Error getting user's name: " +  error);
                } else {
                    var bodyObj = JSON.parse(body);
                    var name = bodyObj.first_name;
                    greeting = "Hi " + name + " 😃 ";
                }
                var message = greeting + "My name is Sex Education Bot. I can tell you various details regarding Relationships and Sex. 👨‍❤️‍💋‍👨 💑 👫";
                sendTextMessage(sender, message)
                .then(sendTextMessage.bind(null,sender, "And to make the experience better, I'd like to get to know a bit about you."))
                .then(sendQuickReply.bind(null,sender, "Check which one applies to you:", "text", "I am under 18.", "minor", "text", "I am above 18.", "major"))
                .catch(function (body) {
                    console.log('aborted');
                });

                //before proceeding, check if user in database:
                insertToSession(sender) // insert to session if not yet in there
            });
        }

        if (postbackcategory === 'nav' && postbacksubcategory === 'main') {
                sendTopics(sender)
            }

        if (postbackcategory === 'registration') {
            if (postbacksubcategory === 'gender') {
                var update = {
                    user_id: sender,
                    sexe: postbackvalue,
                };
                surveyToRegister(sender, update)
            }
            //loop again
            UserMeetsCriteria(sender)
        }
    }

    function decideMessagePlainText(sender, text) {
        console.log('message plain text')
        if (text.is_echo) {
            return;
        }

        console.log('message is: ', text)
        text.toLowerCase()

        if(text == 'I am above 18.' || text == 'I am under 18.') {
            var update = {
                user_id: sender,
                minor: text,
            };
            surveyToRegister(sender, update)
            console.log("MINORITY OR MAJORITY REGISTERED")
            askGender(sender)
            //UserMeetsCriteria(sender)
            return;
        }
        if (text === 'hi' || text == 'hello') {
            sendTextMessage(sender, "Hey there! What do you want to do? 😏 ")
        }

        if (text === 'exit') {
            sendTextMessage(sender, 'Hope you have learnt! See you soon! 🖖😉')
        }

        if (text === 'learn') {
            sendTopics(sender)
        }
        if (text === 'health') {
            sendTextMessage(sender, "No risks condom")
        }
        if (text === 'health') {
            sendTextMessage(sender, "Wear condom")
        }
        if (text === 'age') {
            console.log('age detected')
            sendTextMessage(sender, "18")
            console.log('age end')
        }

        if (text === 'pregnant') {
            sendTextMessage(sender, "Sexual rapport")
        } else {
            tolotrafunctions.senderLearnOrQuestionButton(sender)
        }
    }

           // console.log(sender, 'before database fetching user_id')
          //  getMovieDetail(sender, 'director');

    //data base fetching//data base fetching
    function getMovieDetail(userId, field) {
        Users.findOne({user_id: userId}, function (err, movie) {
            if (err) {
                sendTextMessage(userId, "Something went wrong. Try again");
            } else {
                sendTextMessage(userId, movie[field] + ' sent from mongo DB');
            }
        })
    }

    //API REQUEST
    function sendRequest(sender, messageData) {
        return new Promise(function (resolve, reject) { // *****
        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {access_token: token},
            method: 'POST',
            json: {
                recipient: {id: sender},
                message: messageData,
            }
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var recipientId = body.recipient_id;
                var messageId = body.message_id;
                console.log("Successfully sent message with id %s to recipient %s", messageId, recipientId);
                resolve(body); // ***
            } 
            else {
                console.error("Failed calling Send API", response.statusCode,
                response.statusMessage, body.error);
                reject(body.error); // ***
            }
        })
    })
    }

    function sendButtonMessage(sender, text) {
        let messageData = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "button",
                    "text": "What do you want to learn about sex?",
                    "buttons": [
                    {
                        "type": "postback",
                        "title": "How to maintain Sexual Health",
                        "payload": "health"
                    },
                    {
                        "type": "postback",
                        "title": "How do women get pregnant?",
                        "payload": "pregnant"
                    },
                    {
                        "type": "postback",
                        "title": "At which age should I have sex?",
                        "payload": "age"
                    }
                    ]
                }
            }
        }
        sendRequest(sender, messageData);
    }

    function sendTextMessage(sender, text) {
        let messageData = {text: text}
        return sendRequest(sender, messageData)
    }

    function sendTopics(sender) {
        let messageData = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": "Anatomy",
                        "subtitle": "Let's learn about the genitals + Sexual Hygiene",
                        "image_url": "https://davidventzelblog.files.wordpress.com/2016/05/vitruvian.jpg?w=1200",
                        "buttons": [{
                            "type": "postback",
                            "payload": "anatomy",
                            "title": "Read more"
                        }, {
                            "type": "postback",
                            "title": "Later",
                            "payload": "later",
                        }],
                    }, {
                        "title": "Contraception",
                        "subtitle": "Pleasure without the Consequences",
                        "image_url": "http://blog.francetvinfo.fr/medecine/files/2013/11/contraception.jpg?w=640",
                        "buttons": [{
                            "type": "postback",
                            "payload": "contraception",
                            "title": "Read more"
                        }, {
                            "type": "postback",
                            "title": "Later",
                            "payload": "later",
                        }],
                    },
                    {
                        "title": "Puberty",
                        "subtitle": "Symptoms of puberty",
                        "image_url": "https://i.ytimg.com/vi/Rsj6dW6qKRc/maxresdefault.jpg",
                        "buttons": [{
                            "type": "postback",
                            "payload": "puberty",
                            "title": "Read more"
                        }, {
                            "type": "postback",
                            "title": "Later",
                            "payload": "later",
                        }],
                    },
                    {
                        "title": "Sexual Orientation",
                        "subtitle": "Heterosexual? Homosexual? Bisexual? What Am I?",
                        "image_url": "http://theastrologypodcast.com/wp-content/uploads/2016/04/sexual-orientation-astrology-660.jpg",
                        "buttons": [{
                            "type": "postback",
                            "title": "Read more",
                            "payload": "sex_orientation",
                        }, {
                            "type": "postback",
                            "title": "Later",
                            "payload": "later",
                        }],
                    }]
                }
            }
        }
        sendRequest(sender, messageData)
    }

    function callGreetingAPI(greeting) {
        request({
            uri: 'https://graph.facebook.com/v2.6/me/thread_settings',
            qs: { access_token: token},
            method: 'POST',
            json: greeting

        }, function(error, response, body) {
            if(!error && response.statusCode == 200) {
                console.log("Successfully sent greeting message to {{user_full_name}}")
          } else {
            console.error("Unable to send greeting.");
            console.error(response);
            console.error(body);
        }
    });
    }

    //SET UP FOR QUICK REPLY
    function callSendAPI(messageData) {
      request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: token },
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          var recipientId = body.recipient_id;
          var messageId = body.message_id;

          console.log("Successfully sent message with id %s to recipient %s",
            messageId, recipientId);
      } else {
          console.error("Unable to send message.");
          console.error(response);
          console.error(error);
      }
  });
  }

  function sendQuickReply(recipientId, messageText, ct1, title1, pt1, ct2, title2, pt2) {
      var messageData = {
        recipient: {
          id: recipientId
      },
      message: {
          text: messageText,
          quick_replies:[
          {
              content_type: ct1,
              title: title1,
              payload:pt1
          },
          {
              content_type: ct2,
              title: title2,
              payload:pt2
          }
          ]}
      }
      callSendAPI(messageData);
  }
    //------------------------------------------------------------
