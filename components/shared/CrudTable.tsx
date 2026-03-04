"use client";

/**
 * Genel amaçlı CRUD tablo bileşeni.
 * Companies ve Regions sayfalarında yeniden kullanılır.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string; // responsive: "hidden sm:table-cell" vb.
}

interface Props<T extends { id: number }> {
  title: string;
  createLabel?: string;
  columns: Column<T>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onPageChange: (p: number) => void;
  onDelete: (id: number) => Promise<void>;
  renderForm: (opts: { item: T | null; onSuccess: () => void }) => React.ReactNode;
  getEditData?: (item: T) => Promise<T>;
}

export function CrudTable<T extends { id: number }>({
  title,
  createLabel = "Yeni",
  columns,
  rows,
  total,
  page,
  pageSize,
  loading,
  search,
  onSearchChange,
  onPageChange,
  onDelete,
  renderForm,
  getEditData,
}: Props<T>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<T | null>(null);
  const totalPages = Math.ceil(total / pageSize);

  async function openEdit(item: T) {
    const data = getEditData ? await getEditData(item) : item;
    setEditItem(data);
    setDialogOpen(true);
  }

  function openCreate() {
    setEditItem(null);
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    await onDelete(id);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Ara..."
            className="pl-9"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {createLabel}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={String(col.key)} className={col.className}>{col.header}</TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  Yükleniyor...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  Kayıt bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((col) => (
                    <TableCell key={String(col.key)} className={col.className}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key as string] ?? "—")}
                    </TableCell>
                  ))}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(row.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Toplam {total} kayıt</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
              Önceki
            </Button>
            <span className="flex items-center px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
              Sonraki
            </Button>
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-full max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? `${title} Düzenle` : `Yeni ${title}`}</DialogTitle>
          </DialogHeader>
          {renderForm({
            item: editItem,
            onSuccess: () => setDialogOpen(false),
          })}
        </DialogContent>
      </Dialog>
    </div>
  );
}
