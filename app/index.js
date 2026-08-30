require("dotenv").config();
const fs = require("fs");
const csv = require("csv-parser");
const nodemailer = require("nodemailer");

// --- 1. Configuration & Initializers ---
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

// TEST_MODE=true: Renders AI-generated email in terminal with resume insights (No emails sent)
// TEST_MODE=false: Sends live emails with attached PDF resume via Gmail SMTP
const TEST_MODE = process.env.TEST_MODE === "true";

const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

console.log("================ CONFIGURATION ================");
console.log(
  "Mode:",
  TEST_MODE
    ? "🧪 TEST / PREVIEW MODE (Console output only, no emails sent)"
    : "🚀 PRODUCTION (Emails dispatched via Gmail)",
);
console.log("Sender Account:", EMAIL_USER || "Missing in .env");
console.log(`Ollama Engine: ${OLLAMA_HOST} [Model: ${OLLAMA_MODEL}]`);
console.log("===============================================\n");

// Detailed Resume Context & Metrics Extracted from Pratham_s_Resume_YOE_3.pdf
const resumeInsights = `
Candidate Profile: Pratham Jha[cite: 1]
Target Opportunities: SDE 1 / SDE 2 (Frontend, Backend, or Full Stack roles)
Experience: ~3 Years of Software Engineering Experience[cite: 1]

Core Technical Stack:
- Primary / Frontend: React, JavaScript (ES6+), TypeScript, Next.js, Tailwind CSS, Bootstrap, Material-UI, Shadcn[cite: 1]
- Backend & Architecture: Node.js, Express.js, RESTful APIs, Spring Boot, Microservices Architecture[cite: 1]
- Databases & Cloud: PostgreSQL, MongoDB, MySQL, Supabase, Firebase, AWS, Docker, CI/CD[cite: 1]

Work Experience & High-Impact Metrics:
1. SDE-I at VERTO (Pune):
   - Engineered scalable RESTful backend APIs and automated payment workflows/pricing engines (OAS 3.0 standard)[cite: 1].
   - Built automated refund and archival pipelines reducing manual effort and generating secure audit logs[cite: 1].
   - Expanded trading blotters with multi-currency handling for financial reconciliation and accurate P&L tracking[cite: 1].

2. Software Engineer at SHARDEUM (Remote):
   - Architected enterprise backend tracking 500+ validator nodes, boosting network stability by 40%[cite: 1].
   - Built Node.js load-testing infrastructure simulating 100 TPS across 15+ scripts[cite: 1].
   - Designed a Multisig-App backend to adjust live network parameters, cutting update turnaround by 50%[cite: 1].

Key Projects & Highlights:
- Real-Time Chat App: Built with React, Node.js, and Socket.IO supporting 10+ rooms with 200ms latency and 99.5% delivery rate[cite: 1].
- Music Streaming App: Built responsive frontend with React and Spotify API, decreasing user search time by 60%[cite: 1].
- Price Tracker: Built with Next.js/Node.js, Supabase, and Firecrawl AI for multi-platform price extraction and fuzzy matching[cite: 1].
- Problem Solving: LeetCode Knight (Peak Rating: 1873, 1200+ problems solved, 39 contests)[cite: 1].
`;

// Helper: Formulate clean recruiter greeting
function formatGreeting(contact) {
  if (
    !contact ||
    contact.toLowerCase().includes("team") ||
    contact.toLowerCase().includes("recruiting") ||
    contact.toLowerCase().includes("careers") ||
    contact.toLowerCase().includes("hr") ||
    contact.toLowerCase().includes("external")
  ) {
    return "Hi Hiring Team,";
  }
  const cleanName = contact.split(/[/,]/)[0].trim();
  const firstName = cleanName.split(" ")[0];
  return `Hi ${firstName},`;
}

// Helper: Determine target role subject tag based on context
function resolveTargetRole(context = "") {
  const normalized = context.toLowerCase();
  if (
    normalized.includes("sde2") ||
    normalized.includes("sde 2") ||
    normalized.includes("sde-2")
  ) {
    return "SDE 2 Opportunities";
  }
  if (
    normalized.includes("sde1") ||
    normalized.includes("sde 1") ||
    normalized.includes("sde-1")
  ) {
    return "SDE 1 Opportunities";
  }
  return "SDE 1 / SDE 2 Roles";
}

