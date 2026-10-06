import { initializeDatabase } from "./database";

export const addExpense = async ({ date, category, amount, notes }) => {
  console.log("Adding expense:", { date, category, amount, notes });
  const db = await initializeDatabase();

  await db.run(
    `
      INSERT INTO expenses (
        date,
        category,
        amount,
        notes,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [date, category, amount, notes || null, new Date().toISOString()],
  );

  const result = await db.query("SELECT * FROM expenses");
  console.log(result);
};
