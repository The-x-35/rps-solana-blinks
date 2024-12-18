import {
  ActionPostResponse,
  createActionHeaders,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
  MEMO_PROGRAM_ID,
} from "@solana/actions";

import {
  clusterApiUrl,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";

import bs58 from "bs58";
import { getApps, initializeApp, getApp } from "firebase/app";
import { getDoc, doc, getFirestore, setDoc, deleteDoc } from "firebase/firestore";

const headers = createActionHeaders({
  chainId: "mainnet", // or chainId: "devnet"
  actionVersion: "2.2.1", // the desired spec version
});


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
const app = !getApps.length ? initializeApp(firebaseConfig) : getApp();

const firestore = getFirestore(app);

let mp = await getDoc(doc(firestore, "rps", "moneyPool"));
let c = await getDoc(doc(firestore, "rps", "current"));


export const POST = async (req: Request) => {
  try {
    let moneyPool = 0;
    if (mp.exists()) moneyPool = Number(mp.data().value);
    moneyPool = parseFloat(moneyPool.toFixed(4));
    let current = 0;
    if (c.exists()) current = Number(c.data().value);
    current = parseFloat(current.toFixed(4));
    // Extract the query parameters from the URL
    const url = new URL(req.url);
    const amount = url.searchParams.get("amount");
    const outcome = url.searchParams.get("outcome");

    // Ensure the required parameters are present
    if (!amount) {
      return new Response('Missing "amount" in request', {
        status: 400,
        headers,
      });
    }
    const body: ActionPostRequest = await req.json();
    // Validate to confirm the user publickey received is valid before use


    current -= Number(amount);
    await setDoc(doc(firestore, "rps", "current"), { value: current });


    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      return new Response('Invalid "account" provided', {
        status: 400,
        headers, //Must include CORS HEADERS
      });
    }
    // let p = await getDoc(doc(firestore, "players", account.toString()));
    // let amountDb = 0;
    // if (p.exists()) amountDb = Number(p.data().amount);
    // else {
    //   return new Response('Player not found in database', {
    //     status: 400,
    //     headers, //Must include CORS HEADERS
    //   });
    // }
  //  amountDb = parseFloat(amountDb.toFixed(4));
  //   if (amountDb != Number(amount)) {
  //     return new Response('Amount did not match DB.', {
  //       status: 400,
  //       headers, //Must include CORS HEADERS
  //     });
  //   }
  //   await deleteDoc(doc(firestore, "players", account?.toString()));
    // Solana Blockchain Cluster (Set Mainnet "mainnet-beta" or Devnet "devnet")
    // If your RPC not present, it will use default devnet RPC provided to us via web3.js "clusterApiUrl("devnet")"
    // NOTE: "clusterApiUrl("devnet")" is not for mainnet use - for mainnet production launched Blinks, get your own RPC
    // For testing on mainnet - use "mainnet-beta"
    const connection = new Connection(
      clusterApiUrl("mainnet-beta")
    );
    const web3 = require("@solana/web3.js");
    const sender = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_SENDER_SECRET!));

    const transaction = new Transaction().add(
      // note: `createPostResponse` requires at least 1 non-memo instruction
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000,
      }),
      new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(
          `User won ${amount} SOL`,
          "utf8"
        ),
        keys: [],
      })
    );
    transaction.add(web3.SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: account,
      lamports: Number(amount) * LAMPORTS_PER_SOL,
    }));
    // set the end user as the fee payer
    transaction.feePayer = account;

    // Get the latest Block Hash
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;

    // const nacl = require("tweetnacl");
    // let transaction = new web3.Transaction();
    // transaction.add(
    //     web3.SystemProgram.transfer({
    //       fromPubkey: sender.publickey,
    //       toPubkey: account,
    //       lamports: 1*LAMPORTS_PER_SOL,
    //     }),
    //   );
    //   await web3.sendAndConfirmTransaction(connection, transaction, [sender]);
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        message: `${amount} SOL sent to your account, Play again!`,
      },
      // no additional signers are required for this transaction
      signers: [sender],
    });


    return Response.json(payload, {
      headers,
    });
  } catch (err) {
    console.log(err);
    const message = typeof err === "string" ? err : err?.toString() || "An unknown error occurred";
    return new Response(JSON.stringify({ message }), {
      status: 400,
      headers,
    });
  }

};