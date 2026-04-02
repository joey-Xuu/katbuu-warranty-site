# KATBUU Email Setup Plan

## Recommended sending setup

Use a dedicated transactional sender instead of Gmail or Outlook as the `From` address.

Recommended stack for this project:

- Website: `https://www.katbuu.com`
- Warranty page: `https://www.katbuu.com/` or `https://www.katbuu.com/warranty`
- Email provider: Resend
- Sending subdomain: `mail.katbuu.com`
- Sender address: `warranty@mail.katbuu.com`
- Reply-to address: `katbuu007@outlook.com`
- Admin notification inbox: `katbuu520@gmail.com` or `katbuu007@outlook.com`

## Why not Gmail or Outlook as the sender

You can use Gmail or Outlook as:

- the inbox that receives admin notifications
- the reply-to address for buyer replies

You should not use Gmail or Outlook as the transactional `From` sender for this site.
For reliable delivery, the sender should be on a domain you control, such as `mail.katbuu.com`.

## Best practical option

For this codebase, the easiest reliable setup is:

1. Create a Resend account
2. Add and verify the sending domain `mail.katbuu.com`
3. Add the DNS records Resend gives you for SPF and DKIM
4. Set these values in `.env`

```env
PUBLIC_SITE_URL=https://www.katbuu.com
SUPPORT_EMAIL=katbuu007@outlook.com
ADMIN_EMAIL=katbuu520@gmail.com
MAIL_FROM=KATBUU Warranty <warranty@mail.katbuu.com>
REPLY_TO_EMAIL=katbuu007@outlook.com
RESEND_API_KEY=your_resend_api_key
```

## DNS and reputation notes

- Keep website traffic on `www.katbuu.com`
- Keep email sending on `mail.katbuu.com`
- This separation protects your main domain reputation
- Add a DMARC record after SPF and DKIM are working
- Start with simple transactional email only
- Do not send marketing-style content from this warranty system

## Important truth

No provider can honestly guarantee that mail will never go to spam.
What you can do is maximize inbox placement by using:

- a verified domain
- SPF and DKIM
- a DMARC policy
- a clean transactional template
- a real reply-to address
- low complaint rates

## Official references

- Resend send email API: https://resend.com/docs/api-reference/emails/send-email
- Amazon SES verified identities overview: https://docs.aws.amazon.com/ses/latest/dg/verify-addresses-and-domains.html
