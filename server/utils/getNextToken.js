import Counter from '../models/Counter.js';

export default async function getNextToken() {
    const counter = await Counter.findOneAndUpdate(
        { _id: "tokenNumber" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    return counter.seq;
}
