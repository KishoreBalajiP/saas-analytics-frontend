import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DataTable, type Column } from "./DataTable";

const columns: Column<Record<string, unknown>>[] = [
  { key: "name", header: "Name" },
  { key: "age", header: "Age" },
  { key: "status", header: "Status" },
];

const rows: Record<string, unknown>[] = [
  { name: "Alice", age: 30, status: "active" },
  { name: "Bob", age: 25, status: "paused" },
  { name: "Charlie", age: 35, status: "active" },
];

describe("DataTable", () => {
  describe("loading state", () => {
    it("renders skeleton loading bars", () => {
      const { container } = render(<DataTable columns={columns} data={[]} loading />);

      const busyDiv = container.querySelector('[aria-busy="true"]');
      expect(busyDiv).toBeTruthy();
      expect(busyDiv?.getAttribute("aria-live")).toBe("polite");
    });
  });

  describe("empty state", () => {
    it("renders default empty message", () => {
      render(<DataTable columns={columns} data={[]} />);
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("renders custom empty message", () => {
      render(<DataTable columns={columns} data={[]} emptyMessage="Nothing here" />);
      expect(screen.getByText("Nothing here")).toBeInTheDocument();
    });
  });

  describe("data rendering", () => {
    it("renders column headers", () => {
      render(<DataTable columns={columns} data={rows} />);
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Age")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
    });

    it("renders data cells", () => {
      render(<DataTable columns={columns} data={rows} />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });

    it("formats numbers with locale formatting", () => {
      render(<DataTable columns={columns} data={rows} />);
      // 30 should be rendered as a number (may be formatted with locale separators)
      expect(screen.getByText("30")).toBeInTheDocument();
      expect(screen.getByText("25")).toBeInTheDocument();
    });

    it("renders null/undefined values as em dash", () => {
      const data = [{ name: "Test", age: null, status: undefined }];
      render(<DataTable columns={columns} data={data} />);
      // Em dash character for null/undefined
      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });

    it("renders boolean values", () => {
      const cols: Column<Record<string, unknown>>[] = [{ key: "active", header: "Active" }];
      const data = [{ active: true }];
      render(<DataTable columns={cols} data={data} />);
      expect(screen.getByText("true")).toBeInTheDocument();
    });

    it("renders objects as JSON", () => {
      const cols: Column<Record<string, unknown>>[] = [{ key: "meta", header: "Meta" }];
      const data = [{ meta: { foo: "bar" } }];
      render(<DataTable columns={cols} data={data} />);
      expect(screen.getByText('{"foo":"bar"}')).toBeInTheDocument();
    });

    it("uses custom render function when provided", () => {
      const cols: Column<Record<string, unknown>>[] = [
        {
          key: "name",
          header: "Name",
          render: (row) => <strong>{String(row["name"])}</strong>,
        },
      ];
      render(<DataTable columns={cols} data={[{ name: "Alice" }]} />);
      const strong = screen.getByText("Alice");
      expect(strong.tagName).toBe("STRONG");
    });
  });

  describe("custom getRowId", () => {
    it("uses getRowId for React keys when provided", () => {
      const data = [
        { _id: "abc", name: "A" },
        { _id: "def", name: "B" },
      ];
      const { container } = render(
        <DataTable columns={columns} data={data} getRowId={(row) => String(row["_id"])} />,
      );

      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(2);
    });

    it("uses index as key when getRowId is not provided", () => {
      const data = [{ name: "A" }, { name: "B" }];
      const { container } = render(<DataTable columns={columns} data={data} />);

      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(2);
    });
  });

  describe("pagination", () => {
    const meta = { page: 2, limit: 10, total: 25, pages: 3 };

    it("renders pagination info text", () => {
      render(<DataTable columns={columns} data={rows} meta={meta} onPageChange={vi.fn()} />);
      expect(screen.getByText(/Showing/)).toBeInTheDocument();
      expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    });

    it("renders prev and next buttons", () => {
      render(<DataTable columns={columns} data={rows} meta={meta} onPageChange={vi.fn()} />);
      expect(screen.getByText("Prev")).toBeInTheDocument();
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    it("calls onPageChange with page - 1 when Prev is clicked", async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      render(<DataTable columns={columns} data={rows} meta={meta} onPageChange={onPageChange} />);

      await user.click(screen.getByText("Prev"));
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it("calls onPageChange with page + 1 when Next is clicked", async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      render(<DataTable columns={columns} data={rows} meta={meta} onPageChange={onPageChange} />);

      await user.click(screen.getByText("Next"));
      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it("disables Prev button on first page", () => {
      render(
        <DataTable
          columns={columns}
          data={rows}
          meta={{ page: 1, limit: 10, total: 25, pages: 3 }}
          onPageChange={vi.fn()}
        />,
      );
      expect(screen.getByText("Prev")).toBeDisabled();
    });

    it("disables Next button on last page", () => {
      render(
        <DataTable
          columns={columns}
          data={rows}
          meta={{ page: 3, limit: 10, total: 25, pages: 3 }}
          onPageChange={vi.fn()}
        />,
      );
      expect(screen.getByText("Next")).toBeDisabled();
    });

    it("hides pagination when only one page", () => {
      render(
        <DataTable
          columns={columns}
          data={rows}
          meta={{ page: 1, limit: 10, total: 5, pages: 1 }}
          onPageChange={vi.fn()}
        />,
      );
      expect(screen.queryByText("Prev")).not.toBeInTheDocument();
      expect(screen.queryByText("Next")).not.toBeInTheDocument();
    });

    it("hides pagination when no onPageChange", () => {
      render(<DataTable columns={columns} data={rows} meta={meta} />);
      expect(screen.queryByText("Prev")).not.toBeInTheDocument();
    });
  });

  describe("column className", () => {
    it("applies className to table header and cells", () => {
      const cols: Column<Record<string, unknown>>[] = [
        { key: "x", header: "X", className: "text-right" },
      ];
      const { container } = render(<DataTable columns={cols} data={[{ x: "1" }]} />);

      const th = container.querySelector("th.text-right");
      expect(th).toBeTruthy();
    });
  });
});
