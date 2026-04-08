const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { promises: fs } = require("fs");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || "3000");
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || `http://localhost:${PORT}`;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "katbuu007@outlook.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || SUPPORT_EMAIL;
const MAIL_FROM = process.env.MAIL_FROM || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || SUPPORT_EMAIL;
const APP_USER_AGENT = "katbuu-warranty-site/1.0";

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const REGISTRATIONS_FILE = path.join(DATA_DIR, "registrations.json");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

const ROUTES = {
  "/": "warranty.html",
  "/warranty": "warranty.html",
  "/success": "success.html",
  "/warranty-terms": "warranty-terms.html",
  "/privacy-policy": "privacy-policy.html",
  "/thank-you-card": "thank-you-card.html"
};

let dataQueue = Promise.resolve();

function loadEnvFile(filePath) {
  try {
    const raw = require("fs").readFileSync(filePath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const dividerIndex = trimmed.indexOf("=");
      if (dividerIndex === -1) {
        return;
      }

      const key = trimmed.slice(0, dividerIndex).trim();
      let value = trimmed.slice(dividerIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Unable to load .env:", error.message);
    }
  }
}

function createApp() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const pathname = decodeURIComponent(url.pathname);

      applySecurityHeaders(res);

      if (req.method === "GET" && pathname === "/api/health") {
        return sendJson(res, 200, {
          ok: true,
          app: "katbuu-warranty-site",
          time: new Date().toISOString()
        });
      }

      if (req.method === "POST" && pathname === "/api/registrations") {
        return handleRegistration(req, res);
      }

      if (req.method === "GET") {
        return serveStaticPage(pathname, res);
      }

      return sendJson(res, 405, { error: "Method not allowed." });
    } catch (error) {
      console.error("Unhandled request error:", error);
      return sendJson(res, 500, { error: "Internal server error." });
    }
  });
}

function applySecurityHeaders(res) {
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
}

async function handleRegistration(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  const parsed = validateRegistration(body);
  if (!parsed.ok) {
    return sendJson(res, 400, { error: parsed.error });
  }

  if (parsed.data.honeypot) {
    return sendJson(res, 200, {
      ok: true,
      status: "active",
      duplicate: false,
      mailConfigured: Boolean(RESEND_API_KEY && MAIL_FROM)
    });
  }

  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  const userAgent = req.headers["user-agent"] || "";

  const result = await enqueueDataTask(async () => {
    const registrations = await readRegistrations();
    const existing = registrations.find(
      (registration) =>
        registration.amazonOrderId === parsed.data.amazonOrderId
    );

    if (existing) {
      if (existing.email === parsed.data.email) {
        return { duplicate: true, record: existing };
      }
      return { conflict: true };
    }

    const record = {
      id: crypto.randomUUID(),
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      amazonOrderId: parsed.data.amazonOrderId,
      registeredAt: new Date().toISOString(),
      status: "active",
      coverage: {
        productWarranty: "3-year limited warranty",
        bulbReplacement: "free lifetime bulb replacement"
      },
      metadata: {
        ipAddress: clientIp,
        userAgent
      }
    };

    registrations.push(record);
    await writeRegistrations(registrations);
    return { duplicate: false, record };
  });

  if (result.conflict) {
    return sendJson(res, 409, {
      error: "This Amazon order ID has already been registered with a different email. Please contact support for help.",
      supportEmail: SUPPORT_EMAIL
    });
  }

  let notifications = "skipped";
  const mailConfigured = Boolean(RESEND_API_KEY && MAIL_FROM);

  if (!result.duplicate && mailConfigured) {
    try {
      await Promise.all([
        sendBuyerConfirmation(result.record),
        sendAdminNotification(result.record)
      ]);
      notifications = "sent";
    } catch (error) {
      notifications = "failed";
      console.error("Email delivery failed:", error.message);
    }
  }

  return sendJson(res, 200, {
    ok: true,
    status: "active",
    duplicate: result.duplicate,
    notifications,
    mailConfigured,
    supportEmail: SUPPORT_EMAIL
  });
}

async function serveStaticPage(pathname, res) {
  const routeFile = ROUTES[pathname];
  if (routeFile) {
    return serveFile(path.join(PUBLIC_DIR, routeFile), res);
  }

  const requestedPath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!requestedPath.startsWith(PUBLIC_DIR)) {
    return sendPlainText(res, 403, "Forbidden");
  }

  return serveFile(requestedPath, res);
}

