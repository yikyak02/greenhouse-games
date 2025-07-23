import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

//For testing if resend API is set up correctly

// (async function () {
//   const { data, error } = await resend.emails.send({
//     from: 'Acme <onboarding@resend.dev>',
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
    from: 'Acme <onboarding@resend.dev>',
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