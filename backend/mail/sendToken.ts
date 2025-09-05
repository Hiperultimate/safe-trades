import nodemailer from "nodemailer";

const email = "hiperultimatevegito@gmail.com";
const password = "vwyu cvuh hcxc afju";
// Create a test account or replace with real credentials.
export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.email",
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    // user: process.env.SMTP_EMAIL,
    // pass: process.env.SMTP_PASSWORD,
    user: email,
    pass: password
  },
});

// Wrap in an async IIFE so we can use await.
(async () => {
  const info = await transporter.sendMail({
    from: `"Maddison Foo Koch" <${email}>`,
    to: "bar@example.com, baz@example.com",
    subject: "Hello ✔",
    text: "Hello world?", // plain‑text body
    html: "<b>Hello world?</b>", // HTML body
  });

  console.log("Message sent:", info.messageId);
})();