async function serveFile(filePath, res) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const file = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream"
    });
    res.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      return sendPlainText(res, 404, "Not found");
    }

    console.error("Static file error:", error);
    return sendPlainText(res, 500, "Internal server error");
  }
}

async function readJsonBody(req, res) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    sendJson(res, 400, { error: "Request body is required." });
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload." });
    return null;
  }
}

function validateRegistration(payload) {
  const fullName = sanitizeText(payload.fullName, 80);
  const email = sanitizeEmail(payload.email);
  const amazonOrderId = sanitizeOrderId(payload.amazonOrderId);
  const acceptTerms = Boolean(payload.acceptTerms);
  const acceptPrivacy = Boolean(payload.acceptPrivacy);
  const honeypot = sanitizeText(payload.website, 120);

  if (!fullName) {
    return { ok: false, error: "Full name is required." };
  }
  if (!email) {
    return { ok: false, error: "A valid email address is required." };
  }
  if (!amazonOrderId) {
    return { ok: false, error: "A valid Amazon order ID is required." };
  }
  if (!acceptTerms || !acceptPrivacy) {
    return {
      ok: false,
      error: "You must agree to the Warranty Terms and Privacy Policy."
    };
  }

  return {
    ok: true,
    data: {
      fullName,
      email,
      amazonOrderId,
      honeypot
    }
  };
}

function sanitizeText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 120) : "";
}

function sanitizeOrderId(value) {
  const orderId = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return /^[A-Z0-9-]{10,32}$/.test(orderId) ? orderId : "";
}

function enqueueDataTask(task) {
  const next = dataQueue.then(task, task);
  dataQueue = next.catch(() => {});
  return next;
}

async function readRegistrations() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(REGISTRATIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(REGISTRATIONS_FILE, "[]\n", "utf8");
      return [];
    }
    console.error("Could not read registrations file:", error.message);
    return [];
  }
}

async function writeRegistrations(registrations) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REGISTRATIONS_FILE, `${JSON.stringify(registrations, null, 2)}\n`, "utf8");
}

async function sendBuyerConfirmation(record) {
  return sendEmail({
    to: record.email,
    subject: "Your KATBUU Warranty Has Been Activated",
    text: [
      "Your warranty is active.",
      "",
      "Thank you for registering your KATBUU aroma lamp.",
      "Your 3-year limited warranty is now active, and you are also eligible for free lifetime bulb replacement.",
      `Amazon Order ID: ${record.amazonOrderId}`,
      `If you need help, contact us at ${SUPPORT_EMAIL}.`,
      `${PUBLIC_SITE_URL}/warranty`
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">Your warranty is active</h2>
        <p>Thank you for registering your KATBUU aroma lamp.</p>
        <p>Your <strong>3-year limited warranty</strong> is now active, and you are also eligible for <strong>free lifetime bulb replacement</strong>.</p>
        <p><strong>Amazon Order ID:</strong> ${escapeHtml(record.amazonOrderId)}</p>
        <p>Please keep this order ID for future support requests.</p>
        <p>If you ever need help, contact us at <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a>.</p>
        <p style="margin-top: 24px;">KATBUU Support</p>
        <p><a href="${escapeHtml(PUBLIC_SITE_URL)}/warranty">Warranty Center</a></p>
      </div>
    `
  });
}

async function sendAdminNotification(record) {
  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `New Warranty Registration - ${record.amazonOrderId}`,
    text: [
      "New KATBUU warranty registration",
      `Name: ${record.fullName}`,
      `Email: ${record.email}`,
      `Amazon Order ID: ${record.amazonOrderId}`,
      "Form: streamlined registration",
      `Registered At: ${record.registeredAt}`
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">New KATBUU warranty registration</h2>
        <p><strong>Name:</strong> ${escapeHtml(record.fullName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(record.email)}</p>
        <p><strong>Amazon Order ID:</strong> ${escapeHtml(record.amazonOrderId)}</p>
        <p><strong>Form:</strong> Streamlined registration</p>
        <p><strong>Registered At:</strong> ${escapeHtml(record.registeredAt)}</p>
      </div>
    `
  });
}

async function sendEmail({ to, subject, html, text }) {
  if (!RESEND_API_KEY || !MAIL_FROM) {
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": APP_USER_AGENT
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [to],
      subject,
      html,
      text,
      reply_to: REPLY_TO_EMAIL
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Email provider returned an error.");
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendPlainText(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

if (require.main === module) {
  createApp().listen(PORT, HOST, () => {
    console.log(`KATBUU warranty site running on ${PUBLIC_SITE_URL}`);
  });
}

module.exports = {
  createApp
};
