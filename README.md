# OutMail Backend

OutMail is an email automation backend designed to:
- Let users log in using Google OAuth.
- Allow storing Gmail App Passwords (encrypted).
- Let users upload a CSV and start timed email campaigns.
- Send one email every 2 minutes using a customizable HTML template.

### Tech Stack
- Node.js
- Express
- PostgreSQL
- Nodemailer
- CSV Parser
- Multer
- AES Encryption

### Running Locally
```bash
git clone https://github.com/yourname/outmail-backend.git
cd outmail-backend
cp .env.example .env
npm install
npm run dev
```

### Folder Structure
```
/config      → Database config
/controllers → Business logic
/models      → PostgreSQL schema references
/routes      → API endpoints
/services    → Email logic
/utils       → Encryption
/uploads     → User-uploaded CSVs
```

### Contribution
Make a PR or open an issue to suggest improvements.