# Nodemailer Resend

> Transport for sending email via the Resend SDK

<p align="left">
  <img alt="NPM Version" src="https://img.shields.io/npm/v/%40documenso/nodemailer-resend" />
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/documenso/nodemailer-resend">
  <img alt="GitHub" src="https://img.shields.io/github/license/documenso/nodemailer-resend">
</p>

### Getting Started!

#### Install the package

```bash
npm install @documenso/nodemailer-resend
```

### Usage

#### Create Nodemailer Transport

```typescript
import { ResendTransport } from '@documenso/nodemailer-resend';
import { createTransport } from 'nodemailer';

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
