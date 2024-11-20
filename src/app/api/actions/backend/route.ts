import {
    ActionPostResponse,
    createActionHeaders,
    createPostResponse,
    ActionPostRequest,
    MEMO_PROGRAM_ID,
  } from "@solana/actions";
  
  import { 
    clusterApiUrl,
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction
  } from "@solana/web3.js";
  
import bs58 from "bs58";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

const headers = createActionHeaders({
    chainId: "devnet", // or chainId: "devnet"
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
    
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  // __________________________________________________________
  let db = await getDoc(doc(firestore, "rps", "moneyPool"));
  let moneyPool = 0;
  if(db.exists()) moneyPool = Number(db.data().value);


export const POST = async (req: Request) => {
  try {
    // Extract the query parameters from the URL
    const url = new URL(req.url);
    const amount = url.searchParams.get("amount");
    const choice = url.searchParams.get("choice");
    const player = url.searchParams.get("player");
    // Ensure the required parameters are present
    if (!amount || !choice || !player) {
      return new Response('Missing "amount" or "choice" in request', {
        status: 400,
        headers,
      });
    }
    const body: ActionPostRequest = await req.json();
    // Validate to confirm the user publickey received is valid before use
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      return new Response('Invalid "account" provided', {
        status: 400,
        headers, //Must include CORS HEADERS
      });
    }
    const transaction = new Transaction();
    const sender = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_SENDER_SECRET!));
    function formatChoice(choice: string): string {
      switch (choice) {
        case "R":
          return "rock";
        case "S":
          return "scissors";
        case "P":
          return "paper";
        default:
          return choice;
      }
    }
    let image: string = "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/icon.gif";
    let title: string = "Rock Paper Scissors";
    let description: string = "Let's play Rock Paper Scissors! If you win you get DOUBLE your betted SOL, if it's a tie you get your betted SOL back, and if you lose you lose your betted SOL.";
    let winAmount:Number = 0;
  if (player === "B") {
    // Solana Blockchain Cluster (Set Mainnet "mainnet-beta" or Devnet "devnet")
    // If your RPC not present, it will use default devnet RPC provided to us via web3.js "clusterApiUrl("devnet")"
    // NOTE: "clusterApiUrl("devnet")" is not for mainnet use - for mainnet production launched Blinks, get your own RPC
    // For testing on mainnet - use "mainnet-beta"
    const connection = new Connection(
      clusterApiUrl("devnet")
    );
    transaction.add(
      // note: `createPostResponse` requires at least 1 non-memo instruction
    //   ComputeBudgetProgram.setComputeUnitPrice({
    //     microLamports: 1000,
    //   }),
      new TransactionInstruction({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(
          `User chose ${choice} with bet ${amount} SOL`,
          "utf8"
        ),
        keys: [{ pubkey: sender.publicKey, isSigner: true, isWritable: false }],
      })
    );
    // ensure the receiving account will be rent exempt
    const minimumBalance = await connection.getMinimumBalanceForRentExemption(
        0, // note: simple accounts that just store native SOL have `0` bytes of data
      );
      if (Number(amount) * LAMPORTS_PER_SOL < minimumBalance) {
        throw `account may not be rent exempt.`;
      }
    transaction.add(SystemProgram.transfer({
        fromPubkey: account,
        toPubkey: sender.publicKey,
        lamports: Number(amount)*LAMPORTS_PER_SOL,
        }));

    // set the end user as the fee payer
    transaction.feePayer = account;

    // Get the latest Block Hash
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;

    let outcome: "win" | "lose" | "draw";
    const poolThreshold = 0.2 * moneyPool;
    if (moneyPool - (2 * Number(amount)) < poolThreshold) {
        // If profit condition is not met, declare as loss
        outcome = "lose";
    }
    else{
        // Determine game outcome based on 3:2:1 ratio of win:lose:draw
        const random = Math.floor(Math.random() * 6); // Generates 0 to 5
        if (random < 3) outcome = "win";
        else if (random < 5) outcome = "lose";
        else outcome = "draw";
    }

    if(outcome === "lose"){
        moneyPool += Number(amount);
        await setDoc(doc(firestore, "rps", "moneyPool"), { value: moneyPool });
    }
    // Set CPU's choice based on user's choice and the decided outcome
    let cpuChoice: string;
    if (outcome === "win") {
      cpuChoice = choice === "R" ? "S" : choice === "P" ? "R" : "P"; // Win scenario
    } else if (outcome === "lose") {
      cpuChoice = choice === "R" ? "P" : choice === "P" ? "S" : "R"; // Lose scenario
    } else {
      cpuChoice = choice; // Draw scenario
    }

    if (outcome === "win") {
        if (choice === "R") image = "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/RW.png";
        else if (choice === "P") image = "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/PW.png";
        else if (choice === "S") image = "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/SW.png";
        title = "You Won!";
        winAmount = Number(amount) * 2;
        description = `Congratulations! You chose ${formatChoice(choice)} and the CPU chose ${formatChoice(cpuChoice)}. You won ${winAmount} SOL! Claim your prize by clicking the button below now.`;
    }
    else if (outcome === "lose") {
        if (choice === "R") image = "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/RL.png";
        else if (choice === "P") image = "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/PL.png";
        else if (choice === "S") image = "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/SL.png";
        title = "You Lost!";
        winAmount = 0;
        description = `Unlucky! You chose ${formatChoice(choice)} and the CPU chose ${formatChoice(cpuChoice)}. You lost ${amount} SOL. Try your luck again!`;
    }
    else {
        if (choice === "R") image = "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/RD.png";
        else if (choice === "P") image = "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/PD.png";
        else if (choice === "S") image = "https://raw.githubusercontent.com/The-x-35/rps-solana-blinks/refs/heads/main/public/SD.png";
        title = "It's a Draw!";
        winAmount = Number(amount);
        description = `It's a draw! You chose ${formatChoice(choice)} and the CPU chose ${formatChoice(cpuChoice)}. You get your bet of ${amount} SOL back. Play again!`;
    }
  }
else{
  const connection = new Connection(
    clusterApiUrl("devnet")
  );
  transaction.add(
    // note: `createPostResponse` requires at least 1 non-memo instruction
  //   ComputeBudgetProgram.setComputeUnitPrice({
  //     microLamports: 1000,
  //   }),
    new TransactionInstruction({
      programId: new PublicKey(MEMO_PROGRAM_ID),
      data: Buffer.from(
        `User chose ${choice} with bet ${amount} SOL`,
        "utf8"
      ),
      keys: [{ pubkey: sender.publicKey, isSigner: true, isWritable: false }],
    })
  );
  // ensure the receiving account will be rent exempt
  const minimumBalance = await connection.getMinimumBalanceForRentExemption(
      0, // note: simple accounts that just store native SOL have `0` bytes of data
    );
    if (Number(amount) * LAMPORTS_PER_SOL < minimumBalance) {
      throw `account may not be rent exempt.`;
    }
  transaction.add(SystemProgram.transfer({
      fromPubkey: account,
      toPubkey: sender.publicKey,
      lamports: Number(amount)*LAMPORTS_PER_SOL,
      }));

  // set the end user as the fee payer
  transaction.feePayer = account;

  // Get the latest Block Hash
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;

  await setDoc(doc(firestore, "players", account.toString()), { choice: choice, amount: amount});
  winAmount = 0.001;

}

    const payload: ActionPostResponse = (player === "B")? await createPostResponse({
        fields: {
          type: "transaction",
          transaction,
          message: `Your choice was ${formatChoice(choice)} with a bet of ${amount} SOL.`,
          links: {
            next: {
                type: "inline",
                action: {
                    type: "action",
                    title: `${title}`,
                    icon: new URL(`${image}`,new URL(req.url).origin).toString(),
                    description: `${description}`,
                    label: "Rock Paper Scissors",
                    "links": {
                    "actions": winAmount!=0?[
                        {
                        "label": "Claim Prize", // button text
                        "href": `/api/actions/result?amount=${winAmount}`,
                        type: "transaction"
                        }
                    ]:[]
                    }
                },
            },
          },
        },
        // no additional signers are required for this transaction
        signers: [sender],
      }): await createPostResponse({
        fields: {
          type: "transaction",
          transaction,
          message: `Your choice was ${formatChoice(choice)} with a bet of ${amount} SOL against a friend`,
          links: {
            next: {
                type: "inline",
                action: {
                    type: "action",
                    title: `${title}`,
                    icon: new URL(`${image}`,new URL(req.url).origin).toString(),
                    description: `${description}`,
                    label: "Rock Paper Scissors",
                    "links": {
                    "actions": winAmount!=0?[
                        {
                        "label": "Claim Prize", // button text
                        "href": `/api/actions/result?amount=${winAmount}`,
                        type: "transaction"
                        }
                    ]:[]
                    }
                },
            },
          },
        },
        // no additional signers are required for this transaction
        signers: [sender],
      })



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