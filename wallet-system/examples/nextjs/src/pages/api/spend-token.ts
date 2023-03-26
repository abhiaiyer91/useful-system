// This is your test secret API key.

import { createClient } from "@supabase/supabase-js";

import { AccountsSystem } from "useful-wallet-system";

const db = createClient(
  "https://tsiddebqgokuesfocrti.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzaWRkZWJxZ29rdWVzZm9jcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzkyNjI5MTAsImV4cCI6MTk5NDgzODkxMH0.OKEN7AXSxGvwNqebuPq9mE5XFAq574iOm9Aqm_ytcx0"
);

const system = new AccountsSystem({
  db,
  fetchExternalObject: async () => {},
});

export default async function handler(req, res) {
  const user_id = req.headers["x-user-id"];
  const quantity = req.body.quantity;

  const tx = await system.createTransaction({
    user_id,
    externalId: user_id,
    description: `Spending ${quantity} tokens`,
    type: `SPEND_BALANCE`,
    balance: quantity,
  });


  await system.resolveTransaction({ transaction_id: tx.id })

  const wallet = await system.getWallet(user_id);

  return res.json({ data: wallet });
}
