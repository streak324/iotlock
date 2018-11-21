#!/usr/bin/env node

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const nodemailer = require('nodemailer');

var adminPass = 'secret';
var adminEmail = 'streak324@gmail.com';
var requestEntries = [];
const requestInterval = 30 * 1000;
const maxRequestsDisplayed = 10;

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

function grantAccess(email)
{
    var tempPass = randomIntegerString(6);
    sendMail(email, 
             "Request has been Approved", 
             "Here is your temporary password <b>" + tempPass + "</b>");
}

app.use(session({ secret: 'keyboard warrior', resave: true, saveUninitialized:true, cookie: { maxAge: 60 * 1000 }}));
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

app.get('/', (request, response) => {
    response.sendFile(__dirname+'/assets/index.html');
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
        if(request.body.approve)
        {
            console.log("Admin approved a request");
            grantAccess(request.body.email);
        }
        for(var i =0; i < requestEntries.length; ++i)
        {
            if(requestEntries[i].timestamp === parseInt(request.body.timestamp))
            {
                console.log("Removing request");
                requestEntries.splice(i, 1);
                break;
            }
        }
    }
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
        grantAccess(request.body.email);
    }
    else if(request.body.iMadeRequest && (!lastRequest || lastRequest < Date.now()))
    {
        request.session.lastRequest = Date.now() + requestInterval;
        var requestEntry = {timestamp: parseInt(Date.now()), email: request.body.email, msg: request.body.msg, duration: request.body.duration};
        console.log('Someone made a request ' + JSON.stringify(requestEntry));
        requestEntries.push(requestEntry);
        response.send('Your request has been received');
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

app.listen(3000, () => {
    console.log('Listening on localhost:3000');
});

