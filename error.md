chakra@chakras-MacBook-Air fashion-shoot-agent % cd /Users/chakra/Documents/Agents/fashion-shoot-agent/cloudflare && npx wrangler tail --format pretty  

 ⛅️ wrangler 4.59.1 (update available 4.59.2)
─────────────────────────────────────────────
Successfully created tail, expires at 2026-01-16T07:57:56Z
Connected to fashion-shoot-agent, waiting for logs...
POST https://fashion-shoot-agent.alphasapien17.workers.dev/api/upload - Ok @ 1/16/2026, 7:39:58 AM
  (log) Uploaded: Affordable Winter Outfits That Look Expensive” Shop Now On Amazon.jpeg -> uploads/1768529398813-eoc5q5z.jpeg
GET https://fashion-shoot-agent.alphasapien17.workers.dev/uploads/1768529398813-eoc5q5z.jpeg - Ok @ 1/16/2026, 7:39:59 AM
Sandbox. - Ok @ 1/16/2026, 7:40:13 AM
Sandbox.exec - Ok @ 1/16/2026, 7:40:13 AM
  (debug) Error checking 3000: The container is not listening in the TCP address 10.0.0.1:3000
Sandbox.mountBucket - Ok @ 1/16/2026, 7:40:16 AM
  (log) {"level":"info","msg":"Mounting bucket fashion-shoot-storage to /storage/uploads","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","timestamp":"2026-01-16T02:10:16.260Z"}
  (log) {"level":"info","msg":"File written","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"/tmp/.passwd-s3fs-bf9e3f3d-6995-446d-86ce-3acd7c12db83 (119 chars)","timestamp":"2026-01-16T02:10:16.389Z"}
  (log) {"level":"info","msg":"Command executed","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"chmod 0600 '/tmp/.passwd-s3fs-bf9e3f3d-6995-446d-86ce-3acd7c12db83', Success: true","timestamp":"2026-01-16T02:10:16.471Z"}
  (log) {"level":"info","msg":"Command executed","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"mkdir -p '/storage/uploads', Success: true","timestamp":"2026-01-16T02:10:16.553Z"}
  (log) {"level":"info","msg":"Command executed","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"s3fs 'fashion-shoot-storage:/uploads' '/storage/uploads' -o 'passwd_file=/tmp/.passwd-s3fs-bf9e3f3d-6995-446d-86ce-3acd7c12db83,nomixupload,url=https://091650847ca6a1d9bb40bee044dfdc91.r2.cloudflarestorage.com', Success: true","timestamp":"2026-01-16T02:10:16.777Z"}
  (log) {"level":"info","msg":"Successfully mounted bucket fashion-shoot-storage to /storage/uploads","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","timestamp":"2026-01-16T02:10:16.777Z"}
Sandbox.mountBucket - Ok @ 1/16/2026, 7:40:16 AM
  (log) {"level":"info","msg":"Mounting bucket fashion-shoot-storage to /workspace/agent/outputs","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","timestamp":"2026-01-16T02:10:16.779Z"}
  (log) {"level":"info","msg":"File written","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"/tmp/.passwd-s3fs-f33ee42e-225b-4152-8436-6f3a4022d39b (119 chars)","timestamp":"2026-01-16T02:10:16.872Z"}
  (log) {"level":"info","msg":"Command executed","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"chmod 0600 '/tmp/.passwd-s3fs-f33ee42e-225b-4152-8436-6f3a4022d39b', Success: true","timestamp":"2026-01-16T02:10:16.955Z"}
  (log) {"level":"info","msg":"Command executed","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"mkdir -p '/workspace/agent/outputs', Success: true","timestamp":"2026-01-16T02:10:17.036Z"}
  (log) {"level":"info","msg":"Command executed","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"s3fs 'fashion-shoot-storage:/outputs/session_1768529412806_67wa91w' '/workspace/agent/outputs' -o 'passwd_file=/tmp/.passwd-s3fs-f33ee42e-225b-4152-8436-6f3a4022d39b,nomixupload,url=https://091650847ca6a1d9bb40bee044dfdc91.r2.cloudflarestorage.com', Success: true","timestamp":"2026-01-16T02:10:17.159Z"}
  (log) {"level":"info","msg":"Successfully mounted bucket fashion-shoot-storage to /workspace/agent/outputs","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","timestamp":"2026-01-16T02:10:17.159Z"}
Sandbox.exec - Ok @ 1/16/2026, 7:40:17 AM
  (log) {"level":"info","msg":"Command executed","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"mkdir -p /workspace/agent/outputs/{frames,videos,final}, Success: true","timestamp":"2026-01-16T02:10:22.590Z"}
GET https://fashion-shoot-agent.alphasapien17.workers.dev/outputs/session_1768529412806_67wa91w/hero.png?t=1768529509646 - Ok @ 1/16/2026, 7:41:49 AM
POST https://fashion-shoot-agent.alphasapien17.workers.dev/api/generate-stream - Ok @ 1/16/2026, 7:40:12 AM
  (log) [session] Creating session exec-session_1768529412806_67wa91w
  (log) [container] Agent started
  (log) [agent] [agent] Starting session: session_1768529412806_67wa91w

  (log) [agent] [agent] Pipeline stage: init

  (log) [agent] [agent] Continue mode: false

  (log) [agent] [agent] Prompt: create a highend fashion shoot

GET https://fashion-shoot-agent.alphasapien17.workers.dev/outputs/session_1768529412806_67wa91w/hero.png?t=1768529542342 - Ok @ 1/16/2026, 7:42:22 AM
Sandbox.createSession - Canceled @ 1/16/2026, 7:40:22 AM
  (log) {"level":"info","msg":"Session created","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"ID: exec-session_1768529412806_67wa91w","timestamp":"2026-01-16T02:10:22.668Z"}
  (log) {"level":"info","msg":"Command stream started","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"npx tsx /workspace/agent-runner.ts","timestamp":"2026-01-16T02:10:22.805Z"}
Sandbox.setSandboxName - Ok @ 1/16/2026, 7:40:22 AM
Sandbox.exec - Ok @ 1/16/2026, 7:42:49 AM
  (log) {"level":"info","msg":"Command executed","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"mkdir -p /storage/uploads /workspace/agent/outputs, Success: true","timestamp":"2026-01-16T02:12:49.692Z"}
Sandbox.mountBucket - Ok @ 1/16/2026, 7:42:49 AM
  (log) {"level":"info","msg":"Mounting bucket fashion-shoot-storage to /storage/uploads","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","timestamp":"2026-01-16T02:12:49.695Z"}
Sandbox.mountBucket - Ok @ 1/16/2026, 7:42:49 AM
  (log) {"level":"info","msg":"Mounting bucket fashion-shoot-storage to /workspace/agent/outputs","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","timestamp":"2026-01-16T02:12:49.699Z"}
Sandbox.exec - Ok @ 1/16/2026, 7:42:49 AM
  (log) {"level":"info","msg":"Command executed","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"mkdir -p /workspace/agent/outputs/{frames,videos,final}, Success: true","timestamp":"2026-01-16T02:12:49.786Z"}
Sandbox.createSession - Ok @ 1/16/2026, 7:42:49 AM
Alarm @ 1/16/2026, 7:40:15 AM - Ok
  (log) Port 3000 is ready
  (log) {"level":"info","msg":"Version retrieved","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"0.6.11","timestamp":"2026-01-16T02:10:16.131Z"}
  (log) {"level":"info","msg":"Session created","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"ID: sandbox-session_1768529412806_67wa91w","timestamp":"2026-01-16T02:10:16.134Z"}
  (log) {"level":"info","msg":"Command executed","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","details":"mkdir -p /storage/uploads /workspace/agent/outputs, Success: true","timestamp":"2026-01-16T02:10:16.257Z"}
Alarm @ 1/16/2026, 7:43:15 AM - Ok
  (error) {"level":"error","msg":"Sandbox error","component":"sandbox-do","sandboxId":"02d59c4e7a11d2b1050335307d3d7f0951e6bc682b8f01dca4de497de8b0f5d6","traceId":"tr_ddca846411914b7b","timestamp":"2026-01-16T02:13:50.113Z","error":{"message":"Runtime signalled the container to exit due to a new version rollout: 0","stack":"Error: Runtime signalled the container to exit due to a new version rollout: 0","name":"Error"}}
Alarm @ 1/16/2026, 7:43:15 AM - Exception Thrown
Alarm @ 1/16/2026, 7:43:50 AM - Ok
