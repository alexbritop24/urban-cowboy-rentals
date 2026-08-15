import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ts from "typescript";

const adapterUrl = new URL(
  "../../src/domain/adapters/supabaseRentalAgreementRepository.ts",
  import.meta.url
);

const loadAdapterModule = async () => {
  const source = await readFile(adapterUrl, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: adapterUrl.pathname,
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
};

const agreementRow = ({
  id,
  requestId = "request-1",
  status,
  lockedAt = null,
  createdAt,
}) => ({
  id,
  rental_request_id: requestId,
  agreement_number: `AGREEMENT-${id}`,
  status,
  locked_at: lockedAt,
  created_at: createdAt,
  updated_at: createdAt,
  clause_snapshot: [],
});

class FakeQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.filters = [];
  }

  select() {
    return this;
  }

  eq(field, value) {
    this.filters.push([field, value]);
    return this;
  }

  matchingRows() {
    return this.client.rows[this.table].filter((row) =>
      this.filters.every(([field, value]) => row[field] === value)
    );
  }

  maybeSingle() {
    this.client.maybeSingleCalls.push({
      table: this.table,
      filters: [...this.filters],
    });
    const rows = this.matchingRows();
    return Promise.resolve({
      data: rows.length === 1 ? rows[0] : null,
      error: rows.length > 1 ? new Error("Multiple rows") : null,
    });
  }

  order() {
    return Promise.resolve({ data: this.matchingRows(), error: null });
  }

  then(resolve, reject) {
    return Promise.resolve({ data: this.matchingRows(), error: null }).then(
      resolve,
      reject
    );
  }
}

class FakeSupabaseClient {
  constructor(agreements) {
    this.rows = {
      rental_agreements: agreements,
      agreement_items: [],
    };
    this.maybeSingleCalls = [];
  }

  from(table) {
    return new FakeQuery(this, table);
  }
}

test("request-level Agreement lookup behavior is canonical and direct ID lookup remains stable", async () => {
  const { createSupabaseRentalAgreementRepository } = await loadAdapterModule();

  const scenarios = [
    {
      name: "locked ready over drafts",
      rows: [
        agreementRow({
          id: "draft-newer",
          status: "draft",
          createdAt: "2026-08-14T12:00:00Z",
        }),
        agreementRow({
          id: "ready-locked",
          status: "ready",
          lockedAt: "2026-08-13T12:00:00Z",
          createdAt: "2026-08-13T11:00:00Z",
        }),
      ],
      expectedId: "ready-locked",
    },
    {
      name: "active non-draft over drafts",
      rows: [
        agreementRow({
          id: "draft-newer",
          status: "draft",
          createdAt: "2026-08-14T12:00:00Z",
        }),
        agreementRow({
          id: "sent-active",
          status: "sent",
          createdAt: "2026-08-12T12:00:00Z",
        }),
      ],
      expectedId: "sent-active",
    },
    {
      name: "newest draft fallback",
      rows: [
        agreementRow({
          id: "draft-old",
          status: "draft",
          createdAt: "2026-08-12T12:00:00Z",
        }),
        agreementRow({
          id: "draft-new",
          status: "draft",
          createdAt: "2026-08-14T12:00:00Z",
        }),
      ],
      expectedId: "draft-new",
    },
    {
      name: "stable ID final tie-breaker",
      rows: [
        agreementRow({
          id: "20000000-0000-4000-8000-000000000101",
          status: "draft",
          createdAt: "2026-08-14T12:00:00Z",
        }),
        agreementRow({
          id: "20000000-0000-4000-8000-000000000102",
          status: "draft",
          createdAt: "2026-08-14T12:00:00Z",
        }),
      ],
      expectedId: "20000000-0000-4000-8000-000000000102",
    },
  ];

  for (const scenario of scenarios) {
    const client = new FakeSupabaseClient(scenario.rows);
    const repository = createSupabaseRentalAgreementRepository(client);
    const aggregate = await repository.findByRentalRequestId("request-1");
    assert.equal(aggregate?.agreement.id, scenario.expectedId, scenario.name);
    assert.equal(client.maybeSingleCalls.length, 0, scenario.name);
  }

  const emptyClient = new FakeSupabaseClient([]);
  assert.equal(
    await createSupabaseRentalAgreementRepository(
      emptyClient
    ).findByRentalRequestId("request-1"),
    null
  );

  const directRows = [
    agreementRow({
      id: "ready-locked",
      status: "ready",
      lockedAt: "2026-08-13T12:00:00Z",
      createdAt: "2026-08-13T11:00:00Z",
    }),
    agreementRow({
      id: "direct-draft",
      status: "draft",
      createdAt: "2026-08-12T12:00:00Z",
    }),
  ];
  const directClient = new FakeSupabaseClient(directRows);
  const directAggregate = await createSupabaseRentalAgreementRepository(
    directClient
  ).findById("direct-draft");

  assert.equal(directAggregate?.agreement.id, "direct-draft");
  assert.deepEqual(directClient.maybeSingleCalls, [
    {
      table: "rental_agreements",
      filters: [["id", "direct-draft"]],
    },
  ]);
});
