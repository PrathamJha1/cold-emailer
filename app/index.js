require("dotenv").config();
const fs = require("fs");
const csv = require("csv-parser");
const nodemailer = require("nodemailer");

// --- 1. Configuration & Initializers ---
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

// TEST_MODE=true: Displays generated email in console without sending anything
// TEST_MODE=false: Dispatches live emails with resume attachment
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
    : "🚀 PRODUCTION (Live dispatch via Gmail)"
);
console.log("Sender Account:", EMAIL_USER || "Missing in .env");
console.log(`Ollama Engine: ${OLLAMA_HOST} [Model: ${OLLAMA_MODEL}]`);
console.log("===============================================\n");

// Unbiased candidate profile with distinct frontend and backend skills
const candidateSkills = {
  profile: "Pratham Jha, ~3 Years Software Engineering Experience",
  frontend: "React, Next.js, TypeScript, JavaScript (ES6+), Tailwind CSS, Material-UI, Shadcn",
  backend: "Node.js, Express.js, RESTful APIs, Spring Boot, Microservices, PostgreSQL, MySQL, Supabase",
  distributed: "Scalable payment engines and automated refund pipelines at VERTO; distributed systems tracking 500+ validator nodes and 100 TPS load testing at SHARDEUM",
  problemSolving: "LeetCode Knight (Peak Rating: 1873, 1200+ problems solved)",
};

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

