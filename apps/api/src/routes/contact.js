import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate request body
const validateContactForm = (name, email, organization, message) => {
  console.log('[VALIDATION] Starting validation with:', { name, email, organization, message });
  
  if (!name || typeof name !== 'string' || name.trim() === '') {
    console.warn('[VALIDATION] Name validation failed');
    return { valid: false, error: 'Name is required and must be a non-empty string' };
  }
  
  if (!email || typeof email !== 'string' || email.trim() === '') {
    console.warn('[VALIDATION] Email validation failed - empty or invalid type');
    return { valid: false, error: 'Email is required and must be a non-empty string' };
  }
  
  if (!isValidEmail(email)) {
    console.warn('[VALIDATION] Email format validation failed:', email);
    return { valid: false, error: 'Email format is invalid' };
  }
  
  if (!organization || typeof organization !== 'string' || organization.trim() === '') {
    console.warn('[VALIDATION] Organization validation failed');
    return { valid: false, error: 'Organization is required and must be a non-empty string' };
  }
  
  if (!message || typeof message !== 'string' || message.trim() === '') {
    console.warn('[VALIDATION] Message validation failed');
    return { valid: false, error: 'Message is required and must be a non-empty string' };
  }
  
  console.log('[VALIDATION] All validations passed');
  return { valid: true };
};

// Create transporter with error handling
const createTransporter = () => {
  console.log('[TRANSPORTER] Creating nodemailer transporter...');
  console.log('[TRANSPORTER] SMTP_HOST:', process.env.SMTP_HOST);
  console.log('[TRANSPORTER] SMTP_PORT:', process.env.SMTP_PORT);
  console.log('[TRANSPORTER] SMTP_USER:', process.env.SMTP_USER ? '***' : 'NOT SET');
  console.log('[TRANSPORTER] SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '***' : 'NOT SET');
  console.log('[TRANSPORTER] SMTP_FROM_EMAIL:', process.env.SMTP_FROM_EMAIL);
  console.log('[TRANSPORTER] SMTP_TO_EMAILS:', process.env.SMTP_TO_EMAILS);
  
  // Verify all required SMTP credentials are set
  if (!process.env.SMTP_HOST) {
    throw new Error('SMTP_HOST is not configured in .env file');
  }
  if (!process.env.SMTP_PORT) {
    throw new Error('SMTP_PORT is not configured in .env file');
  }
  if (!process.env.SMTP_USER) {
    throw new Error('SMTP_USER is not configured in .env file');
  }
  if (!process.env.SMTP_PASSWORD) {
    throw new Error('SMTP_PASSWORD is not configured in .env file');
  }
  if (!process.env.SMTP_FROM_EMAIL) {
    throw new Error('SMTP_FROM_EMAIL is not configured in .env file');
  }
  if (!process.env.SMTP_TO_EMAILS) {
    throw new Error('SMTP_TO_EMAILS is not configured in .env file');
  }
  
  try {
    const smtpPort = parseInt(process.env.SMTP_PORT, 10);
    const isSecure = smtpPort === 465; // Use TLS for port 465, STARTTLS for 587
    
    console.log('[TRANSPORTER] Configuration:', {
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: isSecure,
      user: process.env.SMTP_USER,
    });
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: isSecure, // true for 465, false for other ports (587 uses STARTTLS)
      auth: {
        user: process.env.SMTP_USER.trim(),
        pass: process.env.SMTP_PASSWORD.trim(),
      },
      // Add connection timeout and retry logic
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });
    
    console.log('[TRANSPORTER] Transporter created successfully');
    return transporter;
  } catch (error) {
    console.error('[TRANSPORTER] Error creating transporter:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    throw error;
  }
};

// Verify transporter connection
const verifyTransporter = async (transporter) => {
  console.log('[VERIFY] Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('[VERIFY] ✓ SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('[VERIFY] ✗ SMTP connection verification failed:', {
      message: error.message,
      code: error.code,
      response: error.response,
      stack: error.stack,
    });
    throw new Error(`SMTP connection failed: ${error.message}. Please verify your email credentials.`);
  }
};

