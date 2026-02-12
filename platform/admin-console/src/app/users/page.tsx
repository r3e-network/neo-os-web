// =============================================================================
// Users Page
// =============================================================================

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useUsers, useSearchUsers } from "@/lib/hooks/useUsers";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { formatDate, truncate } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const { data: allUsersData, isLoading: allUsersLoading } = useUsers(page, PAGE_SIZE);
  const { data: searchData, isLoading: searchLoading } = useSearchUsers(debouncedSearch, 1, PAGE_SIZE);

  const isSearching = debouncedSearch.length > 0;
  const users = isSearching ? searchData?.users : allUsersData?.users;
  const total = isSearching ? (searchData?.total ?? 0) : (allUsersData?.total ?? 0);
  const isLoading = isSearching ? searchLoading : allUsersLoading;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground">Manage platform users</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              type="search"
              placeholder="Search by address or email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {isLoading ? (
            <Spinner />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{truncate(user.id, 12)}</TableCell>
                      <TableCell className="font-mono text-sm">{user.address}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{user.email || "N/A"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(user.created_at)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(user.updated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!isLoading && (!users || users.length === 0) && (
                <div className="text-muted-foreground py-8 text-center">
                  {isSearching ? "No users found matching your search" : "No users registered yet"}
                </div>
              )}

              {/* Pagination */}
              {!isSearching && totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      Previous
                    </Button>
                    <span className="flex items-center px-2 text-sm text-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
