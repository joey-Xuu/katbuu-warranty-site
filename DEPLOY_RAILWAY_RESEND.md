# KATBUU Deployment Checklist

This is the simplest production path for the current codebase:

- App hosting: Railway
- Public site: `https://www.katbuu.com`
- Email provider: Resend
- Sending subdomain: `mail.katbuu.com`
- Sender address: `warranty@mail.katbuu.com`
- Reply-to inbox: `katbuu007@outlook.com`
- Admin notification inbox: `katbuu520@gmail.com`

Important:

- The current app stores registrations in `./data/registrations.json`
- On Railway, you must attach a Volume and mount it to `/app/data`
- If you skip the volume, submitted registrations can disappear after redeploys

## Part 1: Prepare your domain

1. Confirm that you control both:
   - `katbuu.com`
   - `www.katbuu.com`
2. Decide where you manage DNS:
   - your registrar DNS
   - or Cloudflare DNS
3. Keep the website on `www.katbuu.com`
4. Keep email sending on `mail.katbuu.com`

## Part 2: Deploy the site to Railway

1. Create a Railway account
2. Install Railway CLI on your computer:

```powershell
npm install -g @railway/cli
```

3. Log in:

```powershell
railway login
```

4. Open the project folder:

```powershell
cd C:\Users\Administrator\Codex
```

5. Create a new Railway project:

```powershell
railway init
```

6. Deploy the current code:

```powershell
railway up
```

7. In Railway, open the deployed service
8. Go to `Settings -> Networking -> Public Networking`
9. Click `Generate Domain`
10. Confirm the site opens on the generated `*.up.railway.app` domain

## Part 3: Add persistent storage

1. In Railway, create a Volume attached to the web service
2. Set the mount path to:

```text
/app/data
```

3. Redeploy the service once after the volume is attached
4. Confirm the app still loads

Why `/app/data`:

- Railway says relative app files live under `/app`
- If your app writes to `./data`, the volume should be mounted at `/app/data`

## Part 4: Set Railway environment variables

In Railway, open the service variables and add:

```env
HOST=0.0.0.0
PUBLIC_SITE_URL=https://www.katbuu.com
SUPPORT_EMAIL=katbuu007@outlook.com
ADMIN_EMAIL=katbuu520@gmail.com
MAIL_FROM=KATBUU Warranty <warranty@mail.katbuu.com>
REPLY_TO_EMAIL=katbuu007@outlook.com
RESEND_API_KEY=replace_me_later
```

Then redeploy.

## Part 5: Connect `www.katbuu.com`

1. In Railway, go to the service:
   - `Settings -> Networking -> Public Networking`
2. Click `+ Custom Domain`
3. Enter:

```text
www.katbuu.com
```

4. Railway will give you a target CNAME, for example:

```text
xxxx.up.railway.app
```

5. In your DNS provider, create:
   - Type: `CNAME`
   - Name/Host: `www`
   - Target/Value: the Railway target you were given

DNS note:

- If your DNS panel auto-appends `katbuu.com`, enter only `www`
- If your DNS panel expects a full hostname, enter `www.katbuu.com`

6. Wait for Railway to show the domain as verified
7. Open:

```text
https://www.katbuu.com
```

## Part 6: Redirect root domain to `www`

Your QR code should point to:

```text
https://www.katbuu.com
```

For the root domain `katbuu.com`, do one of these:

- Use your registrar's URL forwarding to redirect `https://katbuu.com` to `https://www.katbuu.com`
- Or use Cloudflare redirect rules

This is simpler than pointing the root domain directly at Railway.

## Part 7: Set up Resend for sending email

1. Create a Resend account
2. In Resend, add a new sending domain:

```text
mail.katbuu.com
```

3. Resend will show DNS records you must add
4. Add the exact records Resend gives you in your DNS provider
5. Verify the domain in Resend

Typical sending records shown by Resend are:

- one `MX` record for the return path
- one `TXT` SPF record
- one `TXT` DKIM record

For example, Resend's API docs show records in this pattern for a domain:

- `send` `MX` -> `feedback-smtp.us-east-1.amazonses.com`
- `send` `TXT` -> `v=spf1 include:amazonses.com ~all`
- `resend._domainkey` `TXT` -> public key

For your subdomain, the exact hostnames may include the `mail` subdomain. Use the exact values Resend shows in the dashboard.

DNS note:

- Some DNS panels want relative hostnames like `send.mail` or `resend._domainkey.mail`
- Others want full names like `send.mail.katbuu.com`
- Use the exact format your DNS provider expects

## Part 8: Recommended sender setup

Use:

- From: `KATBUU Warranty <warranty@mail.katbuu.com>`
- Reply-To: `katbuu007@outlook.com`
- Admin inbox: `katbuu520@gmail.com`

Do not use Gmail or Outlook as the `From` address for transactional email from the website.

Use them only as:

- the inbox that receives your notifications
- the reply-to address for customer replies

## Part 9: Add DMARC after Resend verifies

After SPF and DKIM pass, add this TXT record:

- Type: `TXT`
- Name/Host: `_dmarc.mail`
- Value:

```text
v=DMARC1; p=none; rua=mailto:katbuu007@outlook.com;
```

Leave it on `p=none` first.
After you confirm real emails are landing well and headers pass DMARC, you can upgrade to:

```text
v=DMARC1; p=quarantine; rua=mailto:katbuu007@outlook.com;
```

If your DNS panel expects a full hostname instead of a relative one, use:

```text
_dmarc.mail.katbuu.com
```

## Part 10: Put the API key into Railway

1. In Resend, create an API key
2. Copy it
3. In Railway variables, set:

```env
RESEND_API_KEY=your_real_key_here
```

4. Redeploy

## Part 11: Final live test

1. Open `https://www.katbuu.com`
2. Submit a real test registration using your own email
3. Confirm:
   - the page redirects to success
   - the record appears in `data/registrations.json` on the live service
   - the buyer confirmation email arrives
   - the admin notification email arrives
4. Test one Gmail inbox and one Outlook inbox if possible
5. Check the email headers for:
   - `spf=pass`
   - `dkim=pass`
   - `dmarc=pass`

## Part 12: Generate the final QR code

Final QR target:

```text
https://www.katbuu.com
```

Do not use:

- `http://`
- temporary Railway domains
- local URLs like `localhost:3000`

## What to do if something fails

If the site domain does not verify:

- recheck the `www` CNAME
- make sure the value exactly matches Railway's target
- wait for DNS propagation

If Resend does not verify:

- recheck every DNS record exactly
- remove accidental duplicate SPF records on the same hostname
- wait for propagation

If emails send but go to spam:

- confirm SPF, DKIM, and DMARC are passing
- keep the message transactional only
- keep the sender on `mail.katbuu.com`
- avoid sales language and attachments in the first version

## Official docs used

- Railway custom domains: https://docs.railway.com/networking/domains/working-with-domains
- Railway public networking: https://docs.railway.com/public-networking
- Railway volumes guide: https://docs.railway.com/guides/volumes
- Railway volumes reference: https://docs.railway.com/volumes/reference
- Railway CLI overview: https://docs.railway.com/guides/cli
- Railway CLI `up`: https://docs.railway.com/cli/up
- Resend domain management: https://resend.com/docs/dashboard/domains/introduction
- Resend send email API: https://resend.com/docs/api-reference/emails/send-email
- Resend DMARC guide: https://resend.com/docs/dashboard/domains/dmarc
