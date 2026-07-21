const nodemailer = require('nodemailer');

// =============================================
// Email Notification Service
// Sends alerts to compliance officers for Critical/High changes
// Uses Gmail SMTP with App Password
// =============================================

var transporter = null;

function initMailer() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    console.log('[Notifications] Gmail configured:', process.env.EMAIL_USER);
  } else {
    console.log('[Notifications] No email credentials — notifications disabled');
  }
}

// Send alert notification email
async function sendAlertNotification(regulation, impactScore, severity, details) {
  if (!transporter) initMailer();
  if (!transporter) return false;

  var recipient = process.env.EMAIL_RECIPIENT || process.env.EMAIL_USER;

  var subject = '🚨 [' + severity + '] ' + regulation.substring(0, 80);
  var html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${impactScore === 'Critical' ? '#dc3545' : '#fd7e14'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠️ ${severity}</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">GLDB Regulatory Compliance Alert</p>
      </div>
      <div style="border: 1px solid #dee2e6; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold; width: 140px;">Regulation:</td><td style="padding: 8px 0;">${regulation}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Impact Score:</td><td style="padding: 8px 0;"><span style="background: ${impactScore === 'Critical' ? '#dc3545' : '#fd7e14'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${impactScore}</span></td></tr>
          ${details && details.department ? '<tr><td style="padding: 8px 0; font-weight: bold;">Department:</td><td style="padding: 8px 0;">' + details.department + '</td></tr>' : ''}
          ${details && details.deadline ? '<tr><td style="padding: 8px 0; font-weight: bold;">Compliance Deadline:</td><td style="padding: 8px 0; color: #dc3545; font-weight: bold;">⏰ ' + details.deadline + '</td></tr>' : ''}
          ${details && details.affected_areas ? '<tr><td style="padding: 8px 0; font-weight: bold;">Affected Areas:</td><td style="padding: 8px 0;">' + details.affected_areas + '</td></tr>' : ''}
        </table>
        ${details && details.summary ? '<div style="background: #f8f9fa; padding: 12px; border-radius: 4px; margin-top: 15px;"><strong>Change Summary:</strong><br><span style="color: #495057;">' + details.summary + '</span></div>' : ''}
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">
          <a href="http://localhost:3000" style="background: #0d6efd; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-weight: bold;">Open Dashboard</a>
        </div>
        <p style="color: #6c757d; font-size: 11px; margin-top: 20px;">
          This is an automated notification from the GLDB Regulatory Compliance System.<br>
          Green Link Digital Bank Pte. Ltd. • MAS Licensed • Singapore
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: '"GLDB Compliance System" <' + process.env.EMAIL_USER + '>',
      to: recipient,
      subject: subject,
      html: html
    });
    console.log('[Notifications] ✉️ Email sent to', recipient, '—', regulation.substring(0, 40));
    return true;
  } catch (err) {
    console.error('[Notifications] Email failed:', err.message);
    return false;
  }
}

module.exports = { sendAlertNotification, sendSummaryEmail, initMailer };

// Send summary digest email with all buffered alerts
async function sendSummaryEmail(alerts) {
  if (!transporter) initMailer();
  if (!transporter) return false;

  var recipient = process.env.EMAIL_RECIPIENT || process.env.EMAIL_USER;
  var critCount = alerts.filter(function(a) { return a.impact_score === 'Critical'; }).length;
  var highCount = alerts.filter(function(a) { return a.impact_score === 'High'; }).length;

  var subject = '🚨 GLDB Compliance Digest: ' + alerts.length + ' High-Impact Alert' + (alerts.length > 1 ? 's' : '') + ' Detected';

  var alertRows = alerts.map(function(a) {
    var color = a.impact_score === 'Critical' ? '#dc3545' : '#fd7e14';
    return '<tr>'
      + '<td style="padding:8px; border-bottom:1px solid #eee;"><span style="background:' + color + '; color:white; padding:2px 6px; border-radius:3px; font-size:11px;">' + a.impact_score + '</span></td>'
      + '<td style="padding:8px; border-bottom:1px solid #eee; font-weight:bold;">' + a.title + '</td>'
      + '<td style="padding:8px; border-bottom:1px solid #eee;">' + a.department + '</td>'
      + '<td style="padding:8px; border-bottom:1px solid #eee;">' + (a.deadline || '—') + '</td>'
      + '<td style="padding:8px; border-bottom:1px solid #eee; font-size:12px; color:#555;">' + (a.summary || '') + '</td>'
      + '</tr>';
  }).join('');

  var html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">🛡️ GLDB Compliance Alert Digest</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.8;">Automated summary from the Regulatory Monitoring System</p>
      </div>
      <div style="border: 1px solid #dee2e6; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <div style="display: flex; gap: 15px; margin-bottom: 20px;">
          <div style="background: #dc3545; color: white; padding: 10px 15px; border-radius: 6px; text-align: center; flex:1;">
            <div style="font-size: 24px; font-weight: bold;">${critCount}</div>
            <div style="font-size: 11px;">Critical</div>
          </div>
          <div style="background: #fd7e14; color: white; padding: 10px 15px; border-radius: 6px; text-align: center; flex:1;">
            <div style="font-size: 24px; font-weight: bold;">${highCount}</div>
            <div style="font-size: 11px;">High</div>
          </div>
          <div style="background: #0d6efd; color: white; padding: 10px 15px; border-radius: 6px; text-align: center; flex:1;">
            <div style="font-size: 24px; font-weight: bold;">${alerts.length}</div>
            <div style="font-size: 11px;">Total Alerts</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="background: #f8f9fa;">
            <th style="padding: 8px; text-align: left;">Impact</th>
            <th style="padding: 8px; text-align: left;">Regulation</th>
            <th style="padding: 8px; text-align: left;">Department</th>
            <th style="padding: 8px; text-align: left;">Deadline</th>
            <th style="padding: 8px; text-align: left;">Summary</th>
          </tr>
          ${alertRows}
        </table>

        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">
          <a href="http://localhost:3000" style="background: #0d6efd; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-weight: bold;">Open Dashboard →</a>
        </div>
        <p style="color: #6c757d; font-size: 11px; margin-top: 20px;">
          This digest was auto-generated by the GLDB Notification Agent.<br>
          Green Link Digital Bank Pte. Ltd. • MAS Licensed • Singapore
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: '"GLDB Compliance System" <' + process.env.EMAIL_USER + '>',
    to: recipient,
    subject: subject,
    html: html
  });
  return true;
}
