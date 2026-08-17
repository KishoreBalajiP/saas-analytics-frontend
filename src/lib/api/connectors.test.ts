import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "./client";

// Mock the client module
vi.mock("./client", () => {
  const actual = vi.importActual<typeof client>("./client");
  return {
    ...actual,
    request: vi.fn(),
    requestPaged: vi.fn(),
  };
});

const mockedRequest = vi.mocked(client.request);
const mockedRequestPaged = vi.mocked(client.requestPaged);

import * as connectorsApi from "./connectors";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("connectorsApi", () => {
  describe("listTypes()", () => {
    it("calls GET /connectors/types", async () => {
      const types = [
        {
          type: "csv",
          displayName: "CSV Import",
          description: "Upload CSV",
          capabilities: ["validate", "preview", "ingest"],
        },
      ];
      mockedRequest.mockResolvedValue(types);

      const result = await connectorsApi.listTypes();

      expect(result).toEqual(types);
      expect(mockedRequest).toHaveBeenCalledWith("/connectors/types");
    });
  });

  describe("list()", () => {
    it("calls GET /connectors with query params", async () => {
      mockedRequestPaged.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 25, total: 0, pages: 0 },
      });

      await connectorsApi.list({ page: 2, limit: 10, type: "csv", search: "test" });

      expect(mockedRequestPaged).toHaveBeenCalledWith("/connectors", {
        query: { page: 2, limit: 10, type: "csv", search: "test" },
      });
    });

    it("calls with empty query by default", async () => {
      mockedRequestPaged.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 25, total: 0, pages: 1 },
      });

      await connectorsApi.list();

      expect(mockedRequestPaged).toHaveBeenCalledWith("/connectors", { query: {} });
    });
  });

  describe("get()", () => {
    it("calls GET /connectors/:connectorId", async () => {
      const connector = { _id: "abc123", type: "csv", name: "Test CSV", status: "active" };
      mockedRequest.mockResolvedValue(connector);

      const result = await connectorsApi.get("abc123");

      expect(result).toEqual(connector);
      expect(mockedRequest).toHaveBeenCalledWith("/connectors/abc123");
    });
  });

  describe("create()", () => {
    it("calls POST /connectors with CSV config body", async () => {
      const body = {
        type: "csv" as const,
        name: "My CSV",
        config: { delimiter: ",", hasHeader: true },
      };
      const created = { _id: "new1", ...body, status: "active" };
      mockedRequest.mockResolvedValue(created);

      const result = await connectorsApi.create(body);

      expect(result).toEqual(created);
      expect(mockedRequest).toHaveBeenCalledWith("/connectors", {
        method: "POST",
        body,
      });
    });

    it("sends fieldMapping when provided", async () => {
      const body = {
        type: "xlsx" as const,
        name: "Sales Data",
        config: { hasHeader: true, sheet: "Sheet1" },
        fieldMapping: { col_a: "revenue", col_b: "date" },
      };
      mockedRequest.mockResolvedValue({ _id: "new2", ...body, status: "active" });

      await connectorsApi.create(body);

      expect(mockedRequest).toHaveBeenCalledWith("/connectors", {
        method: "POST",
        body,
      });
    });

    it("sends MongoDB config with uri, database, collection", async () => {
      const body = {
        type: "mongodb" as const,
        name: "Mongo Source",
        config: {
          uri: "mongodb://user:pass@host:27017",
          database: "mydb",
          collection: "events",
        },
      };
      mockedRequest.mockResolvedValue({ _id: "new3", ...body, status: "active" });

      await connectorsApi.create(body);

      const callBody = mockedRequest.mock.calls[0]?.[1]?.body as Record<string, unknown>;
      expect(callBody["type"]).toBe("mongodb");
      const config = callBody["config"] as Record<string, unknown>;
      expect(config["uri"]).toBe("mongodb://user:pass@host:27017");
      expect(config["database"]).toBe("mydb");
      expect(config["collection"]).toBe("events");
    });

    it("sends webhook config with signingSecret", async () => {
      const body = {
        type: "webhook" as const,
        name: "Stripe Webhook",
        config: {
          signingSecret: "whsec_abcdef1234567890",
          toleranceSeconds: 300,
          requireTimestamp: true,
        },
      };
      mockedRequest.mockResolvedValue({ _id: "new4", ...body, status: "active" });

      await connectorsApi.create(body);

      const callBody = mockedRequest.mock.calls[0]?.[1]?.body as Record<string, unknown>;
      expect(callBody["type"]).toBe("webhook");
      const config = callBody["config"] as Record<string, unknown>;
      expect(config["signingSecret"]).toBe("whsec_abcdef1234567890");
      expect(config["toleranceSeconds"]).toBe(300);
      expect(config["requireTimestamp"]).toBe(true);
    });
  });

  describe("update()", () => {
    it("calls PATCH /connectors/:connectorId", async () => {
      const updated = { _id: "abc123", name: "Updated Name", status: "paused" };
      mockedRequest.mockResolvedValue(updated);

      const result = await connectorsApi.update("abc123", {
        name: "Updated Name",
        status: "paused",
      });

      expect(result).toEqual(updated);
      expect(mockedRequest).toHaveBeenCalledWith("/connectors/abc123", {
        method: "PATCH",
        body: { name: "Updated Name", status: "paused" },
      });
    });

    it("sends config updates", async () => {
      mockedRequest.mockResolvedValue({ _id: "abc123" });

      await connectorsApi.update("abc123", { config: { delimiter: ";" } });

      expect(mockedRequest).toHaveBeenCalledWith("/connectors/abc123", {
        method: "PATCH",
        body: { config: { delimiter: ";" } },
      });
    });
  });

  describe("remove()", () => {
    it("calls DELETE /connectors/:connectorId", async () => {
      mockedRequest.mockResolvedValue(undefined);

      await connectorsApi.remove("abc123");

      expect(mockedRequest).toHaveBeenCalledWith("/connectors/abc123", {
        method: "DELETE",
      });
    });
  });

  describe("validate()", () => {
    it("calls POST /connectors/:connectorId/validate", async () => {
      const response = { valid: true };
      mockedRequest.mockResolvedValue(response);

      const result = await connectorsApi.validate("abc123");

      expect(result).toEqual(response);
      expect(mockedRequest).toHaveBeenCalledWith("/connectors/abc123/validate", {
        method: "POST",
      });
    });

    it("returns validation errors on failure", async () => {
      const response = { valid: false, errors: ["Missing required field"] };
      mockedRequest.mockResolvedValue(response);

      const result = await connectorsApi.validate("abc123");

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(["Missing required field"]);
    });
  });

  describe("listRows()", () => {
    it("calls GET /connectors/:connectorId/rows with pagination", async () => {
      const rows = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ];
      const meta = { page: 1, limit: 25, total: 50, pages: 2 };
      mockedRequestPaged.mockResolvedValue({ data: rows, meta });

      const result = await connectorsApi.listRows("abc123", { page: 1, limit: 25 });

      expect(result.data).toEqual(rows);
      expect(result.meta.total).toBe(50);
      expect(mockedRequestPaged).toHaveBeenCalledWith("/connectors/abc123/rows", {
        query: { page: 1, limit: 25 },
      });
    });

    it("passes empty query by default", async () => {
      mockedRequestPaged.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 0, total: 0, pages: 0 },
      });

      await connectorsApi.listRows("abc123");

      expect(mockedRequestPaged).toHaveBeenCalledWith("/connectors/abc123/rows", { query: {} });
    });
  });

  describe("previewFile()", () => {
    it("calls POST /connectors/:connectorId/preview with FormData", async () => {
      const previewResult = {
        fields: ["name", "age"],
        sample: [{ name: "Alice", age: 30 }],
        meta: { delimiter: "," },
      };
      mockedRequest.mockResolvedValue(previewResult);

      const file = new File(["name,age\nAlice,30"], "data.csv", { type: "text/csv" });
      const result = await connectorsApi.previewFile("abc123", file);

      expect(result).toEqual(previewResult);
      expect(mockedRequest).toHaveBeenCalledTimes(1);
      const [path, opts] = mockedRequest.mock.calls[0]!;
      expect(path).toBe("/connectors/abc123/preview");
      expect(opts?.method).toBe("POST");
      expect(opts?.formData).toBeInstanceOf(FormData);
      // Verify file was appended to FormData
      const formData = opts?.formData as FormData;
      expect(formData.get("file")).toBe(file);
    });
  });

  describe("syncFile()", () => {
    it("calls POST /connectors/:connectorId/sync with FormData", async () => {
      const syncResult = { accepted: true, jobType: "file_sync", filename: "data.csv" };
      mockedRequest.mockResolvedValue(syncResult);

      const file = new File(["name,age\nAlice,30"], "data.csv", { type: "text/csv" });
      const result = await connectorsApi.syncFile("abc123", file);

      expect(result).toEqual(syncResult);
      expect(mockedRequest).toHaveBeenCalledTimes(1);
      const [path, opts] = mockedRequest.mock.calls[0]!;
      expect(path).toBe("/connectors/abc123/sync");
      expect(opts?.method).toBe("POST");
      const formData = opts?.formData as FormData;
      expect(formData.get("file")).toBe(file);
    });
  });

  describe("syncMongoDB()", () => {
    it("calls POST /connectors/:connectorId/sync-mongodb with empty body", async () => {
      const syncResult = { accepted: true, jobType: "mongodb_sync" };
      mockedRequest.mockResolvedValue(syncResult);

      const result = await connectorsApi.syncMongoDB("abc123");

      expect(result).toEqual(syncResult);
      expect(mockedRequest).toHaveBeenCalledWith("/connectors/abc123/sync-mongodb", {
        method: "POST",
        body: {},
      });
    });
  });
});
