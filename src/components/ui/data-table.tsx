'use client';

import * as React from 'react';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    type ColumnDef,
    type Row,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export type ExtendedColumnDef<TData, TValue = unknown> = ColumnDef<TData, TValue> & {
    loading?: React.ComponentType;
};

interface DataTableProps<TData, TValue> {
    columns: ExtendedColumnDef<TData, TValue>[];
    data: TData[];
    isLoading?: boolean;
    loadingRowCount?: number;
    pageSize?: number;
    page?: number;
    onPageChange?: (page: number) => void;
    hasNextPage?: boolean;
    onRowClick?: (row: Row<TData>) => void;
    emptyMessage?: string;
    className?: string;
}

function LoadingSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn('h-4 bg-muted animate-pulse rounded', className)} />
    );
}

export function DataTable<TData, TValue>({
    columns,
    data,
    isLoading = false,
    loadingRowCount = 5,
    pageSize = 10,
    page = 0,
    onPageChange,
    hasNextPage,
    onRowClick,
    emptyMessage = 'No results.',
    className,
}: DataTableProps<TData, TValue>) {
    const isServerSidePagination = onPageChange !== undefined;

    const table = useReactTable({
        data: isLoading ? (Array(loadingRowCount).fill({}) as TData[]) : data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: isServerSidePagination
            ? undefined
            : getPaginationRowModel(),
        initialState: {
            pagination: { pageSize },
        },
        manualPagination: isServerSidePagination,
    });

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-gray-50">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent border-gray-200">
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className="font-semibold text-xs uppercase tracking-wider"
                                        style={{ width: header.getSize() }}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: loadingRowCount }).map((_, index) => (
                                <TableRow key={`loading-${index}`}>
                                    {columns.map((column, columnIndex) => (
                                        <TableCell
                                            key={`loading-${index}-${columnIndex}`}
                                            style={{ width: column.size }}
                                        >
                                            {column.loading ? (
                                                <column.loading />
                                            ) : (
                                                <LoadingSkeleton className="w-full" />
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    className={cn(
                                        onRowClick && 'cursor-pointer',
                                        'transition-colors'
                                    )}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            style={{ width: cell.column.getSize() }}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {(isServerSidePagination || table.getPageCount() > 1) && (
                <div className="flex items-center justify-between gap-2 px-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            if (isServerSidePagination && onPageChange) {
                                onPageChange(page - 1);
                            } else {
                                table.previousPage();
                            }
                        }}
                        disabled={isServerSidePagination ? page === 0 : !table.getCanPreviousPage()}
                        className="h-8 w-8 p-0"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {isLoading ? (
                        <LoadingSkeleton className="h-4 w-20" />
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            {isServerSidePagination
                                ? `Page ${page + 1}`
                                : `Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`}
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            if (isServerSidePagination && onPageChange) {
                                onPageChange(page + 1);
                            } else {
                                table.nextPage();
                            }
                        }}
                        disabled={
                            isServerSidePagination
                                ? hasNextPage === false
                                : !table.getCanNextPage()
                        }
                        className="h-8 w-8 p-0"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
