import os
import json
import threading
import urllib.request
import urllib.error

SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"

def send_alert_email_async(to_email: str, alerts: list):
    """Fires SendGrid email notification in a background thread to prevent blocking HTTP response."""
    thread = threading.Thread(target=_send_alert_email_sync, args=(to_email, alerts), daemon=True)
    thread.start()

def _send_alert_email_sync(to_email: str, alerts: list):
    api_key = os.getenv("SENDGRID_API_KEY")
    if not api_key:
        print("[SendGrid] SENDGRID_API_KEY environment variable is missing. Skipping email dispatch.")
        return

    from_email = os.getenv("SENDGRID_FROM_EMAIL", "alerts@revenueprocesstwin.com")
    recipient = to_email or os.getenv("ALERT_RECIPIENT_EMAIL", "admin@revenueprocesstwin.com")

    if not alerts:
        return

    critical_count = sum(1 for a in alerts if a.get("severity") == "critical")
    high_count = sum(1 for a in alerts if a.get("severity") == "high")
    total_leak_rs = sum(float(a.get("leak_amount_paise", 0)) / 100.0 for a in alerts)

    # Build HTML rows for top 5 alerts
    rows_html = ""
    for a in alerts[:5]:
        sev_color = "#dc2626" if a.get("severity") == "critical" else "#f59e0b"
        leak_rs = float(a.get("leak_amount_paise", 0)) / 100.0
        rows_html += f"""
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; font-weight: bold;">{a.get('rule_id', 'ALERT')}</td>
          <td style="padding: 12px;">{a.get('customer_name', a.get('customer_id', 'Customer'))}</td>
          <td style="padding: 12px;"><span style="background-color: {sev_color}15; color: {sev_color}; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 12px;">{str(a.get('severity')).upper()}</span></td>
          <td style="padding: 12px; font-weight: 600;">₹{leak_rs:,.2f}</td>
          <td style="padding: 12px; font-size: 13px; color: #4b5563;">{a.get('recommended_action', 'Investigate invoice SLA')}</td>
        </tr>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Revenue Leakage Detection Alert</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background: #0f172a; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
            ⚠️ Revenue Leakage Alert Detected
          </h1>
          <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">
            Revenue Process Twin Engine automatically flagged new compliance breaks
          </p>
        </div>

        <!-- Summary Banner -->
        <div style="padding: 20px; background: #fef2f2; border-bottom: 1px solid #fee2e2;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-size: 24px; font-weight: 800; color: #991b1b;">₹{total_leak_rs:,.2f}</span>
              <span style="color: #7f1d1d; font-size: 14px; margin-left: 6px;">Total Flagged Leakage</span>
            </div>
            <div style="font-size: 13px; color: #991b1b; font-weight: 600;">
              {critical_count} Critical • {high_count} High Severity
            </div>
          </div>
        </div>

        <!-- Alerts Table -->
        <div style="padding: 24px;">
          <h3 style="margin-top: 0; font-size: 16px; color: #1e293b;">Detected Revenue Leaks</h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase;">
                <th style="padding: 10px;">Rule</th>
                <th style="padding: 10px;">Customer</th>
                <th style="padding: 10px;">Severity</th>
                <th style="padding: 10px;">Leakage</th>
                <th style="padding: 10px;">Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {rows_html}
            </tbody>
          </table>

          <!-- CTA Button -->
          <div style="margin-top: 32px; text-align: center;">
            <a href="https://revenue-process-twin-frontend.onrender.com/alerts" 
               style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 28px; border-radius: 8px; font-size: 14px;">
              View & Resolve Alerts in Dashboard →
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
          Automated real-time notification sent by <strong>Revenue Process Twin Engine</strong>.
        </div>

      </div>
    </body>
    </html>
    """

    payload = {
        "personalizations": [
            {
                "to": [{"email": recipient}],
                "subject": f"🚨 [Revenue Twin] {len(alerts)} Leaks Flagged (₹{total_leak_rs:,.0f} at risk)"
            }
        ],
        "from": {"email": from_email, "name": "Revenue Process Twin"},
        "content": [
            {
                "type": "text/html",
                "value": html_content
            }
        ]
    }

    try:
        req = urllib.request.Request(
            SENDGRID_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req) as resp:
            print(f"[SendGrid] Email notification dispatched to {recipient}. Status: {resp.status}")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"[SendGrid] Failed to send email (HTTP {e.code}): {err_body}")
    except Exception as ex:
        print(f"[SendGrid] Exception during email dispatch: {ex}")
