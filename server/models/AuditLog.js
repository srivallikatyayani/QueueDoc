import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
    event_type: String, // e.g. 'call', 'add', 'hold', 'no_show', 'delay'
    token_number: Number, // Optional, depending on event
    description: String,
    clinic_day: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("AuditLog", AuditLogSchema);