// Generate HTML email body
const generateEmailHTML = (name, email, organization, message) => {
  console.log('[EMAIL_TEMPLATE] Generating email HTML...');
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background-color: white; padding: 20px; border-radius: 0 0 8px 8px; }
          .field { margin-bottom: 20px; }
          .label { font-weight: bold; color: #2c3e50; margin-bottom: 5px; }
          .value { background-color: #f0f0f0; padding: 10px; border-left: 4px solid #3498db; border-radius: 4px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New MARG Demo Request</h2>
          </div>
          <div class="content">
            <div class="field">
              <div class="label">Sender Name:</div>
              <div class="value">${name}</div>
            </div>
            <div class="field">
              <div class="label">Sender Email:</div>
              <div class="value"><a href="mailto:${email}">${email}</a></div>
            </div>
            <div class="field">
              <div class="label">Organization:</div>
              <div class="value">${organization}</div>
            </div>
            <div class="field">
              <div class="label">Message:</div>
              <div class="value">${message.replace(/\n/g, '<br>')}</div>
            </div>
            <div class="footer">
              <p>This is an automated email from the MARG Demo Request form.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
  
  console.log('[EMAIL_TEMPLATE] Email HTML generated successfully');
  return html;
};

router.post('/', async (req, res) => {
  console.log('\n========== CONTACT FORM REQUEST STARTED =========');
  console.log('[REQUEST] Received POST request to /contact');
  console.log('[REQUEST] Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { name, email, organization, message } = req.body;

    // Validate input
    console.log('[STEP 1] Validating input fields...');
    const validation = validateContactForm(name, email, organization, message);
    if (!validation.valid) {
      console.warn('[STEP 1] Validation failed:', validation.error);
      return res.status(400).json({ success: false, error: validation.error });
    }
    console.log('[STEP 1] ✓ Input validation passed');

    // Create transporter
    console.log('[STEP 2] Creating email transporter...');
    let transporter;
    try {
      transporter = createTransporter();
      console.log('[STEP 2] ✓ Transporter created successfully');
    } catch (error) {
      console.error('[STEP 2] ✗ Failed to create transporter:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      return res.status(500).json({ 
        success: false, 
        error: `Failed to create email transporter: ${error.message}` 
      });
    }

    // Verify transporter connection
    console.log('[STEP 2.5] Verifying SMTP connection...');
    try {
      await verifyTransporter(transporter);
      console.log('[STEP 2.5] ✓ SMTP connection verified');
    } catch (error) {
      console.error('[STEP 2.5] ✗ SMTP verification failed:', error.message);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    // Generate email template
    console.log('[STEP 3] Generating email template...');
    let emailHTML;
    try {
      emailHTML = generateEmailHTML(name, email, organization, message);
      console.log('[STEP 3] ✓ Email template generated successfully');
    } catch (error) {
      console.error('[STEP 3] ✗ Failed to generate email template:', {
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ 
        success: false, 
        error: `Failed to generate email template: ${error.message}` 
      });
    }

    // Prepare email options
    console.log('[STEP 4] Preparing email options...');
    const recipientEmails = process.env.SMTP_TO_EMAILS.split(',').map(e => e.trim());
    const mailOptions = {
      from: process.env.SMTP_FROM_EMAIL,
      to: recipientEmails.join(', '),
      subject: `New MARG Demo Request from ${name}`,
      html: emailHTML,
      replyTo: email,
    };
    console.log('[STEP 4] ✓ Email options prepared:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      replyTo: mailOptions.replyTo,
    });

    // Send email
    console.log('[STEP 5] Sending email...');
    let info;
    try {
      info = await transporter.sendMail(mailOptions);
      console.log('[STEP 5] ✓ Email sent successfully');
      console.log('[STEP 5] Email response:', {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
        pending: info.pending,
      });
    } catch (error) {
      console.error('[STEP 5] ✗ Failed to send email:', {
        message: error.message,
        code: error.code,
        response: error.response,
        stack: error.stack,
      });
      return res.status(500).json({ 
        success: false, 
        error: `Failed to send email: ${error.message}` 
      });
    }

    // Success response
    console.log('[RESPONSE] Sending success response...');
    const successResponse = { 
      success: true, 
      message: 'Email sent successfully',
      messageId: info.messageId,
    };
    console.log('[RESPONSE] Success response:', successResponse);
    console.log('========== CONTACT FORM REQUEST COMPLETED =========\n');
    
    return res.status(200).json(successResponse);
  } catch (error) {
    console.error('\n========== UNEXPECTED ERROR =========');
    console.error('[ERROR] Unexpected error in contact form handler:', {
      message: error.message,
      code: error.code,
      response: error.response,
      stack: error.stack,
    });
    console.error('========== END UNEXPECTED ERROR =========\n');
    
    return res.status(500).json({ 
      success: false, 
      error: `Unexpected error: ${error.message}` 
    });
  }
});

export default router;