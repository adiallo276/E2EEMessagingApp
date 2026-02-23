"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  miniNtruKeyGen,
  miniNtruEncapsulate,
  miniNtruDecapsulate,
  MiniNtruKeyPair,
  MiniNtruCiphertext,
} from "@/lib/crypto/minintru";
import {
  miniKyberKeyGen,
  miniKyberEncapsulate,
  miniKyberDecapsulate,
} from "@/lib/crypto/minikyber";
import {
  miniFrodoKeyGen,
  miniFrodoEncapsulate,
  miniFrodoDecapsulate,
} from "@/lib/crypto/minifrodo";

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

export default function TestCryptoPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const log = (msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev, msg]);
  };

  const clearLogs = () => setLogs([]);

  const testNTRU = async () => {
    setTesting(true);
    clearLogs();
    
    try {
      log("=== NTRU KEM Test (Basic) ===");
      log("");
      
      // Step 1: Key Generation (User A)
      log("1. User A generates keypair...");
      const kp = await miniNtruKeyGen();
      log(`   pk.h = [${kp.pk.h.join(", ")}]`);
      log(`   sk.f = [${kp.sk.f.join(", ")}]`);
      log("");
      
      // Step 2: Simulate sending pk over network (JSON round-trip)
      log("2. Simulating network transmission of public key...");
      const pkJson = JSON.stringify(kp.pk);
      log(`   JSON: ${pkJson.substring(0, 100)}...`);
      const pkParsed = JSON.parse(pkJson);
      log(`   Parsed pk.h = [${pkParsed.h.join(", ")}]`);
      log(`   pk.h matches: ${JSON.stringify(kp.pk.h) === JSON.stringify(pkParsed.h)}`);
      log("");
      
      // Step 3: Encapsulation (User B)
      log("3. User B encapsulates with received public key...");
      const { ct, sharedSecret: ss1 } = await miniNtruEncapsulate(pkParsed);
      log(`   ct.c = [${ct.c.join(", ")}]`);
      log(`   ct.encSeed = ${ct.encSeed.substring(0, 30)}...`);
      log(`   sharedSecret1 = ${bytesToB64(ss1).substring(0, 30)}...`);
      log("");
      
      // Step 4: Simulate sending ct over network (JSON round-trip)
      log("4. Simulating network transmission of ciphertext...");
      const ctJson = JSON.stringify(ct);
      log(`   JSON: ${ctJson.substring(0, 100)}...`);
      const ctParsed = JSON.parse(ctJson);
      log(`   Parsed ct.c = [${ctParsed.c.join(", ")}]`);
      log(`   Parsed ct.encSeed = ${ctParsed.encSeed.substring(0, 30)}...`);
      log(`   ct.c matches: ${JSON.stringify(ct.c) === JSON.stringify(ctParsed.c)}`);
      log(`   ct.encSeed matches: ${ct.encSeed === ctParsed.encSeed}`);
      log("");
      
      // Step 5: Decapsulation (User A)
      log("5. User A decapsulates with secret key...");
      const ss2 = await miniNtruDecapsulate(kp.sk, ctParsed);
      log(`   sharedSecret2 = ${bytesToB64(ss2).substring(0, 30)}...`);
      log("");
      
      // Step 6: Verify shared secrets match
      const ss1B64 = bytesToB64(ss1);
      const ss2B64 = bytesToB64(ss2);
      const match = ss1B64 === ss2B64;
      log("6. Verification:");
      log(`   SS1: ${ss1B64}`);
      log(`   SS2: ${ss2B64}`);
      log(`   MATCH: ${match ? "✅ YES" : "❌ NO"}`);
      log("");
      
      if (!match) {
        log("❌ NTRU TEST FAILED - Shared secrets do not match!");
      } else {
        log("✅ NTRU TEST PASSED!");
      }
      
    } catch (err: any) {
      log(`❌ ERROR: ${err.message}`);
      console.error(err);
    } finally {
      setTesting(false);
    }
  };

  const testNTRUWithStorage = async () => {
    setTesting(true);
    clearLogs();
    
    try {
      log("=== NTRU KEM Test (With localStorage simulation) ===");
      log("This simulates the exact flow in the app");
      log("");
      
      // Clear any existing test keys
      localStorage.removeItem("test_ntru_kp");
      
      // Step 1: User A generates and stores keypair
      log("1. User A generates keypair and stores in localStorage...");
      const kpOriginal = await miniNtruKeyGen();
      localStorage.setItem("test_ntru_kp", JSON.stringify(kpOriginal));
      log(`   Stored keypair`);
      log("");
      
      // Step 2: User A sends HELLO (pk extracted from stored keypair)
      log("2. User A retrieves keypair and sends HELLO...");
      const kpFromStorage1 = JSON.parse(localStorage.getItem("test_ntru_kp")!) as MiniNtruKeyPair;
      const helloMessage = JSON.stringify({ type: "E2EE_HELLO", pk: kpFromStorage1.pk });
      log(`   HELLO message: ${helloMessage.substring(0, 80)}...`);
      log("");
      
      // Step 3: User B receives HELLO and extracts pk
      log("3. User B receives HELLO and extracts pk...");
      const helloParsed = JSON.parse(helloMessage);
      const pkFromHello = helloParsed.pk;
      log(`   Extracted pk.h: [${pkFromHello.h.join(", ")}]`);
      log("");
      
      // Step 4: User B encapsulates
      log("4. User B encapsulates with pk...");
      const { ct, sharedSecret: ss1 } = await miniNtruEncapsulate(pkFromHello);
      log(`   ct.c: [${ct.c.join(", ")}]`);
      log(`   ss1: ${bytesToB64(ss1)}`);
      log("");
      
      // Step 5: User B sends KEY message
      log("5. User B sends KEY message...");
      const keyMessage = JSON.stringify({ type: "E2EE_KEY", ct: ct });
      log(`   KEY message: ${keyMessage.substring(0, 100)}...`);
      log("");
      
      // Step 6: User A receives KEY and extracts ct
      log("6. User A receives KEY and extracts ct...");
      const keyParsed = JSON.parse(keyMessage);
      const ctFromKey = keyParsed.ct as MiniNtruCiphertext;
      log(`   Extracted ct.c: [${ctFromKey.c.join(", ")}]`);
      log(`   Extracted ct.encSeed: ${ctFromKey.encSeed}`);
      log("");
      
      // Step 7: User A retrieves keypair from storage AGAIN and decapsulates
      log("7. User A retrieves keypair from localStorage and decapsulates...");
      const kpFromStorage2 = JSON.parse(localStorage.getItem("test_ntru_kp")!) as MiniNtruKeyPair;
      log(`   Retrieved sk.f: [${kpFromStorage2.sk.f.join(", ")}]`);
      
      const ss2 = await miniNtruDecapsulate(kpFromStorage2.sk, ctFromKey);
      log(`   ss2: ${bytesToB64(ss2)}`);
      log("");
      
      // Step 8: Verify
      const ss1B64 = bytesToB64(ss1);
      const ss2B64 = bytesToB64(ss2);
      const match = ss1B64 === ss2B64;
      log("8. Verification:");
      log(`   SS1 (User B): ${ss1B64}`);
      log(`   SS2 (User A): ${ss2B64}`);
      log(`   MATCH: ${match ? "✅ YES" : "❌ NO"}`);
      log("");
      
      if (!match) {
        log("❌ NTRU STORAGE TEST FAILED!");
        
        // Debug: check if arrays are same
        log("");
        log("Debug info:");
        log(`   Original sk.f: [${kpOriginal.sk.f.join(", ")}]`);
        log(`   Storage1 sk.f: [${kpFromStorage1.sk.f.join(", ")}]`);
        log(`   Storage2 sk.f: [${kpFromStorage2.sk.f.join(", ")}]`);
        log(`   Original pk.h: [${kpOriginal.pk.h.join(", ")}]`);
        log(`   Hello pk.h:    [${pkFromHello.h.join(", ")}]`);
        log(`   ct.c original: [${ct.c.join(", ")}]`);
        log(`   ct.c from KEY: [${ctFromKey.c.join(", ")}]`);
      } else {
        log("✅ NTRU STORAGE TEST PASSED!");
      }
      
      // Cleanup
      localStorage.removeItem("test_ntru_kp");
      
    } catch (err: any) {
      log(`❌ ERROR: ${err.message}`);
      console.error(err);
    } finally {
      setTesting(false);
    }
  };

  const testKyber = async () => {
    setTesting(true);
    clearLogs();
    
    try {
      log("=== Kyber KEM Test ===");
      log("");
      
      const kp = await miniKyberKeyGen();
      log("1. KeyGen done");
      
      const pkJson = JSON.stringify(kp.pk);
      const pkParsed = JSON.parse(pkJson);
      log("2. PK JSON round-trip done");
      
      const { ct, sharedSecret: ss1 } = await miniKyberEncapsulate(pkParsed);
      log(`3. Encap done, SS1: ${bytesToB64(ss1).substring(0, 30)}...`);
      
      const ctJson = JSON.stringify(ct);
      const ctParsed = JSON.parse(ctJson);
      log("4. CT JSON round-trip done");
      
      const ss2 = await miniKyberDecapsulate(kp.sk, ctParsed);
      log(`5. Decap done, SS2: ${bytesToB64(ss2).substring(0, 30)}...`);
      
      const match = bytesToB64(ss1) === bytesToB64(ss2);
      log(`6. MATCH: ${match ? "✅ YES" : "❌ NO"}`);
      
    } catch (err: any) {
      log(`❌ ERROR: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const testFrodo = async () => {
    setTesting(true);
    clearLogs();
    
    try {
      log("=== Frodo KEM Test ===");
      log("");
      
      const kp = await miniFrodoKeyGen();
      log("1. KeyGen done");
      
      const pkJson = JSON.stringify(kp.pk);
      const pkParsed = JSON.parse(pkJson);
      log("2. PK JSON round-trip done");
      
      const { ct, sharedSecret: ss1 } = await miniFrodoEncapsulate(pkParsed);
      log(`3. Encap done, SS1: ${bytesToB64(ss1).substring(0, 30)}...`);
      
      const ctJson = JSON.stringify(ct);
      const ctParsed = JSON.parse(ctJson);
      log("4. CT JSON round-trip done");
      
      const ss2 = await miniFrodoDecapsulate(kp.sk, ctParsed);
      log(`5. Decap done, SS2: ${bytesToB64(ss2).substring(0, 30)}...`);
      
      const match = bytesToB64(ss1) === bytesToB64(ss2);
      log(`6. MATCH: ${match ? "✅ YES" : "❌ NO"}`);
      
    } catch (err: any) {
      log(`❌ ERROR: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Crypto Algorithm Test</h1>
        
        <div className="flex flex-wrap gap-4 mb-6">
          <Button onClick={testKyber} disabled={testing}>
            Test Kyber
          </Button>
          <Button onClick={testFrodo} disabled={testing}>
            Test Frodo
          </Button>
          <Button onClick={testNTRU} disabled={testing}>
            Test NTRU (Basic)
          </Button>
          <Button onClick={testNTRUWithStorage} disabled={testing} variant="secondary">
            Test NTRU (Full Flow)
          </Button>
          <Button onClick={clearLogs} variant="ghost">
            Clear
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          The "Full Flow" test simulates exactly what happens in the app: keypair stored in localStorage, 
          messages serialized as JSON, etc.
        </p>
        
        <div className="bg-zinc-900 text-green-400 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap max-h-[600px] overflow-auto">
          {logs.length === 0 ? (
            <span className="text-zinc-500">Click a test button to start...</span>
          ) : (
            logs.map((line, i) => <div key={i}>{line}</div>)
          )}
        </div>
      </div>
    </main>
  );
}
