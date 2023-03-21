// This is your test secret API key.

import { createClient } from "@supabase/supabase-js";
import { AccountsSystem } from "credit-system";

const stripe = require("stripe")(
  "sk_test_51MnjF3Dfxj6lEmZePwkoHrG49im7rfXi9XoEdzCEHshV3sXWMucJdep30ODed0yWCVPbaoOY2qeYRGXG7qGD9XTo00bnd2ZW71"
);

const YOUR_DOMAIN = "http://localhost:3000";



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
  const quantity = req.body.quantity;

  const userId = req.headers["x-user-id"];

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: "price_1MnjFhDfxj6lEmZek1ukTPFT",
        quantity: quantity,
      },
    ],
    mode: "payment",
    success_url: `${YOUR_DOMAIN}`,
    cancel_url: `${YOUR_DOMAIN}?error=payment`,
  });

  await system.createTransaction({
    type: "STRIPE_CHECKOUT_SESSION",
    user_id: userId,
    externalId: session.id,
    description: `Purchasing ${quantity} of tokens for user_id ${userId}`,
  });

  return res.json({ url: session.url });
}
