import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM;

//For testing if resend API is set up correctly

// (async function () {
//   const { data, error } = await resend.emails.send({
//     from: 'Your App <noreply@yourdomain.com>',
//     to: ['delivered@resend.dev'],
//     subject: 'Hello World',
//     html: '<strong>It works!</strong>',
//   });

//   if (error) {
//     return console.error({ error });
//   }

//   console.log({ data });
// })();

export async function sendSignupNotification(to, name) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: 'Welcome!',
    html: `<strong>Hi ${name}, welcome to our app!</strong>`,
  });

  if (error) {
    console.error({ error });
    return false;
  }
  console.log({ data });
  return true;
}

export async function sendPurchaseConfirmation({ to, name, items, amount, currency = 'USD', orderId }) {
  try {
    const itemsHtml = (items || [])
      .map((item) => {
        const title = item?.games?.title || item?.title || 'Game';
        const quantity = item?.quantity ?? 1;
        const price = item?.games?.price ?? item?.price ?? 0;
        const lineTotal = Number(price) * Number(quantity);
        return `<li>${title} × ${quantity} — $${lineTotal.toFixed(2)}</li>`;
      })
      .join('');

    const prettyAmount = typeof amount === 'number' ? amount.toFixed(2) : amount;

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: `Your purchase confirmation${orderId ? ` • Order #${orderId}` : ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Thanks for your purchase${name ? `, ${name}` : ''}!</h2>
          <p>We're processing your order${orderId ? ` <strong>#${orderId}</strong>` : ''}. Here are the details:</p>
          ${itemsHtml ? `<ul>${itemsHtml}</ul>` : ''}
          <p><strong>Total:</strong> $${prettyAmount} ${currency.toUpperCase()}</p>
          <p>If you have any questions, just reply to this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error('sendPurchaseConfirmation error:', error);
      return false;
    }
    console.log('Purchase confirmation email sent:', { to, orderId, data });
    return true;
  } catch (err) {
    console.error('sendPurchaseConfirmation exception:', err);
    return false;
  }
}
