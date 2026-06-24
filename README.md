# Placement Portal

A real-time messaging and placement drive coordination platform for campus recruitment.

**Stack:** React 19 + Vite, Firebase (Firestore + Auth), React Router, Framer Motion

**Live on:** [Vercel](https://cdc-platform.vercel.app)

## Features

- 🎯 Company placement drives with eligibility filtering
- 💬 Real-time group chat per drive with pin/reply/reactions
- 👥 Direct messaging between coordinators and students
- 🔐 Role-based access (Admin, Coordinator, Student)
- 📱 Responsive mobile-first design
- 🔔 Notifications system

## Getting Started

```bash
npm install
npm run dev
```

## Project Structure

- `src/pages/` — Main pages (Dashboard, DriveRoom, DirectMessage, Login)
- `src/components/` — Reusable UI components
- `src/contexts/` — React context (auth, state)
- `src/utils/` — Helper functions
