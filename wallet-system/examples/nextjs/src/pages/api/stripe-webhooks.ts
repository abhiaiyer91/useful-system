import { createClient } from "@supabase/supabase-js";
import { AccountsSystem } from "credit-system";

const stripe = require("stripe")(
  "sk_test_51MnjF3Dfxj6lEmZePwkoHrG49im7rfXi9XoEdzCEHshV3sXWMucJdep30ODed0yWCVPbaoOY2qeYRGXG7qGD9XTo00bnd2ZW71"
);

const db = createClient(
  "https://tsiddebqgokuesfocrti.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzaWRkZWJxZ29rdWVzZm9jcnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzkyNjI5MTAsImV4cCI6MTk5NDgzODkxMH0.OKEN7AXSxGvwNqebuPq9mE5XFAq574iOm9Aqm_ytcx0"
);

const system = new AccountsSystem({
  db,
  product_id: `price_1MnjFhDfxj6lEmZek1ukTPFT`,
  fetchExternalObject: async ({ type, external_id }) => {
    if (type === `STRIPE_CHECKOUT_SESSION`) {
      const session = await stripe.checkout.sessions.retrieve(external_id, {
        expand: ["line_items"],
      });

      console.log(session);

      return session;
    }
  },
});

export default async function handler(req, res) {
  console.log(req.body);

  if (req.body.type === `checkout.session.completed`) {
    const externalId = req.body.data.object.id;

    const tx = await system.getTransactionByExternalId({
      external_id: externalId,
    });

    await system.resolveTransaction({ transaction_id: tx.id });
  }

  return res.send(200);
}
