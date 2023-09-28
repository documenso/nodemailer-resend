# Nodemailer Resend

> Transport for sending email via the Resend SDK

### Getting Started!

#### Install the package

```bash
npm install nodemailer-resend
```

### Usage

#### Create Nodemailer Transport

```typescript
import { createTransport } from 'nodemailer';
import { ResendTransport } from 'nodemailer-resend';

const mailer = createTransport(
  createTransport(
    ResendTransport.makeTransport({
      apiKey: process.env.NEXT_PRIVATE_RESEND_API_KEY || '',
    }),
  ),
);
```

#### Send an Email

```typescript
mailer.sendMail({
  from: 'timur@documenso.com',
  to: 'zeno@resend.com',
  subject: 'Hello from Resend!',
  html: '<h1>Hello world!</h1>',
});
```
