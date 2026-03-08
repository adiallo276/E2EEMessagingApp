# Post-Quantum Cryptography Messaging Application

A real-time end-to-end encrypted messaging application implementing and benchmarking post-quantum cryptographic algorithms.

## Overview

This Final Year Project demonstrates the practical integration of post-quantum Key Encapsulation Mechanisms (KEMs) into a web-based messaging application. The system implements three PQC algorithms—Mini-Kyber, Mini-Frodo, and Mini-NTRU—alongside traditional ECDH for performance comparison.

**Key Features:**
- True end-to-end encryption (all cryptography client-side)
- User-selectable encryption algorithms
- Comprehensive benchmarking infrastructure
- OpenAI ChatGPT integration with PQC encryption
- Voice message support with E2EE

## Project Structure

```
FYP/
├── backend/                 # Spring Boot backend
│   └── src/main/java/com/messaging/backend/
│       ├── algorithms/      # Java PQC implementations
│       ├── config/          # Security, WebSocket config
│       ├── controller/      # REST & WebSocket controllers
│       └── service/         # Business logic
├── frontend/                # Next.js frontend
│   └── lib/crypto/          # TypeScript PQC implementations
│       ├── mini-kyber.ts    # Ring-LWE based KEM
│       ├── mini-frodo.ts    # Standard LWE based KEM
│       ├── mini-ntru.ts     # NTRU lattice KEM
│       ├── ecdh.ts          # Traditional ECDH (baseline)
│       ├── aes.ts           # AES-GCM encryption
│       └── benchmark.ts     # Performance testing
├── algorithms/              # Standalone Java implementations
│   ├── miniKyber/
│   ├── miniFrodo/
│   └── miniNTRU/
└── Report/                  # LaTeX report
```

## Technology Stack

### Backend
- **Java 21** with **Spring Boot 3.2**
- Spring Security with JWT authentication
- Spring WebSocket with STOMP protocol
- Spring Data JPA with H2 in-memory database
- Bouncy Castle for cryptographic primitives

### Frontend
- **Next.js 14** with **TypeScript**
- React 18 with Tailwind CSS
- shadcn/ui component library
- WebCrypto API for AES-GCM and ECDH
- SockJS for WebSocket compatibility

### Why These Technologies?

**Java/Spring Boot**: Mature ecosystem with production-ready security frameworks, strong typing for cryptographic safety, and excellent WebSocket support.

**Next.js/TypeScript**: Type safety essential for correct handling of `Uint8Array`, polynomial coefficients, and matrix operations. Native WebCrypto API access enables hardware-accelerated AES-GCM.

## Prerequisites

- Java 21 or later
- Node.js 18 or later
- npm or yarn

## Running the Application

### Backend

```bash
cd backend

# Using Maven wrapper
./mvnw spring-boot:run

# Or with Maven installed
mvn spring-boot:run
```

The backend starts on `http://localhost:8080`

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build && npm start
```

The frontend starts on `http://localhost:3000`

### Environment Variables

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
OPENAI_API_KEY=your_openai_api_key  # Optional, for AI chat
```

## Running the Standalone Algorithms

The `/algorithms` directory contains standalone Maven modules for each PQC implementation:

```bash
cd algorithms

# Build all modules
mvn clean install

# Run individual tests
cd miniKyber && mvn exec:java -Dexec.mainClass="miniKyber.MiniKyberTest"
cd miniFrodo && mvn exec:java -Dexec.mainClass="miniFrodo.MiniFrodoTest"
cd miniNTRU && mvn exec:java -Dexec.mainClass="miniNTRU.MiniNTRUTest"
```

## Benchmarking

### In-App Benchmarking

1. Navigate to the Benchmarks page in the application
2. Configure parameters:
   - **Iterations**: 100–5,000 (higher = more accurate)
   - **Sessions**: Number of simulated messaging sessions
   - **Message size**: 1KB–500KB
3. Run KEM benchmark or Session Throughput benchmark
4. Export results to CSV for analysis

### Quick Performance Test

```typescript
// In browser console on the app
import { runKEMBenchmark } from './lib/crypto/benchmark';
const results = await runKEMBenchmark(1000); // 1000 iterations
console.table(results);
```

## Algorithm Implementations

### Mini-Kyber (Ring-LWE)
- Ring: ℤq[x]/(x^n + 1) with n=256, q=3329
- Operations: Polynomial multiplication via schoolbook method
- Security: Based on Ring-LWE problem

### Mini-Frodo (Standard LWE)
- Matrix-based with reduced dimensions (n=4, q=257)
- Operations: Matrix-vector multiplication
- Security: Based on plain LWE problem (conservative)

### Mini-NTRU
- Ring: ℤ[x]/(x^N - 1) with N=7, q=128
- Operations: Cyclic convolution
- Security: Based on NTRU lattice problem

**Note**: These are educational implementations with reduced parameters. Production systems should use standardized libraries like liboqs.

## E2EE Protocol

The application uses a three-phase handshake:

1. **E2EE_HELLO**: Initiator generates KEM keypair, sends public key
2. **E2EE_KEY**: Responder encapsulates shared secret, sends ciphertext
3. **E2EE_MSG**: Both derive AES-256-GCM key via HKDF, encrypt messages

All cryptographic operations occur client-side. The server only sees ciphertexts.

## API Endpoints

### REST
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - JWT authentication
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation

### WebSocket (STOMP)
- `/app/chat.send` - Send encrypted message
- `/topic/messages/{conversationId}` - Subscribe to messages
- `/app/e2ee.hello` - Initiate key exchange
- `/app/e2ee.key` - Complete key exchange

## Benchmark Results Summary

Tested on MacBook Pro M2, 16GB RAM, Safari:

| Algorithm | Total KEM | Key Gen | Session Time |
|-----------|-----------|---------|--------------|
| Mini-Kyber | 174.20 μs | 3.40 μs | 730.81 ms |
| Mini-Frodo | 179.60 μs | 11.60 μs | 741.14 ms |
| Mini-NTRU | 287.00 μs | 7.00 μs | 740.52 ms |
| ECDH | — | — | 739.84 ms |

**Key Finding**: All PQC algorithms perform within 1.2% of traditional ECDH, with Kyber actually 1.2% faster.

## Known Limitations

- Mini implementations use reduced security parameters (educational only)
- No constant-time guarantees in JavaScript
- Single-platform benchmarks (Safari/M2)
- No formal security verification

## Future Work

- Hybrid classical/PQC mode
- WebAssembly compilation of production libraries
- Group messaging support
- Formal verification of implementations

## License

This project was developed as a Final Year Project at [University Name].

## Author

Abdoulahi Diallo  
Supervised by: Pieter Joubert  
2025-2026