// Helper: Deterministic extractor to identify the exact role from CSV context
function extractTargetRole(rawContext = "", rawRole = "") {
  const source = (rawRole || rawContext || "").trim();
  if (!source) return "Software Engineer";

  const lower = source.toLowerCase();

  if (lower.includes("node.js") || lower.includes("node developer")) return "Node.js Developer";
  if (lower.includes("sr. frontend") || lower.includes("senior frontend")) return "Senior Frontend Engineer";
  if (lower.includes("frontend") || lower.includes("sde frontend")) return "Frontend Engineer";
  if (lower.includes("backend") || lower.includes("backend developer")) return "Backend Developer";
  if (lower.includes("microservices")) return "Microservices Engineer";
  if (lower.includes("full-stack") || lower.includes("full stack")) return "Full-Stack Developer";
  if (lower.includes("java developer")) return "Java Developer";
  if (lower.includes("risk engineering")) return "Risk Engineer";
  if (lower.includes("founding engineer")) return "Founding Engineer";
  if (lower.includes("sde2") || lower.includes("sde 2") || lower.includes("sde-2")) return "SDE 2";
  if (lower.includes("sde1") || lower.includes("sde 1") || lower.includes("sde-1") || lower.includes("swe1")) return "SDE 1";
  if (lower.includes("swe") || lower.includes("software engineer")) return "Software Engineer";
  if (lower.includes("software developer")) return "Software Developer";
  if (lower.includes("sde")) return "Software Development Engineer";

  const cleaned = source
    .replace(/\b(interviews?|application|hiring documents?|hiring process|cold outreach|outreach|round \d+|hackerrank|test process|opportunity)\b/gi, "")
    .replace(/[/,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 2 ? cleaned : "Software Engineer";
}

// Helper: Strip model meta-commentary, markdown, and stray signatures
function sanitizeEmailBody(rawText) {
  return rawText
    .replace(/^```[a-z]*\n?/gim, "")
    .replace(/```$/gim, "")
    .replace(
      /^(here (?:is|are|'s)[^\n]*:?|certainly[^\n]*|sure[^\n]*|subject:[^\n]*|dear[^\n]*|hi[^\n]*|hello[^\n]*)\n*/gim,
      ""
    )
    .replace(/\n+(best regards|sincerely|cheers|thanks|regards)[^\n]*/gim, "")
    .replace(/\[(?:Your Name|Company Name|Recruiter Name|Target Role|Role)\]/gi, "")
    .trim();
}

// --- 2. Ollama AI Generation with Dynamic Role Alignment ---
async function generateAIEmail({ company, contact, targetRole }) {
  const prompt = `You are Pratham Jha writing a direct, high-impact cold application email to ${contact} at ${company}.

Target Position: ${targetRole}
Target Company: ${company}

Candidate Highlights:
- Profile: ${candidateSkills.profile}
- Frontend Skills: ${candidateSkills.frontend}
- Backend Skills: ${candidateSkills.backend}
- System Achievements: Scalable payment/pricing workflows at VERTO; distributed backends tracking 500+ nodes (100 TPS) at SHARDEUM
- Problem Solving: ${candidateSkills.problemSolving}

ROLE-SPECIFIC PITCH INSTRUCTIONS:
1. Write 1-2 concise body paragraphs strictly applying for the "${targetRole}" position at ${company}.
2. DYNAMIC SKILL MAPPING:
   - If "${targetRole}" relates to Node.js, Backend, or Microservices: Focus heavily on Node.js, Express, REST APIs, and the scalable architectures at VERTO/SHARDEUM. Do NOT lead with React.
   - If "${targetRole}" relates to Frontend: Focus heavily on React, Next.js, TypeScript, and responsive web performance.
   - If "${targetRole}" is Full-Stack or general SDE: Present a balanced combination of React and Node.js microservices.
3. STRICT ROLE ADHERENCE:
   - Always refer to the position as "${targetRole}". NEVER replace or generalize this to "SDE 1 / SDE 2" unless "${targetRole}" is literally "SDE 1" or "SDE 2".
   - Explicitly mention "${company}" and "${targetRole}" in the text.
   - Mention that your resume is attached for review.
   - Write strictly in the FIRST PERSON ("I", "my").

STRICT CONSTRAINTS:
- Output ONLY the raw email body paragraphs.
- Do NOT generate greetings ("Hi..."), sign-offs, signatures, or meta commentary.
- Length must be strictly under 85 words.`;

  let bodyText = "";

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        system: `You are Pratham Jha. You write direct, role-tailored cold emails. You must tailor your skills specifically to ${targetRole} and never default to generic titles. Output raw body paragraphs only.`,
        stream: false,
        options: {
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) throw new Error(`Ollama HTTP Error: ${response.statusText}`);

    const data = await response.json();
    bodyText = data.response || "";
  } catch (error) {
    console.warn(`⚠️ Ollama Generation failed for ${company} (${error.message}). Using role-specific fallback.`);

    const isFrontend = targetRole.toLowerCase().includes("front");
    const skillFocus = isFrontend
      ? "React, TypeScript, Next.js, and modern frontend architecture"
      : "Node.js, TypeScript, RESTful APIs, and distributed microservices";

    bodyText = `I am reaching out to express my strong interest in the ${targetRole} position at ${company}. With ~3 years of software engineering experience specializing in ${skillFocus}, I have delivered scalable payment workflows at VERTO and architected distributed systems for 500+ nodes at SHARDEUM. I have attached my resume for your review and would welcome the opportunity to discuss how my technical expertise aligns with your engineering team's current goals.`;
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
        const rawContext = (row.Context || row.context || "").trim();
        const rawRole = (row.Role || row.role || "").trim();

        if (!email || email.includes("relay address") || !email.includes("@")) {
          console.log(`⏭️  Skipping invalid/relay row: ${company} (${contact})`);
          continue;
        }

        const targetRole = extractTargetRole(rawContext, rawRole);

        try {
          const { subject, text } = await generateAIEmail({
            company,
            contact,
            targetRole,
          });

          if (TEST_MODE) {
            console.log(`====================== [PREVIEW #${counter}] ======================`);
            console.log(`To:          ${contact} <${email}>`);
            console.log(`Company:     ${company}`);
            console.log(`Raw CSV:     ${rawRole || rawContext}`);
            console.log(`Target Role: ${targetRole}`);
            console.log(`Subject:     ${subject}`);
            console.log("----------------------- EMAIL BODY -----------------------");
            console.log(text);
            console.log("==========================================================\n");
            counter++;
          } else {
            console.log(`📨 Sending email to ${email} [${targetRole} @ ${company}]...`);

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

            await new Promise((resolve) => setTimeout(resolve, 4500));
          }
        } catch (error) {
          console.error(`❌ Error processing entry for ${email}:`, error.message);
        }
      }

      console.log(`🎉 Finished run. Mode was: ${TEST_MODE ? "TEST PREVIEW" : "LIVE SEND"}`);
    });
};

// --- 4. Execution ---
const targetCSV = "./assets/emails.csv";
if (fs.existsSync(targetCSV)) {
  processEmailsCSV(targetCSV);
} else {
  console.error(`❌ Error: File "${targetCSV}" not found.`);
}