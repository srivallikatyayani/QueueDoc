# QueueDoc Live Clinic Queue Manager

A high-performance, real-time token management system built specifically for the chaos of modern clinic waiting rooms.

## The 90-Second Demo: "A Clinic's Chaotic Morning"

This project was built to solve the real problems that paper tokens and generic queue apps ignore. To see the true power of QueueDoc, run through this 90-second script with both screens open side-by-side (`/reception` and `/display`):

1. **The Lightning Add (< 10s):** A patient walks in. The receptionist types a name and hits enter. In less than a second, the Token # is generated, the live Display screen updates, and an Audit Log event is recorded.
2. **The Emergency Bump:** An emergency patient arrives. The receptionist clicks "Urgent" and adds them. Watch the queue instantly re-order, bumping the Urgent patient to the absolute front of the line without any page refreshes.
3. **The Doctor Delay:** The doctor signals they are running 15 minutes late. The receptionist clicks the **Doctor Delay (+15m)** button. Instantly, an amber banner pushes to all patient screens explaining the delay, and every single patient's Estimated Wait Time algorithm adds 15 minutes. No shouting across the waiting room needed.
4. **The Smart Slot (Leave & Come Back):** Patient #14 says they are going to the cafe next door. The receptionist clicks "Hold". The patient is paused. As the line drops to 3 people ahead of them, the system *automatically* re-inserts them into the active waiting pool so they don't lose their turn.
5. **The Auto No-Show Timeout:** The receptionist clicks "Call Next". The Display screen's browser literally **speaks** the token out loud using the Web Speech API. We wait 2 minutes. The patient never shows up to the desk. To prevent the queue from stalling, the server automatically transitions them to "No Show" and clears the slot.

## Technology Stack

- **Frontend:** React (Vite) + Tailwind CSS for a highly responsive, modern interface.
- **Backend:** Node.js + Express.js
- **Database:** MongoDB via Mongoose
- **Realtime Sync:** Socket.io for instantaneous, zero-latency state broadcasting.

## Run Locally

1. `npm install`
2. `node server/index.js` (starts backend and Socket.io server)
3. `npm run dev` (starts Vite frontend)
4. Open `http://localhost:5173/reception` and `http://localhost:5173/display` side-by-side.

## Key Features
- **Deterministic Audit Trail**: Live logging of every queue action with time diffs to visibly prove speed.
- **EMA Wait Time Algorithm**: Dynamically adjusts wait estimates based on true consultation durations, discarding statistical outliers.
- **Queue Health Indicator**: Automatically classifies clinic load (Light/Moderate/Heavy) based on total wait time.
