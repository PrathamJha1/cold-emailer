const fs = require('fs');
const csv = require('csv-parser');

const contacts = [];

fs.createReadStream('./assets/whatsapp_contacts.csv')
  .pipe(csv())
  .on('data', (row) => contacts.push(row))
  .on('end', () => {
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>WhatsApp Outreach Dashboard</title>
        <style>
            body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
            .card { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
            .btn { display: inline-block; padding: 10px 18px; background: #25D366; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .btn:visited { background: #128C7E; }
        </style>
    </head>
    <body>
        <h2>WhatsApp Outreach Queue (${contacts.length} Contacts)</h2>
    `;

    contacts.forEach((c, idx) => {
      const phoneDigits = c.phone.replace(/\D/g, '').slice(-10);
      const fullNumber = `91${phoneDigits}`;
      const targetOrg = (c.company && c.company.trim()) ? c.company.trim() : 'your organization';
      
      const message = `Hi hiring manager, I'm looking for an opportunity at ${targetOrg}. I got your number from a trusted friend and wanted to connect to see if there are any roles in the company that I might be a fit for.\n\nI'm Pratham Jha, a Full-Stack Engineer (back-end heavy) with solid exposure to front-end development and experience building scalable systems. I'd love to chat further if you have a few minutes.\n\nBest regards,\nPratham Jha`;
      
      const encodedMsg = encodeURIComponent(message);
      const waLink = `https://wa.me/${fullNumber}?text=${encodedMsg}`;

      html += `
        <div class="card">
            <h3>#${idx + 1} - ${c.company || 'Organization'} (${c.phone})</h3>
            <p style="white-space: pre-line; background: #f9f9f9; padding: 10px; border-radius: 4px;">${message}</p>
            <a href="${waLink}" target="_blank" class="btn">Open Chat & Send Message</a>
        </div>
      `;
    });

    html += `</body></html>`;
    fs.writeFileSync('./outreach.html', html);
    console.log('✅ Generated outreach.html! Open this file in your browser to send one-click messages.');
  });