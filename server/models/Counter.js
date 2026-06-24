import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
    _id: String,
    seq: Number
});

export default mongoose.model("Counter", CounterSchema);
