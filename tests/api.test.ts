import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../server/app.js";
import { DEMO_PASSWORD } from "../server/auth.js";
import { day } from "../server/store.js";
import { calendarDay } from "../shared/calendar.js";

process.env.AUTH_BOOTSTRAP_PASSWORD = DEMO_PASSWORD;
process.env.AUTH_EXPOSE_CODES = "true";
process.env.SIMULATION_ENABLED = "false";

test("India calendar rolls over at midnight IST rather than midnight UTC", () => {
  assert.equal(calendarDay(new Date("2026-09-16T18:29:59Z")), "2026-09-16");
  assert.equal(calendarDay(new Date("2026-09-16T18:30:00Z")), "2026-09-17");
  assert.equal(calendarDay(new Date("2026-12-31T18:30:00Z")), "2027-01-01");
});

async function fixture(
  run: (agent: ReturnType<typeof request.agent>) => Promise<void>,
  seed = true,
) {
  const directory = mkdtempSync(join(tmpdir(), "claimchain-"));
  const { app, db, simulation } = createApp({ directory, seed });
  const agent = request.agent(app);
  try {
    await agent
      .post("/api/auth/login")
      .send({ identifier: "admin", password: DEMO_PASSWORD })
      .expect(200);
    await run(agent);
  } finally {
    simulation.stop();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test("a valid case persists across a database restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "claimchain-"));
  const first = createApp({ directory, seed: false });
  try {
    const firstAgent = request.agent(first.app);
    await firstAgent
      .post("/api/auth/login")
      .send({ identifier: "admin", password: DEMO_PASSWORD })
      .expect(200);
    const response = await firstAgent
      .post("/api/cases")
      .send({
        title: "September invoice",
        kind: "payment",
        counterparty: "Test Cafe",
        invoice: "INV-1",
        amount: 105099,
        dueDate: "2026-09-30",
        summary: "Delivered goods",
      })
      .expect(201);
    first.db.close();
    const second = createApp({ directory, seed: false });
    try {
      const secondAgent = request.agent(second.app);
      await secondAgent
        .post("/api/auth/login")
        .send({ identifier: "admin", password: DEMO_PASSWORD })
        .expect(200);
      const read = await secondAgent
        .get(`/api/cases/${response.body.id}`)
        .expect(200);
      assert.equal(read.body.amount, 105099);
      assert.equal(read.body.counterparty, "Test Cafe");
    } finally {
      second.db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("partial and full payments reconcile, replay safely and reject overpayment", () =>
  fixture(async (agent) => {
    const c = (
      await agent
        .post("/api/cases")
        .send({
          title: "Invoice test",
          kind: "payment",
          counterparty: "Cafe",
          amount: 10001,
          dueDate: day(),
          invoice: "INV-2",
        })
        .expect(201)
    ).body;
    const payment = {
      amount: 3000,
      date: day(),
      reference: "UTR-0001",
      key: "payment-test-key-1",
    };
    const first = await agent
      .post(`/api/cases/${c.id}/payments`)
      .send(payment)
      .expect(201);
    const replay = await agent
      .post(`/api/cases/${c.id}/payments`)
      .send(payment)
      .expect(201);
    assert.equal(replay.body.id, first.body.id);
    await agent
      .post(`/api/cases/${c.id}/payments`)
      .send({ ...payment, amount: 3001 })
      .expect(409);
    await agent
      .post(`/api/cases/${c.id}/payments`)
      .send({ ...payment, key: "different-key-same-ref" })
      .expect(409);
    await agent
      .post(`/api/cases/${c.id}/payments`)
      .send({
        ...payment,
        amount: 8000,
        key: "payment-test-key-2",
        reference: "UTR-0002",
      })
      .expect(409);
    await agent
      .patch(`/api/cases/${c.id}`)
      .send({ status: "resolved" })
      .expect(409);
    let current = (await agent.get(`/api/cases/${c.id}`).expect(200)).body;
    assert.equal(current.status, "in_progress");
    assert.equal(current.payments.length, 1);
    await agent
      .post(`/api/cases/${c.id}/payments`)
      .send({
        amount: 7001,
        date: day(),
        reference: "UTR-0003",
        key: "payment-test-key-3",
      })
      .expect(201);
    current = (await agent.get(`/api/cases/${c.id}`).expect(200)).body;
    assert.equal(current.status, "resolved");
    assert.equal(
      current.payments.reduce(
        (n: number, p: { amount: number }) => n + p.amount,
        0,
      ),
      10001,
    );
    await agent
      .patch(`/api/cases/${c.id}`)
      .send({ status: "open" })
      .expect(409);
  }));

test("stock reservation prevents overselling and credits a receipt once", () =>
  fixture(async (agent) => {
    const transfer = (
      await agent
        .post("/api/transfers")
        .send({ lotId: "lot-1", destination: "store-2", quantity: 40 })
        .expect(201)
    ).body;
    await agent
      .post("/api/transfers")
      .send({ lotId: "lot-1", destination: "store-3", quantity: 25 })
      .expect(409);
    await agent
      .post(`/api/transfers/${transfer.id}/transition`)
      .send({ status: "received" })
      .expect(409);
    await agent
      .post(`/api/transfers/${transfer.id}/transition`)
      .send({ status: "dispatched" })
      .expect(200);
    await agent
      .post(`/api/transfers/${transfer.id}/transition`)
      .send({ status: "cancelled" })
      .expect(409);
    await agent
      .post(`/api/transfers/${transfer.id}/transition`)
      .send({ status: "received" })
      .expect(200);
    await agent
      .post(`/api/transfers/${transfer.id}/transition`)
      .send({ status: "received" })
      .expect(409);
    const state = (await agent.get("/api/bootstrap")).body;
    const source = state.lots.find((l: { id: string }) => l.id === "lot-1");
    const target = state.lots.find(
      (l: { storeId: string; sku: string }) =>
        l.storeId === "store-2" && l.sku === "RICE-5KG",
    );
    assert.equal(source.quantity, 24);
    assert.equal(source.reserved, 0);
    assert.equal(target.quantity, 40);
  }));

test("canceling a reservation releases inventory and terminal transfers stay closed", () =>
  fixture(async (agent) => {
    await agent
      .post("/api/transfers")
      .send({ lotId: "lot-1", destination: "store-1", quantity: 2 })
      .expect(400);
    const t = (
      await agent
        .post("/api/transfers")
        .send({ lotId: "lot-1", destination: "store-2", quantity: 64 })
        .expect(201)
    ).body;
    await agent
      .post(`/api/transfers/${t.id}/transition`)
      .send({ status: "cancelled" })
      .expect(200);
    await agent
      .post(`/api/transfers/${t.id}/transition`)
      .send({ status: "dispatched" })
      .expect(409);
    const s = (await agent.get("/api/bootstrap")).body;
    assert.equal(
      s.lots.find((l: { id: string }) => l.id === "lot-1").reserved,
      0,
    );
    await agent
      .post("/api/transfers")
      .send({ lotId: "lot-1", destination: "store-3", quantity: 64 })
      .expect(201);
  }));

test("evidence keeps original bytes, deduplicates and validates files", () =>
  fixture(async (agent) => {
    const bytes = Buffer.from(
      "Invoice INV-001\nAmount INR 1000\nFictional test evidence.",
    );
    const one = await agent
      .post("/api/cases/case-1/evidence")
      .attach("file", bytes, {
        filename: "invoice.txt",
        contentType: "text/plain",
      })
      .expect(201);
    const two = await agent
      .post("/api/cases/case-1/evidence")
      .attach("file", bytes, {
        filename: "duplicate.txt",
        contentType: "text/plain",
      })
      .expect(201);
    assert.equal(one.body.id, two.body.id);
    assert.equal(one.body.digest.length, 64);
    assert.equal(one.body.text, bytes.toString());
    const downloaded = await agent
      .get(`/api/evidence/${one.body.id}/file`)
      .buffer(true)
      .expect(200);
    assert.equal(downloaded.text, bytes.toString());
    await agent
      .post("/api/cases/case-1/evidence")
      .attach("file", Buffer.from("not a PDF"), {
        filename: "bad.pdf",
        contentType: "application/pdf",
      })
      .expect(400);
    await agent
      .post("/api/cases/missing/evidence")
      .attach("file", bytes, {
        filename: "invoice.txt",
        contentType: "text/plain",
      })
      .expect(404);
    await agent
      .post("/api/cases/case-1/evidence")
      .attach("file", Buffer.alloc(10 * 1024 * 1024 + 1, 65), {
        filename: "large.txt",
        contentType: "text/plain",
      })
      .expect(413);
  }));

test("drafts are editable with revision protection and produce a PDF packet", () =>
  fixture(async (agent) => {
    const d = (
      await agent
        .post("/api/cases/case-1/documents")
        .send({ kind: "reminder" })
        .expect(201)
    ).body;
    assert.match(d.body, /33,500/);
    assert.match(d.body, /No delivery/);
    const saved = await agent
      .patch(`/api/documents/${d.id}`)
      .send({ body: d.body + "\nPlease confirm receipt.", revision: 1 })
      .expect(200);
    assert.equal(saved.body.revision, 2);
    await agent
      .patch(`/api/documents/${d.id}`)
      .send({ body: "Stale update", revision: 1 })
      .expect(409);
    const packet = await agent
      .get("/api/cases/case-1/packet")
      .buffer(true)
      .expect(200)
      .expect("Content-Type", /pdf/);
    assert.ok(packet.body.length > 1000);
    assert.equal(packet.body.subarray(0, 5).toString(), "%PDF-");
    await agent
      .get(`/api/documents/${d.id}/download`)
      .expect(200)
      .expect("Content-Type", /pdf/);
  }));

test("document recovery requirements gate resolution and allow reopening", () =>
  fixture(async (agent) => {
    await agent
      .patch("/api/cases/case-4")
      .send({ status: "resolved" })
      .expect(409);
    const c = (await agent.get("/api/cases/case-4")).body;
    for (const item of c.checklist)
      await agent
        .patch(`/api/checklist/${item.id}`)
        .send({ done: true })
        .expect(200);
    await agent
      .patch("/api/cases/case-4")
      .send({ status: "resolved" })
      .expect(200);
    await agent
      .patch(`/api/checklist/${c.checklist[0].id}`)
      .send({ done: false })
      .expect(409);
    await agent
      .patch("/api/cases/case-4")
      .send({ status: "in_progress" })
      .expect(200);
    await agent
      .patch(`/api/checklist/${c.checklist[0].id}`)
      .send({ done: false })
      .expect(200);
    await agent
      .post("/api/cases/case-4/payments")
      .send({
        amount: 100,
        date: day(),
        reference: "not-allowed",
        key: "document-payment",
      })
      .expect(409);
  }));

test("follow-ups can be completed and reopened with one event per actual change", () =>
  fixture(async (agent) => {
    const task = (
      await agent
        .post("/api/tasks")
        .send({ caseId: "case-1", title: "Call buyer", dueDate: day() })
        .expect(201)
    ).body;
    await agent.patch(`/api/tasks/${task.id}`).send({ done: true }).expect(200);
    const before = (await agent.get("/api/bootstrap")).body.events.length;
    await agent.patch(`/api/tasks/${task.id}`).send({ done: true }).expect(200);
    assert.equal(
      (await agent.get("/api/bootstrap")).body.events.length,
      before,
    );
    const reopened = await agent
      .patch(`/api/tasks/${task.id}`)
      .send({ done: false })
      .expect(200);
    assert.equal(reopened.body.completedAt, null);
  }));

test("invalid dates, money, IDs and cross-origin writes are rejected", () =>
  fixture(async (agent) => {
    const body = {
      title: "Invoice",
      kind: "payment",
      counterparty: "Cafe",
      amount: 100,
      dueDate: day(),
    };
    await agent
      .post("/api/cases")
      .send({ ...body, dueDate: "2026-02-30" })
      .expect(400);
    await agent
      .post("/api/cases")
      .send({ ...body, amount: -1 })
      .expect(400);
    await agent
      .post("/api/cases")
      .send({ ...body, amount: 1.5 })
      .expect(400);
    await agent
      .post("/api/cases")
      .set("Origin", "https://attacker.example")
      .send(body)
      .expect(403);
    await agent.get("/api/cases/missing").expect(404);
    await agent
      .post("/api/stock")
      .send({
        storeId: "missing",
        sku: "A",
        product: "A",
        category: "Other",
        unit: "packs",
        quantity: 2,
        expiry: day(1),
        batch: "A",
      })
      .expect(404);
  }));

test("role sessions reject anonymous requests and support logout", async () => {
  const directory = mkdtempSync(join(tmpdir(), "claimchain-auth-"));
  const { app, db, simulation } = createApp({ directory });
  const agent = request.agent(app);
  try {
    await agent.get("/api/bootstrap").expect(401);
    await agent
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "wrong" })
      .expect(401);
    await agent
      .post("/api/auth/login")
      .send({ identifier: "admin", password: DEMO_PASSWORD })
      .expect(200);
    await agent.get("/api/bootstrap").expect(200);
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/bootstrap").expect(401);
  } finally {
    simulation.stop();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("recovery operators are limited to assigned cases and stores", async () => {
  const directory = mkdtempSync(join(tmpdir(), "claimchain-operator-"));
  const { app, db, simulation } = createApp({ directory });
  const agent = request.agent(app);
  try {
    await agent
      .post("/api/auth/login")
      .send({ identifier: "operator", password: DEMO_PASSWORD })
      .expect(200);
    const bootstrap = await agent.get("/api/bootstrap").expect(200);
    assert.deepEqual(
      bootstrap.body.cases.map((item: { id: string }) => item.id).sort(),
      ["case-1", "case-2", "case-4"],
    );
    assert.deepEqual(
      bootstrap.body.stores.map((item: { id: string }) => item.id).sort(),
      ["store-1", "store-2"],
    );
    await agent.get("/api/cases/case-1").expect(200);
    await agent.get("/api/cases/case-3").expect(403);
    await agent.post("/api/cases").send({}).expect(403);
    await agent.patch("/api/workspace").send({}).expect(403);
    await agent.get("/api/admin/users").expect(403);
  } finally {
    simulation.stop();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("auditors can inspect and export but cannot mutate records", async () => {
  const directory = mkdtempSync(join(tmpdir(), "claimchain-auditor-"));
  const { app, db, simulation } = createApp({ directory });
  const agent = request.agent(app);
  try {
    await agent
      .post("/api/auth/login")
      .send({ identifier: "auditor", password: DEMO_PASSWORD })
      .expect(200);
    await agent.get("/api/bootstrap").expect(200);
    await agent.get("/api/cases/case-1").expect(200);
    await agent
      .get("/api/cases/case-1/packet")
      .expect(200)
      .expect("Content-Type", /pdf/);
    await agent
      .patch("/api/cases/case-1")
      .send({ summary: "Changed" })
      .expect(403);
    await agent.post("/api/stock").send({}).expect(403);
  } finally {
    simulation.stop();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("provisioned accounts complete verification and password recovery", () =>
  fixture(async (agent) => {
    const created = await agent
      .post("/api/admin/users")
      .send({
        username: "new.operator",
        email: "new.operator@example.com",
        displayName: "New Operator",
        role: "recovery_operator",
        password: "TemporaryPass!2026",
        scopes: { caseIds: ["case-1"], storeIds: ["store-1"] },
      })
      .expect(201);
    assert.equal(created.body.verified, false);
    await agent.post("/api/auth/logout").expect(200);
    await agent
      .post("/api/auth/login")
      .send({ identifier: "new.operator", password: "TemporaryPass!2026" })
      .expect(403);
    const verification = await agent
      .post("/api/auth/verify/send")
      .send({ identifier: "new.operator" })
      .expect(200);
    assert.match(verification.body.developmentCode, /^\d{6}$/);
    await agent
      .post("/api/auth/verify/confirm")
      .send({
        identifier: "new.operator",
        requestId: verification.body.requestId,
        code: verification.body.developmentCode,
      })
      .expect(200);
    await agent
      .post("/api/auth/login")
      .send({ identifier: "new.operator", password: "TemporaryPass!2026" })
      .expect(200);
    await agent.post("/api/auth/logout").expect(200);
    const reset = await agent
      .post("/api/auth/forgot")
      .send({ identifier: "new.operator" })
      .expect(200);
    await agent
      .post("/api/auth/reset")
      .send({
        requestId: reset.body.requestId,
        code: reset.body.developmentCode,
        password: "ReplacementPass!2026",
      })
      .expect(200);
    await agent
      .post("/api/auth/login")
      .send({ identifier: "new.operator", password: "ReplacementPass!2026" })
      .expect(200);
  }));

test("an empty workspace can add stores and stock without seeded data", () =>
  fixture(async (agent) => {
    const first = (
      await agent
        .post("/api/stores")
        .send({ name: "First Store", locality: "Bengaluru" })
        .expect(201)
    ).body;
    const second = (
      await agent
        .post("/api/stores")
        .send({ name: "Second Store", locality: "Mysuru" })
        .expect(201)
    ).body;
    await agent
      .post("/api/stores")
      .send({ name: "First Store", locality: "Bengaluru" })
      .expect(409);
    const lot = (
      await agent
        .post("/api/stock")
        .send({
          storeId: first.id,
          sku: "SKU-1",
          product: "Rice",
          category: "Staples",
          unit: "bags",
          quantity: 10,
          expiry: day(30),
          batch: "B-1",
        })
        .expect(201)
    ).body;
    await agent
      .post("/api/transfers")
      .send({ lotId: lot.id, destination: second.id, quantity: 5 })
      .expect(201);
    const s = (await agent.get("/api/bootstrap")).body;
    assert.equal(s.stores.length, 2);
    assert.equal(s.lots[0].reserved, 5);
    assert.equal(s.workspace.sample, false);
  }, false));

test("workspace details persist into prepared correspondence and export", () =>
  fixture(async (agent) => {
    await agent
      .patch("/api/workspace")
      .send({
        name: "Independent Store",
        owner: "Owner Name",
        email: "owner@example.com",
        address: "Bengaluru",
      })
      .expect(200);
    const draft = (
      await agent
        .post("/api/cases/case-1/documents")
        .send({ kind: "reminder" })
        .expect(201)
    ).body;
    assert.match(draft.body, /Independent Store/);
    assert.match(draft.body, /owner@example.com/);
    const exported = await agent.get("/api/export").expect(200);
    assert.equal(exported.body.workspace.name, "Independent Store");
    assert.equal(exported.body.schemaVersion, 1);
  }));
