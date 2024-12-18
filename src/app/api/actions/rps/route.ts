import {
  ActionPostResponse,
  createActionHeaders,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
  MEMO_PROGRAM_ID,
} from "@solana/actions";
import { getApps, initializeApp, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, getDoc, doc } from "firebase/firestore";
// Firebase _______________________________________________
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
// __________________________________________________________

const app = !getApps.length ? initializeApp(firebaseConfig) : getApp();
const firestore = getFirestore(app);

const auth = getAuth(app);


const headers = createActionHeaders({
  chainId: "mainnet", // or chainId: "devnet"
  actionVersion: "2.2.1", // the desired spec version
});
export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const amount = url.searchParams.get("amount");
  const player1 = url.searchParams.get("player");
  const host = url.searchParams.get("host");
  const account = url.searchParams.get("account");
  let payload: ActionGetResponse;
  if (account) {
    let db = await getDoc(doc(firestore, "hosts", account?.toString()));
    let amount = 0;
    amount = parseFloat(amount.toFixed(4));
    if (db.exists()) amount = Number(db.data().amount);
    payload = {
      title: `You(${account}) have ${amount} SOL left in your wager.`,
      icon: "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/icon.gif",
      description: `Claim you amount back from the below button.`,
      label: "Rock Paper Scissors",
      "links": {
        "actions": [
          {
            "label": "Claim amount!", // button text
            "href": `/api/actions/hostback?account=${account}`,
            type: "transaction",
          }
        ]
      }
    };
  }
  else if (player1 && host === "F") {
    payload = {
      title: `Player 1 (${player1}) has made a bet of ${amount} SOL. Waiting for Player 2 to make a choice.`,
      icon: "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/icon.gif",
      description: `Player 1 has made a bet and is waiting for Player 2 to make a choice and match their bet of ${amount} SOL! Both bet amounts will be pooled together, and the winner will take it all, but in case of a tie, both players will get their bet amount back.`,
      label: "Rock Paper Scissors",
      "links": {
        "actions": [
          {
            "label": "Play!", // button text
            "href": `/api/actions/friend?choice={choice}&player=${player1}`,
            type: "transaction",
            parameters: [
              {
                type: "radio",
                name: "choice", // parameter name in the `href` above
                label: "Choose your move?", // placeholder of the text input
                required: true,
                options: [
                  { label: "Rock", value: "R" },
                  { label: "Paper", value: "P" },
                  { label: "Scissors", value: "S" },
                ],
              },
            ]
          }
        ]
      }
    };
  }
  else if (player1 && host === "H") {
    const firestore = getFirestore(app);
    let db = await getDoc(doc(firestore, "hosts", player1.toString()));
    let amount = 0;
    if (db.exists()) amount = Number(db.data().amount);
    payload = {
      title: `Player 1 (${player1}) has made a bet and has ${amount} SOL left in their wager. Waiting for Player 2 to make a choice.`,
      icon: "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/icon.gif",
      description: `You can place a bet equal to or less than this amount to compete. The winner takes double the amount they bet and in case of a tie, both players will get their bet amount back.`,
      label: "Rock Paper Scissors",
      "links": {
        "actions": [
          {
            "label": "Play!", // button text
            "href": `/api/actions/host?choice={choice}&player=${player1}&amount={amount}`,
            type: "transaction",
            parameters: [
              {
                type: "select",
                name: "amount", // parameter name in the `href` above
                label: "Bet Amount in SOL", // placeholder of the text input
                required: true,
                options: [
                  { label: "1 SOL", value: "1" },
                  { label: "0.1 SOL", value: "0.1" },
                  { label: "0.01 SOL", value: "0.01" },
                ],
              },
              {
                type: "radio",
                name: "choice", // parameter name in the `href` above
                label: "Choose your move?", // placeholder of the text input
                required: true,
                options: [
                  { label: "Rock", value: "R" },
                  { label: "Paper", value: "P" },
                  { label: "Scissors", value: "S" },
                ],
              },
            ]
          }
        ]
      }
    };
  }
  else {
    payload = {
      title: "Double or Nothing: Rock Paper Scissors",
      icon: "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/icon.gif",
      description:
        "",
      label: "Rock Paper Scissors",
      "links": {
        "actions": [
          {
            "label": "Play!", // button text
            "href": `/api/actions/backend?amount={amount}&choice={choice}&player=${"B"}`,
            "parameters": [
              {
                type: "select",
                name: "amount", // parameter name in the `href` above
                label: "Bet Amount in SOL", // placeholder of the text input
                required: true,
                options: [
                  { label: "0.1 SOL", value: "0.1" },
                  { label: "0.01 SOL", value: "0.01" },
                  { label: "0.005 SOL", value: "0.005" },
                ],
              },
              {
                type: "radio",
                name: "choice", // parameter name in the `href` above
                label: "Choose your move?", // placeholder of the text input
                required: true,
                options: [
                  { label: "Rock", value: "R" },
                  { label: "Paper", value: "P" },
                  { label: "Scissors", value: "S" },
                ],
              },
              // {
              //   type: "radio",
              //   name: "player", // parameter name in the `href` above
              //   label: "Who would you like to play against?", // placeholder of the text input
              //   required: true,
              //   options: [
              //     { label: "Our bot", value: "B" },
              //     { label: "Friend", value: "F" },
              //     { label: "Host your own bot and ask others to play (10% fees cut of total value in each play)", value: "H" },
              //   ],
              // },
            ],
            type: "transaction"
          }
        ]
      }
    };
  }

  return Response.json(payload, {
    headers,
  });
};

export const OPTIONS = GET;