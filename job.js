#!/usr/bin/env node
'use strict'

/*

 only worker : https://stackoverflow.com/questions/38343299/deploy-only-worker-dyno-to-heroku-for-firebase-queue
 $ heroku ps:scale web=0 worker=1
 $ heroku ps:restart

 Heroku button : https://devcenter.heroku.com/articles/heroku-button
 */

const sendgrid_api_key = process.env.SENDGRID_API_KEY;
const from_email_address = process.env.FROM_EMAIL_ADDRESS;
const to_email_address = process.env.TO_EMAIL_ADDRESS;
const email_subject = process.env.EMAIL_SUBJECT;

const sfdc_api_version = process.env.SFDC_API_VERSION; //44.0
const sfdc_username = process.env.SFDC_USERNAME;
const sfdc_password = process.env.SFDC_PASSWORD;
const sfdc_security_token = process.env.SFDC_SECURITY_TOKEN;
const sfdc_login_url = process.env.SFDC_LOGIN_URL;

var jsforce = require('jsforce');
var conn = new jsforce.Connection({
    version : sfdc_api_version,
    loginUrl : sfdc_login_url
});

console.log('......... Start job .........');

conn.login(sfdc_username, sfdc_password + sfdc_security_token, function(err, userInfo) {
    if (err) {
        console.log('Salesforce login failure');
        return console.error(err);
    }

    var now = new Date();
    var ten_mins_ago = new Date(now - (1000 * 60 * 10));
    var query_str = 'activities?level=Error&endTime='+ now.toJSON() + '&startTime=' + ten_mins_ago.toJSON();

    conn.requestGet('/services/data/v'+ sfdc_api_version + '/iot/' + query_str, function (err, res) {
        var count = res.activities.length;

        if(count == 0) {
            console.log('No error activity');
            console.log('......... Finish job .........');
            return;
        }
        console.log('Error found');
        var activities = res.activities;
        var msgs = '';
        for(var i = 0; i < activities.length; i++) {
            var act = activities[i];
            var summary = act.summary;
            var type = act.type;
            msgs = msgs +'' + i + '. ' + type + ' : ' + summary + '<br/>';
        }

        // Sending email with short description
        var helper = require('sendgrid').mail;
        var sg = require('sendgrid')(sendgrid_api_key);
        var from_email = new helper.Email(from_email_address);
        var to_email = new helper.Email(to_email_address);
        var subject = email_subject + ' [' + count + ' error/s]';
        var content = new helper.Content('text/html', msgs);
        var mail = new helper.Mail(from_email, subject, to_email, content);

        var request = sg.emptyRequest({
            method: 'POST',
            path: '/v3/mail/send',
            body: mail.toJSON(),
        });

        sg.API(request, function(error, response) {
            console.log(response.statusCode);
            if(error) {
                console.log('Email failure');
                console.log(response.body);
                console.log(response.headers);
            } else {
                console.log('Email sent');
            }
            console.log('......... Finish job .........');
        });
    });
});
