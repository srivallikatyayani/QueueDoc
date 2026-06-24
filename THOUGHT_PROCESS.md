# Thought Process & Architecture Decisions

This document outlines the core technical and design decisions made to ensure QueueDoc is resilient, deterministic, and solves real-world clinic pain points.

## Feature-to-Problem Mapping

We deliberately scoped our advanced features to solve the messy edge cases of real clinics, rather than just building the "happy path".

| The Clinic Problem | Our Technical Solution |
| :--- | :--- |
| **"Two receptionists call the next patient at the exact same millisecond."** | **Production-Grade DB Locks:** We use MongoDB's atomic `findOneAndUpdate` with a strict status lock (`{ status: 'waiting' }`) when pulling the next patient. Even if two node instances fire simultaneously, the DB enforces that only one gets the token. |
| **"I stepped out for tea and lost my turn."** | **"Smart Slot" Holding State:** Receptionists can put a patient on hold. The server constantly monitors the queue length and automatically transitions holding patients back to active waiting when they are 3rd in line, guaranteeing they are back in the pool for their turn without losing their spot. |
| **"The doctor is stuck in surgery, and the waiting room is angry."** | **Global Delay Broadcasts:** A single button click adds a 15-minute offset to the `ClinicConfig` schema. The Socket server instantly broadcasts an amber delay banner to all Patient Displays and updates the Exponential Moving Average (EMA) wait calculations in real-time. |
| **"The receptionist called a patient, but they went home. The queue is stalled."** | **Auto No-Show Timeout:** When `callNext` fires, the Node.js server initiates a strict 2-minute `setTimeout`. If the token is still in the 'called' state after 2 minutes, it automatically transitions to 'no_show', logs the event, and frees the queue. |
| **"How do we know the system is actually fast and fair?"** | **Live Audit Trail with Time Diffs:** Every action logs to an `AuditLog` collection. The Receptionist UI renders these live, mathematically calculating the exact seconds elapsed between actions to visibly prove the "under 10 seconds" criteria. |

## Known Limitations & Trade-offs

We believe in acknowledging technical limits over claiming perfection. Here are the deliberate trade-offs we made:

### 1. The Socket Level Double-Click Guard
**The Limitation:** To prevent a receptionist from accidentally double-clicking "Call Next" and firing two valid DB requests, we implemented a server-side in-memory lock using a JavaScript `Set` (a 600ms debounce). If this application scales horizontally to multiple Node.js instances behind a load balancer, this in-memory `Set` will not hold across processes.
**The Mitigation:** We accepted this UI-level limitation because the core data integrity is protected by our true DB-level atomic lock (Mongoose `findOneAndUpdate`). The DB lock guarantees only one patient is called, even if the in-memory debounce fails across clusters.

### 2. Multi-Doctor Load Balancing
**The Limitation:** The current token schema assumes a single doctor (or a single pooled triage room). It does not assign Token #14 to "Doctor A" and Token #15 to "Doctor B". 
**The Mitigation:** Adding multi-doctor support fundamentally shifts the data structure from a "single queue" to a "multi-queue balancing algorithm". We opted to skip this to focus entirely on perfecting the concurrency, auditability, and speed of a single pipeline, ensuring we nailed the core requirements flawlessly before adding routing complexity.

## Concurrency Strategy

1. **Token Generation:** Handled by a dedicated `Counter` collection using atomic `$inc` updates to prevent duplicate token numbers.
2. **State Updates:** No client ever mutates state directly. Clients emit socket events, the server runs the DB mutation, fetches the *fresh* state from the DB, and broadcasts `queue:update` to everyone. This guarantees all screens are perfectly synchronized to the DB's absolute truth.
