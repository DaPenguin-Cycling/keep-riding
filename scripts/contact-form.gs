/**
 * DaPenguin contact form handler — Google Apps Script Web App.
 *
 * Receives a POST from the contact form on dapenguincycling.com and emails it
 * to RECIPIENT. Free, no third-party service, no monthly submission cap.
 *
 * ---------------------------------------------------------------------------
 * DEPLOYING (one time, ~5 minutes)
 *
 *  1. Sign in to the Google account that should send and receive these, then go
 *     to https://script.google.com and choose "New project".
 *  2. Delete the placeholder code, paste this whole file in, and give the
 *     project a name such as "DaPenguin contact form".
 *  3. Check RECIPIENT below is the address the messages should land in.
 *  4. Deploy → New deployment → gear icon → Web app, then set:
 *        Description:      DaPenguin contact form
 *        Execute as:       Me
 *        Who has access:   Anyone            <-- must be "Anyone", not
 *                                                "Anyone with Google account"
 *  5. Click Deploy. Google will ask you to authorise it; it needs permission to
 *     send email as you. Approve it. On the "Google hasn't verified this app"
 *     screen choose Advanced → Go to <project name>. This warning is normal for
 *     your own private script.
 *  6. Copy the Web app URL. It ends in /exec.
 *  7. Paste it into _config.yml as forms.endpoint, commit, and the form goes live:
 *
 *        forms:
 *          endpoint: "https://script.google.com/macros/s/AKfy.../exec"
 *
 * If you ever edit this script, you must Deploy → Manage deployments → edit →
 * Version: New version, or the live endpoint keeps running the old code.
 *
 * Sending limit is Gmail's: 100 emails/day on a consumer account, which is far
 * above what this form will see.
 * ---------------------------------------------------------------------------
 */

// Where submissions are emailed. Change this and redeploy a new version.
var RECIPIENT = 'anthonybrown7557@gmail.com';

// Shown in the subject line so these are easy to filter in Gmail.
var SUBJECT_PREFIX = '[DaPenguin]';

// Fields accepted from the form. Anything else is ignored.
var FIELDS = ['name', 'email', 'company', 'topic', 'message'];

function doPost(e) {
  try {
    var data = (e && e.parameter) || {};

    // Honeypot: a field hidden from people but often filled in by bots. If it
    // has anything in it, accept the request and quietly drop it, so the bot
    // gets no signal that it was caught.
    if (String(data._gotcha || '').trim() !== '') {
      return json({ ok: true });
    }

    var name = clean(data.name, 200);
    var email = clean(data.email, 200);
    var message = clean(data.message, 5000);

    if (!name || !email || !message) {
      return json({ ok: false, error: 'Name, email and message are required.' });
    }
    if (!isEmail(email)) {
      return json({ ok: false, error: 'That email address does not look right.' });
    }

    var company = clean(data.company, 200) || '(not given)';
    var topic = clean(data.topic, 100) || '(not given)';

    var body =
      'New message from the DaPenguin contact form.\n\n' +
      'Name:     ' + name + '\n' +
      'Email:    ' + email + '\n' +
      'Company:  ' + company + '\n' +
      'Topic:    ' + topic + '\n\n' +
      'Message:\n' +
      message + '\n\n' +
      '---\n' +
      'Sent ' + new Date().toString() + '\n' +
      'Reply to this email to answer them directly.\n';

    MailApp.sendEmail({
      to: RECIPIENT,
      subject: SUBJECT_PREFIX + ' ' + topic + ' — ' + name,
      body: body,
      // Lets him hit Reply in Gmail and have it go to the sender, not himself.
      replyTo: email,
      name: 'DaPenguin website'
    });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: 'Server error.' });
  }
}

/**
 * Visiting the /exec URL in a browser hits this. Also the no-JavaScript
 * fallback target, so give people a readable page rather than an error.
 */
function doGet() {
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8">' +
    '<title>DaPenguin</title>' +
    '<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">' +
    '<h1>Got it.</h1><p>I\'ll get back to you.</p>' +
    '<p><a href="https://dapenguincycling.com/contact.html">Back to dapenguincycling.com</a></p>'
  );
}

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function isEmail(value) {
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
