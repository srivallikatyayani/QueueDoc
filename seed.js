import mongoose from 'mongoose';
import Token from './server/models/Token.js';
import Counter from './server/models/Counter.js';

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/queuedoc');
  console.log('Connected to MongoDB');

  // Clean out existing data
  await Token.deleteMany({});
  await Counter.deleteMany({});

  // Mock time for today
  const today = new Date();
  const time = (hours, mins) => {
    const d = new Date(today);
    d.setHours(hours, mins, 0, 0);
    return d;
  };

  const dateStr = (d) => {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const currentDay = dateStr(today);

  // Insert completed ones to seed the EMA
  const seedTokens = [
    { num: 1, name: "Alice M.", status: "done", created_at: time(8, 0), called_at: time(8, 5), completed_at: time(8, 11), priority: "normal", clinic_day: currentDay },
    { num: 2, name: "Bob C.", status: "done", created_at: time(8, 5), called_at: time(8, 12), completed_at: time(8, 16), priority: "normal", clinic_day: currentDay },
    { num: 3, name: "Charlie D.", status: "done", created_at: time(8, 10), called_at: time(8, 17), completed_at: time(8, 22), priority: "normal", clinic_day: currentDay },
    { num: 4, name: "David E.", status: "no_show", created_at: time(8, 12), priority: "normal", clinic_day: currentDay },
    { num: 5, name: "Eve F.", status: "waiting", created_at: time(8, 15), priority: "normal", clinic_day: currentDay },
    { num: 6, name: "Frank G.", status: "waiting", created_at: time(8, 18), priority: "normal", clinic_day: currentDay },
    { num: 7, name: "Grace H.", status: "waiting", created_at: time(8, 20), priority: "urgent", clinic_day: currentDay },
    { num: 8, name: "Heidi I.", status: "waiting", created_at: time(8, 22), priority: "normal", clinic_day: currentDay },
  ];

  for (const t of seedTokens) {
    await Token.create({
      token_number: t.num,
      ...t
    });
  }

  // Set counter to 8
  await Counter.create({
    _id: "tokenNumber",
    seq: 8
  });

  console.log("Database seeded successfully with 8 tokens (3 done, 1 no-show, 4 waiting).");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
