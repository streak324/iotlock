#!/usr/bin/env node

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const nodemailer = require('nodemailer');
const busy_hours = require('busy-hours');

var adminPass = 'secret';
var adminEmail = 'streak324@gmail.com';
var requestEntries = [];
var passEntries = [{email_ad: "andrewsepulveda95@gmail.com", lifespan: 10, pass: "123459"}];
var personUsingDevice = undefined;
var iotSecret = "alakazam";
var alarmEmailInterval = 20 * 60;
var lastAlarmEmailSent = 0;
const requestInterval = 30 * 1000;
const maxRequestsDisplayed = 10;
var boxOpenTimes;
var mean;
var std;
var useNormalHours = true;
var usePopularTimes = false;
var lightArray = [];
var lightCount = 0;
var lightMaxSize = 100;
var placesHours = {};
var currentPlaceHours;
var lastPasswords = [];
const maxPasswordTries = 5;
var lastPasswordIndex = 0;
const googleAPIKey = 'AIzaSyB28tqF2mcRt7VjwZqSkHIUC-k2tTqLSxE';
const outlierPercentile = 2.1;

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'cs190iotlock@gmail.com',
        pass: 'KluckaD00dleDoo'
    }
});

function sendMail(destination, emailSubject, emailBody)
{
    var mailOptions = {
        from: '"IoTLock" <cs190iotlock@gmail.com>', // sender address
        to: destination, // list of receivers
        subject: emailSubject, // Subject line
        html: emailBody // html body
    };

    var success = false;
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Message sent: %s', info.messageId);
        success = true;
    });
    return success;
}

function randomIntegerString(length)
{
    var decimals = "1234567890";
    var result = "";
    for(var i=0; i < length; ++i)
    {
        result += decimals[Math.floor(Math.random() * 10)];
    }
    return result;
}

function providePassword(email, duration)
{
    var tempPass = randomIntegerString(6);
    sendMail(email, 
             "Request has been Approved", 
             "Here is your temporary password <b>" + tempPass + "</b>");
    var passEntry = {email_ad: email, lifespan: duration, pass: tempPass};
    passEntries.push(passEntry);
    console.log("As of " + Date.now() + " Lock Password: " + passEntry.pass + " with a " + duration + "s lifetime has been entered into the system");
}

function isAnOutlier(data, myMean, myStd)
{
    return data > myMean + 2 * myStd || data < myMean - 2 * myStd;
}

function isNotAMajority(data, myMean, myStd)
{
    return data > myMean +  myStd || data < myMean - myStd;
}

app.use(session({ secret: 'keyboard warrior', resave: true, saveUninitialized:true, cookie: { maxAge: 5 * 60 * 1000 }}));
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

app.get('/', (request, response) => {
    response.sendFile(__dirname+'/assets/index.html');
});


app.get('/iot_status', (request, response) => {
    console.log("IoT Device has setup an http connection");
    response.end();
});

function isOutsideNormalUse(day, currentTime, currentDate)
{
    if(useNormalHours)
    {
        if(usePopularTimes && currentPlaceHours != undefined)
        {
            var currentHour = currentDate.getHours();
            var hourPercentage = 0;
            for(var i=0; i < currentPlaceHours[day].hours.length; ++i)
            {
                if(currentHour === currentPlaceHours[day].hours[i].hour)
                {
                    hourPercentage = currentPlaceHours[day].hours[i].percentage;
                    break;
                }
            }
            if(!currentPlaceHours[day].mean || !currentPlaceHours[day].std)
                return false;
            return isNotAMajority(hourPercentage, currentPlaceHours[day].mean, currentPlaceHours[day].std);
        }
        else
        {
           return (boxOpenTimes[day].length === 100 && isAnOutlier(currentTime, mean, std));
        }
    } 
    else
    {
        return false;
    }
}

