# KATBUU Warranty Site

Zero-dependency Node.js warranty registration site for `KATBUU`, including:

- `/warranty` registration landing page
- `/success` confirmation page
- `/warranty-terms` and `/privacy-policy`
- `/thank-you-card` printable thank-you card preview
- `POST /api/registrations` form endpoint
- JSON data persistence in `data/registrations.json`
- Optional email delivery through the Resend API

## Quick start

1. Open PowerShell
2. Go to the project folder:

```powershell
cd C:\Users\Administrator\Codex
```

3. Copy `.env.example` to `.env`
4. Update the email settings if you want real email delivery
5. Run:

```bash
npm start
```

Or double-click:

`start-katbuu.cmd`

6. Open `http://localhost:3000/warranty`

## Email delivery

The app sends two emails when email is configured:

- buyer confirmation email
- admin notification email

To enable that flow, set:

- `RESEND_API_KEY`
- `MAIL_FROM`
- `ADMIN_EMAIL`
- `SUPPORT_EMAIL`
- `REPLY_TO_EMAIL`

If email is not configured, registrations still succeed and are saved locally.

## Data storage

Registrations are saved to:

`data/registrations.json`

## Routes

- `/` -> warranty page
- `/warranty`
- `/success`
- `/warranty-terms`
- `/privacy-policy`
- `/thank-you-card`
- `/api/health`
- `/api/registrations`