// Helper: Strip conversational prefixes, markdown, placeholders, and trailing sign-offs
function sanitizeEmailBody(rawText) {
  return rawText
    .replace(/^```[a-z]*\n?/gim, "")
    .replace(/```$/gim, "")
    .replace(
      /^(here (?:is|are|'s)[^\n]*:?|certainly[^\n]*|sure[^\n]*|subject:[^\n]*|dear[^\n]*|hi[^\n]*|hello[^\n]*)\n*/gim,
      "",
    )
    .replace(/\n+(best regards|sincerely|cheers|thanks|regards)[^\n]*/gim, "")
    .replace(
      /\[(?:Your Name|Company Name|Recruiter Name|Target Role|Role)\]/gi,
      "",
    )
    .trim();
}

// --- 2. Ollama AI Email Generation ---
async function generateAIEmail({ company, contact, context }) {
  const targetRole = resolveTargetRole(context);

  const prompt = `You are Pratham Jha writing a direct, high-impact cold email to ${contact} at ${company}.

Resume Data & Insights:
${resumeInsights}

Target Opening Context: ${context} (Focus: ${targetRole})

Instructions:
Write 1-2 concise body paragraphs applying for ${targetRole} at ${company}.
- ALWAYS write in the FIRST PERSON ("I", "my", "me"). NEVER refer to yourself in the third person.
- Highlight your core strengths in React and JavaScript/TypeScript upfront, along with backend achievements at VERTO (scalable payment APIs/microservices) and SHARDEUM (distributed systems tracking 500+ nodes).
- Explicitly state that you have attached your resume for detailed metrics, and ask if their engineering team has open SDE 1 or SDE 2 positions.

STRICT CONSTRAINTS:
- Output ONLY the body paragraphs.
- Do NOT output greetings ("Hi...", "Dear..."), subject lines, signatures, or meta commentary (e.g., "Here is the email:").
- Keep length strictly under 95 words.`;

  let bodyText = "";

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        system:
          "You are a concise cold email generator representing Pratham Jha. Output only the email body in the first person. Emphasize React, JavaScript, and scalable microservices metrics. Never include conversational filler.",
        stream: false,
        options: {
          temperature: 0.6,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP Error: ${response.statusText}`);
    }

    const data = await response.json();
    bodyText = data.response || "";
  } catch (error) {
    console.warn(
      `⚠️ Ollama Generation failed for ${company} (${error.message}). Using fallback template.`,
    );
    bodyText = `I am reaching out to explore ${targetRole} engineering opportunities at ${company}. With ~3 years of experience specializing in React, JavaScript, TypeScript, and high-performance Node.js microservices, I have built mission-critical payment workflows at VERTO and scaled distributed backend systems for 500+ nodes at SHARDEUM. I have attached my resume for your review and would love to discuss how my skill set aligns with open SDE 1 or SDE 2 roles on your team.`;
  }

  const cleanedBody = sanitizeEmailBody(bodyText);
  const greeting = formatGreeting(contact);
  const mySignature = `Best regards,\n\nPratham Jha\nSoftware Engineer\nLinkedIn: https://linkedin.com/in/prathamjha\nGitHub: https://github.com/PrathamJha1`;

  const finalEmailBody = `${greeting}\n\n${cleanedBody}\n\n${mySignature}`;

  return {
    subject: `Application: ${targetRole} - Pratham Jha`,
    text: finalEmailBody,
  };
}

// --- 3. CSV Processing & Dispatch ---
const processEmailsCSV = (filePath) => {
  console.log("📂 Reading emails from CSV...");
  const results = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      console.log(`✅ Loaded ${results.length} rows from CSV.\n`);

      let counter = 1;
      for (const row of results) {
        const company = (row.Company || row.company || "your team").trim();
        const contact = (row.Contact || row.contact || "Hiring Team").trim();
        const email = (row.Email || row.email || "").trim();
        const context = (row.Context || row.context || "SDE 1 / SDE 2").trim();

        if (!email || email.includes("relay address") || !email.includes("@")) {
          console.log(
            `⏭️  Skipping invalid/relay row: ${company} (${contact})`,
          );
          continue;
        }

        try {
          const { subject, text } = await generateAIEmail({
            company,
            contact,
            context,
          });

          if (TEST_MODE) {
            // Preview Generated Email in Terminal
            console.log(
              `====================== [PREVIEW #${counter}] ======================`,
            );
            console.log(`To:       ${contact} <${email}>`);
            console.log(`Company:  ${company}`);
            console.log(`Context:  ${context}`);
            console.log(`Subject:  ${subject}`);
            console.log(
              "----------------------- EMAIL BODY -----------------------",
            );
            console.log(text);
            console.log(
              "==========================================================\n",
            );
            counter++;
          } else {
            // Live Dispatch Mode
            console.log(`📨 Sending email to ${email} (${company})...`);

            const mailOptions = {
              from: EMAIL_USER,
              to: email,
              subject: subject,
              text: text,
            };

            const resumePath = "./assets/Pratham_s_Resume_YOE_3.pdf";
            if (fs.existsSync(resumePath)) {
              mailOptions.attachments = [
                {
                  filename: "Pratham_Jha_Resume.pdf",
                  path: resumePath,
                },
              ];
            }

            await emailTransporter.sendMail(mailOptions);
            console.log(`✅ Successfully sent to: ${email}`);

            // 4.5s delay to protect Gmail SMTP quota
            await new Promise((resolve) => setTimeout(resolve, 4500));
          }
        } catch (error) {
          console.error(
            `❌ Error processing entry for ${email}:`,
            error.message,
          );
        }
      }

      console.log(
        `🎉 Finished run. Mode was: ${TEST_MODE ? "TEST PREVIEW" : "LIVE SEND"}`,
      );
    });
};

// --- 4. Execution ---
const targetCSV = "./assets/emails.csv";
if (fs.existsSync(targetCSV)) {
  processEmailsCSV(targetCSV);
} else {
  console.error(`❌ Error: File "${targetCSV}" not found.`);
}
