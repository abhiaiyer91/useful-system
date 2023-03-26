import Head from "next/head";
import Image from "next/image";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { useEffect, useState } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  const [wallet, setWallet] = useState<{ balance: number }>({ balance: 0 });

  const [txs, setTxs] = useState([]);

  useEffect(() => {
    if (typeof window !== `undefined`) {
      window
        .fetch("/api/get-balance", {
          method: `GET`,
          headers: {
            "x-user-id": "USER",
          },
        })
        .then((res) => res.json())
        .then(({ data }: any) => {
          setWallet(data);
        });
    }
  }, []);

  useEffect(() => {
    if (typeof window !== `undefined`) {
      window
        .fetch("/api/get-transactions", {
          method: `GET`,
          headers: {
            "x-user-id": "USER",
          },
        })
        .then((res) => res.json())
        .then(({ data }: any) => {
          setTxs(data);
        });
    }
  }, []);

  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <div>
          <button
            onClick={() => {
              window
                .fetch("/api/create-stripe-checkout", {
                  method: `POST`,
                  headers: {
                    "x-user-id": "USER",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    quantity: 1,
                  }),
                })
                .then((res) => res.json())
                .then((data) => {
                  window.location.href = data.url;
                })
                .catch((e) => console.error(e));
            }}
          >
            Buy a token
          </button>

          <button
            onClick={() => {
              window
                .fetch("/api/spend-token", {
                  method: `POST`,
                  headers: {
                    "x-user-id": "USER",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    quantity: 1,
                  }),
                })
                .then((res) => res.json())
                .then(({ data }) => {
                  setWallet(data);
                })
                .catch((e) => console.error(e));
            }}
          >
            Spend a token
          </button>

          <p>Balance: {wallet?.balance || 0}</p>
          <div>
            <h1>Transactions</h1>
            <div style={{ marginTop: `10px` }}>
              {txs?.map((tx) => {
                return (
                  <div style={{ marginBottom: `10px` }}>
                    <p>{tx.id}</p>
                    <p>{tx.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}