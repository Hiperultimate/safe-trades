import { Resend } from 'resend';

const resend = new Resend(process.env.RESENT_API);

export async function sendAuthMail(to : string, auth_token: string){
    await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: to,
        subject: 'Auth Token V1',
        html: `<p>Click on this URL to login http://localhost:3000/api/v1/signin/search?email=${to}&auth_token=${auth_token}</p>`
    });
}