app.post('/iot_status', (request, response) => {
    console.log("Data sent from IoT Device " + JSON.stringify(request.body));
    if(request.body.secret === iotSecret)
    {
        switch(request.body.type)
        {
            case 'p':
            {
                var currentDate = new Date();
                lastPasswords[lastPasswordIndex++] = Date.now();
                if(lastPasswordIndex === maxPasswordTries)
                {
                    lastPasswordIndex = 0;
                    var diffTime = lastPasswords[maxPasswordTries-1] - lastPasswords[0];
                    if(diffTime < 60*1000)
                    {
                        sendMail(adminEmail, "Brute Force Detection", "Someone is trying to bruteforce their way into the IoT Box");
                    }
                }
                var currentTime = currentDate.getSeconds() + currentDate.getMinutes() * 60 + currentDate.getHours() * 3600;
                console.log("Password attempt on Iot Device @ " + currentTime);
                if (boxOpenTimes[currentDate.getDay()].length < 100)
                {
                    boxOpenTimes[currentDate.getDay()].push(currentTime);
                }
                else if (boxOpenTimes[currentDate.getDay()].length === 100)
                {
                    boxOpenTimes[currentDate.getDay()].splice(0, 1);
                    boxOpenTimes[currentDate.getDay()].push(currentTime);
                    [mean, std] = getMeanAndStd(boxOpenTimes[currentDate.getDay()]);
                }

                if(isOutsideNormalUse(currentDate.getDay(), currentTime, currentDate))
                {
                    console.log("PANIC! IOT DEVICE USE OUTSIDE OF NORMAL HOURS");
                    sendMail(adminEmail, "Abnormal Day Use of IoT Box", "SOMEONE IS TRYING TO USE THE BOX OUTSIDE OF NORMAL HOURS!");
                }
                for(var i=0; i < passEntries.length; ++i)
                {
                    if(passEntries[i].pass === request.body.pass)
                    {
                        lastPasswordIndex = 0;
                        console.log("Correct Password submitted by IoT Device");
                        response.send({life: passEntries[i].lifespan, ok: 1});
                        personUsingDevice = passEntries[i];
                        if(i > 0)
                            passEntries.splice(i, 1);
                        return;
                    }
                }
                response.send({ok: 0});
            } break;
            case 'a1':
            {
                console.log("Sound Alert");
                if(lastAlarmEmailSent < Date.now() + alarmEmailInterval)
                {
                    lastAlarmEmailSent = Date.now();
                    sendMail(adminEmail, "IoT Box Overstayed Welcome", personUsingDevice.email_ad + " HAS NOT CLOSED THE BOX");
                }
            } break;
            case 'a2':
            {
                if(lastAlarmEmailSent < Date.now() + alarmEmailInterval)
                {
                    lastAlarmEmailSent = Date.now();
                    sendMail(adminEmail, "IoT Box Broken In", "SOMEONE IS TRYING TO BREAK INTO THE IOT BOX");
                }
            } break;
            default:
                response.send({msg: "Hello IoT Device"});
                break;
        }
    }
    response.end();
});

app.post('/admin_login', (request, response) => {
    var auth_resp = {};
    if(request.body.passGuess === adminPass)
    {
        request.session.isAdmin = true;
        auth_resp["success"] = true;
    }
    else
    {
        auth_resp["success"] = false;
        auth_resp["msg"] = "Not the right password hombre";
    }
    response.send(auth_resp);
    console.log('Admin login attempt with password ' + request.body.passGuess);
});

app.post('/admin_approve', (request, response) => 
{
    if(request.session.isAdmin)
    {
        console.log("Admin responded to request: " + request.body.approve);
        if(parseInt(request.body.approve) === 1)
        {
            providePassword(request.body.email, request.body.duration);
        }
        else
        {
            sendMail(request.body.email, "Request has been denied", 
                    "The admin did not approve your use of the box");
        }
        for(var i =0; i < requestEntries.length; ++i)
        {
            if(requestEntries[i].timestamp === parseInt(request.body.timestamp))
            {
                requestEntries.splice(i, 1);
                break;
            }
        }
    }
});

app.post('/admin_toggle_hours', (request, response) =>
{
    if(request.session.isAdmin)
    {
        console.log("toggling normal hours");
        useNormalHours = !useNormalHours;
        response.send({ok: 1});
    }
    else
    {
        response.send({ok: 0});
    }
});


app.post('/admin_toggle_popular', (request, response) =>
{
    if(request.session.isAdmin)
    {
        console.log("toggling popular times");
        usePopularTimes = !usePopularTimes;
        response.send({ok: 1});
    }
    else
    {
        response.send({ok: 0});
    }
});

