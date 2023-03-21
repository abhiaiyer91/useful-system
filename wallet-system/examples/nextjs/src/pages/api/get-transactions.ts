// This is your test secret API key.

import { createClient } from "@supabase/supabase-js";
import { AccountsSystem } from "useful-wallet-system";

const db = createClient(
  "https://tsiddebqgokuesfocrti.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzaWRkZWJxZ29rdWVzZm9jcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzkyNjI5MTAsImV4cCI6MTk5NDgzODkxMH0.OKEN7AXSxGvwNqebuPq9mE5XFAq574iOm9Aqm_ytcx0"
);

const system = new AccountsSystem({
  db,
  product_id: `price_1MnjFhDfxj6lEmZek1ukTPFT`,
  fetchExternalObject: async () => {},
});

export default async function handler(req, res) {
  const user_id = req.headers["x-user-id"];

  const txs = await system.getTransactions({ user_id });

  return res.json({ data: txs });
}