app.post('/admin_update_place_id', (request, response) =>
{
    if(request.session.isAdmin)
    {
        console.log("updating current place id");
        currentPlaceHours = placesHours[request.body.placeID];
        if(currentPlaceHours === undefined)
        {
            busy_hours(request.body.placeID, googleAPIKey).then(data => {
                if(data.status === "error")
                {
                    console.log(data);
                    response.send({ok: 0});
                }
                else
                {
                    for(var i=0; i < data.week.length; ++i)
                    {
                        var meanPercentage = 0;
                        var stdPercentage = 0;
                        for(var j=0; j < data.week[i].hours.length; ++j)
                        {
                            meanPercentage += data.week[i].hours[j]["percentage"];
                        }
                        meanPercentage /= data.week[i].hours.length;
                        for(var j=0; j < data.week[i].hours.length; ++j)
                        {
                            var diff = meanPercentage - data.week[i].hours[j]["percentage"];
                            stdPercentage += diff * diff;
                        }
                        stdPercentage = Math.sqrt(stdPercentage / data.week[i].hours.length);
                        data.week[i]["mean"] = meanPercentage;
                        data.week[i]["std"] = stdPercentage;
                    }
                    currentPlaceHours = data.week;
                    console.log(JSON.stringify(currentPlaceHours));
                    response.send({ok: 1})
                }
            });
        }
    }
    else
    {
        response.send({ok: 0});
    }
});

app.get('/admin_hours_state', (request, response) =>
{
    if(request.session.isAdmin)
        response.send({state: useNormalHours, popularTimes: usePopularTimes});
});

app.post('/admin_view_requests', (request, response) => {
    if(request.session.isAdmin)
    {
        requestsDisplayed = [];
        for(var i=requestEntries.length-1; 
            i >= 0 && i + maxRequestsDisplayed >= requestEntries.length; --i)
        {
            requestsDisplayed.push(requestEntries[i]);
        }
        response.send({success: true, msg: requestsDisplayed});
    }
    else
    {
        response.send({success: false, msg: 'Nice try admin impersonator'});
    }
});

app.get('/admin', (request, response) => {
    if(request.session.isAdmin)
    {
        response.sendFile(__dirname+'/assets/admin_overview.html');
    }
    else
    {
        response.sendFile(__dirname+'/assets/admin_auth_form.html');
    }
});

app.post('/request_submit', (request, response) => {
    var lastRequest = request.session.lastRequest;
    if(request.session.isAdmin)
    {
        response.send('Your an admin, your request has been automatically granted.');
        providePassword(request.body.email, request.body.duration);
    }
    else if(request.body.iMadeRequest && (!lastRequest || lastRequest < Date.now()))
    {
        request.session.lastRequest = Date.now() + requestInterval;
        var requestEntry = {timestamp: parseInt(Date.now()), email: request.body.email, msg: request.body.msg, duration: request.body.duration};
        console.log('Someone made a request ' + JSON.stringify(requestEntry));
        requestEntries.push(requestEntry);
        response.send('Your request has been received');
        sendMail(adminEmail, "You have requests to look at", 
                "Go to the IoT website http://68.183.164.250:3000/admin to see the request");
    }
    else if(lastRequest && lastRequest > Date.now())
    {
        response.send("Hey faggot, stop spamming requests. Hold up a bit");
    }
    response.end();
});

app.get('/request', (request, response) => {
    response.sendFile(__dirname+'/assets/request_form.html');
});


function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getMeanAndStd(array)
{
    var mean = 0;
    for(var i=0; i < array.length; ++i)
    {
        mean += array[i];
    }
    mean /= array.length;

    var sum = 0;
    for(var i=0; i < array.length; ++i)
    {
        sum += (array[i] - mean) * (array[i] - mean); 
    }
    var std = Math.sqrt(sum/array.length);
    return [mean, std];
}

app.listen(3000, () => {
    console.log('Listening on port 3000');
    var DateStart = new Date("Dec 04 2018 12:00:00 GMT-0800");
    var DateEnd = new Date("Dec 04 2018 18:00:00 GMT-0800");
    boxOpenTimes = [];
    for(var i=1; i <= 7; ++i)
    {
        DateStart.setDate(i);
        DateEnd.setDate(i);
        boxOpenTimes[DateStart.getDay()] = [];
        for (var j = 0; j < 98; ++j)
        {
            var date = randomDate(DateStart, DateEnd);
            var time = date.getSeconds() + date.getMinutes() * 60 + date.getHours() * 3600;
            boxOpenTimes[date.getDay()].push(time);
        }
    }
});
